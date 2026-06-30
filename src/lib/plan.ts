import type { Menu, ScheduleItem, Weekday } from '../types'
import { WEEKDAY_ORDER } from './dates'
import type { WeeklyPlan } from './ai'

export interface ReconciledPlan {
  menus: Menu[]
  weeklySchedule: Record<Weekday, ScheduleItem[]>
}

function clampInt(n: unknown, min: number, max: number, def: number): number {
  const v = Math.round(Number(n))
  if (!Number.isFinite(v)) return def
  return Math.min(max, Math.max(min, v))
}

const VALID_TYPES = new Set(['gym', 'run', 'pickleball', 'rest'])

/**
 * AIプランをアプリのデータ形に整え、安全に適用できる形にする。
 * - 数値はクランプ、不正項目は除外
 * - ピックルボールは AI 出力を無視し、現在の予定をそのまま維持
 * - gym の menuId は生成された menus の id に解決（無ければ先頭に）
 */
export function reconcilePlan(
  plan: WeeklyPlan,
  current: Record<Weekday, ScheduleItem[]>,
): ReconciledPlan {
  const menus: Menu[] = (plan.menus ?? [])
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

  const menuIds = new Set(menus.map((m) => m.id))
  const fallbackMenuId = menus[0]?.id

  const weeklySchedule = {} as Record<Weekday, ScheduleItem[]>
  for (const wd of WEEKDAY_ORDER) {
    const planItems = (plan.weeklySchedule?.[wd] ?? []).filter((it) => it && VALID_TYPES.has(it.type))
    const aiItems: ScheduleItem[] = []
    for (const it of planItems) {
      if (it.type === 'pickleball') continue // ピックルは現状維持するので無視
      if (it.type === 'rest') continue // rest は後で必要なときだけ補う
      const item: ScheduleItem = { type: it.type }
      if (it.type === 'gym') {
        item.menuId = it.menuId && menuIds.has(it.menuId) ? it.menuId : fallbackMenuId
      }
      if (it.note && String(it.note).trim()) item.note = String(it.note).trim()
      aiItems.push(item)
    }
    // 現在のピックルボールを維持
    const pickle = (current[wd] ?? []).filter((it) => it.type === 'pickleball')
    let merged = [...aiItems, ...pickle]
    if (merged.length === 0) merged = [{ type: 'rest' }]
    weeklySchedule[wd] = merged
  }

  return { menus, weeklySchedule }
}
