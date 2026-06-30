import type { Weekday } from '../types'

const JP_WEEK = ['日', '月', '火', '水', '木', '金', '土'] as const
// JS getDay(): 0=日 .. 6=土
const WEEKDAY_BY_GETDAY: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

export const WEEKDAY_ORDER: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
export const WEEKDAY_LABEL: Record<Weekday, string> = {
  mon: '月', tue: '火', wed: '水', thu: '木', fri: '金', sat: '土', sun: '日',
}

export function pad2(n: number): string {
  return n < 10 ? '0' + n : '' + n
}

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayISO(): string {
  return toISO(new Date())
}

export function weekdayKey(iso: string): Weekday {
  return WEEKDAY_BY_GETDAY[parseISO(iso).getDay()]
}

export function jpWeekday(iso: string): string {
  return JP_WEEK[parseISO(iso).getDay()]
}

/** 'M月D日(曜)' */
export function formatJP(iso: string): string {
  const d = parseISO(iso)
  return `${d.getMonth() + 1}月${d.getDate()}日(${jpWeekday(iso)})`
}

/** 'M/D(曜)' 短縮形 */
export function formatShort(iso: string): string {
  const d = parseISO(iso)
  return `${d.getMonth() + 1}/${d.getDate()}(${jpWeekday(iso)})`
}

/** その週の月曜（週は月〜日とする）の ISO */
export function startOfWeek(iso: string): string {
  const d = parseISO(iso)
  const day = d.getDay() // 0=日
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return toISO(d)
}

/** 月〜日の7日分の ISO 配列 */
export function weekDates(iso: string): string[] {
  const start = parseISO(startOfWeek(iso))
  const out: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    out.push(toISO(d))
  }
  return out
}

export function addDays(iso: string, n: number): string {
  const d = parseISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

/** start から count 日分の ISO 日付配列（start を含む） */
export function dateRange(start: string, count: number): string[] {
  const out: string[] = []
  for (let i = 0; i < count; i++) out.push(addDays(start, i))
  return out
}

export function addMonths(iso: string, n: number): string {
  const d = parseISO(iso)
  d.setMonth(d.getMonth() + n)
  return toISO(d)
}

/** today から iso までの残り日数（未来が正） */
export function daysUntil(iso: string, from: string = todayISO()): number {
  const a = parseISO(from)
  const b = parseISO(iso)
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

/** その月のカレンダーグリッド（月曜始まり、6週=42日固定）を返す */
export function monthGrid(year: number, month0: number): string[] {
  const first = new Date(year, month0, 1)
  const startMon = parseISO(startOfWeek(toISO(first)))
  const out: string[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(startMon)
    d.setDate(startMon.getDate() + i)
    out.push(toISO(d))
  }
  return out
}

export function ymLabel(year: number, month0: number): string {
  return `${year}年${month0 + 1}月`
}
