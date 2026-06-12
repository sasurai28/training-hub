// ─────────────────────────────────────────────────────────────
// トレーニングハブ データモデル
// ─────────────────────────────────────────────────────────────

export type ActivityType = 'gym' | 'run' | 'pickleball'

export interface GymSet {
  weightKg: number
  reps: number
}

export interface GymExerciseLog {
  name: string
  sets: GymSet[]
}

export interface GymLog {
  menuId: string | null
  exercises: GymExerciseLog[]
}

export type RunKind = 'jog' | 'workout' | 'race'

export interface RunLog {
  km: number
  durationSec: number
  kind: RunKind
  memo?: string
}

export interface PickleballLog {
  done: boolean
  memo?: string
}

/** 1日分の記録。date をキーに保持する */
export interface DayLog {
  date: string // 'YYYY-MM-DD'
  gym?: GymLog
  run?: RunLog
  pickleball?: PickleballLog
  weightKg?: number
  proteinOk?: boolean
  photoId?: string // Phase 2（IndexedDB のキー）
}

export interface MenuExercise {
  name: string
  targetSets: number
  targetRepsMin: number
  targetRepsMax: number
}

export interface Menu {
  id: string
  name: string // 例: 'A日（プッシュ）'
  exercises: MenuExercise[]
}

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export interface ScheduleItem {
  type: ActivityType | 'rest'
  menuId?: string
}

export interface Goals {
  gymPerWeek: number
  runKmPerWeek: number
  proteinDaysPerWeek: number
  targetWeightKg?: number
}

export interface AppEvent {
  name: string
  date: string // 'YYYY-MM-DD'
}

export type Theme = 'dark' | 'light'

export interface Settings {
  weeklySchedule: Record<Weekday, ScheduleItem[]>
  goals: Goals
  events: AppEvent[]
  theme: Theme
}

/** localStorage に分割保存する3つの塊をまとめた型 */
export interface AppData {
  logs: Record<string, DayLog> // date -> DayLog
  menus: Menu[]
  settings: Settings
}

/** JSON エクスポート/インポートの外形 */
export interface ExportBundle {
  app: 'training-hub'
  version: number
  exportedAt: string
  logs: Record<string, DayLog>
  menus: Menu[]
  settings: Settings
}
