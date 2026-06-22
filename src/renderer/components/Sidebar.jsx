import { C, SERIF, MONO } from '../constants'
import { PROJECTS, projStats } from '../data'

function NavItem({ icon, label, active, badge, badgeDanger, onClick }) {
  return (
    <button onClick={onClick} style={{ all: "unset", cursor: "pointer", display: "flex",
      alignItems: "center", gap: 11, padding: "8px 10px", borderRadius: 8, marginBottom: 2,
      background: active ? C.clayWash : "transparent" }}>
      <span style={{ fontSize: 14, color: active ? C.clay : C.dim, width: 16 }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 13.5, color: active ? C.ink : C.body, fontWeight: active ? 600 : 400 }}>{label}</span>
      {badge && <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.clay,
        background: C.claySoft, borderRadius: 10, padding: "1px 7px" }}>{badge}</span>}
      {badgeDanger && <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.danger,
        background: C.dangerSoft, borderRadius: 10, padding: "1px 7px" }}>{badgeDanger}</span>}
    </button>
  )
}

export default function Sidebar({ proj, setProj, onHome }) {
  return (
    <aside style={{ width: 248, flexShrink: 0, background: C.surface,
      borderRight: `1px solid ${C.line}`, height: "100vh", display: "flex",
      flexDirection: "column", padding: "20px 14px" }}>
      <button onClick={onHome} style={{ all: "unset", cursor: "pointer", display: "flex",
        alignItems: "center", gap: 10, padding: "4px 8px", marginBottom: 24 }}>
        <span style={{ width: 24, height: 24, borderRadius: 7, background: C.clay,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ width: 9, height: 9, borderRadius: 2, background: C.surface }} />
        </span>
        <span style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 500, color: C.ink, letterSpacing: ".2px" }}>
          Converge
        </span>
      </button>

      <NavItem icon="◇" label="项目总览" active onClick={onHome} />
      <NavItem icon="◷" label="待我处理" badge={String(PROJECTS.flatMap(p=>p.loops).filter(l=>l.state==="needYou").length)} />
      <NavItem icon="⎙" label="已收敛" />
      <NavItem icon="⚑" label="攻关中" badgeDanger={String(PROJECTS.flatMap(p=>p.loops).filter(l=>l.state==="escalated").length)} />

      <div style={{ fontSize: 11, color: C.faint, fontFamily: MONO, letterSpacing: ".5px",
        padding: "20px 10px 8px", textTransform: "uppercase" }}>项目</div>
      {PROJECTS.map((p) => {
        const on = p.id === proj.id
        const st = projStats(p)
        return (
          <button key={p.id} onClick={() => setProj(p)} style={{ all: "unset", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8,
            marginBottom: 2, background: on ? C.claySoft : "transparent", transition: "background .12s" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
              background: st.need > 0 ? C.clay : C.ok }} />
            <span style={{ flex: 1, fontSize: 13, color: on ? C.ink : C.body, fontWeight: on ? 600 : 400,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
            {st.need > 0 && (
              <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.clay }}>{st.need}</span>
            )}
          </button>
        )
      })}

      <div style={{ marginTop: "auto", padding: "10px", borderTop: `1px solid ${C.line2}`,
        display: "flex", alignItems: "center", gap: 9 }}>
        <span style={{ width: 26, height: 26, borderRadius: "50%", background: C.projSoft,
          color: C.proj, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>D</span>
        <span style={{ fontSize: 12.5, color: C.dim }}>Dong · 工作区</span>
      </div>
    </aside>
  )
}
