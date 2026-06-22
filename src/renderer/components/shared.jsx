import { C, MONO, SERIF } from '../constants'

export function Crumb({ proj, r, onBack }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11, flexWrap: "wrap", marginBottom: 8 }}>
      <button onClick={onBack} style={{ all: "unset", cursor: "pointer", color: C.dim, fontSize: 13, fontFamily: MONO }}>← 项目台</button>
      <span style={{ color: C.faint }}>/</span>
      <span style={{ fontFamily: MONO, fontSize: 12, color: C.proj }}>{proj.id}</span>
      <span style={{ color: C.faint }}>/</span>
      <span style={{ fontFamily: MONO, fontSize: 12, color: C.faint }}>{r.id}</span>
      <span style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 500, color: C.ink }}>{r.title}</span>
    </div>
  )
}

export function Eyebrow({ t, noTop }) {
  return (
    <div style={{ display: "flex", gap: 9, alignItems: "center", margin: noTop ? "0 0 12px" : "26px 0 12px" }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.clay }} />
      <span style={{ fontFamily: MONO, fontSize: 11.5, color: C.dim, letterSpacing: ".4px" }}>{t}</span>
    </div>
  )
}
