import { useState } from 'react'
import { useStore } from '../store'

export default function PickleballRecord({ date, onClose }: { date: string; onClose: () => void }) {
  const { getDay, updateDay } = useStore()
  const existing = getDay(date).pickleball

  const [done, setDone] = useState(existing?.done ?? true)
  const [memo, setMemo] = useState(existing?.memo ?? '')

  const save = () => {
    updateDay(date, (prev) => ({
      ...prev,
      pickleball: done ? { done: true, memo: memo.trim() || undefined } : undefined,
    }))
    onClose()
  }

  return (
    <div>
      <button
        className={`toggle-big ${done ? 'on' : ''}`}
        onClick={() => setDone((d) => !d)}
      >
        <span className="big-ico">🎾</span>
        {done ? 'やった！' : 'タップして記録'}
      </button>

      <div className="field" style={{ marginTop: 16 }}>
        <label>メモ（任意）</label>
        <textarea
          className="textarea"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="今日のテーマ（例: リターンの深さ）、気づき"
        />
      </div>

      <button className="btn btn-accent btn-block" onClick={save}>保存</button>
    </div>
  )
}
