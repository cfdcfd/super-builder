import { C, SERIF, MONO, btnPrimary } from '../constants'
import { TRACE } from '../data'
import { Crumb, Eyebrow } from './shared'

export default function DeepScreen({ r, proj, onBack }) {
  return (
    <div className="fade" style={{ paddingTop: 28 }}>
      <Crumb proj={proj} r={{ ...r, title: r.title || "统一错误码体系" }} onBack={onBack} />

      <div style={{ background: C.dangerSoft, border: `1px solid ${C.danger}55`, borderRadius: 14,
        padding: "15px 18px", display: "flex", gap: 12, alignItems: "center", marginBottom: 24 }}>
        <span style={{ color: C.danger, fontSize: 16 }}>⏏</span>
        <div style={{ fontSize: 13.5, lineHeight: 1.55, color: C.ink }}>
          <b>阀门触发：结果级循环已失效。</b>
          <span style={{ color: C.body }}> 系统替你跑了 3 轮「批注→归因→重跑」，每轮都栽在同一处、且无收敛迹象。现在——也只有现在——请你打开过程。</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.05fr 1fr", gap: 20, alignItems: "start" }}>
        <div>
          <Eyebrow t="过程轨迹 · 折叠成一屏，红色标出反复栽倒处" noTop />
          <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, padding: 10 }}>
            {TRACE.map((n) => {
              const m = { ok: [C.ok, "✓"], bad: [C.danger, "✕"], stuck: [C.clay, "⏸"] }[n.state]
              return (
                <div key={n.id} style={{ display: "flex", gap: 11, alignItems: "center", padding: "12px",
                  borderRadius: 10, marginBottom: 4, background: n.state === "bad" ? C.dangerSoft : "transparent" }}>
                  <span style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, background: m[0] + "22",
                    color: m[0], fontSize: 11, fontFamily: MONO, display: "flex", alignItems: "center", justifyContent: "center" }}>{m[1]}</span>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: C.faint, width: 22 }}>{n.id}</span>
                  <span style={{ flex: 1, fontSize: 14, color: n.state === "ok" ? C.dim : C.ink,
                    fontWeight: n.state === "ok" ? 400 : 600 }}>{n.title}</span>
                  {n.note && <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.danger }}>{n.note}</span>}
                </div>
              )
            })}
          </div>
        </div>

        <div>
          <Eyebrow t="为什么自动收敛失败 · 三轮留痕" noTop />
          <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, padding: 16,
            display: "flex", flexDirection: "column", gap: 13 }}>
            {[
              ["第 1 轮", "归因到命名风格，改了枚举名。审查者：根因未动。"],
              ["第 2 轮", "归因到映射表缺项，补了 3 条。审查者：仍漏旧码段。"],
              ["第 3 轮", "归因到兼容层，重写。审查者：与新枚举循环依赖。"],
            ].map(([k, v], i) => (
              <div key={i} style={{ display: "flex", gap: 10 }}>
                <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.danger, width: 38, flexShrink: 0, paddingTop: 2 }}>{k}</span>
                <span style={{ fontSize: 13, color: C.body, lineHeight: 1.55 }}>{v}</span>
              </div>
            ))}
            <div style={{ fontSize: 13, color: C.ink, lineHeight: 1.6, background: C.clayWash,
              borderRadius: 10, padding: "11px 13px" }}>
              系统判断：三轮归因在「症状」间打转，未触达「旧码与新枚举的根本结构冲突」。这是模型当前盲区 —— 该你下场重新定义问题了。
            </div>
            <button onClick={onBack} style={btnPrimary}>我来接管这个根因 →</button>
          </div>
        </div>
      </div>

      <p style={{ marginTop: 22, color: C.dim, fontSize: 13, lineHeight: 1.65, maxWidth: 720 }}>
        你打开过程，是因为系统已证明「结果级反馈这条便宜的路走不通」。这正是省下平庸注意力、
        把它攒到这一刻的意义 —— 攻关只发生在真正配得上你智力的地方。
      </p>
    </div>
  )
}
