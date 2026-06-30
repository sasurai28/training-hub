import type { Menu, Settings } from '../types'

export const MENU_A_ID = 'menu-a'
export const MENU_B_ID = 'menu-b'

export const defaultMenus = (): Menu[] => [
  {
    id: MENU_A_ID,
    name: 'A日（プッシュ）',
    exercises: [
      { name: 'ベンチプレス', targetSets: 3, targetRepsMin: 8, targetRepsMax: 12 },
      { name: 'ショルダープレス', targetSets: 3, targetRepsMin: 8, targetRepsMax: 12 },
      { name: 'サイドレイズ', targetSets: 3, targetRepsMin: 12, targetRepsMax: 15 },
      { name: 'トライセプスプレスダウン', targetSets: 3, targetRepsMin: 10, targetRepsMax: 15 },
    ],
  },
  {
    id: MENU_B_ID,
    name: 'B日（プル）',
    exercises: [
      { name: 'ラットプルダウン', targetSets: 3, targetRepsMin: 8, targetRepsMax: 12 },
      { name: 'シーテッドロウ', targetSets: 3, targetRepsMin: 8, targetRepsMax: 12 },
      { name: 'アームカール', targetSets: 3, targetRepsMin: 10, targetRepsMax: 15 },
      { name: '腹筋（クランチ）', targetSets: 3, targetRepsMin: 15, targetRepsMax: 20 },
    ],
  },
]

export const defaultSettings = (): Settings => ({
  weeklySchedule: {
    mon: [{ type: 'rest' }],
    tue: [{ type: 'gym', menuId: MENU_A_ID }],
    wed: [{ type: 'run' }],
    thu: [{ type: 'pickleball' }],
    fri: [{ type: 'gym', menuId: MENU_B_ID }],
    sat: [{ type: 'run' }],
    sun: [{ type: 'run' }, { type: 'pickleball' }],
  },
  goals: {
    gymPerWeek: 2,
    runKmPerWeek: 25,
    proteinDaysPerWeek: 6,
    targetWeightKg: undefined,
  },
  events: [
    { name: 'ピックルボール市民大会', date: '2026-07-15' },
    { name: 'プール付きコテージ旅行', date: '2026-09-15' },
    { name: '大阪マラソン（日付は確定後に更新）', date: '2027-02-28' },
  ],
  theme: 'dark',
  gymEquipment: DEFAULT_GYM_EQUIPMENT,
  policy: '',
})

/** エニタイムフィットネス 大正千島店のラインナップ（初期値・設定で変更可） */
export const DEFAULT_GYM_EQUIPMENT = `ジム: エニタイムフィットネス 大正千島店
【マシンエリア】チェストプレス / シーテッドレッグプレス / ショルダープレス / レッグエクステンション / ラットプルダウン / レッグカール / シーテッドロー / ヒップアブダクション・アダクション / フライ・リアデルト / 45°バックエクステンション / アブドミナル / レッグレイズ / トーソローテーション / アシストディップ・チン / デクライン・アブドミナルベンチ
【有酸素】トレッドミル / クロストレーナー / パワーミル / リカンベントバイク / アップライトバイク
【フリーウェイト】シーテッドアームカール / パワーラック×2 / リニアレッグプレス / スミスマシン / デュアルアジャスタブルプーリー / アイソラテラルローイング / アジャスタブルベンチ / ダンベル1〜40kg / Tバーロウ / エクササイズバンド
【ファンクショナル】シナジー360T / フラットベンチ / ケトルベル8〜20kg / メディシンボール2〜5kg / バトルロープ / チューブ / ディップスバー
【ストレッチ】バランスボール / ストレッチポール / アブローラー / フォームローラー / プッシュアップバー / ヒップバンド`
