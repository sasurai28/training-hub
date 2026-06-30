import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { AppData, DayLog, Menu, Settings } from './types'
import {
  exportBundle,
  loadAiKey,
  loadAppData,
  mergeLogs as mergeLogsData,
  saveAiKey,
  saveLogs,
  saveMenus,
  saveSettings,
} from './lib/storage'
import { toISO } from './lib/dates'

interface Store {
  logs: Record<string, DayLog>
  menus: Menu[]
  settings: Settings
  /** その日の DayLog を取得（無ければ空の枠を返す） */
  getDay: (date: string) => DayLog
  /** その日の DayLog を更新して即保存 */
  updateDay: (date: string, mutate: (prev: DayLog) => DayLog) => void
  setMenus: (menus: Menu[]) => void
  setSettings: (settings: Settings | ((prev: Settings) => Settings)) => void
  replaceAll: (data: AppData) => void
  /** 取り込んだ記録を既存 logs に日付単位でマージして保存。マージ後の日数を返す */
  mergeLogs: (incoming: Record<string, DayLog>) => number
  exportJSON: () => string
  /** AIコーチ用 APIキー（localStorage のみ・エクスポート対象外） */
  aiKey: string
  setAiKey: (key: string) => void
}

const StoreContext = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const initial = useRef<AppData>(loadAppData())
  const [logs, setLogs] = useState<Record<string, DayLog>>(initial.current.logs)
  const [menus, setMenusState] = useState<Menu[]>(initial.current.menus)
  const [settings, setSettingsState] = useState<Settings>(initial.current.settings)
  const [aiKey, setAiKeyState] = useState<string>(loadAiKey())

  // テーマを <html data-theme> に反映
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', settings.theme === 'dark' ? '#0e0f13' : '#f6f7f9')
  }, [settings.theme])

  const getDay = useCallback(
    (date: string): DayLog => logs[date] ?? { date },
    [logs],
  )

  const updateDay = useCallback((date: string, mutate: (prev: DayLog) => DayLog) => {
    setLogs((prev) => {
      const current = prev[date] ?? { date }
      const next = mutate(current)
      const updated = { ...prev, [date]: { ...next, date } }
      saveLogs(updated)
      return updated
    })
  }, [])

  const setMenus = useCallback((next: Menu[]) => {
    setMenusState(next)
    saveMenus(next)
  }, [])

  const setSettings = useCallback((next: Settings | ((prev: Settings) => Settings)) => {
    setSettingsState((prev) => {
      const value = typeof next === 'function' ? (next as (p: Settings) => Settings)(prev) : next
      saveSettings(value)
      return value
    })
  }, [])

  const replaceAll = useCallback((data: AppData) => {
    setLogs(data.logs)
    setMenusState(data.menus)
    setSettingsState(data.settings)
    saveLogs(data.logs)
    saveMenus(data.menus)
    saveSettings(data.settings)
  }, [])

  const mergeLogs = useCallback((incoming: Record<string, DayLog>) => {
    setLogs((prev) => {
      const merged = mergeLogsData(prev, incoming)
      saveLogs(merged)
      return merged
    })
    return Object.keys(incoming).length
  }, [])

  const setAiKey = useCallback((key: string) => {
    setAiKeyState(key)
    saveAiKey(key)
  }, [])

  const exportJSON = useCallback(() => {
    const bundle = exportBundle({ logs, menus, settings }, toISO(new Date()))
    return JSON.stringify(bundle, null, 2)
  }, [logs, menus, settings])

  const value = useMemo<Store>(
    () => ({ logs, menus, settings, getDay, updateDay, setMenus, setSettings, replaceAll, mergeLogs, exportJSON, aiKey, setAiKey }),
    [logs, menus, settings, getDay, updateDay, setMenus, setSettings, replaceAll, mergeLogs, exportJSON, aiKey, setAiKey],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): Store {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore は StoreProvider の内側で使うこと')
  return ctx
}
