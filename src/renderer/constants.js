// 视觉常量 —— 套用 Claude Cowork 视觉语言（暖白底 / 赤陶橙强调）
export const C = {
  bg: "#F5F1EB",
  surface: "#FBF9F5",
  surface2: "#FFFFFF",
  raised: "#FEFDFB",
  ink: "#2B2722",
  body: "#4A443C",
  dim: "#8A8175",
  faint: "#B5AC9E",
  line: "#E6DFD4",
  line2: "#EFE9DF",
  clay: "#CC785C",
  clayDeep: "#B5613F",
  claySoft: "#F2E2D9",
  clayWash: "#FBF1EB",
  ok: "#6B7F5E",
  okSoft: "#EAEDE2",
  danger: "#C25B4E",
  dangerSoft: "#F6E5E1",
  proj: "#7A6A9E",
  projSoft: "#ECE7F1"
}

export const SERIF = "'Tiempos Text','Georgia',ui-serif,serif"
export const SANS = "'Styrene B','Inter',-apple-system,system-ui,sans-serif"
export const MONO = "'GT America Mono','SF Mono',ui-monospace,Menlo,monospace"

export const btnPrimary = {
  all: "unset", cursor: "pointer", textAlign: "center", padding: "10px 18px", borderRadius: 10,
  background: C.clay, color: "#FFF", fontWeight: 600, fontSize: 13.5, display: "block", width: "100%", boxSizing: "border-box"
}

export const btnGhost = {
  all: "unset", cursor: "pointer", padding: "9px 16px", borderRadius: 9,
  border: `1px solid ${C.line}`, color: C.body, fontSize: 13, whiteSpace: "nowrap", background: C.surface2
}
