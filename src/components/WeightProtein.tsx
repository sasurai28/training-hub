import { useState } from 'react'
import { useStore } from '../store'
import { latestWeight, weightAvgBefore } from '../lib/selectors'
import { Stepper } from './ui'

export default function WeightProtein({ date, onClose }: { date: string; onClose: () => void }) {
  const { getDay, updateDay, logs } = useStore()
  const day = getDay(date)

  const seed = day.weightKg ?? latestWeight(logs, date)?.kg ?? 70
  const [weight, setWeight] = useState(seed)
  const [recordWeight, setRecordWeight] = useState(day.weightKg != null)
  const [proteinOk, setProteinOk] = useState<boolean | null>(day.proteinOk ?? null)

  const avg = weightAvgBefore(logs, date, 7)
  const diff = avg != null ? weight - avg : null

  const save = () => {
    updateDay(date, (prev) => ({
      ...prev,
      weightKg: recordWeight ? weight : undefined,
      proteinOk: proteinOk ?? undefined,
    }))
    onClose()
  }

  return (
    <div>
      <div className="card">
        <div className="row">
          <span style={{ fontWeight: 800 }}>体重を記録</span>
          <span className="spacer" />
          <button
            className={`btn btn-sm ${recordWeight ? 'btn-accent' : ''}`}
            onClick={() => setRecordWeight((v) => !v)}
          >
            {recordWeight ? 'ON' : 'OFF'}
          </button>
        </div>
        {recordWeight && (
          <div style={{ marginTop: 12 }}>
            <Stepper value={weight} onChange={setWeight} step={0.1} min={20} max={200} decimals={1} unit="kg" />
            {diff != null && (
              <div className="prev-hint" style={{ marginTop: 8 }}>
                前週平均({avg!.toFixed(1)}kg)との差: {diff >= 0 ? '+' : ''}{diff.toFixed(1)}kg
              </div>
            )}
          </div>
        )}
      </div>

      <div className="section-title">タンパク質（体重×1.6〜2g/日）</div>
      <div className="grid-2">
        <button
          className={`toggle-big ${proteinOk === true ? 'on' : ''}`}
          onClick={() => setProteinOk(true)}
        >
          <span className="big-ico">💪</span>達成
        </button>
        <button
          className={`toggle-big ${proteinOk === false ? 'on' : ''}`}
          style={proteinOk === false ? { borderColor: 'var(--danger)', background: 'color-mix(in srgb, var(--danger) 14%, var(--surface))' } : undefined}
          onClick={() => setProteinOk(false)}
        >
          <span className="big-ico">🍙</span>未達
        </button>
      </div>

      <button className="btn btn-accent btn-block" style={{ marginTop: 18 }} onClick={save}>保存</button>
    </div>
  )
}
