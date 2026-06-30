import type { DayConstraint, Menu, ScheduleItem } from '../types'
import type { DatePlan } from './ai'

export interface ReconciledDatePlan {
  menus: Menu[]
  /** date -> その日の計画（gym/run/rest） */
  days: Record<string, ScheduleItem[]>
}

function clampInt(n: unknown, min: number, max: number, def: number): number {
  const v = Math.round(Number(n))
  if (!Number.isFinite(v)) return def
  return Math.min(max, Math.max(min, v))
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const VALID_TYPES = new Set(['gym', 'run', 'rest'])

function sanitizeMenus(menus: DatePlan['menus']): Menu[] {
  return (menus ?? [])
    .filter((m) => m && m.id && m.name)
    .map((m) => ({
      id: String(m.id),
      name: String(m.name),
      exercises: (m.exercises ?? [])
        .filter((e) => e && e.name)
        .map((e) => {
          const min = clampInt(e.targetRepsMin, 1, 100, 8)
          const max = clampInt(e.targetRepsMax, min, 100, Math.max(min, 12))
          return {
            name: String(e.name),
            targetSets: clampInt(e.targetSets, 1, 20, 3),
            targetRepsMin: min,
            targetRepsMax: max,
          }
        }),
    }))
}

/**
 * AIの日付プランをアプリのデータ形に整える。
 * - 数値クランプ・不正項目除外・gym の menuId 解決
 * - 強制休息日（forcedRest）はトレーニングを入れず rest にする
 * - allowedDates 内の日付のみ採用（範囲外・重複・不正日付は無視）
 */
export function reconcileDatePlan(
  plan: DatePlan,
  constraints: Record<string, DayConstraint>,
  allowedDates: string[],
): ReconciledDatePlan {
  const menus = sanitizeMenus(plan.menus)
  const menuIds = new Set(menus.map((m) => m.id))
  const fallbackMenuId = menus[0]?.id
  const allowed = new Set(allowedDates)

  // AIの日付→items を引きやすく
  const byDate = new Map<string, ScheduleItem[]>()
  for (const day of plan.days ?? []) {
    if (!day || !DATE_RE.test(day.date) || !allowed.has(day.date)) continue
    if (byDate.has(day.date)) continue // 重複日付は最初を採用
    const items: ScheduleItem[] = []
    for (const it of day.items ?? []) {
      if (!it || !VALID_TYPES.has(it.type) || it.type === 'rest') continue
      const item: ScheduleItem = { type: it.type }
      if (it.type === 'gym') item.menuId = it.menuId && menuIds.has(it.menuId) ? it.menuId : fallbackMenuId
      if (it.note && String(it.note).trim()) item.note = String(it.note).trim()
      items.push(item)
    }
    byDate.set(day.date, items)
  }

  const days: Record<string, ScheduleItem[]> = {}
  for (const date of allowedDates) {
    // 強制休息日はトレーニングを入れない
    if (constraints[date]?.forcedRest) {
      days[date] = [{ type: 'rest' }]
      continue
    }
    const items = byDate.get(date) ?? []
    days[date] = items.length ? items : [{ type: 'rest' }]
  }

  return { menus, days }
}
