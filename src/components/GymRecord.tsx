import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store'
import { weekdayKey } from '../lib/dates'
import { lastGymPerformance } from '../lib/selectors'
import type { GymExerciseLog, GymSet, MenuExercise } from '../types'
import { Stepper } from './ui'

export default function GymRecord({ date, onClose }: { date: string; onClose: () => void }) {
  const { getDay, updateDay, menus, settings, logs } = useStore()
  const day = getDay(date)

  // スケジュールから今日のジムメニューを推定
  const scheduleMenuId = useMemo(() => {
    const items = settings.weeklySchedule[weekdayKey(date)] ?? []
    return items.find((i) => i.type === 'gym')?.menuId ?? null
  }, [settings, date])

  const [menuId, setMenuId] = useState<string | null>(day.gym?.menuId ?? scheduleMenuId)
  const menu = menus.find((m) => m.id === menuId) ?? null

  const seedFromMenu = (mid: string | null): GymExerciseLog[] => {
    const m = menus.find((x) => x.id === mid)
    if (!m) return []
    return m.exercises.map((e) => ({ name: e.name, sets: [] }))
  }

  const [exercises, setExercises] = useState<GymExerciseLog[]>(
    day.gym?.exercises ?? seedFromMenu(menuId),
  )
  const [expanded, setExpanded] = useState(0)
  const [prToast, setPrToast] = useState(false)

  const hasAnySet = exercises.some((e) => e.sets.length > 0)

  const commit = (next: GymExerciseLog[], nextMenuId: string | null = menuId) => {
    setExercises(next)
    updateDay(date, (prev) => ({ ...prev, gym: { menuId: nextMenuId, exercises: next } }))
  }

  const changeMenu = (mid: string) => {
    setMenuId(mid)
    if (!hasAnySet) commit(seedFromMenu(mid), mid)
    else updateDay(date, (prev) => ({ ...prev, gym: { menuId: mid, exercises } }))
  }

  const addSet = (exIndex: number, set: GymSet, isPR: boolean) => {
    const next = exercises.map((e, i) =>
      i === exIndex ? { ...e, sets: [...e.sets, set] } : e,
    )
    commit(next)
    if (isPR) {
      setPrToast(true)
      window.setTimeout(() => setPrToast(false), 1400)
    }
  }

  const removeSet = (exIndex: number, setIndex: number) => {
    const next = exercises.map((e, i) =>
      i === exIndex ? { ...e, sets: e.sets.filter((_, s) => s !== setIndex) } : e,
    )
    commit(next)
  }

  const move = (exIndex: number, dir: -1 | 1) => {
    const j = exIndex + dir
    if (j < 0 || j >= exercises.length) return
    const next = [...exercises]
    ;[next[exIndex], next[j]] = [next[j], next[exIndex]]
    commit(next)
    setExpanded(j)
  }

  const removeExercise = (exIndex: number) => {
    commit(exercises.filter((_, i) => i !== exIndex))
  }

  const [newName, setNewName] = useState('')
  const addExercise = () => {
    const name = newName.trim()
    if (!name) return
    commit([...exercises, { name, sets: [] }])
    setNewName('')
    setExpanded(exercises.length)
  }

  const menuExerciseOf = (name: string): MenuExercise | undefined =>
    menu?.exercises.find((e) => e.name === name)

  return (
    <div>
      {/* メニュー選択 */}
      <div className="field">
        <label>メニュー</label>
        <select
          className="input"
          value={menuId ?? ''}
          onChange={(e) => changeMenu(e.target.value)}
        >
          <option value="">（メニューなし）</option>
          {menus.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>

      {exercises.length === 0 && (
        <p className="empty">メニューを選ぶか、下から種目を追加してください。</p>
      )}

      {exercises.map((ex, i) => (
        <ExerciseCard
          key={`${ex.name}-${i}`}
          exercise={ex}
          target={menuExerciseOf(ex.name)}
          lastPerf={lastGymPerformance(logs, ex.name, date)}
          expanded={expanded === i}
          onToggle={() => setExpanded(expanded === i ? -1 : i)}
          onAddSet={(set, pr) => addSet(i, set, pr)}
          onRemoveSet={(s) => removeSet(i, s)}
          onMoveUp={() => move(i, -1)}
          onMoveDown={() => move(i, 1)}
          onRemove={() => removeExercise(i)}
          canUp={i > 0}
          canDown={i < exercises.length - 1}
        />
      ))}

      {/* 種目追加 */}
      <div className="card" style={{ marginTop: 12 }}>
        <div className="stepper-label">種目を追加</div>
        <div className="row">
          <input
            className="input"
            placeholder="例: インクラインダンベルプレス"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addExercise() }}
          />
          <button className="btn btn-sm" onClick={addExercise}>追加</button>
        </div>
      </div>

      <button className="btn btn-accent btn-block" style={{ marginTop: 16 }} onClick={onClose}>
        完了
      </button>

      {prToast && <div className="pr-toast">前回超え！ ✓</div>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────

function isPR(set: GymSet, prev: GymSet | undefined): boolean {
  if (!prev) return false
  if (set.weightKg > prev.weightKg) return true
  if (set.weightKg === prev.weightKg && set.reps > prev.reps) return true
  return false
}

function ExerciseCard({
  exercise, target, lastPerf, expanded, onToggle,
  onAddSet, onRemoveSet, onMoveUp, onMoveDown, onRemove, canUp, canDown,
}: {
  exercise: GymExerciseLog
  target?: MenuExercise
  lastPerf: GymSet[] | null
  expanded: boolean
  onToggle: () => void
  onAddSet: (set: GymSet, pr: boolean) => void
  onRemoveSet: (setIndex: number) => void
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
  canUp: boolean
  canDown: boolean
}) {
  const nextIndex = exercise.sets.length
  const lastSet = exercise.sets[exercise.sets.length - 1]
  const prevForNext = lastPerf?.[nextIndex] ?? lastPerf?.[lastPerf.length - 1]
  const def: GymSet = lastSet ?? prevForNext ?? { weightKg: 20, reps: 10 }

  const [weight, setWeight] = useState(def.weightKg)
  const [reps, setReps] = useState(def.reps)
  const [justFlash, setJustFlash] = useState(false)

  // セットを追加するたびに入力欄を次の既定値へ更新
  useEffect(() => {
    const last = exercise.sets[exercise.sets.length - 1]
    const fallback = lastPerf?.[exercise.sets.length] ?? lastPerf?.[lastPerf.length - 1]
    const d = last ?? fallback ?? { weightKg: 20, reps: 10 }
    setWeight(d.weightKg)
    setReps(d.reps)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.sets.length])

  const livePrev = lastPerf?.[nextIndex]
  const willBePR = isPR({ weightKg: weight, reps }, livePrev)

  const handleAdd = () => {
    const set = { weightKg: weight, reps }
    onAddSet(set, willBePR)
    setJustFlash(true)
    window.setTimeout(() => setJustFlash(false), 700)
  }

  return (
    <div className={`card ex-card ${justFlash ? 'flash' : ''}`} style={{ marginTop: 12 }}>
      <div className="ex-head" onClick={onToggle} role="button">
        <div className="reorder" onClick={(e) => e.stopPropagation()}>
          <button disabled={!canUp} onClick={onMoveUp} aria-label="上へ">▲</button>
          <button disabled={!canDown} onClick={onMoveDown} aria-label="下へ">▼</button>
        </div>
        <span className="name">{exercise.name}</span>
        <span className="count">
          {exercise.sets.length}
          {target ? `/${target.targetSets}` : ''} セット
        </span>
        <span className="muted">{expanded ? '▾' : '▸'}</span>
      </div>

      {expanded && (
        <div className="ex-body">
          {target && (
            <div className="prev-hint">
              目標 {target.targetSets}セット × {target.targetRepsMin}〜{target.targetRepsMax}回
            </div>
          )}

          {exercise.sets.map((s, si) => {
            const pr = isPR(s, lastPerf?.[si])
            return (
              <div className="set-row" key={si}>
                <span className="idx">{si + 1}</span>
                <span className="vals">{s.weightKg}kg × {s.reps}回 {pr && <span className="pr">✓</span>}</span>
                <button className="icon-btn" style={{ minHeight: 32, width: 32, fontSize: 16 }} aria-label="セット削除" onClick={() => onRemoveSet(si)}>✕</button>
              </div>
            )
          })}

          <div className="set-inputs">
            <Stepper label="重量" value={weight} onChange={setWeight} step={2.5} min={0} max={500} decimals={1} unit="kg" />
            <Stepper label="回数" value={reps} onChange={setReps} step={1} min={1} max={100} unit="回" />
          </div>
          {livePrev && (
            <div className="prev-hint">
              前回 {nextIndex + 1}セット目: {livePrev.weightKg}kg × {livePrev.reps}回
              {willBePR && <span className="pr"> → 超えてる ✓</span>}
            </div>
          )}

          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn btn-accent" style={{ flex: 1 }} onClick={handleAdd}>セット完了 ＋</button>
            <button className="btn btn-sm btn-ghost btn-danger" onClick={onRemove}>種目削除</button>
          </div>
        </div>
      )}
    </div>
  )
}
