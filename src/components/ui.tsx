import { useEffect, type ReactNode } from 'react'

// ── ステッパー（大きなタップ領域・長押し不要） ──────────────
interface StepperProps {
  label?: string
  value: number
  onChange: (v: number) => void
  step: number
  min?: number
  max?: number
  decimals?: number
  unit?: string
}

export function Stepper({ label, value, onChange, step, min = 0, max = 9999, decimals = 0, unit }: StepperProps) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v))
  const fmt = (v: number) => (decimals > 0 ? v.toFixed(decimals) : String(Math.round(v)))
  const bump = (dir: number) => {
    const next = clamp(Math.round((value + dir * step) / step) * step)
    onChange(Number(next.toFixed(decimals)))
  }
  return (
    <div>
      {label && <div className="stepper-label">{label}</div>}
      <div className="stepper">
        <button type="button" aria-label="減らす" onClick={() => bump(-1)}>−</button>
        <div className="value">
          {fmt(value)}
          {unit && <span className="u">{unit}</span>}
        </div>
        <button type="button" aria-label="増やす" onClick={() => bump(1)}>＋</button>
      </div>
    </div>
  )
}

// ── セグメントコントロール ──────────────────────────────
interface SegmentedProps<T extends string> {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}

export function Segmented<T extends string>({ options, value, onChange }: SegmentedProps<T>) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          className={value === o.value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ── 進捗バー ──────────────────────────────────────────
export function ProgressBar({ label, value, ratio, color }: { label: string; value: string; ratio: number; color: 'gym' | 'run' | 'protein' }) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100
  return (
    <div className="progress-block">
      <div className="progress-row">
        <span className="label">{label}</span>
        <span className="val">{value}</span>
      </div>
      <div className={`bar ${color}`}>
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ── ボトムシートモーダル ────────────────────────────────
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="modal-head">
          <span className="title">{title}</span>
          <button className="icon-btn" aria-label="閉じる" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
