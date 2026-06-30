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
  /** その活動の指示メモ（例: ラン「8km ジョグ キロ6:00」）。AIメニュー生成でも使う */
  note?: string
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
  /** 利用できるジムの設備（自由記述）。AIメニュー生成でこの範囲の種目に限定する */
  gymEquipment: string
}

/** カレンダー上でユーザーが日付ごとに設定する制約 */
export interface DayConstraint {
  /** その日ピックルボールに参加（仕事都合で毎週固定ではない） */
  pickleball?: boolean
  /** 旅行・ジム不可など、その日はトレーニング不可の強制休息 */
  forcedRest?: boolean
}

/** localStorage に分割保存する塊をまとめた型 */
export interface AppData {
  logs: Record<string, DayLog> // date -> DayLog（実績）
  menus: Menu[]
  settings: Settings
  /** date -> その日の計画（AI生成・手編集可。gym/run/rest） */
  plan: Record<string, ScheduleItem[]>
  /** date -> ユーザー設定の制約（ピックル参加・強制休息） */
  constraints: Record<string, DayConstraint>
}

/** JSON エクスポート/インポートの外形 */
export interface ExportBundle {
  app: 'training-hub'
  version: number
  exportedAt: string
  logs: Record<string, DayLog>
  menus: Menu[]
  settings: Settings
  plan?: Record<string, ScheduleItem[]>
  constraints?: Record<string, DayConstraint>
}
