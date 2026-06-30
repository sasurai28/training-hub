import Anthropic from '@anthropic-ai/sdk'
import type { AppData } from '../types'
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
