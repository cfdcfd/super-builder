import { useState } from 'react'
import { C, SERIF, MONO, SANS, btnPrimary, btnGhost } from '../constants'
import { DOC, NAIVE_STEPS, CONVERGE_STEPS, REVIEW } from '../data'
import { Crumb, Eyebrow } from './shared'

export default function ResultScreen({ r, proj, onBack, onEscalate }) {
  const [phase, setPhase] = useState("annotate") // annotate | naive | converge
  const [notes, setNotes] = useState({})          // { blockId: text }
  const [active, setActive] = useState(null)      // 正在批注的 blockId

  const suspectId = DOC.blocks.find((b) => b.suspect)?.id
  const suspectAnnotated = !!notes[suspectId]

  function addNote(id, text) {
    setNotes((n) => ({ ...n, [id]: text }))
    setActive(null)
  }
  function removeNote(id) {
    setNotes((n) => { const m = { ...n }; delete m[id]; return m })
  }

  return (
    <div className="fade" style={{ paddingTop: 28 }}>
      <Crumb proj={proj} r={r} onBack={onBack} />

      {/* 审查者裁决条 */}
      <div style={{ background: C.surface, border: `1px solid ${C.danger}44`, borderRadius: 14,
        padding: "14px 18px", marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontFamily: MONO, fontSize: 11, color: C.danger, border: `1px solid ${C.danger}66`,
            borderRadius: 20, padding: "2px 10px", background: C.dangerSoft }}>独立审查：{REVIEW.verdict}</span>
          <span style={{ fontFamily: MONO, fontSize: 11, color: C.faint }}>点击任意文档元素 · 在右侧批注</span>
        </div>
        <p style={{ margin: 0, color: C.body, fontSize: 13, lineHeight: 1.6 }}>{REVIEW.summary}</p>
      </div>

      {phase === "annotate" && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 320px", gap: 18, alignItems: "start" }}>
          {/* 左：可批注的 HTML 产物（点击选中元素，不就地展开）*/}
          <AnnotatableDoc notes={notes} active={active}
            onPick={setActive} suspectId={suspectId} />

          {/* 右：批注侧栏（输入与列表都在这里）*/}
          <NotePanel notes={notes} active={active} onRemove={removeNote}
            onAdd={addNote} onCancel={() => setActive(null)} suspectId={suspectId}
            suspectAnnotated={suspectAnnotated}
            onSubmit={() => setPhase("naive")} />
        </div>
      )}

      {/* 提交后：收敛对比 */}
      {phase !== "annotate" && (
        <>
          <Eyebrow t={`你批注了「${shortBlock(DOC.blocks.find(b=>b.id===suspectId))}」· 看同一条批注的两种命运`} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
            <Lane title="多数产品：直接把批注丢回 agent" tone="bad">
              {NAIVE_STEPS.map((s, i) => <Turn key={i} s={s} />)}
              <Stamp tone="bad" text="循环假收敛 · 你被一句「已修复」骗过" />
            </Lane>
            <Lane title="Converge：锚定元素 + 强制归因 + 收敛判据" tone="ok"
              locked={phase === "naive"} onUnlock={() => setPhase("converge")}>
              {phase !== "naive" && CONVERGE_STEPS.map((s, i) => <Turn key={i} s={s} />)}
              {phase !== "naive" && <Stamp tone="ok" text="审查者复核通过 · 真收敛，无需你看过程" />}
            </Lane>
          </div>

          {phase === "converge" && (
            <div style={{ marginTop: 20, display: "flex", gap: 14, alignItems: "center",
              background: C.okSoft, border: `1px solid ${C.ok}44`, borderRadius: 14, padding: "16px 20px" }}>
              <span style={{ color: C.ok, fontSize: 18 }}>✓</span>
              <div style={{ flex: 1, color: C.body, fontSize: 13.5, lineHeight: 1.6 }}>
                <b style={{ color: C.ink }}>这一个结果收敛了。</b> 你的批注锚定在那段代码上，模型据此归因重跑，
                没让你打开那一小时过程。正因为多数循环自己就收住了，你才能同时管几十个 loop。
              </div>
              <button onClick={onBack} style={btnGhost}>回项目台</button>
            </div>
          )}

          <div style={{ marginTop: 18, display: "flex", gap: 10, alignItems: "center",
            color: C.dim, fontSize: 12.5, fontFamily: MONO }}>
            <span>若反复改不动 →</span>
            <button onClick={onEscalate} style={{ all: "unset", cursor: "pointer", color: C.danger,
              borderBottom: `1px dashed ${C.danger}` }}>看已升级的攻关案例 →</button>
          </div>
        </>
      )}
    </div>
  )
}

function shortBlock(b) {
  if (!b) return "代码块"
  if (b.kind === "code") return "rotateRefresh 代码块"
  if (b.kind === "table") return b.text
  return (b.text || "").slice(0, 14) + "…"
}

// ── 可批注的 HTML 文档（点击选中，批注在右侧）──────────────────
function AnnotatableDoc({ notes, active, onPick, suspectId }) {
  return (
    <div style={{ background: C.surface2, border: `1px solid ${C.line}`, borderRadius: 14,
      overflow: "hidden" }}>
      {/* 文档头 */}
      <div style={{ padding: "16px 22px", borderBottom: `1px solid ${C.line2}`, background: C.surface }}>
        <div style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 500, color: C.ink, marginBottom: 4 }}>{DOC.title}</div>
        <div style={{ fontFamily: MONO, fontSize: 11, color: C.faint }}>{DOC.meta}</div>
      </div>
      {/* 文档体 */}
      <div style={{ padding: "10px 14px 22px" }}>
        {DOC.blocks.map((b) => (
          <AnnBlock key={b.id} b={b} note={notes[b.id]} isActive={active === b.id}
            isSuspect={b.id === suspectId} onPick={() => onPick(b.id)} />
        ))}
      </div>
    </div>
  )
}

function AnnBlock({ b, note, isActive, isSuspect, onPick }) {
  const [hover, setHover] = useState(false)
  const annotated = !!note
  const wrapBase = {
    position: "relative", borderRadius: 8, transition: "background .12s, box-shadow .12s",
    cursor: "pointer", margin: "2px 0", padding: "6px 10px",
    background: isActive ? C.claySoft : annotated ? C.clayWash : hover ? C.line2 + "88" : "transparent",
    boxShadow: isActive ? `0 0 0 2px ${C.clay}` : annotated ? `inset 3px 0 0 ${C.clay}` : "none",
  }
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div style={wrapBase} onClick={onPick}>
        {/* 角标：已批注 / 可批注 / 审查者标记 */}
        {annotated ? (
          <Corner color={C.clay} bg={C.surface2} bordered text="✎ 已批注" />
        ) : isActive ? (
          <Corner color="#FFF" bg={C.clay} text="批注中 →" />
        ) : isSuspect ? (
          <Corner color={C.danger} bg={C.dangerSoft} text="⚠ 审查者标记" />
        ) : hover ? (
          <Corner color={C.faint} bg={C.surface2} bordered text="＋ 批注" />
        ) : null}
        <BlockBody b={b} />
      </div>
    </div>
  )
}

function Corner({ color, bg, bordered, text }) {
  return (
    <span style={{ position: "absolute", top: 4, right: 6, fontFamily: MONO, fontSize: 10,
      color, background: bg, borderRadius: 6, padding: "1px 7px",
      border: bordered ? `1px solid ${C.line}` : "none", zIndex: 1 }}>{text}</span>
  )
}

function BlockBody({ b }) {
  if (b.kind === "h2")
    return <div style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 600, color: C.ink, margin: "6px 0 2px" }}>{b.text}</div>
  if (b.kind === "p")
    return <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: C.body }}>{b.text}</p>
  if (b.kind === "code")
    return (
      <pre style={{ margin: 0, fontFamily: MONO, fontSize: 12.5, lineHeight: 1.65, color: C.ink,
        background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8, padding: "12px 14px",
        overflowX: "auto", whiteSpace: "pre" }}>{b.text}</pre>
    )
  if (b.kind === "callout")
    return (
      <div style={{ fontSize: 13, lineHeight: 1.6, color: C.clayDeep, background: C.clayWash,
        borderRadius: 8, padding: "10px 13px" }}>{b.text}</div>
    )
  if (b.kind === "table")
    return (
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <tbody>
          {b.rows.map((row, ri) => (
            <tr key={ri} style={{ background: ri === 0 ? C.surface : ri === b.suspectRow ? C.dangerSoft + "66" : "transparent" }}>
              {row.map((cell, ci) => (
                <td key={ci} style={{ border: `1px solid ${C.line}`, padding: "7px 11px",
                  fontWeight: ri === 0 ? 600 : 400, color: ri === 0 ? C.ink : C.body,
                  fontFamily: ri === 0 ? SANS : SANS }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    )
  return null
}

// ── 批注侧栏（输入 + 列表都在右侧）────────────────────────────
function NotePanel({ notes, active, onAdd, onRemove, onCancel, suspectId, suspectAnnotated, onSubmit }) {
  const ids = Object.keys(notes)
  const activeBlock = active ? DOC.blocks.find((b) => b.id === active) : null

  return (
    <div style={{ position: "sticky", top: 16, background: C.surface, border: `1px solid ${C.line}`,
      borderRadius: 14, overflow: "hidden" }}>
      <div style={{ padding: "13px 16px", borderBottom: `1px solid ${C.line2}`, display: "flex",
        alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: C.ink }}>批注</span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: C.faint }}>{ids.length} 条</span>
      </div>

      {/* 顶部：针对当前选中元素的输入框 */}
      {activeBlock ? (
        <NoteEditor key={active} block={activeBlock} initial={notes[active]}
          suspect={active === suspectId}
          onSave={(t) => onAdd(active, t)} onCancel={onCancel} />
      ) : (
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.line2}`,
          color: C.faint, fontSize: 12.5, lineHeight: 1.6, background: C.surface2 }}>
          点击左侧文档的任意元素，在这里写下批注。每条都会锚定到你选中的元素。
        </div>
      )}

      {/* 批注列表 */}
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 9, maxHeight: 320, overflowY: "auto" }}>
        {ids.length === 0 ? (
          <div style={{ color: C.faint, fontSize: 12, lineHeight: 1.6, padding: "4px 4px" }}>
            还没有批注。
          </div>
        ) : ids.map((id) => {
          const b = DOC.blocks.find((x) => x.id === id)
          const isEditing = id === active
          return (
            <div key={id}
              style={{ background: isEditing ? C.claySoft : C.surface2,
                border: `1px solid ${isEditing ? C.clay + "66" : C.line}`,
                borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                <span style={{ fontFamily: MONO, fontSize: 10, color: C.clay, background: C.claySoft,
                  borderRadius: 5, padding: "1px 7px" }}>↳ {shortBlock(b)}</span>
                <button onClick={() => onRemove(id)} style={{ all: "unset", cursor: "pointer",
                  color: C.faint, fontSize: 13 }}>✕</button>
              </div>
              <div style={{ fontSize: 12.5, color: C.ink, lineHeight: 1.5 }}>{notes[id]}</div>
            </div>
          )
        })}
      </div>

      <div style={{ padding: 12, borderTop: `1px solid ${C.line2}` }}>
        {!suspectAnnotated && (
          <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.faint, marginBottom: 9, lineHeight: 1.5 }}>
            提示：审查者标记的那段代码（⚠）最值得你批注。
          </div>
        )}
        <button onClick={onSubmit} disabled={ids.length === 0}
          style={{ ...btnPrimary, opacity: ids.length ? 1 : .4,
            cursor: ids.length ? "pointer" : "not-allowed" }}>
          提交批注 · 看会发生什么
        </button>
      </div>
    </div>
  )
}

// 右侧输入框（针对选中元素）
function NoteEditor({ block, initial, suspect, onSave, onCancel }) {
  const [v, setV] = useState(initial || "")
  return (
    <div className="fade" style={{ padding: 14, borderBottom: `1px solid ${C.line2}`,
      background: C.clayWash }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
        <span style={{ fontFamily: MONO, fontSize: 10, color: "#FFF", background: C.clay,
          borderRadius: 5, padding: "2px 8px" }}>↳ {shortBlock(block)}</span>
        <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.dim }}>批注锚定到此元素</span>
      </div>
      <textarea autoFocus value={v} onChange={(e) => setV(e.target.value)} rows={3}
        placeholder={suspect ? "例：先删后发不是原子操作，并发下会丢牌。换 CAS 原子换牌。" : "写下你对这个元素的意见…"}
        style={{ width: "100%", boxSizing: "border-box", resize: "none", background: C.surface2,
          border: `1px solid ${C.line}`, borderRadius: 8, color: C.ink, padding: "9px 11px",
          fontFamily: SANS, fontSize: 13.5, lineHeight: 1.5, outline: "none" }} />
      <div style={{ display: "flex", gap: 8, marginTop: 9 }}>
        <button onClick={() => v.trim() && onSave(v.trim())} disabled={!v.trim()}
          style={{ ...btnPrimary, width: "auto", padding: "7px 15px", fontSize: 12.5,
            opacity: v.trim() ? 1 : .45, cursor: v.trim() ? "pointer" : "not-allowed" }}>
          {initial ? "更新批注" : "保存批注"}
        </button>
        <button onClick={onCancel} style={{ ...btnGhost, padding: "7px 14px", fontSize: 12.5 }}>取消</button>
      </div>
    </div>
  )
}

function Lane({ title, tone, children, locked, onUnlock }) {
  const col = tone === "bad" ? C.danger : C.ok
  return (
    <div style={{ background: C.surface, border: `1px solid ${col}33`, borderRadius: 14, overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.line2}`, fontSize: 12.5,
        fontWeight: 600, color: col }}>{title}</div>
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10, minHeight: 88 }}>
        {locked ? (
          <button onClick={onUnlock} style={{ all: "unset", cursor: "pointer", textAlign: "center",
            color: C.ok, fontSize: 13, padding: "22px 0", border: `1px dashed ${C.ok}55`, borderRadius: 10 }}>
            ▶ 看 Converge 怎么处理同一条批注
          </button>
        ) : children}
      </div>
    </div>
  )
}
function Turn({ s }) {
  const map = {
    you: { c: C.clay, lbl: "你" },
    bot: { c: s.bad ? C.danger : C.ok, lbl: "agent" },
    sys: { c: s.bad ? C.danger : C.proj, lbl: "系统" },
  }
  const m = map[s.who]
  return (
    <div className="fade" style={{ display: "flex", gap: 10 }}>
      <span style={{ fontFamily: MONO, fontSize: 10, color: m.c, width: 40, flexShrink: 0, paddingTop: 2 }}>{m.lbl}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, color: C.faint, marginBottom: 3 }}>{s.t}</div>
        <div style={{ fontSize: 13, color: s.bad ? C.danger : C.ink, lineHeight: 1.55 }}>{s.s}</div>
      </div>
    </div>
  )
}
function Stamp({ tone, text }) {
  const col = tone === "bad" ? C.danger : C.ok
  return (
    <div style={{ marginTop: 4, fontFamily: MONO, fontSize: 11, color: col,
      background: tone === "bad" ? C.dangerSoft : C.okSoft, borderRadius: 8, padding: "8px 11px" }}>
      {tone === "bad" ? "✕ " : "✓ "}{text}
    </div>
  )
}
