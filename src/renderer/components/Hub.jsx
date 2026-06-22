import { useState } from 'react'
import { C, SERIF, MONO } from '../constants'
import { projStats, sortedLoops, ATTENTION, LOOP_STATE, PRI } from '../data'

export default function Hub({ proj, onOpen }) {
  const st = projStats(proj)
  const loops = sortedLoops(proj)
  const attn = loops.filter((l) => ATTENTION.has(l.state))
  const conv = loops.filter((l) => l.state === "converging")
  const run = loops.filter((l) => l.state === "running")
  const done = loops.filter((l) => l.state === "done")

  return (
    <div className="fade">
      <header style={{ padding: "44px 0 30px" }}>
        <div style={{ fontFamily: MONO, fontSize: 12, color: C.clay, letterSpacing: 1, marginBottom: 16 }}>
          人类的理解，才是瓶颈
        </div>
        <h1 style={{ margin: 0, fontFamily: SERIF, fontSize: 34, lineHeight: 1.25, fontWeight: 500,
          color: C.ink, letterSpacing: "-.3px", maxWidth: 680 }}>
          一个项目下，多个 loop 并行跑。<br />
          只有<span style={{ color: C.clay }}>该你拍板的</span>才浮上来。
        </h1>
        <p style={{ margin: "18px 0 0", color: C.dim, maxWidth: 600, lineHeight: 1.7, fontSize: 15 }}>
          一小时长程任务的偏差会落在结果里。你批注结果，模型自己归因重跑；
          改不动的极少数，才请你打开看过程。
        </p>
      </header>

      {/* 项目概览卡 */}
      <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16,
        padding: "22px 24px", marginBottom: 30 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontFamily: SERIF, fontSize: 21, fontWeight: 500, color: C.ink }}>{proj.name}</h2>
          <span style={{ fontFamily: MONO, fontSize: 11.5, color: C.dim }}>{proj.id}</span>
        </div>
        <p style={{ margin: "0 0 18px", color: C.body, fontSize: 14, lineHeight: 1.6 }}>{proj.blurb}</p>
        <StatusStrip loops={loops} />
        <div style={{ display: "flex", gap: 22, marginTop: 16, fontFamily: MONO, fontSize: 12, flexWrap: "wrap" }}>
          <Stat n={st.total} t="loop" />
          <Stat n={st.need} t="待你" tone={st.need ? "clay" : "ok"} />
          <Stat n={st.running} t="在跑" tone="ok" />
          <Stat n={st.done} t="已收敛" />
        </div>
      </div>

      {/* 1. 需要你的 loop（浮顶）*/}
      {attn.length > 0 && (
        <Section title="需要你" hint="结果存疑 / 价值判断 / 循环失效">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {attn.map((l) => <LoopCard key={l.id} l={l} onOpen={onOpen} prominent />)}
          </div>
        </Section>
      )}

      {/* 2. 自动收敛中（系统在替你处理，不必看）*/}
      {conv.length > 0 && (
        <Section title="自动收敛中" hint="系统在替你迭代，收住了就归档，不必打扰你">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {conv.map((l) => <LoopRow key={l.id} l={l} />)}
          </div>
        </Section>
      )}

      {/* 3. 运行中（安静网格）*/}
      {run.length > 0 && (
        <Section title="运行中" hint={`${run.length} 个长程任务在跑，尚未产出结果`}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 8 }}>
            {run.map((l) => <LoopChip key={l.id} l={l} />)}
          </div>
        </Section>
      )}

      {/* 4. 已收敛（折叠）*/}
      {done.length > 0 && <DoneFold loops={done} />}
    </div>
  )
}

function Section({ title, hint, children }) {
  return (
    <div style={{ marginBottom: 30 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: C.ink }}>{title}</h3>
        <span style={{ color: C.faint, fontFamily: MONO, fontSize: 11 }}>{hint}</span>
      </div>
      {children}
    </div>
  )
}

// 概览条：每个 loop 一格，颜色=状态
function StatusStrip({ loops }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {loops.map((l) => {
        const s = LOOP_STATE[l.state]
        const lit = ATTENTION.has(l.state)
        return (
          <div key={l.id} title={`${l.id} · ${s.label}`} style={{ flex: 1, height: 9, borderRadius: 3,
            background: lit ? s.dot : l.state === "converging" ? C.projSoft : l.state === "done" ? C.line2 : C.okSoft,
            border: `1px solid ${lit ? "transparent" : C.line}` }} />
        )
      })}
    </div>
  )
}

function Stat({ n, t, tone }) {
  const c = tone === "ok" ? C.ok : tone === "clay" ? C.clay : C.ink
  return (
    <span style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
      <span style={{ fontSize: 17, fontWeight: 700, color: c }}>{n}</span>
      <span style={{ color: C.dim }}>{t}</span>
    </span>
  )
}

// 已收敛折叠区
function DoneFold({ loops }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ marginBottom: 30 }}>
      <button onClick={() => setOpen(!open)} style={{ all: "unset", cursor: "pointer", display: "flex",
        alignItems: "center", gap: 9, marginBottom: open ? 14 : 0, color: C.dim, fontSize: 14 }}>
        <span style={{ fontSize: 12, color: C.faint }}>{open ? "▾" : "▸"}</span>
        <span style={{ fontWeight: 600 }}>已收敛 {loops.length} 个</span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: C.faint }}>· 通过独立审查，已归档</span>
      </button>
      {open && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 8 }}>
          {loops.map((l) => <LoopChip key={l.id} l={l} muted />)}
        </div>
      )}
    </div>
  )
}

// 需要你的 loop —— 大卡片
function LoopCard({ l, onOpen, prominent }) {
  const p = l.pri ? PRI[l.pri] : { label: LOOP_STATE[l.state].label, c: LOOP_STATE[l.state].c }
  const [h, setH] = useState(false)
  return (
    <button onClick={() => onOpen(l)} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ all: "unset", cursor: "pointer", display: "block", background: h ? C.raised : C.surface,
        border: `1px solid ${h ? C.clay + "66" : C.line}`, borderLeft: `3px solid ${p.c}`,
        borderRadius: 14, padding: "17px 20px", transition: "all .14s",
        boxShadow: h ? "0 2px 12px rgba(204,120,92,.08)" : "none" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: 9, alignItems: "center", marginBottom: 9 }}>
            <span style={{ fontFamily: MONO, fontSize: 10, color: p.c, border: `1px solid ${p.c}66`,
              borderRadius: 20, padding: "2px 9px", background: p.c === C.clay ? C.claySoft : "transparent" }}>{p.label}</span>
            <span style={{ fontFamily: MONO, fontSize: 11, color: C.faint }}>{l.id}</span>
            {l.rounds > 0 && <span style={{ fontFamily: MONO, fontSize: 10,
              color: l.state === "escalated" ? C.danger : C.dim }}>已 {l.rounds} 轮</span>}
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 500, color: C.ink, marginBottom: 6 }}>{l.title}</div>
          <div style={{ color: C.dim, fontSize: 13, lineHeight: 1.5 }}>
            <span style={{ color: p.c, fontFamily: MONO, fontSize: 12 }}>{l.routeReason}</span>
            <span style={{ color: C.faint }}>　·　{l.deliverable}</span>
          </div>
        </div>
        <div style={{ textAlign: "right", fontFamily: MONO, fontSize: 11, color: C.faint, whiteSpace: "nowrap", paddingTop: 2 }}>
          <div style={{ maxWidth: 120, whiteSpace: "normal", lineHeight: 1.45 }}>{l.confidence}</div>
          <div style={{ marginTop: 12, color: h ? p.c : C.faint }}>
            {l.state === "escalated" ? "进攻关 →" : "看结果 →"}
          </div>
        </div>
      </div>
    </button>
  )
}

// 自动收敛中 —— 行
function LoopRow({ l }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, background: C.surface,
      border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px 16px" }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.proj, flexShrink: 0 }}
        className="breathe" />
      <span style={{ fontFamily: MONO, fontSize: 11, color: C.faint, width: 70, flexShrink: 0 }}>{l.id}</span>
      <span style={{ flex: 1, fontSize: 13.5, color: C.ink, fontWeight: 500 }}>{l.title}</span>
      <span style={{ fontSize: 12, color: C.proj, fontFamily: MONO }}>{l.sub}</span>
      <span style={{ fontFamily: MONO, fontSize: 11, color: C.faint, width: 48, textAlign: "right" }}>{l.step}</span>
    </div>
  )
}

// 运行中 / 已收敛 —— 小芯片
function LoopChip({ l, muted }) {
  const s = LOOP_STATE[l.state]
  return (
    <div style={{ background: muted ? "transparent" : C.surface, border: `1px solid ${C.line}`,
      borderRadius: 11, padding: "11px 13px", opacity: muted ? .65 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flexShrink: 0 }}
          className={l.state === "running" ? "breathe" : ""} />
        <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.faint }}>{l.id}</span>
        <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 10.5, color: s.c }}>
          {l.state === "done" ? "✓" : l.step}
        </span>
      </div>
      <div style={{ fontSize: 13, color: muted ? C.dim : C.ink, fontWeight: 500, lineHeight: 1.35 }}>{l.title}</div>
    </div>
  )
}
