import { useStore } from '../store'
import { daysUntil, formatJP, todayISO, weekdayKey } from '../lib/dates'
import { weekSummary } from '../lib/selectors'
import { ProgressBar } from './ui'
import Coach from './Coach'
import Planner from './Planner'
import type { RecorderKind } from './Recorder'
import type { Tab } from './TabBar'
import type { ActivityType } from '../types'

const ACT_LABEL: Record<ActivityType | 'rest', string> = {
  gym: '🏋️ ジム', run: '🏃 ラン', pickleball: '🎾 ピックル', rest: '休養',
}
const ACT_CLASS: Record<ActivityType | 'rest', string> = {
  gym: 'gym', run: 'run', pickleball: 'pickle', rest: 'rest',
}

export default function Home({ openRecorder, goTab }: { openRecorder: (k: RecorderKind, date?: string) => void; goTab: (t: Tab) => void }) {
  const { logs, menus, settings, plan, constraints } = useStore()
  const today = todayISO()
  const todayCon = constraints[today]
  // 日付ベースの計画があれば優先。無ければ週テンプレートにフォールバック
  const schedule = plan[today] ?? settings.weeklySchedule[weekdayKey(today)] ?? []
  const summary = weekSummary(logs, today)
  const goals = settings.goals

  const upcoming = settings.events
    .map((e) => ({ ...e, days: daysUntil(e.date, today) }))
    .filter((e) => e.days >= 0)
    .sort((a, b) => a.days - b.days)
  const next = upcoming[0]

  const gymItem = schedule.find((s) => s.type === 'gym')
  const gymMenu = gymItem ? menus.find((m) => m.id === gymItem.menuId) : null

  return (
    <div className="screen">
      <div className="today-head">
        <h1 className="screen-title" style={{ margin: 0 }}>今日</h1>
        <span className="today-date">{formatJP(today)}</span>
      </div>

      {/* 今日のメニュー */}
      <div className="card" style={{ marginTop: 12 }}>
        <div className="stepper-label">今日のメニュー</div>
        {todayCon?.forcedRest ? (
          <div style={{ fontWeight: 800, fontSize: 18 }}>🛌 強制休息日</div>
        ) : schedule.length === 0 || schedule.every((s) => s.type === 'rest') ? (
          <div style={{ fontWeight: 800, fontSize: 18 }}>休養日 🛌{todayCon?.pickleball ? ' ＋ 🎾 ピックル' : ''}</div>
        ) : (
          <div>
            <div>
              {schedule.filter((s) => s.type !== 'rest').map((s, i) => (
                <div key={i} className="menu-chip">
                  <span className={`pill ${ACT_CLASS[s.type]}`} style={{ padding: '2px 6px' }}>{ACT_LABEL[s.type]}</span>
                  {s.type === 'gym' && gymMenu ? gymMenu.name : ''}
                  {s.note ? <span className="muted"> — {s.note}</span> : ''}
                </div>
              ))}
              {todayCon?.pickleball && (
                <div className="menu-chip">
                  <span className={`pill ${ACT_CLASS.pickleball}`} style={{ padding: '2px 6px' }}>{ACT_LABEL.pickleball}</span>
                </div>
              )}
            </div>
            {gymMenu && (
              <div style={{ marginTop: 12 }}>
                {gymMenu.exercises.map((e) => (
                  <div className="exercise-target" key={e.name}>
                    <span>{e.name}</span>
                    <span className="t">{e.targetSets}×{e.targetRepsMin}〜{e.targetRepsMax}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* イベントカウントダウン */}
      {next && (
        <div className="card">
          <div className="countdown-main">
            <span className="days">{next.days}</span>
            <span className="unit">日後</span>
            <span className="spacer" />
            <span className="name">{next.name}</span>
          </div>
          {upcoming.length > 1 && (
            <div className="countdown-list">
              {upcoming.slice(1).map((e) => (
                <div className="row" key={e.name}>
                  <span>{e.name}</span>
                  <span className="spacer" />
                  <span>あと{e.days}日</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* AIコーチ */}
      <Coach goTab={goTab} />

      {/* AIメニュー作成 */}
      <Planner />

      {/* クイック記録 */}
      <div className="section-title">クイック記録</div>
      <div className="quick-grid">
        <button className="quick" onClick={() => openRecorder('gym', today)}><span className="ico">🏋️</span>ジム</button>
        <button className="quick" onClick={() => openRecorder('run', today)}><span className="ico">🏃</span>ラン</button>
        <button className="quick" onClick={() => openRecorder('pickleball', today)}><span className="ico">🎾</span>ピックル</button>
        <button className="quick" onClick={() => openRecorder('weight', today)}><span className="ico">⚖️</span>体重・PFC</button>
      </div>

      {/* 今週の達成 */}
      <div className="section-title">今週の達成</div>
      <div className="card">
        <ProgressBar label="ジム" value={`${summary.gymCount} / ${goals.gymPerWeek}回`} ratio={summary.gymCount / goals.gymPerWeek} color="gym" />
        <ProgressBar label="ラン" value={`${summary.runKm} / ${goals.runKmPerWeek}km`} ratio={summary.runKm / goals.runKmPerWeek} color="run" />
        <ProgressBar label="タンパク質" value={`${summary.proteinDays} / ${goals.proteinDaysPerWeek}日`} ratio={summary.proteinDays / goals.proteinDaysPerWeek} color="protein" />
        <div className="prev-hint" style={{ marginTop: 12 }}>ピックルボール {summary.pickleballCount}回</div>
      </div>

      <button className="btn btn-ghost btn-block" style={{ marginTop: 16 }} onClick={() => goTab('calendar')}>
        🗓️ カレンダーで振り返る
      </button>
    </div>
  )
}
