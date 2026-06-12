import type { AppData, DayLog, ExportBundle, Menu, Settings } from '../types'
import { defaultMenus, defaultSettings } from './defaults'

const K_LOGS = 'th:logs'
const K_MENUS = 'th:menus'
const K_SETTINGS = 'th:settings'
const EXPORT_VERSION = 1

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
  return { logs, menus, settings }
}

export const saveLogs = (logs: Record<string, DayLog>) => write(K_LOGS, logs)
export const saveMenus = (menus: Menu[]) => write(K_MENUS, menus)
export const saveSettings = (settings: Settings) => write(K_SETTINGS, settings)

export function exportBundle(data: AppData, exportedAt: string): ExportBundle {
  return {
    app: 'training-hub',
    version: EXPORT_VERSION,
    exportedAt,
    logs: data.logs,
    menus: data.menus,
    settings: data.settings,
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
    },
  }
}
