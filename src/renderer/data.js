// ── 数据 ──────────────────────────────────────────────────────
// loop 状态：running 跑着没出结果 / converging 自动收敛中 / needYou 待你审
//            / escalated 已升级攻关 / done 已收敛归档
// 一个项目下挂多个 loop。needYou 与 escalated 会浮到顶部。
export const PROJECTS = [
  {
    id: "PRJ-auth", name: "Auth 服务 v3 迁移",
    blurb: "把鉴权迁到新 token 体系，14 个长程任务并行推进。",
    loops: [
      { id: "loop-4471", title: "重写 refresh token 轮转逻辑", deliverable: "auth/refresh.ts",
        state: "needYou", pri: "high", rounds: 0, runtime: "2h 14m", step: "41/41",
        routeReason: "结果存疑：独立审查者发现并发竞态", confidence: "模型自评 92% · 审查者驳回" },
      { id: "loop-4480", title: "生成 v3 迁移指南文档", deliverable: "docs/migration-v3.md",
        state: "needYou", pri: "med", rounds: 0, runtime: "1h 02m", step: "23/23",
        routeReason: "价值判断：弃用节奏需人拍板", confidence: "非对错问题 · 需你定方向" },
      { id: "loop-4467", title: "统一错误码体系", deliverable: "errors/codes.ts",
        state: "escalated", pri: "deep", rounds: 3, runtime: "4h 38m", step: "—",
        routeReason: "循环已失效：3 轮自我归因未收敛", confidence: "改不动 · 建议进攻关" },
      { id: "loop-4455", title: "JWT 校验中间件改造", deliverable: "auth/verify.ts",
        state: "converging", pri: null, rounds: 1, runtime: "0h 47m", step: "18/22",
        sub: "已自动收敛 1 轮 · 审查者复核中" },
      { id: "loop-4448", title: "登录限流策略", deliverable: "auth/ratelimit.ts",
        state: "running", pri: null, runtime: "0h 31m", step: "12/20" },
      { id: "loop-4490", title: "迁移单元测试套件", deliverable: "tests/auth/*",
        state: "running", pri: null, runtime: "1h 09m", step: "30/55" },
      { id: "loop-4493", title: "废弃旧 session 表", deliverable: "db/migrations",
        state: "running", pri: null, runtime: "0h 18m", step: "5/14" },
      { id: "loop-4496", title: "OAuth 回调兼容层", deliverable: "auth/oauth.ts",
        state: "running", pri: null, runtime: "0h 52m", step: "21/33" },
      { id: "loop-4401", title: "密钥轮换调度", deliverable: "auth/rotation.ts",
        state: "done", pri: null, runtime: "1h 40m", step: "完成" },
      { id: "loop-4402", title: "审计日志埋点", deliverable: "auth/audit.ts",
        state: "done", pri: null, runtime: "0h 55m", step: "完成" },
      { id: "loop-4403", title: "错误响应脱敏", deliverable: "auth/sanitize.ts",
        state: "done", pri: null, runtime: "0h 40m", step: "完成" },
      { id: "loop-4404", title: "刷新令牌存储迁移", deliverable: "store/refresh.ts",
        state: "done", pri: null, runtime: "1h 12m", step: "完成" },
      { id: "loop-4405", title: "登录指标看板", deliverable: "dash/login.tsx",
        state: "done", pri: null, runtime: "0h 33m", step: "完成" },
      { id: "loop-4406", title: "跨域 cookie 配置", deliverable: "config/cors.ts",
        state: "done", pri: null, runtime: "0h 21m", step: "完成" },
    ],
  },
  {
    id: "PRJ-rag", name: "RAG 检索层重构",
    blurb: "混合召回 + reranker 选型，结果质量分歧较大。",
    loops: [
      { id: "loop-4502", title: "选定 cross-encoder reranker", deliverable: "retrieval/rerank.py",
        state: "needYou", pri: "med", rounds: 1, runtime: "3h 02m", step: "53/53",
        routeReason: "结果分歧：两套方案召回率接近", confidence: "模型反复横跳 · 需你定调" },
      { id: "loop-4510", title: "稠密向量索引构建", deliverable: "index/dense.py",
        state: "converging", pri: null, rounds: 1, runtime: "1h 20m", step: "28/40",
        sub: "已自动收敛 1 轮 · 审查者复核中" },
      { id: "loop-4511", title: "稀疏 BM25 通道", deliverable: "index/sparse.py",
        state: "running", pri: null, runtime: "0h 44m", step: "15/30" },
      { id: "loop-4512", title: "MMR 去重逻辑", deliverable: "retrieval/mmr.py",
        state: "running", pri: null, runtime: "0h 26m", step: "9/18" },
      { id: "loop-4513", title: "召回评测集构建", deliverable: "eval/recall_set.json",
        state: "running", pri: null, runtime: "1h 03m", step: "22/35" },
      { id: "loop-4490b", title: "查询改写模块", deliverable: "query/rewrite.py",
        state: "done", pri: null, runtime: "0h 50m", step: "完成" },
      { id: "loop-4491b", title: "分块策略调优", deliverable: "chunk/strategy.py",
        state: "done", pri: null, runtime: "1h 15m", step: "完成" },
      { id: "loop-4492b", title: "向量库选型评估", deliverable: "docs/vecdb.md",
        state: "done", pri: null, runtime: "0h 38m", step: "完成" },
    ],
  },
  {
    id: "PRJ-pay", name: "支付对账系统",
    blurb: "全部在正轨，已替你判断「无需打扰」。",
    loops: Array.from({ length: 11 }).map((_, i) => ({
      id: `loop-46${10 + i}`,
      title: ["交易流水拉取","对账规则引擎","差异检测","退款幂等校验","账期切分",
        "异常工单生成","汇率快照","对账报表","审计留痕","告警阈值","定时任务编排"][i],
      deliverable: "pay/*",
      state: i < 6 ? "running" : "done", pri: null,
      runtime: `${i % 3}h ${10 + i * 4}m`, step: i < 6 ? `${10 + i}/${30}` : "完成",
    })),
  },
]

// 状态显示规格
export const LOOP_STATE = {
  needYou:    { label: "待你审", c: "#CC785C",   dot: "#CC785C" },
  escalated:  { label: "已升级攻关", c: "#C25B4E", dot: "#C25B4E" },
  converging: { label: "自动收敛中", c: "#7A6A9E",  dot: "#7A6A9E" },
  running:    { label: "运行中", c: "#8A8175",    dot: "#6B7F5E" },
  done:       { label: "已收敛", c: "#B5AC9E",  dot: "#B5AC9E" },
}
export const ATTENTION = new Set(["needYou", "escalated"]) // 会浮到顶部的

// 项目统计
export function projStats(p) {
  const need = p.loops.filter((l) => ATTENTION.has(l.state)).length
  const running = p.loops.filter((l) => l.state === "running" || l.state === "converging").length
  const done = p.loops.filter((l) => l.state === "done").length
  return { total: p.loops.length, need, running, done }
}
// loop 排序：注意项在前，再收敛中，再运行，再已完成
const ORDER = { needYou: 0, escalated: 1, converging: 2, running: 3, done: 4 }
export function sortedLoops(p) {
  return [...p.loops].sort((a, b) => ORDER[a.state] - ORDER[b.state])
}
export const PRI = {
  high: { label: "需判断", c: "#CC785C" }, med: { label: "需拍板", c: "#B8923E" },
  deep: { label: "需攻关", c: "#C25B4E" },
}
export const REVIEW = {
  verdict: "可疑",
  summary: "新轮转逻辑在并发下会丢牌：先删旧 token 再发新 token 不是原子操作。模型的自我总结称此为「合理的单次使用设计」，但审查者认为这正是缺陷被掩盖处。",
  suspect: "auth/refresh.ts:4-6 — 删除与签发之间存在竞态窗口",
}

// agent 产出的 HTML 产物 —— 每个元素可批注。
// suspect:true 的元素是审查者点出的可疑处，批注它会触发收敛对比。
export const DOC = {
  title: "Refresh Token 轮转逻辑 · 实现说明",
  meta: "loop-4471 · 由 agent 自动生成 · auth/refresh.ts",
  blocks: [
    { id: "b1", kind: "h2", text: "设计目标" },
    { id: "b2", kind: "p", text:
      "将 refresh token 从「长期有效」改为「单次使用 + 轮转」：每次刷新都签发新的 refresh token，并使旧的立即失效，以缩小被盗用的时间窗口。" },
    { id: "b3", kind: "h2", text: "核心实现" },
    { id: "b4", kind: "p", text: "轮转函数接收旧 token，校验后删除旧记录、签发并存储新 token，最后返回新 token：" },
    { id: "b5", kind: "code", suspect: true, text:
`async function rotateRefresh(oldToken) {
  const rec = await store.get(oldToken);
  if (!rec) throw new InvalidToken();
  await store.delete(oldToken);        // 先删旧
  const next = mint(rec.userId);
  await store.put(next, rec.userId);   // 再发新
  return next;
}` },
    { id: "b6", kind: "callout", text:
      "设计说明：采用「单次使用」语义，旧 token 一经使用即失效，符合 OAuth 2.0 refresh token rotation 推荐实践。" },
    { id: "b7", kind: "h2", text: "失效策略" },
    { id: "b8", kind: "table", text: "失效场景对照",
      rows: [
        ["场景", "处理"],
        ["正常刷新", "旧 token 删除，签发新 token"],
        ["旧 token 重放", "store 查不到 → InvalidToken"],
        ["并发刷新", "「按单次使用语义自然处理」"],
      ], suspectRow: 3 },
    { id: "b9", kind: "p", text:
      "测试覆盖：单元测试 12 例通过；集成测试 test_refresh_concurrent 当前为 flaky，偶发失败，已标记为待观察。" },
  ],
}

export const NAIVE_STEPS = [
  { t: "你的批注", s: "并发下会丢牌，这个方向不对。", who: "you" },
  { t: "agent 回应", s: "已修复 ✓ 我加了一条注释说明设计意图。", who: "bot", bad: true },
  { t: "真实情况", s: "根因未触碰。agent 遇主观反馈「鬼隐」，做了表面改动。", who: "sys", bad: true },
]
export const CONVERGE_STEPS = [
  { t: "你的批注", s: "并发下会丢牌，这个方向不对。", who: "you" },
  { t: "强制自我归因", s: "把批注 + 完整轨迹交给独立归因器：定位到第 4-6 行非原子操作，而非表面注释。", who: "sys" },
  { t: "agent 重跑（仅受影响节点）", s: "改用 CAS 原子换牌；并发测试通过。", who: "bot" },
  { t: "收敛判据", s: "审查者复核 → 缺陷消失，循环收敛。无需你看过程。", who: "sys", good: true },
]
export const TRACE = [
  { id: "n1", title: "梳理现有错误码", state: "ok" },
  { id: "n2", title: "设计统一 code 枚举", state: "ok" },
  { id: "n3", title: "映射旧码到新码", state: "bad", note: "← 3 轮都栽在这" },
  { id: "n4", title: "生成兼容层", state: "stuck" },
]
