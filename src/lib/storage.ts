import type { AppData, DayConstraint, DayLog, ExportBundle, Menu, ScheduleItem, Settings } from '../types'
import { defaultMenus, defaultSettings } from './defaults'

const K_LOGS = 'th:logs'
const K_MENUS = 'th:menus'
const K_SETTINGS = 'th:settings'
const K_PLAN = 'th:plan'
const K_CONSTRAINTS = 'th:constraints'
const K_AI_KEY = 'th:aiKey'
const EXPORT_VERSION = 2

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    // ストレージ枯渇など。握りつぶさずコンソールに残す
    console.error('localStorage への保存に失敗:', e)
  }
}

/** 保存済みの設定に新しいキーが無い場合に既定値で補完する */
function mergeSettings(saved: Partial<Settings> | null): Settings {
  const base = defaultSettings()
  if (!saved) return base
  return {
    weeklySchedule: saved.weeklySchedule ?? base.weeklySchedule,
    goals: { ...base.goals, ...(saved.goals ?? {}) },
    events: saved.events ?? base.events,
    theme: saved.theme ?? base.theme,
  }
}

export function loadAppData(): AppData {
  const logs = read<Record<string, DayLog>>(K_LOGS, {})
  const savedMenus = read<Menu[] | null>(K_MENUS, null)
  const menus = savedMenus && savedMenus.length > 0 ? savedMenus : defaultMenus()
  const settings = mergeSettings(read<Partial<Settings> | null>(K_SETTINGS, null))
  const plan = read<Record<string, ScheduleItem[]>>(K_PLAN, {})
  const constraints = read<Record<string, DayConstraint>>(K_CONSTRAINTS, {})
  return { logs, menus, settings, plan, constraints }
}

export const saveLogs = (logs: Record<string, DayLog>) => write(K_LOGS, logs)
export const saveMenus = (menus: Menu[]) => write(K_MENUS, menus)
export const saveSettings = (settings: Settings) => write(K_SETTINGS, settings)
export const savePlan = (plan: Record<string, ScheduleItem[]>) => write(K_PLAN, plan)
export const saveConstraints = (c: Record<string, DayConstraint>) => write(K_CONSTRAINTS, c)

// AIコーチ用 APIキー。意図的に ExportBundle には含めない（バックアップへの鍵漏洩を防ぐ）。
export function loadAiKey(): string {
  try {
    return localStorage.getItem(K_AI_KEY) ?? ''
  } catch {
    return ''
  }
}
export function saveAiKey(key: string): void {
  try {
    if (key) localStorage.setItem(K_AI_KEY, key)
    else localStorage.removeItem(K_AI_KEY)
  } catch (e) {
    console.error('APIキーの保存に失敗:', e)
  }
}

export function exportBundle(data: AppData, exportedAt: string): ExportBundle {
  return {
    app: 'training-hub',
    version: EXPORT_VERSION,
    exportedAt,
    logs: data.logs,
    menus: data.menus,
    settings: data.settings,
    plan: data.plan,
    constraints: data.constraints,
  }
}

export interface ImportResult {
  ok: boolean
  error?: string
  data?: AppData
}

export function parseImport(text: string): ImportResult {
  let obj: unknown
  try {
    obj = JSON.parse(text)
  } catch {
    return { ok: false, error: 'JSON として読み込めませんでした' }
  }
  const b = obj as Partial<ExportBundle>
  if (!b || b.app !== 'training-hub') {
    return { ok: false, error: 'トレーニングハブのバックアップではありません' }
  }
  if (typeof b.logs !== 'object' || !Array.isArray(b.menus) || typeof b.settings !== 'object') {
    return { ok: false, error: 'データの形式が不正です' }
  }
  return {
    ok: true,
    data: {
      logs: (b.logs ?? {}) as Record<string, DayLog>,
      menus: b.menus as Menu[],
      settings: mergeSettings(b.settings as Settings),
      plan: (b.plan ?? {}) as Record<string, ScheduleItem[]>,
      constraints: (b.constraints ?? {}) as Record<string, DayConstraint>,
    },
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export interface LogsImportResult {
  ok: boolean
  error?: string
  /** date -> DayLog（取り込み対象の記録のみ） */
  logs?: Record<string, DayLog>
}

/**
 * 「記録（logs）」だけを取り込むための緩いパーサ。
 * 次の2形式をどちらも受け付ける:
 *   1) ExportBundle 全体（`app:"training-hub"` ラッパー付き）→ その logs を取り出す
 *   2) 日付キーの logs マップ単体（例: `{ "2026-06-24": { ... } }`）
 * メニューや設定は触らず、既存データへのマージに使う想定。
 */
export function parseLogsImport(text: string): LogsImportResult {
  let obj: unknown
  try {
    obj = JSON.parse(text)
  } catch {
    return { ok: false, error: 'JSON として読み込めませんでした' }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { ok: false, error: 'データの形式が不正です' }
  }
  const root = obj as Record<string, unknown>
  // ExportBundle 形式なら logs 部分だけを対象にする
  const source = (root.app === 'training-hub' && root.logs && typeof root.logs === 'object'
    ? root.logs
    : root) as Record<string, unknown>

  const entries = Object.entries(source)
  if (entries.length === 0) {
    return { ok: false, error: '取り込める記録がありません' }
  }
  const logs: Record<string, DayLog> = {}
  for (const [key, value] of entries) {
    if (!DATE_RE.test(key)) {
      return { ok: false, error: `日付キーの形式が不正です（YYYY-MM-DD）: ${key}` }
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { ok: false, error: `記録の形式が不正です: ${key}` }
    }
    // date フィールドはキーで正規化（欠落・不一致を吸収）
    logs[key] = { ...(value as DayLog), date: key }
  }
  return { ok: true, logs }
}

/**
 * 既存 logs に取り込み分を重ねる。日付単位で浅くマージするため、
 * 同じ日に既存の活動（例: ラン）があり取り込み側が別活動（例: ジム）なら両方残る。
 * 同じ活動キーが両方にある場合は取り込み側で上書きする。
 */
export function mergeLogs(
  existing: Record<string, DayLog>,
  incoming: Record<string, DayLog>,
): Record<string, DayLog> {
  const next = { ...existing }
  for (const [date, day] of Object.entries(incoming)) {
    next[date] = { ...(existing[date] ?? { date }), ...day, date }
  }
  return next
}
