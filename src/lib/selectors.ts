import type { DayLog, GymSet } from '../types'
import { addDays, parseISO, startOfWeek, weekDates } from './dates'

type Logs = Record<string, DayLog>

export interface WeekSummary {
  gymCount: number
  runKm: number
  proteinDays: number
  pickleballCount: number
}

export function weekSummary(logs: Logs, anyDateInWeek: string): WeekSummary {
  const dates = weekDates(anyDateInWeek)
  let gymCount = 0
  let runKm = 0
  let proteinDays = 0
  let pickleballCount = 0
  for (const d of dates) {
    const log = logs[d]
    if (!log) continue
    if (log.gym && log.gym.exercises.some((e) => e.sets.length > 0)) gymCount++
    if (log.run) runKm += log.run.km
    if (log.proteinOk) proteinDays++
    if (log.pickleball?.done) pickleballCount++
  }
  return { gymCount, runKm: Math.round(runKm * 10) / 10, proteinDays, pickleballCount }
}

/** 指定日より前で、その種目を最後にやった時のセット内容を返す */
export function lastGymPerformance(
  logs: Logs,
  exerciseName: string,
  beforeDate: string,
): GymSet[] | null {
  const before = parseISO(beforeDate).getTime()
  const candidates = Object.values(logs)
    .filter((l) => parseISO(l.date).getTime() < before && l.gym)
    .sort((a, b) => (a.date < b.date ? 1 : -1)) // 新しい順
  for (const l of candidates) {
    const ex = l.gym!.exercises.find((e) => e.name === exerciseName && e.sets.length > 0)
    if (ex) return ex.sets
  }
  return null
}

/** ペース文字列 'm'ss"/km' を返す */
export function paceLabel(km: number, durationSec: number): string {
  if (km <= 0 || durationSec <= 0) return '--'
  const secPerKm = durationSec / km
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}'${s.toString().padStart(2, '0')}"/km`
}

export function formatDuration(durationSec: number): string {
  const m = Math.floor(durationSec / 60)
  const s = durationSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** 直近 N 日（指定日より前）の体重平均 */
export function weightAvgBefore(logs: Logs, beforeDate: string, days = 7): number | null {
  const before = parseISO(beforeDate).getTime()
  const cutoff = before - days * 86400000
  const values: number[] = []
  for (const l of Object.values(logs)) {
    const t = parseISO(l.date).getTime()
    if (l.weightKg != null && t < before && t >= cutoff) values.push(l.weightKg)
  }
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

/** 直近 N 日の体重推移（記録がある日のみ・古い順） */
export function weightSeries(logs: Logs, endDate: string, days: number): { date: string; kg: number }[] {
  const start = addDays(endDate, -(days - 1))
  return Object.values(logs)
    .filter((l) => l.weightKg != null && l.date >= start && l.date <= endDate)
    .map((l) => ({ date: l.date, kg: l.weightKg! }))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
}

/** 直近 N 週の週間走行距離（今週を含む・古い順） */
export function weeklyRunSeries(logs: Logs, endDate: string, weeks: number): { weekStart: string; km: number }[] {
  const out: { weekStart: string; km: number }[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = startOfWeek(addDays(endDate, -7 * i))
    let km = 0
    for (let d = 0; d < 7; d++) {
      const log = logs[addDays(ws, d)]
      if (log?.run) km += log.run.km
    }
    out.push({ weekStart: ws, km: Math.round(km * 10) / 10 })
  }
  return out
}

/** 記録に登場する種目名（新しい順・重複なし） */
export function exerciseNames(logs: Logs): string[] {
  const seen = new Set<string>()
  const dates = Object.values(logs).sort((a, b) => (a.date < b.date ? 1 : -1))
  for (const l of dates) {
    for (const ex of l.gym?.exercises ?? []) {
      if (ex.sets.length > 0) seen.add(ex.name)
    }
  }
  return [...seen]
}

/** 種目のトップ重量推移（日ごとの最大重量・古い順） */
export function exerciseTopSeries(logs: Logs, name: string): { date: string; kg: number }[] {
  const out: { date: string; kg: number }[] = []
  for (const l of Object.values(logs)) {
    const ex = l.gym?.exercises.find((e) => e.name === name && e.sets.length > 0)
    if (!ex) continue
    out.push({ date: l.date, kg: Math.max(...ex.sets.map((s) => s.weightKg)) })
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : 1))
}

/** 何かしら記録した連続日数（today から遡る） */
export function streakDays(logs: Logs, today: string): number {
  let n = 0
  let d = today
  const hasRecord = (l: DayLog | undefined) =>
    !!l && (!!l.run || !!l.pickleball?.done || l.weightKg != null || l.proteinOk != null ||
      (!!l.gym && l.gym.exercises.some((e) => e.sets.length > 0)))
  // 今日が未記録でも昨日から数える
  if (!hasRecord(logs[d])) d = addDays(d, -1)
  while (hasRecord(logs[d])) { n++; d = addDays(d, -1) }
  return n
}

/** いちばん新しい体重記録 */
export function latestWeight(logs: Logs, beforeOrOn: string): { date: string; kg: number } | null {
  const limit = parseISO(beforeOrOn).getTime()
  let best: { date: string; kg: number } | null = null
  for (const l of Object.values(logs)) {
    if (l.weightKg == null) continue
    const t = parseISO(l.date).getTime()
    if (t > limit) continue
    if (!best || l.date > best.date) best = { date: l.date, kg: l.weightKg }
  }
  return best
}
