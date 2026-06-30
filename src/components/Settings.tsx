import { useRef, useState } from 'react'
import { useStore } from '../store'
import { WEEKDAY_LABEL, WEEKDAY_ORDER, todayISO } from '../lib/dates'
import { parseImport, parseLogsImport } from '../lib/storage'
import { Segmented } from './ui'
import type { ActivityType, Menu, ScheduleItem, Theme, Weekday } from '../types'

const ACT_OPTIONS: { value: ScheduleItem['type']; label: string }[] = [
  { value: 'rest', label: '休養' },
  { value: 'gym', label: 'ジム' },
  { value: 'run', label: 'ラン' },
  { value: 'pickleball', label: 'ピックル' },
]

export default function SettingsView() {
  const { menus, settings, setMenus, setSettings, replaceAll, mergeLogs, exportJSON } = useStore()
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const mergeRef = useRef<HTMLInputElement>(null)

  // ── スケジュール ──────────────────────
  const setSchedule = (wd: Weekday, items: ScheduleItem[]) =>
    setSettings((prev) => ({ ...prev, weeklySchedule: { ...prev.weeklySchedule, [wd]: items } }))

  const updateItem = (wd: Weekday, idx: number, patch: Partial<ScheduleItem>) => {
    const items = settings.weeklySchedule[wd].map((it, i) => {
      if (i !== idx) return it
      const merged = { ...it, ...patch }
      if (merged.type === 'gym' && !merged.menuId) merged.menuId = menus[0]?.id
      if (merged.type !== 'gym') delete merged.menuId
      return merged
    })
    setSchedule(wd, items)
  }

  // ── 目標 ──────────────────────────────
  const setGoal = (patch: Partial<typeof settings.goals>) =>
    setSettings((prev) => ({ ...prev, goals: { ...prev.goals, ...patch } }))

  // ── イベント ──────────────────────────
  const setEvent = (idx: number, patch: Partial<{ name: string; date: string }>) =>
    setSettings((prev) => ({ ...prev, events: prev.events.map((e, i) => (i === idx ? { ...e, ...patch } : e)) }))
  const addEvent = () => setSettings((prev) => ({ ...prev, events: [...prev.events, { name: '新しいイベント', date: todayISO() }] }))
  const removeEvent = (idx: number) => setSettings((prev) => ({ ...prev, events: prev.events.filter((_, i) => i !== idx) }))

  // ── メニュー ──────────────────────────
  const updateMenu = (id: string, patch: Partial<Menu>) =>
    setMenus(menus.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  const addMenu = () =>
    setMenus([...menus, { id: `menu-${Date.now()}`, name: '新しいメニュー', exercises: [] }])
  const removeMenu = (id: string) => setMenus(menus.filter((m) => m.id !== id))

  // ── 入出力 ────────────────────────────
  const handleExport = () => {
    const blob = new Blob([exportJSON()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `training-hub-backup-${todayISO()}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    setMsg('エクスポートしました')
  }
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const res = parseImport(text)
    e.target.value = ''
    if (!res.ok || !res.data) { setMsg('読み込み失敗: ' + (res.error ?? '不明')); return }
    if (window.confirm('現在のデータをこのバックアップで上書きします。よろしいですか？')) {
      replaceAll(res.data)
      setMsg('インポートしました')
    }
  }
  const handleMergeFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const res = parseLogsImport(text)
    e.target.value = ''
    if (!res.ok || !res.logs) { setMsg('取り込み失敗: ' + (res.error ?? '不明')); return }
    const count = Object.keys(res.logs).length
    if (window.confirm(`${count}日分の記録を現在のデータに追加します（同じ日は上書き）。よろしいですか？`)) {
      mergeLogs(res.logs)
      setMsg(`${count}日分の記録を取り込みました`)
    }
  }

  return (
    <div className="screen">
      <h1 className="screen-title">設定</h1>

      {/* テーマ */}
      <div className="card">
        <div className="stepper-label">テーマ</div>
        <Segmented<Theme>
          value={settings.theme}
          onChange={(t) => setSettings((prev) => ({ ...prev, theme: t }))}
          options={[{ value: 'dark', label: '🌙 ダーク' }, { value: 'light', label: '☀️ ライト' }]}
        />
      </div>

      {/* 目標 */}
      <div className="section-title">週間目標</div>
      <div className="card">
        <NumberField label="ジム（回/週）" value={settings.goals.gymPerWeek} onChange={(v) => setGoal({ gymPerWeek: v })} step={1} />
        <NumberField label="ラン（km/週）" value={settings.goals.runKmPerWeek} onChange={(v) => setGoal({ runKmPerWeek: v })} step={1} />
        <NumberField label="タンパク質達成（日/週）" value={settings.goals.proteinDaysPerWeek} onChange={(v) => setGoal({ proteinDaysPerWeek: v })} step={1} max={7} />
        <NumberField label="目標体重（kg・任意）" value={settings.goals.targetWeightKg ?? 0} onChange={(v) => setGoal({ targetWeightKg: v || undefined })} step={0.5} decimals={1} />
      </div>

      {/* 週間スケジュール */}
      <details className="card" style={{ marginTop: 22 }}>
        <summary style={{ fontWeight: 800, cursor: 'pointer' }}>週間スケジュール</summary>
        <div style={{ marginTop: 12 }}>
          {WEEKDAY_ORDER.map((wd) => (
            <div key={wd} style={{ borderTop: '1px solid var(--border)', padding: '10px 0' }}>
              <div className="row" style={{ marginBottom: 6 }}>
                <strong>{WEEKDAY_LABEL[wd]}曜</strong>
                <span className="spacer" />
                <button className="btn btn-sm" onClick={() => setSchedule(wd, [...settings.weeklySchedule[wd], { type: 'rest' }])}>＋活動</button>
              </div>
              {settings.weeklySchedule[wd].map((it, idx) => (
                <div className="row" key={idx} style={{ marginBottom: 6, flexWrap: 'wrap' }}>
                  <select className="input" style={{ flex: '1 1 110px', minHeight: 40 }} value={it.type} onChange={(e) => updateItem(wd, idx, { type: e.target.value as ActivityType | 'rest' })}>
                    {ACT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  {it.type === 'gym' && (
                    <select className="input" style={{ flex: '1 1 130px', minHeight: 40 }} value={it.menuId ?? ''} onChange={(e) => updateItem(wd, idx, { menuId: e.target.value })}>
                      {menus.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  )}
                  <button className="icon-btn" aria-label="削除" onClick={() => setSchedule(wd, settings.weeklySchedule[wd].filter((_, i) => i !== idx))}>✕</button>
                </div>
              ))}
            </div>
          ))}
        </div>
      </details>

      {/* メニュー編集 */}
      <details className="card" style={{ marginTop: 12 }}>
        <summary style={{ fontWeight: 800, cursor: 'pointer' }}>メニュー編集</summary>
        <div style={{ marginTop: 12 }}>
          {menus.map((m) => (
            <div key={m.id} style={{ borderTop: '1px solid var(--border)', padding: '12px 0' }}>
              <div className="row" style={{ marginBottom: 8 }}>
                <input className="input" value={m.name} onChange={(e) => updateMenu(m.id, { name: e.target.value })} />
                <button className="icon-btn btn-danger" aria-label="メニュー削除" onClick={() => removeMenu(m.id)}>🗑</button>
              </div>
              {m.exercises.map((ex, ei) => (
                <div className="row" key={ei} style={{ marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
                  <input className="input" style={{ flex: '2 1 120px', minHeight: 38 }} value={ex.name}
                    onChange={(e) => updateMenu(m.id, { exercises: m.exercises.map((x, i) => i === ei ? { ...x, name: e.target.value } : x) })} />
                  <input className="input" style={{ flex: '0 0 52px', minHeight: 38, textAlign: 'center' }} type="number" inputMode="numeric" value={ex.targetSets} aria-label="セット数"
                    onChange={(e) => updateMenu(m.id, { exercises: m.exercises.map((x, i) => i === ei ? { ...x, targetSets: Number(e.target.value) } : x) })} />
                  <span className="muted">×</span>
                  <input className="input" style={{ flex: '0 0 52px', minHeight: 38, textAlign: 'center' }} type="number" inputMode="numeric" value={ex.targetRepsMin} aria-label="最小回数"
                    onChange={(e) => updateMenu(m.id, { exercises: m.exercises.map((x, i) => i === ei ? { ...x, targetRepsMin: Number(e.target.value) } : x) })} />
                  <span className="muted">〜</span>
                  <input className="input" style={{ flex: '0 0 52px', minHeight: 38, textAlign: 'center' }} type="number" inputMode="numeric" value={ex.targetRepsMax} aria-label="最大回数"
                    onChange={(e) => updateMenu(m.id, { exercises: m.exercises.map((x, i) => i === ei ? { ...x, targetRepsMax: Number(e.target.value) } : x) })} />
                  <button className="icon-btn" aria-label="種目削除" onClick={() => updateMenu(m.id, { exercises: m.exercises.filter((_, i) => i !== ei) })}>✕</button>
                </div>
              ))}
              <button className="btn btn-sm" style={{ marginTop: 4 }} onClick={() => updateMenu(m.id, { exercises: [...m.exercises, { name: '新しい種目', targetSets: 3, targetRepsMin: 8, targetRepsMax: 12 }] })}>＋種目</button>
            </div>
          ))}
          <button className="btn btn-block" style={{ marginTop: 12 }} onClick={addMenu}>＋メニューを追加</button>
        </div>
      </details>

      {/* イベント */}
      <details className="card" style={{ marginTop: 12 }}>
        <summary style={{ fontWeight: 800, cursor: 'pointer' }}>イベント（カウントダウン）</summary>
        <div style={{ marginTop: 12 }}>
          {settings.events.map((ev, idx) => (
            <div className="row" key={idx} style={{ marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
              <input className="input" style={{ flex: '2 1 140px', minHeight: 40 }} value={ev.name} onChange={(e) => setEvent(idx, { name: e.target.value })} />
              <input className="input" style={{ flex: '1 1 130px', minHeight: 40 }} type="date" value={ev.date} onChange={(e) => setEvent(idx, { date: e.target.value })} />
              <button className="icon-btn" aria-label="削除" onClick={() => removeEvent(idx)}>✕</button>
            </div>
          ))}
          <button className="btn btn-sm" onClick={addEvent}>＋イベントを追加</button>
        </div>
      </details>

      {/* バックアップ */}
      <div className="section-title">バックアップ</div>
      <div className="card">
        <button className="btn btn-block" onClick={handleExport}>⬇️ JSON エクスポート</button>
        <button className="btn btn-block" style={{ marginTop: 10 }} onClick={() => fileRef.current?.click()}>⬆️ JSON インポート（全置換）</button>
        <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={handleFile} />
        <button className="btn btn-block" style={{ marginTop: 10 }} onClick={() => mergeRef.current?.click()}>➕ 記録をマージ取り込み</button>
        <input ref={mergeRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={handleMergeFile} />
        <div className="prev-hint" style={{ marginTop: 8 }}>
          マージ取り込みは、メニュー・設定を保ったまま過去記録を追加します。バックアップ全体（ExportBundle）でも、日付キーだけのlogs JSONでも読み込めます。
        </div>
        {msg && <div className="prev-hint" style={{ marginTop: 10, color: 'var(--good)' }}>{msg}</div>}
      </div>

      <div className="prev-hint center" style={{ marginTop: 22 }}>トレーニングハブ v0.1 ・ データはこの端末内のみに保存されます</div>
    </div>
  )
}

function NumberField({ label, value, onChange, step, max, decimals = 0 }: { label: string; value: number; onChange: (v: number) => void; step: number; max?: number; decimals?: number }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input
        className="input"
        type="number"
        inputMode="decimal"
        value={value}
        step={step}
        max={max}
        onChange={(e) => onChange(decimals > 0 ? Number(e.target.value) : Math.round(Number(e.target.value)))}
      />
    </div>
  )
}
