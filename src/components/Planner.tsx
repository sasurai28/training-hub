import { useState } from 'react'
import { useStore } from '../store'
import { todayISO, WEEKDAY_LABEL, WEEKDAY_ORDER } from '../lib/dates'
import { buildCoachContext, generatePlan } from '../lib/ai'
import { reconcilePlan, type ReconciledPlan } from '../lib/plan'
import type { ActivityType } from '../types'

type Status = 'idle' | 'loading' | 'preview' | 'error'

const ACT_LABEL: Record<ActivityType | 'rest', string> = {
  gym: '🏋️ ジム', run: '🏃 ラン', pickleball: '🎾 ピックル', rest: '休養',
}

/** プロンプト用に、現在の週間スケジュールとメニューを文章化 */
function describeCurrent(
  schedule: ReturnType<typeof useStore>['settings']['weeklySchedule'],
  menus: ReturnType<typeof useStore>['menus'],
): string {
  const lines: string[] = ['## 現在の週間スケジュール（ピックルボールの曜日は固定・変更不可）']
  for (const wd of WEEKDAY_ORDER) {
    const items = schedule[wd] ?? []
    const desc = items.length
      ? items.map((it) => (it.type === 'gym' ? `ジム(${menus.find((m) => m.id === it.menuId)?.name ?? '?'})` : ACT_LABEL[it.type].replace(/^.. /, ''))).join('・')
      : '（なし）'
    lines.push(`- ${WEEKDAY_LABEL[wd]}: ${desc}`)
  }
  lines.push('## 現在のジムメニュー')
  for (const m of menus) {
    lines.push(`- ${m.name} (id:${m.id}): ${m.exercises.map((e) => `${e.name} ${e.targetSets}×${e.targetRepsMin}-${e.targetRepsMax}`).join(', ')}`)
  }
  return lines.join('\n')
}

export default function Planner() {
  const { logs, menus, settings, aiKey, setMenus, setSettings } = useStore()
  const [status, setStatus] = useState<Status>('idle')
  const [plan, setPlan] = useState<ReconciledPlan | null>(null)
  const [summary, setSummary] = useState('')
  const [error, setError] = useState('')

  if (!aiKey) return null // キー未登録時はコーチカードの導線に任せる

  const generate = async () => {
    setStatus('loading')
    setError('')
    try {
      const context =
        buildCoachContext({ logs, menus, settings }, todayISO()) +
        '\n\n' +
        describeCurrent(settings.weeklySchedule, menus)
      const raw = await generatePlan(aiKey, context)
      const reconciled = reconcilePlan(raw, settings.weeklySchedule)
      setPlan(reconciled)
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
    setSettings((prev) => ({ ...prev, weeklySchedule: plan.weeklySchedule }))
    setStatus('idle')
    setPlan(null)
    setSummary('適用しました。週間スケジュールとメニューを更新しました。')
  }

  return (
    <div className="card">
      <div className="row" style={{ alignItems: 'center' }}>
        <div className="stepper-label" style={{ margin: 0 }}>📋 AIにメニューを組んでもらう</div>
        <span className="spacer" />
        {status !== 'preview' && (
          <button className="btn btn-sm" onClick={generate} disabled={status === 'loading'}>
            {status === 'loading' ? '作成中…' : status === 'idle' ? '作ってもらう' : 'もう一度'}
          </button>
        )}
      </div>

      {status === 'idle' && !summary && (
        <div className="prev-hint" style={{ marginTop: 6 }}>
          直近の記録から筋トレ・ランの週間メニューを設計します（ピックルボールの曜日はそのまま維持）。
        </div>
      )}
      {status === 'idle' && summary && (
        <div className="prev-hint" style={{ marginTop: 8, color: 'var(--good)' }}>{summary}</div>
      )}
      {status === 'loading' && (
        <div className="prev-hint" style={{ marginTop: 8 }}>記録を読み込んでメニューを設計しています…</div>
      )}
      {status === 'error' && (
        <div className="prev-hint" style={{ marginTop: 8, color: 'var(--bad, #e5484d)' }}>作成に失敗しました: {error}</div>
      )}

      {status === 'preview' && plan && (
        <div style={{ marginTop: 10 }}>
          {summary && <div style={{ marginBottom: 10, lineHeight: 1.6 }}>{summary}</div>}

          <div className="stepper-label">週間スケジュール（案）</div>
          <div style={{ marginBottom: 12 }}>
            {WEEKDAY_ORDER.map((wd) => (
              <div className="row" key={wd} style={{ alignItems: 'flex-start', padding: '4px 0', borderTop: '1px solid var(--border)' }}>
                <strong style={{ flex: '0 0 32px' }}>{WEEKDAY_LABEL[wd]}</strong>
                <div style={{ flex: 1 }}>
                  {plan.weeklySchedule[wd].map((it, i) => (
                    <div key={i}>
                      {ACT_LABEL[it.type]}
                      {it.type === 'gym' && it.menuId ? `（${plan.menus.find((m) => m.id === it.menuId)?.name ?? menus.find((m) => m.id === it.menuId)?.name ?? ''}）` : ''}
                      {it.note ? <span className="muted"> — {it.note}</span> : ''}
                    </div>
                  ))}
                </div>
              </div>
            ))}
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
            「適用」で週間スケジュールとジムメニューを上書きします（記録・ピックルボールの曜日は維持）。
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
