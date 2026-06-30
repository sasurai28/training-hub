import Anthropic from '@anthropic-ai/sdk'
import type { AppData, Menu, Weekday } from '../types'
import { addDays, daysUntil, formatShort } from './dates'
import { formatDuration, latestWeight, paceLabel, weekSummary, weightAvgBefore } from './selectors'

/** トレーニングハブAIコーチで使うモデル */
export const AI_MODEL = 'claude-opus-4-8'

const SYSTEM_PROMPT = `あなたは個人向けトレーニングアプリ「トレーニングハブ」の専属コーチです。
ユーザーは2026年9月の旅行までのマッチョ化（筋肥大・減量）と、2027年大阪マラソンでのサブ3（フルマラソン3時間切り）を並行して目指しています。
渡される直近の記録（筋トレ・ラン・ピックルボール・体重・タンパク質）と週次目標・イベントを読み、日本語で簡潔に実用的なアドバイスをしてください。

出力ルール:
- 200〜350字程度。Markdownの見出しは使わず、短い段落か箇条書き（・）で。
- まず「今週ここが良い」を1つ具体的な数値で褒める。
- 次に「次に効くこと」を1〜2点、根拠（前回比・目標との差・残り日数）とセットで提案する。
- 筋肥大とサブ3は両立が難しい局面があるため、衝突する週は優先順位を明示する。
- 数値は記録から引用し、ないデータは創作しない。励ましつつ、断定しすぎない。`

/** Claude に渡す、記録の要約コンテキストを組み立てる */
export function buildCoachContext(data: AppData, today: string): string {
  const { logs, settings } = data
  const lines: string[] = []
  lines.push(`# 基準日: ${today}`)

  // 週次サマリーと目標
  const wk = weekSummary(logs, today)
  const g = settings.goals
  lines.push('## 今週の達成 / 目標')
  lines.push(`- ジム: ${wk.gymCount} / ${g.gymPerWeek} 回`)
  lines.push(`- ラン: ${wk.runKm} / ${g.runKmPerWeek} km`)
  lines.push(`- タンパク質達成日: ${wk.proteinDays} / ${g.proteinDaysPerWeek} 日`)
  lines.push(`- ピックルボール: ${wk.pickleballCount} 回`)

  // 体重
  const latest = latestWeight(logs, today)
  if (latest) {
    const avg7 = weightAvgBefore(logs, addDays(today, 1), 7)
    const avgStr = avg7 != null ? `（直近7日平均 ${avg7.toFixed(1)}kg）` : ''
    const target = g.targetWeightKg ? `／目標 ${g.targetWeightKg}kg` : ''
    lines.push('## 体重')
    lines.push(`- 最新: ${latest.kg}kg (${formatShort(latest.date)})${avgStr}${target}`)
  }

  // イベント・カウントダウン
  const upcoming = settings.events
    .map((e) => ({ ...e, days: daysUntil(e.date, today) }))
    .filter((e) => e.days >= 0)
    .sort((a, b) => a.days - b.days)
  if (upcoming.length > 0) {
    lines.push('## 近いイベント')
    for (const e of upcoming.slice(0, 3)) lines.push(`- ${e.name}: あと${e.days}日`)
  }

  // 直近14日のログ
  lines.push('## 直近14日の記録（新しい順）')
  for (let i = 0; i < 14; i++) {
    const d = addDays(today, -i)
    const log = logs[d]
    if (!log) continue
    const parts: string[] = []
    if (log.gym && log.gym.exercises.some((e) => e.sets.length > 0)) {
      const ex = log.gym.exercises
        .filter((e) => e.sets.length > 0)
        .map((e) => {
          const top = e.sets.reduce((a, b) => (b.weightKg > a.weightKg ? b : a), e.sets[0])
          return `${e.name} ${top.weightKg}kg×${top.reps}（${e.sets.length}セット）`
        })
        .join(', ')
      parts.push(`筋トレ[${ex}]`)
    }
    if (log.run) {
      parts.push(
        `ラン ${log.run.km}km ${formatDuration(log.run.durationSec)} ${paceLabel(log.run.km, log.run.durationSec)}` +
          (log.run.memo ? `（${log.run.memo}）` : ''),
      )
    }
    if (log.pickleball?.done) parts.push('ピックルボール' + (log.pickleball.memo ? `（${log.pickleball.memo}）` : ''))
    if (log.weightKg != null) parts.push(`体重${log.weightKg}kg`)
    if (log.proteinOk) parts.push('タンパク質OK')
    if (parts.length > 0) lines.push(`- ${formatShort(d)}: ${parts.join(' / ')}`)
  }

  return lines.join('\n')
}

/**
 * Claude にアドバイスを依頼し、ストリーミングで本文を返す。
 * onDelta で逐次テキストを受け取る。中断は AbortSignal で。
 * 個人端末でユーザー自身のAPIキーを使う前提のためブラウザ直叩きを許可している。
 */
export async function streamAdvice(
  apiKey: string,
  context: string,
  onDelta: (text: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
  const stream = client.messages.stream(
    {
      model: AI_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `次が私の最近のトレーニング記録です。今週のコーチングをお願いします。\n\n${context}`,
        },
      ],
    },
    { signal },
  )
  stream.on('text', onDelta)
  await stream.finalMessage()
}

// ─────────────────────────────────────────────────────────────
// AIによるメニュー生成（構造化出力）
// ─────────────────────────────────────────────────────────────

/** AIが返す週間プランの1項目（menuId/note は無い場合 空文字） */
export interface PlanScheduleItem {
  type: 'gym' | 'run' | 'pickleball' | 'rest'
  menuId: string
  note: string
}

export interface WeeklyPlan {
  summary: string
  menus: Menu[]
  weeklySchedule: Record<Weekday, PlanScheduleItem[]>
}

const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

const SCHEDULE_ITEM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['type', 'menuId', 'note'],
  properties: {
    type: { type: 'string', enum: ['gym', 'run', 'pickleball', 'rest'] },
    menuId: { type: 'string', description: 'gym のとき menus の id。それ以外は空文字' },
    note: { type: 'string', description: 'ラン等の指示メモ。短く（例: 8km ジョグ キロ6:00）。無ければ空文字' },
  },
}

const PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'menus', 'weeklySchedule'],
  properties: {
    summary: { type: 'string', description: '組み方の根拠を2〜3文で' },
    menus: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'name', 'exercises'],
        properties: {
          id: { type: 'string', description: "既存に合わせるなら 'menu-a'/'menu-b'" },
          name: { type: 'string' },
          exercises: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['name', 'targetSets', 'targetRepsMin', 'targetRepsMax'],
              properties: {
                name: { type: 'string' },
                targetSets: { type: 'integer' },
                targetRepsMin: { type: 'integer' },
                targetRepsMax: { type: 'integer' },
              },
            },
          },
        },
      },
    },
    weeklySchedule: {
      type: 'object',
      additionalProperties: false,
      required: WEEKDAYS as unknown as string[],
      properties: Object.fromEntries(
        WEEKDAYS.map((d) => [d, { type: 'array', items: SCHEDULE_ITEM_SCHEMA }]),
      ),
    },
  },
}

const PLAN_SYSTEM = `あなたは「トレーニングハブ」の専属コーチです。ユーザーの直近の記録・目標・現在の予定をもとに、来週以降の週間メニューを設計し、指定のJSONで返します。

前提:
- 目標は2026年9月の旅行までのマッチョ化（筋肥大・適度な減量）と、2027年大阪マラソンでのサブ3の両立。
- **ピックルボールの曜日は確定済みで変更不可**。スケジュールにピックルボールは含めず（アプリ側で現状の曜日を自動で維持する）、その曜日は負荷の重複に配慮すること。
- 筋トレは記録の前回値から無理のない漸進性過負荷（重量 or レップを少しずつ）。ジムは週2〜3回、A/B（プッシュ/プル＋脚）で回す想定。menus の id は既存に合わせ 'menu-a' / 'menu-b' を使う（必要なら追加可）。
- ランはサブ3に向けて、週内に「ジョグ（有酸素ベース）」「ポイント練（インターバル/テンポ）」「ロング走」を配分。各ラン日の note に距離と目安ペース/種類を短く入れる（例: '8km ジョグ キロ6:00' / 'インターバル 1km×5 R200m' / 'ロング 18km キロ5:40'）。
- 筋トレ翌日に高強度ランを重ねすぎない、ピックルの日と高負荷を被せすぎない等、週全体の回復バランスを取る。衝突する週は summary で優先順位を述べる。
- gym 日は menuId を必ず該当 menus の id にする。rest 日は type=rest のみ。値は記録に基づき、創作しすぎない。`

/** Claude に来週以降のメニューを設計させ、構造化された WeeklyPlan を返す */
export async function generatePlan(apiKey: string, context: string): Promise<WeeklyPlan> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
  // 構造化出力（output_config.format）。SDKの型に無い場合があるため any で渡す。
  const params = {
    model: AI_MODEL,
    max_tokens: 2500,
    system: PLAN_SYSTEM,
    messages: [
      {
        role: 'user',
        content: `現在の状況と直近の記録です。これを踏まえて来週以降の週間メニュー（筋トレとラン）を組んでください。\n\n${context}`,
      },
    ],
    output_config: { format: { type: 'json_schema', schema: PLAN_SCHEMA } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
  const res = await client.messages.create(params)
  const block = res.content.find((b) => b.type === 'text')
  if (!block || block.type !== 'text') throw new Error('プランを取得できませんでした')
  return JSON.parse(block.text) as WeeklyPlan
}
