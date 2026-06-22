import { useState, useEffect } from 'react'
import { C, SERIF, MONO, btnPrimary, btnGhost } from '../constants'

const LABEL = { fontSize: 11, fontFamily: MONO, color: C.dim, letterSpacing: '.3px',
  textTransform: 'uppercase', marginBottom: 6, display: 'block' }
const INPUT = { width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 8,
  border: `1px solid ${C.line}`, background: C.surface2, color: C.ink, fontSize: 13.5,
  fontFamily: 'inherit', outline: 'none' }

export default function CreateLoopModal({ onSubmit, onClose }) {
  const [title, setTitle] = useState('')
  const [deliverable, setDeliverable] = useState('')
  const [acceptance, setAcceptance] = useState('')
  const [maxRuns, setMaxRuns] = useState('6')
  const [maxDuration, setMaxDuration] = useState('2h')
  const [model, setModel] = useState('sonnet')
  const [pattern, setPattern] = useState('sequential')
  const [escalateAfter, setEscalateAfter] = useState('2')

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function submit(e) {
    e.preventDefault()
    if (!title.trim()) return
    onSubmit({
      title: title.trim(), deliverable: deliverable.trim(), acceptance: acceptance.trim(),
      maxRuns, maxDuration, model, pattern, escalateAfter,
    })
  }

  const canSubmit = title.trim().length > 0

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(43,39,34,.32)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '70px 20px 20px',
      zIndex: 50, overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.surface, border: `1px solid ${C.line}`,
        borderRadius: 16, width: '100%', maxWidth: 520, padding: '24px 26px',
        boxShadow: '0 8px 32px rgba(43,39,34,.12)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontFamily: SERIF, fontSize: 21, fontWeight: 500, color: C.ink }}>新建 loop</h2>
          <button onClick={onClose} style={{ all: 'unset', cursor: 'pointer', color: C.faint, fontSize: 18, lineHeight: 1 }}>×</button>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
          <div>
            <label style={LABEL}>标题 *</label>
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="这个 loop 要达成什么" style={INPUT} />
          </div>
          <div>
            <label style={LABEL}>交付物</label>
            <input value={deliverable} onChange={(e) => setDeliverable(e.target.value)}
              placeholder="auth/x.ts" style={INPUT} />
          </div>
          <div>
            <label style={LABEL}>验收标准</label>
            <input value={acceptance} onChange={(e) => setAcceptance(e.target.value)}
              placeholder="完成信号 / done 的判据" style={INPUT} />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={LABEL}>停止 · 轮数</label>
              <input value={maxRuns} onChange={(e) => setMaxRuns(e.target.value)} style={INPUT} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={LABEL}>停止 · 时长</label>
              <input value={maxDuration} onChange={(e) => setMaxDuration(e.target.value)} style={INPUT} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={LABEL}>模型档位</label>
              <select value={model} onChange={(e) => setModel(e.target.value)} style={INPUT}>
                <option value="sonnet">sonnet</option>
                <option value="opus">opus</option>
                <option value="haiku">haiku</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={LABEL}>loop 模式</label>
              <select value={pattern} onChange={(e) => setPattern(e.target.value)} style={INPUT}>
                <option value="sequential">sequential</option>
                <option value="continuous-pr">continuous-pr</option>
                <option value="rfc-dag">rfc-dag</option>
                <option value="infinite">infinite</option>
              </select>
            </div>
          </div>
          <div>
            <label style={LABEL}>升级阈值（连续 N 轮无进展 → 浮给你）</label>
            <input value={escalateAfter} onChange={(e) => setEscalateAfter(e.target.value)}
              type="number" min="1" style={{ ...INPUT, width: 80 }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
            <button type="button" onClick={onClose} style={btnGhost}>取消</button>
            <button type="submit" disabled={!canSubmit}
              style={{ ...btnPrimary, width: 'auto', padding: '10px 18px',
                opacity: canSubmit ? 1 : 0.5, cursor: canSubmit ? 'pointer' : 'not-allowed' }}>
              启动 loop
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
