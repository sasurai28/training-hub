import Anthropic from '@anthropic-ai/sdk'
import type { AppData, Menu } from '../types'
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
export function buildCoachContext(data: Pick<AppData, 'logs' | 'settings'>, today: string): string {
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
// AIによる日付ベースのメニュー生成（構造化出力）
// ─────────────────────────────────────────────────────────────

/** AIが返す計画の1項目（menuId/note は無い場合 空文字。ピックルは含めない） */
export interface PlanItem {
  type: 'gym' | 'run' | 'rest'
  menuId: string
  note: string
}

/** 1日分の計画 */
export interface PlanDay {
  date: string
  items: PlanItem[]
}

export interface DatePlan {
  summary: string
  menus: Menu[]
  days: PlanDay[]
}

const MENUS_SCHEMA = {
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
}

const PLAN_ITEM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['type', 'menuId', 'note'],
  properties: {
    type: { type: 'string', enum: ['gym', 'run', 'rest'] },
    menuId: { type: 'string', description: 'gym のとき menus の id。それ以外は空文字' },
    note: { type: 'string', description: 'ラン等の指示メモ。短く（例: 8km ジョグ キロ6:00）。無ければ空文字' },
  },
}

const DATE_PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'menus', 'days'],
  properties: {
    summary: { type: 'string', description: '組み方の根拠を2〜4文で。目標衝突時は優先順位も' },
    menus: MENUS_SCHEMA,
    days: {
      type: 'array',
      description: '指定された全日付について、その日のトレーニング',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['date', 'items'],
        properties: {
          date: { type: 'string', description: 'YYYY-MM-DD（指定範囲内の日付）' },
          items: { type: 'array', items: PLAN_ITEM_SCHEMA },
        },
      },
    },
  },
}

const DATE_PLAN_SYSTEM = `あなたは「トレーニングハブ」の専属コーチです。ユーザーの過去の記録・目標・カレンダー上の制約をもとに、指定された期間（開始日からの各日付）の具体的なトレーニング計画をJSONで返します。

前提と方針:
- 目標は2026年9月の旅行までのマッチョ化（筋肥大・適度な減量）と、2027年大阪マラソンでのサブ3の両立。
- **強制休息日（forcedRest）が指定された日は一切トレーニングを入れない**（items は空配列、または type=rest のみ）。旅行・ジム不可などで体を動かせない前提。
- **ピックルボール参加日が指定された日**は、その日にジムの高強度や高負荷ランを重ねない（ピックル自体はアプリ側で表示するので items には含めない。軽いジョグや休養に留めるか、状況により軽め調整）。
- 筋トレは過去の記録の前回値から無理のない漸進性過負荷（重量 or レップを少しずつ）。ジムは週2〜3回、A/B（プッシュ/プル＋脚）で回す。menus の id は既存に合わせ 'menu-a' / 'menu-b'（必要なら追加可）。gym 日は menuId を必ず該当 menus の id にする。
- **「利用できるジムの設備」が与えられた場合は、その設備でできる種目だけを使う**（無い器具を前提にした種目は出さない）。種目名は設備リストの名称に合わせる。
- ランはサブ3に向けて、週単位で「ジョグ」「ポイント練（インターバル/テンポ）」「ロング走」を配分。各ラン日の note に距離と目安ペース/種類を短く（例: '8km ジョグ キロ6:00' / 'インターバル 1km×5 R200m' / 'ロング 18km キロ5:40'）。
- 筋トレ翌日に高強度ランを重ねすぎない、連続高負荷を避ける、週1〜2日は休養。回復バランスを最優先。
- **days には指定範囲の全日付を漏れなく含める**。休養日も type=rest で明示。値は記録に基づき創作しすぎない。`

/** Claude に開始日からの日付ベース計画を設計させ、構造化された DatePlan を返す */
export async function generateDatePlan(apiKey: string, context: string): Promise<DatePlan> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
  // 構造化出力（output_config.format）。SDKの型に無い場合があるため any で渡す。
  const params = {
    model: AI_MODEL,
    max_tokens: 6000,
    system: DATE_PLAN_SYSTEM,
    messages: [
      {
        role: 'user',
        content: `過去の記録・目標・カレンダー制約・計画する日付の一覧です。各日付の筋トレ・ランの計画を組んでください。\n\n${context}`,
      },
    ],
    output_config: { format: { type: 'json_schema', schema: DATE_PLAN_SCHEMA } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
  const res = await client.messages.create(params)
  const block = res.content.find((b) => b.type === 'text')
  if (!block || block.type !== 'text') throw new Error('プランを取得できませんでした')
  return JSON.parse(block.text) as DatePlan
}
