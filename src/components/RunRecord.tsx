import { useState } from 'react'
import { useStore } from '../store'
import { paceLabel } from '../lib/selectors'
import type { RunKind } from '../types'
import { Segmented, Stepper } from './ui'

export default function RunRecord({ date, onClose }: { date: string; onClose: () => void }) {
  const { getDay, updateDay } = useStore()
  const existing = getDay(date).run

  const [km, setKm] = useState(existing?.km ?? 5)
  const [min, setMin] = useState(existing ? Math.floor(existing.durationSec / 60) : 30)
  const [sec, setSec] = useState(existing ? existing.durationSec % 60 : 0)
  const [kind, setKind] = useState<RunKind>(existing?.kind ?? 'jog')
  const [memo, setMemo] = useState(existing?.memo ?? '')

  const durationSec = min * 60 + sec
  const pace = paceLabel(km, durationSec)

  const save = () => {
    updateDay(date, (prev) => ({
      ...prev,
      run: { km, durationSec, kind, memo: memo.trim() || undefined },
    }))
    onClose()
  }

  const clearRun = () => {
    updateDay(date, (prev) => ({ ...prev, run: undefined }))
    onClose()
  }

  return (
    <div>
      <div className="field">
        <label>距離</label>
        <Stepper value={km} onChange={setKm} step={0.5} min={0} max={100} decimals={1} unit="km" />
      </div>

      <div className="field">
        <label>タイム</label>
        <div className="row">
          <Stepper label="分" value={min} onChange={setMin} step={1} min={0} max={600} unit="分" />
          <Stepper label="秒" value={sec} onChange={setSec} step={5} min={0} max={59} unit="秒" />
        </div>
      </div>

      <div className="card center" style={{ padding: 12 }}>
        <span className="muted">ペース </span>
        <span style={{ fontSize: 22, fontWeight: 900 }}>{pace}</span>
      </div>

      <div className="field" style={{ marginTop: 16 }}>
        <label>種別</label>
        <Segmented<RunKind>
          value={kind}
          onChange={setKind}
          options={[
            { value: 'jog', label: 'ジョグ' },
            { value: 'workout', label: 'ポイント練' },
            { value: 'race', label: 'レース' },
          ]}
        />
      </div>

      <div className="field">
        <label>メモ（任意）</label>
        <textarea className="textarea" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="コース・体感・心拍など" />
      </div>

      <button className="btn btn-accent btn-block" onClick={save}>保存</button>
      {existing && (
        <button className="btn btn-ghost btn-danger btn-block" style={{ marginTop: 10 }} onClick={clearRun}>
          このランを削除
        </button>
      )}
    </div>
  )
}
