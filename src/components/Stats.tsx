import { useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { addDays, formatShort, todayISO } from '../lib/dates'
import {
  exerciseNames,
  exerciseTopSeries,
  latestWeight,
  streakDays,
  weeklyRunSeries,
  weightSeries,
  weekSummary,
} from '../lib/selectors'
import { Segmented } from './ui'

// ─── チャート共通 ────────────────────────────
// dataviz仕様: 線2px/角丸、面は10%ウォッシュ、点r4.5+2pxサーフェスリング、
// グリッドは1px実線の控えめグレー、値テキストはテキストトークン（系列色にしない）

const W = 340
const H = 150
const PAD = { l: 34, r: 14, t: 14, b: 22 }

function niceTicks(min: number, max: number): number[] {
  if (min === max) { min -= 1; max += 1 }
  const span = max - min
  const step = [1, 2, 2.5, 5, 10, 20, 25, 50].map((s) => s * Math.pow(10, Math.floor(Math.log10(span))))
    .map((s) => s / 10)
    .find((s) => span / s <= 4) ?? span / 3
  const lo = Math.floor(min / step) * step
  const out: number[] = []
  for (let v = lo; v <= max + step * 0.01; v += step) if (v >= min - step * 0.01) out.push(Math.round(v * 100) / 100)
  return out
}

interface Pt { x: number; y: number; date: string; v: number }

function useTip() {
  const [tip, setTip] = useState<{ px: number; py: number; date: string; text: string } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const show = (pts: Pt[], e: React.PointerEvent<SVGSVGElement>, unit: string) => {
    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * W
    let best = pts[0]
    for (const p of pts) if (Math.abs(p.x - x) < Math.abs(best.x - x)) best = p
    setTip({
      px: (best.x / W) * rect.width,
      py: (best.y / H) * rect.height,
      date: formatShort(best.date),
      text: `${best.v}${unit}`,
    })
  }
  return { tip, setTip, ref, show }
}

/** 単系列ライン（体重・種目トップ重量） */
function LineChart({ data, color, unit, refLine }: {
  data: { date: string; v: number }[]
  color: string
  unit: string
  refLine?: { v: number; label: string }
}) {
  const { tip, setTip, show } = useTip()
  if (data.length < 2) return <div className="chart-empty">データが2件以上たまると表示されます</div>

  const vs = data.map((d) => d.v)
  let lo = Math.min(...vs, refLine?.v ?? Infinity)
  let hi = Math.max(...vs, refLine?.v ?? -Infinity)
  const pad = Math.max((hi - lo) * 0.15, 0.5)
  lo -= pad; hi += pad
  const ticks = niceTicks(lo, hi)
  const x = (i: number) => PAD.l + (i / (data.length - 1)) * (W - PAD.l - PAD.r)
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b)
  const pts: Pt[] = data.map((d, i) => ({ x: x(i), y: y(d.v), date: d.date, v: d.v }))
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('')
  const area = `${line}L${pts[pts.length - 1].x.toFixed(1)},${H - PAD.b}L${pts[0].x.toFixed(1)},${H - PAD.b}Z`
  const last = pts[pts.length - 1]

  return (
    <div style={{ position: 'relative' }}>
      <svg
        className="chart-svg" viewBox={`0 0 ${W} ${H}`} role="img"
        onPointerDown={(e) => show(pts, e, unit)}
        onPointerMove={(e) => e.buttons > 0 && show(pts, e, unit)}
        onPointerLeave={() => setTip(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth="1" />
            <text x={PAD.l - 6} y={y(t) + 3.5} textAnchor="end" fontSize="9.5" fill="var(--text-dim)">{t}</text>
          </g>
        ))}
        {refLine && refLine.v > lo && refLine.v < hi && (
          <g>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(refLine.v)} y2={y(refLine.v)} stroke="var(--text-dim)" strokeWidth="1" />
            <text x={W - PAD.r} y={y(refLine.v) - 4} textAnchor="end" fontSize="9.5" fill="var(--text-dim)">{refLine.label}</text>
          </g>
        )}
        <path d={area} fill={color} opacity="0.1" />
        <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={last.x} cy={last.y} r="6.5" fill="var(--surface)" />
        <circle cx={last.x} cy={last.y} r="4.5" fill={color} />
        <text x={Math.min(last.x, W - PAD.r - 2)} y={last.y - 9} textAnchor="end" fontSize="11" fontWeight="800" fill="var(--text)">
          {last.v}{unit}
        </text>
        <text x={PAD.l} y={H - 6} fontSize="9.5" fill="var(--text-dim)">{formatShort(data[0].date)}</text>
        <text x={W - PAD.r} y={H - 6} textAnchor="end" fontSize="9.5" fill="var(--text-dim)">{formatShort(last.date)}</text>
      </svg>
      {tip && (
        <div className="chart-tip" style={{ left: tip.px, top: tip.py - 8 }}>
          <span className="d">{tip.date}</span> {tip.text}
        </div>
      )}
    </div>
  )
}

/** 週間走行距離カラム（目標ライン付き） */
function WeeklyRunChart({ data, goal }: { data: { weekStart: string; km: number }[]; goal: number }) {
  const { tip, setTip, show } = useTip()
  const hi = Math.max(...data.map((d) => d.km), goal) * 1.15 || 10
  const ticks = niceTicks(0, hi)
  const band = (W - PAD.l - PAD.r) / data.length
  const bw = Math.min(24, band - 8)
  const y = (v: number) => PAD.t + (1 - v / hi) * (H - PAD.t - PAD.b)
  const x = (i: number) => PAD.l + band * i + (band - bw) / 2
  const pts: Pt[] = data.map((d, i) => ({ x: x(i) + bw / 2, y: y(d.km), date: d.weekStart, v: d.km }))
  const maxIdx = data.reduce((m, d, i) => (d.km > data[m].km ? i : m), 0)

  return (
    <div style={{ position: 'relative' }}>
      <svg
        className="chart-svg" viewBox={`0 0 ${W} ${H}`} role="img"
        onPointerDown={(e) => show(pts, e, 'km')}
        onPointerMove={(e) => e.buttons > 0 && show(pts, e, 'km')}
        onPointerLeave={() => setTip(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth="1" />
            <text x={PAD.l - 6} y={y(t) + 3.5} textAnchor="end" fontSize="9.5" fill="var(--text-dim)">{t}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const h = Math.max(H - PAD.b - y(d.km), 0)
          const r = Math.min(4, h) // 上端のみ4px角丸・ベースラインは直角
          return (
            <path
              key={d.weekStart}
              d={`M${x(i)},${H - PAD.b} v${-(h - r)} q0,${-r} ${r},${-r} h${bw - r * 2} q${r},0 ${r},${r} v${h - r} Z`}
              fill="var(--ch-run)"
              opacity={i === data.length - 1 ? 1 : 0.75}
            />
          )
        })}
        {goal > 0 && goal < hi && (
          <g>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(goal)} y2={y(goal)} stroke="var(--text-dim)" strokeWidth="1" />
            <text x={W - PAD.r} y={y(goal) - 4} textAnchor="end" fontSize="9.5" fill="var(--text-dim)">目標 {goal}km</text>
          </g>
        )}
        {[maxIdx, data.length - 1].filter((v, i, a) => a.indexOf(v) === i).map((i) => (
          data[i].km > 0 && (
            <text key={i} x={x(i) + bw / 2} y={y(data[i].km) - 5} textAnchor="middle" fontSize="10.5" fontWeight="800" fill="var(--text)">
              {data[i].km}
            </text>
          )
        ))}
        <text x={PAD.l} y={H - 6} fontSize="9.5" fill="var(--text-dim)">{formatShort(data[0].weekStart)}週</text>
        <text x={W - PAD.r} y={H - 6} textAnchor="end" fontSize="9.5" fill="var(--text-dim)">今週</text>
      </svg>
      {tip && (
        <div className="chart-tip" style={{ left: tip.px, top: tip.py - 8 }}>
          <span className="d">{tip.date}週</span> {tip.text}
        </div>
      )}
    </div>
  )
}

// ─── 画面 ───────────────────────────────────
export default function Stats() {
  const { logs, settings } = useStore()
  const today = todayISO()
  const [range, setRange] = useState<30 | 90>(30)

  const weights = useMemo(() => weightSeries(logs, today, range), [logs, today, range])
  const weekly = useMemo(() => weeklyRunSeries(logs, today, 8), [logs, today])
  const names = useMemo(() => exerciseNames(logs), [logs])
  const [exName, setExName] = useState<string | null>(null)
  const activeEx = exName ?? names[0] ?? null
  const exSeries = useMemo(
    () => (activeEx ? exerciseTopSeries(logs, activeEx).slice(-12).map((d) => ({ date: d.date, v: d.kg })) : []),
    [logs, activeEx],
  )

  const wk = weekSummary(logs, today)
  const latest = latestWeight(logs, today)
  const prev30 = latestWeight(logs, addDays(today, -30))
  const deltaKg = latest && prev30 && prev30.date !== latest.date
    ? Math.round((latest.kg - prev30.kg) * 10) / 10
    : null
  const streak = streakDays(logs, today)
  const monthStart = today.slice(0, 8) + '01'
  const monthCount = Object.values(logs).filter(
    (l) => l.date >= monthStart && l.date <= today &&
      (l.run || l.pickleball?.done || (l.gym && l.gym.exercises.some((e) => e.sets.length > 0))),
  ).length

  return (
    <div className="screen">
      <h1 className="screen-title">分析</h1>

      <div className="stat-grid">
        <div className="stat-tile">
          <div className="label">最新体重</div>
          <div className="value">{latest ? latest.kg : '--'}<span className="u">kg</span></div>
          {deltaKg != null && (
            <div className={`delta ${deltaKg < 0 ? 'good' : deltaKg > 0 ? 'bad' : 'flat'}`}>
              {deltaKg > 0 ? '+' : ''}{deltaKg}kg / 30日
            </div>
          )}
        </div>
        <div className="stat-tile">
          <div className="label">今週のラン</div>
          <div className="value">{wk.runKm}<span className="u">/ {settings.goals.runKmPerWeek}km</span></div>
          <div className="delta flat">ジム {wk.gymCount}回 ・ ピックル {wk.pickleballCount}回</div>
        </div>
        <div className="stat-tile">
          <div className="label">今月のワークアウト</div>
          <div className="value">{monthCount}<span className="u">日</span></div>
        </div>
        <div className="stat-tile">
          <div className="label">連続記録</div>
          <div className="value">{streak}<span className="u">日</span></div>
        </div>
      </div>

      <div className="section-title">体重の推移</div>
      <div className="card chart-card">
        <div className="chart-head">
          <span className="t">体重（{range}日）</span>
          <div style={{ width: 130 }}>
            <Segmented<'30' | '90'>
              value={String(range) as '30' | '90'}
              onChange={(v) => setRange(Number(v) as 30 | 90)}
              options={[{ value: '30', label: '30日' }, { value: '90', label: '90日' }]}
            />
          </div>
        </div>
        <LineChart
          data={weights.map((d) => ({ date: d.date, v: d.kg }))}
          color="var(--ch-weight)"
          unit="kg"
          refLine={settings.goals.targetWeightKg ? { v: settings.goals.targetWeightKg, label: `目標 ${settings.goals.targetWeightKg}kg` } : undefined}
        />
      </div>

      <div className="section-title">週間走行距離</div>
      <div className="card chart-card">
        <div className="chart-head">
          <span className="t">直近8週</span>
          <span className="sub">サブ3への積み上げ</span>
        </div>
        <WeeklyRunChart data={weekly} goal={settings.goals.runKmPerWeek} />
      </div>

      <div className="section-title">種目のトップ重量</div>
      <div className="card chart-card">
        {names.length === 0 ? (
          <div className="chart-empty">筋トレを記録すると種目ごとの推移が見られます</div>
        ) : (
          <>
            <div className="chip-scroll">
              {names.slice(0, 10).map((n) => (
                <button key={n} className={`chip ${n === activeEx ? 'on' : ''}`} onClick={() => setExName(n)}>{n}</button>
              ))}
            </div>
            <LineChart data={exSeries} color="var(--ch-gym)" unit="kg" />
          </>
        )}
      </div>
    </div>
  )
}
