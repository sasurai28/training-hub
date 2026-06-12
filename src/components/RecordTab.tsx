import { useState } from 'react'
import { useStore } from '../store'
import { formatJP, todayISO } from '../lib/dates'
import { paceLabel } from '../lib/selectors'
import type { RecorderKind } from './Recorder'

export default function RecordTab({ openRecorder }: { openRecorder: (k: RecorderKind, date?: string) => void }) {
  const { getDay } = useStore()
  const [date, setDate] = useState(todayISO())
  const day = getDay(date)

  const gymSets = day.gym?.exercises.reduce((n, e) => n + e.sets.length, 0) ?? 0

  return (
    <div className="screen">
      <h1 className="screen-title">記録</h1>

      <div className="field">
        <label>日付</label>
        <div className="row">
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value || todayISO())} />
          <button className="btn btn-sm" onClick={() => setDate(todayISO())}>今日</button>
        </div>
        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{formatJP(date)} の記録</div>
      </div>

      <div className="quick-grid">
        <button className="quick" onClick={() => openRecorder('gym', date)}><span className="ico">🏋️</span>ジム</button>
        <button className="quick" onClick={() => openRecorder('run', date)}><span className="ico">🏃</span>ラン</button>
        <button className="quick" onClick={() => openRecorder('pickleball', date)}><span className="ico">🎾</span>ピックル</button>
        <button className="quick" onClick={() => openRecorder('weight', date)}><span className="ico">⚖️</span>体重・PFC</button>
      </div>

      <div className="section-title">この日の記録</div>
      <div className="card">
        {!day.gym && !day.run && !day.pickleball && day.weightKg == null && day.proteinOk == null ? (
          <div className="empty">まだ記録がありません</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {gymSets > 0 && (
              <RecRow ico="🏋️" onClick={() => openRecorder('gym', date)}>
                筋トレ {day.gym!.exercises.filter((e) => e.sets.length > 0).length}種目 / {gymSets}セット
              </RecRow>
            )}
            {day.run && (
              <RecRow ico="🏃" onClick={() => openRecorder('run', date)}>
                {day.run.km}km・{paceLabel(day.run.km, day.run.durationSec)}
              </RecRow>
            )}
            {day.pickleball?.done && (
              <RecRow ico="🎾" onClick={() => openRecorder('pickleball', date)}>
                ピックルボール{day.pickleball.memo ? `（${day.pickleball.memo}）` : ''}
              </RecRow>
            )}
            {day.weightKg != null && (
              <RecRow ico="⚖️" onClick={() => openRecorder('weight', date)}>体重 {day.weightKg}kg</RecRow>
            )}
            {day.proteinOk != null && (
              <RecRow ico="💪" onClick={() => openRecorder('weight', date)}>タンパク質 {day.proteinOk ? '達成' : '未達'}</RecRow>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function RecRow({ ico, children, onClick }: { ico: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <button className="row" style={{ background: 'transparent', border: 0, color: 'var(--text)', textAlign: 'left', padding: '4px 0', font: 'inherit' }} onClick={onClick}>
      <span style={{ fontSize: 20 }}>{ico}</span>
      <span style={{ fontWeight: 700 }}>{children}</span>
      <span className="spacer" />
      <span className="muted">編集 ›</span>
    </button>
  )
}
