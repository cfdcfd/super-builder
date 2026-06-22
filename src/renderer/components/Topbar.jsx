import { C, MONO } from '../constants'
import { PROJECTS, ATTENTION } from '../data'

export default function Topbar({ screen }) {
  const map = { hub: "项目总览", result: "结果审阅", deep: "攻关模式" }
  const all = PROJECTS.flatMap((p) => p.loops)
  const runN = all.filter((l) => l.state === "running" || l.state === "converging").length
  const needN = all.filter((l) => ATTENTION.has(l.state)).length
  return (
    <div style={{ height: 56, flexShrink: 0, borderBottom: `1px solid ${C.line}`,
      background: "rgba(251,249,245,.8)", backdropFilter: "blur(8px)", display: "flex",
      alignItems: "center", padding: "0 40px", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 13.5, color: C.ink, fontWeight: 600 }}>{map[screen]}</span>
        <span style={{ fontSize: 12, color: C.faint, fontFamily: MONO }}>
          人只看结果 · 改不动的才看过程
        </span>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Pill>{runN} 个 loop 在跑</Pill>
        <Pill tone="clay">{needN} 待我</Pill>
      </div>
    </div>
  )
}

function Pill({ children, tone }) {
  const clay = tone === "clay"
  return (
    <span style={{ fontFamily: MONO, fontSize: 11, padding: "4px 11px", borderRadius: 20,
      background: clay ? C.claySoft : C.surface2, color: clay ? C.clayDeep : C.dim,
      border: `1px solid ${clay ? "transparent" : C.line}` }}>{children}</span>
  )
}
