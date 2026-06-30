import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { addDays, dateRange, formatShort, jpWeekday, todayISO } from '../lib/dates'
import { buildCoachContext, generateDatePlan } from '../lib/ai'
import { reconcileDatePlan, type ReconciledDatePlan } from '../lib/plan'
import type { ActivityType } from '../types'

type Status = 'idle' | 'loading' | 'preview' | 'error'

const ACT_LABEL: Record<ActivityType | 'rest', string> = {
  gym: '🏋️ ジム', run: '🏃 ラン', pickleball: '🎾 ピックル', rest: '休養',
}

export default function Planner() {
  const { logs, menus, settings, aiKey, constraints, setMenus, setPlanDays } = useStore()
  const [start, setStart] = useState(todayISO())
  const [horizon, setHorizon] = useState(28)
  const [status, setStatus] = useState<Status>('idle')
  const [plan, setPlan] = useState<ReconciledDatePlan | null>(null)
  const [dates, setDates] = useState<string[]>([])
  const [summary, setSummary] = useState('')
  const [error, setError] = useState('')

  // 制約サマリー（プレビュー前の確認用）
  const constraintInfo = useMemo(() => {
    const range = dateRange(start, horizon)
    const pick = range.filter((d) => constraints[d]?.pickleball)
    const rest = range.filter((d) => constraints[d]?.forcedRest)
    return { pick, rest }
  }, [start, horizon, constraints])

  if (!aiKey) return null

  const generate = async () => {
    setStatus('loading')
    setError('')
    try {
      const range = dateRange(start, horizon)
      const constraintLines = range.map((d) => {
        const c = constraints[d]
        const marks = [c?.pickleball ? '[ピックルボール参加]' : '', c?.forcedRest ? '[強制休息日・トレ不可]' : '']
          .filter(Boolean)
          .join(' ')
        return `- ${d} (${jpWeekday(d)})${marks ? ' ' + marks : ''}`
      })
      const menuLines = menus.map(
        (m) => `- ${m.name} (id:${m.id}): ${m.exercises.map((e) => `${e.name} ${e.targetSets}×${e.targetRepsMin}-${e.targetRepsMax}`).join(', ')}`,
      )
      const context =
        buildCoachContext({ logs, settings }, start) +
        `\n\n## 計画する日付（${start} 〜 ${addDays(start, horizon - 1)}・この全日付に計画を入れる）\n` +
        constraintLines.join('\n') +
        '\n\n## 現在のジムメニュー（これを土台に更新可）\n' +
        menuLines.join('\n')

      const raw = await generateDatePlan(aiKey, context)
      const reconciled = reconcileDatePlan(raw, constraints, range)
      setPlan(reconciled)
      setDates(range)
      setSummary(raw.summary ?? '')
      setStatus('preview')
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : '不明なエラー')
    }
  }

  const apply = () => {
    if (!plan) return
    if (plan.menus.length > 0) setMenus(plan.menus)
    setPlanDays(plan.days)
    setStatus('idle')
    setPlan(null)
    setSummary(`適用しました。${dates.length}日分の計画を反映しました。`)
  }

  return (
    <div className="card">
      <div className="row" style={{ alignItems: 'center' }}>
        <div className="stepper-label" style={{ margin: 0 }}>📋 AIに計画を組んでもらう</div>
      </div>

      {status !== 'preview' && (
        <>
          <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <label className="field" style={{ flex: '1 1 140px', margin: 0 }}>
              <span style={{ fontSize: 12 }}>開始日</span>
              <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label className="field" style={{ flex: '1 1 120px', margin: 0 }}>
              <span style={{ fontSize: 12 }}>期間</span>
              <select className="input" value={horizon} onChange={(e) => setHorizon(Number(e.target.value))}>
                <option value={14}>2週間</option>
                <option value={28}>4週間</option>
                <option value={56}>8週間</option>
              </select>
            </label>
          </div>
          <div className="prev-hint" style={{ marginTop: 8 }}>
            過去の記録から各日の筋トレ・ランを設計します。カレンダーで設定した
            <strong>ピックル参加日（{constraintInfo.pick.length}日）</strong>・
            <strong>強制休息日（{constraintInfo.rest.length}日）</strong>を踏まえます。
          </div>
          <button className="btn btn-block" style={{ marginTop: 10 }} onClick={generate} disabled={status === 'loading'}>
            {status === 'loading' ? '作成中…' : '計画を作ってもらう'}
          </button>
          {status === 'idle' && summary && (
            <div className="prev-hint" style={{ marginTop: 8, color: 'var(--good)' }}>{summary}</div>
          )}
          {status === 'loading' && (
            <div className="prev-hint" style={{ marginTop: 8 }}>記録を読み込んで計画を設計しています…（少し時間がかかります）</div>
          )}
          {status === 'error' && (
            <div className="prev-hint" style={{ marginTop: 8, color: 'var(--bad, #e5484d)' }}>作成に失敗しました: {error}</div>
          )}
        </>
      )}

      {status === 'preview' && plan && (
        <div style={{ marginTop: 10 }}>
          {summary && <div style={{ marginBottom: 10, lineHeight: 1.6 }}>{summary}</div>}

          <div className="stepper-label">計画（案・{dates.length}日分）</div>
          <div style={{ marginBottom: 12 }}>
            {dates.map((d) => {
              const c = constraints[d]
              const items = plan.days[d] ?? []
              return (
                <div key={d} className="row" style={{ alignItems: 'flex-start', padding: '4px 0', borderTop: '1px solid var(--border)' }}>
                  <strong style={{ flex: '0 0 78px', fontSize: 13 }}>{formatShort(d)}</strong>
                  <div style={{ flex: 1, fontSize: 14 }}>
                    {c?.forcedRest && <div className="muted">🛌 強制休息日</div>}
                    {!c?.forcedRest && items.map((it, i) => (
                      <div key={i}>
                        {ACT_LABEL[it.type]}
                        {it.type === 'gym' && it.menuId ? `（${plan.menus.find((m) => m.id === it.menuId)?.name ?? menus.find((m) => m.id === it.menuId)?.name ?? ''}）` : ''}
                        {it.note ? <span className="muted"> — {it.note}</span> : ''}
                      </div>
                    ))}
                    {c?.pickleball && <div>🎾 ピックルボール（予定）</div>}
                  </div>
                </div>
              )
            })}
          </div>

          {plan.menus.length > 0 && (
            <>
              <div className="stepper-label">ジムメニュー（案）</div>
              <div style={{ marginBottom: 12 }}>
                {plan.menus.map((m) => (
                  <div key={m.id} style={{ padding: '6px 0', borderTop: '1px solid var(--border)' }}>
                    <strong>{m.name}</strong>
                    {m.exercises.map((e, i) => (
                      <div className="exercise-target" key={i}>
                        <span>{e.name}</span>
                        <span className="t">{e.targetSets}×{e.targetRepsMin}〜{e.targetRepsMax}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="prev-hint" style={{ marginBottom: 8 }}>
            「適用」で {dates.length}日分の計画とジムメニューを保存します（記録・カレンダーの制約は維持）。
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-block" onClick={apply}>✅ 適用する</button>
            <button className="btn btn-ghost btn-sm" onClick={generate}>やり直す</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setStatus('idle'); setPlan(null); setSummary('') }}>閉じる</button>
          </div>
        </div>
      )}
    </div>
  )
}
