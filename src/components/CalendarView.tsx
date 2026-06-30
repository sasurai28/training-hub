import { useState } from 'react'
import { useStore } from '../store'
import { formatJP, monthGrid, parseISO, todayISO, ymLabel } from '../lib/dates'
import { paceLabel } from '../lib/selectors'
import type { DayLog, ScheduleItem } from '../types'
import type { RecorderKind } from './Recorder'

const DOW = ['月', '火', '水', '木', '金', '土', '日']

const ITEM_LABEL: Record<string, string> = { gym: '🏋️ ジム', run: '🏃 ラン', rest: '休養' }

function logDots(log: DayLog | undefined) {
  if (!log) return [] as string[]
  const out: string[] = []
  if (log.gym && log.gym.exercises.some((e) => e.sets.length > 0)) out.push('gym')
  if (log.run) out.push('run')
  if (log.pickleball?.done) out.push('pickle')
  return out
}

export default function CalendarView({ openRecorder }: { openRecorder: (k: RecorderKind, date?: string) => void }) {
  const { logs, plan, constraints, setDayConstraint } = useStore()
  const today = todayISO()
  const now = parseISO(today)
  const [year, setYear] = useState(now.getFullYear())
  const [month0, setMonth0] = useState(now.getMonth())
  const [selected, setSelected] = useState<string | null>(null)

  const cells = monthGrid(year, month0)
  const weeks: string[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  const shift = (delta: number) => {
    let m = month0 + delta
    let y = year
    if (m < 0) { m = 11; y-- }
    if (m > 11) { m = 0; y++ }
    setMonth0(m)
    setYear(y)
    setSelected(null)
  }

  const sel = selected ? logs[selected] : undefined
  const selPlan: ScheduleItem[] = selected ? plan[selected] ?? [] : []
  const selCon = selected ? constraints[selected] : undefined

  /** セルの表示マーカー。実績があれば実績、無ければ計画＋制約を薄く表示 */
  function cellMarkers(d: string): { dots: string[]; planned: boolean; rest: boolean } {
    const actual = logDots(logs[d])
    if (actual.length) return { dots: actual, planned: false, rest: false }
    const c = constraints[d]
    if (c?.forcedRest) return { dots: [], planned: true, rest: true }
    const items = plan[d] ?? []
    const out: string[] = []
    if (items.some((i) => i.type === 'gym')) out.push('gym')
    if (items.some((i) => i.type === 'run')) out.push('run')
    if (c?.pickleball) out.push('pickle')
    return { dots: out, planned: out.length > 0, rest: false }
  }

  return (
    <div className="screen">
      <h1 className="screen-title">カレンダー</h1>

      <div className="cal-head">
        <span className="ym">{ymLabel(year, month0)}</span>
        <div className="cal-nav">
          <button onClick={() => shift(-1)} aria-label="前の月">‹</button>
          <button onClick={() => { setYear(now.getFullYear()); setMonth0(now.getMonth()); setSelected(null) }} aria-label="今月" style={{ width: 'auto', padding: '0 12px', fontSize: 14 }}>今月</button>
          <button onClick={() => shift(1)} aria-label="次の月">›</button>
        </div>
      </div>

      <div className="cal-grid" style={{ marginBottom: 4 }}>
        {DOW.map((d) => <div className="cal-dow" key={d}>{d}</div>)}
      </div>

      {weeks.map((week, wi) => {
        const weekKm = week.reduce((n, d) => n + (logs[d]?.run?.km ?? 0), 0)
        return (
          <div key={wi}>
            <div className="cal-grid">
              {week.map((d) => {
                const inMonth = parseISO(d).getMonth() === month0
                const { dots, planned, rest } = cellMarkers(d)
                return (
                  <button
                    key={d}
                    className={`cal-cell ${inMonth ? '' : 'out'} ${d === today ? 'today' : ''} ${d === selected ? 'today' : ''}`}
                    onClick={() => setSelected(d)}
                  >
                    <span>{parseISO(d).getDate()}</span>
                    <div className="dots">
                      {rest && <span className="muted" style={{ fontSize: 9, lineHeight: 1 }}>休</span>}
                      {dots.map((c) => <span key={c} className={`dot ${c}`} style={planned ? { opacity: 0.5 } : undefined} />)}
                    </div>
                  </button>
                )
              })}
            </div>
            {weekKm > 0 && (
              <div className="week-km-row"><span className="spacer" /><span>週合計 {Math.round(weekKm * 10) / 10} km</span></div>
            )}
          </div>
        )
      })}

      <div className="cal-legend">
        <span className="item"><span className="dot gym" />ジム</span>
        <span className="item"><span className="dot run" />ラン</span>
        <span className="item"><span className="dot pickle" />ピックル</span>
        <span className="item"><span className="dot gym" style={{ opacity: 0.5 }} />予定</span>
        <span className="item">休 強制休息</span>
      </div>

      {selected && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="row">
            <span style={{ fontWeight: 800 }}>{formatJP(selected)}</span>
            <span className="spacer" />
            <button className="icon-btn" onClick={() => setSelected(null)} aria-label="閉じる">✕</button>
          </div>

          {/* 制約設定（カレンダーでピックル参加・強制休息日を指定） */}
          <div style={{ margin: '10px 0' }}>
            <div className="stepper-label">この日の予定（AIメニューに反映）</div>
            <div className="row" style={{ gap: 8 }}>
              <button
                className={`btn btn-sm ${selCon?.pickleball ? '' : 'btn-ghost'}`}
                onClick={() => setDayConstraint(selected, { pickleball: !selCon?.pickleball })}
              >
                🎾 ピックル参加 {selCon?.pickleball ? 'ON' : 'OFF'}
              </button>
              <button
                className={`btn btn-sm ${selCon?.forcedRest ? '' : 'btn-ghost'}`}
                onClick={() => setDayConstraint(selected, { forcedRest: !selCon?.forcedRest })}
              >
                🛌 強制休息 {selCon?.forcedRest ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>

          {/* 計画（AIが組んだトレーニング） */}
          {(selPlan.length > 0 || selCon?.forcedRest) && (
            <div style={{ margin: '8px 0 12px' }}>
              <div className="stepper-label">計画</div>
              {selCon?.forcedRest ? (
                <div className="muted" style={{ fontSize: 14 }}>🛌 強制休息日（トレーニングなし）</div>
              ) : (
                selPlan.map((it, i) => (
                  <div key={i} style={{ fontSize: 14 }}>
                    {ITEM_LABEL[it.type] ?? it.type}
                    {it.note ? <span className="muted"> — {it.note}</span> : ''}
                  </div>
                ))
              )}
            </div>
          )}

          {/* 実績（記録） */}
          <div className="stepper-label">記録</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '4px 0 14px' }}>
            {!sel || (!sel.gym && !sel.run && !sel.pickleball && sel.weightKg == null && sel.proteinOk == null) ? (
              <div className="muted" style={{ fontSize: 14 }}>記録なし</div>
            ) : (
              <>
                {sel.gym && sel.gym.exercises.some((e) => e.sets.length > 0) && (
                  <div>🏋️ 筋トレ {sel.gym.exercises.reduce((n, e) => n + e.sets.length, 0)}セット</div>
                )}
                {sel.run && <div>🏃 {sel.run.km}km・{paceLabel(sel.run.km, sel.run.durationSec)}</div>}
                {sel.pickleball?.done && <div>🎾 ピックルボール</div>}
                {sel.weightKg != null && <div>⚖️ {sel.weightKg}kg</div>}
                {sel.proteinOk != null && <div>💪 タンパク質 {sel.proteinOk ? '達成' : '未達'}</div>}
              </>
            )}
          </div>

          <div className="quick-grid">
            <button className="btn btn-sm" onClick={() => openRecorder('gym', selected)}>🏋️ ジム</button>
            <button className="btn btn-sm" onClick={() => openRecorder('run', selected)}>🏃 ラン</button>
            <button className="btn btn-sm" onClick={() => openRecorder('pickleball', selected)}>🎾 ピックル</button>
            <button className="btn btn-sm" onClick={() => openRecorder('weight', selected)}>⚖️ 体重</button>
          </div>
        </div>
      )}
    </div>
  )
}
