# 新建 loop 创建功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Hub 屏增加「+ 新建 loop」按钮 + 模态表单，创建的 loop 持久化到 localStorage 并出现在「运行中」区。

**Architecture:** 在 App 层把 loop 数据提升为可变 state（`projects`），由 `loadProjects()` 合并不可变种子 `PROJECTS` 与 localStorage 中的用户 loop。模态表单收集 7 字段（标题/交付物/验收标准/停止条件/模型档位/loop 模式/升级阈值），提交后 append 到当前 project 并持久化。Sidebar 接口不变，Topbar 改为从 `projects` prop 读计数。

**Tech Stack:** Electron + electron-vite, React 18 (hooks), 无构建步骤变化。

## Global Constraints

- **无测试框架**：spec 的 out-of-scope 明确「不引入测试框架」。本计划用 `node -e`（纯函数）+ `npm run build`（编译 gate）+ `npm run dev` + DevTools console / 手动走查（运行时）替代自动化测试。每个任务的「验证」步骤给出确切命令与期望输出。
- **不改现有 UI/文案/状态机**：种子数据、现有组件的视觉与文案零改动（Topbar 改数据来源但不改外观）。
- **视觉常量**复用 `src/renderer/constants.js` 的 `C` / `SERIF` / `MONO` / `btnPrimary` / `btnGhost`，不新增色值。
- **store.js 纯函数原则**：`buildLoop` 不调用 `Date.now()`/`Math.random()`；`createdAt` 与 `id` 由调用方（App）传入，保持可测。
- **localStorage 失败降级**：所有 `window.localStorage` 访问 try/catch，失败时返回空/`false`，不抛错。
- 提交信息遵循 conventional commits；末尾加 `Co-Authored-By: Claude <noreply@anthropic.com>`。

---

## File Structure

| 文件 | 改动 | 责任 |
|---|---|---|
| `src/renderer/store.js` | **新建** | 持久化层纯函数：`genLoopId` / `buildLoop` / `loadUserLoops` / `addUserLoop` / `loadProjects` |
| `src/renderer/components/CreateLoopModal.jsx` | **新建** | 模态表单组件：7 字段、Esc/点背景关闭、标题空禁用提交 |
| `src/renderer/components/App.jsx` | 改 | 提升 `projects` state + `projId` 派生 + `handleCreateLoop` |
| `src/renderer/components/Topbar.jsx` | 改 | 从 `projects` prop 读计数（替代直接 import `PROJECTS`） |
| `src/renderer/components/Hub.jsx` | 改 | 项目卡 header 加按钮 + 本地 modal open state + 提交透传 `onCreateLoop` |

`Sidebar.jsx` / `ResultScreen.jsx` / `DeepScreen.jsx` / `data.js` / `constants.js` 不动。

---

### Task 1: store.js 持久化层

**Files:**
- Create: `src/renderer/store.js`

**Interfaces:**
- Consumes: `PROJECTS` from `./data`（只读种子）
- Produces:
  - `genLoopId(existing: Loop[]): string` — 4 位随机 id，防碰撞
  - `buildLoop(form: {id,title,deliverable,acceptance,maxRuns,maxDuration,model,pattern,escalateAfter}, createdAt: number): Loop`
  - `loadUserLoops(): {[projId: string]: Loop[]}` — 读 localStorage，失败返回 `{}`
  - `addUserLoop(projId: string, loop: Loop): boolean` — 追加并写 localStorage，失败返回 `false`
  - `loadProjects(): Project[]` — 合并种子 + 用户 loop

- [ ] **Step 1: 写 store.js**

```js
// src/renderer/store.js
// 用户创建 loop 的持久化层。种子 PROJECTS 保持不可变；localStorage 只存用户创建的 loop。
import { PROJECTS } from './data'

const STORAGE_KEY = 'super-builder:user-loops'

// 生成 4 位随机 id，与 existing 列表防碰撞
export function genLoopId(existing = []) {
  const taken = new Set(existing.map((l) => l && l.id))
  for (let i = 0; i < 100; i++) {
    const n = String(Math.floor(Math.random() * 10000)).padStart(4, '0')
    const id = 'loop-' + n
    if (!taken.has(id)) return id
  }
  return 'loop-' + Date.now()
}

// 由表单数据组装 loop 对象。id 与 createdAt 由调用方传入（保持纯函数可测）。
export function buildLoop(form, createdAt) {
  return {
    id: form.id,
    title: form.title,
    deliverable: form.deliverable || '',
    state: 'running',
    pri: null,
    rounds: 0,
    runtime: '0h 00m',
    step: '0/—',
    acceptance: form.acceptance || '',
    maxRuns: form.maxRuns,
    maxDuration: form.maxDuration,
    model: form.model,
    pattern: form.pattern,
    escalateAfter: form.escalateAfter,
    createdAt,
    userCreated: true,
  }
}

export function loadUserLoops() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function addUserLoop(projId, loop) {
  try {
    const all = loadUserLoops()
    all[projId] = all[projId] || []
    all[projId].push(loop)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
    return true
  } catch {
    return false
  }
}

export function loadProjects() {
  const userLoops = loadUserLoops()
  return PROJECTS.map((p) => ({
    ...p,
    loops: [...p.loops, ...(userLoops[p.id] || [])],
  }))
}
```

- [ ] **Step 2: 用 node -e 验证纯函数 genLoopId / buildLoop**

`loadUserLoops`/`addUserLoop` 依赖 `window.localStorage`，node 环境没有；用 try/catch 包裹后 `loadUserLoops()` 会返回 `{}`。先验证不碰 window 的两个纯函数：

Run:
```bash
node -e "
import('./src/renderer/store.js').then(({ genLoopId, buildLoop }) => {
  const existing = [{ id: 'loop-4471' }, { id: 'loop-4480' }];
  const id = genLoopId(existing);
  console.assert(id.startsWith('loop-'), 'id 前缀');
  console.assert(!existing.some(l => l.id === id), '不与 existing 碰撞');
  const loop = buildLoop({ id, title: '测试', deliverable: 'a.ts', acceptance: 'done', maxRuns: '6', maxDuration: '2h', model: 'sonnet', pattern: 'sequential', escalateAfter: '2' }, 123);
  console.assert(loop.state === 'running', 'state=running');
  console.assert(loop.step === '0/—', 'step');
  console.assert(loop.userCreated === true, 'userCreated');
  console.assert(loop.createdAt === 123, 'createdAt 透传');
  console.log('store 纯函数 OK', id);
});
"
```
Expected: 打印 `store 纯函数 OK loop-XXXX`，无 AssertionError。

> 注：`store.js` 用 `import { PROJECTS } from './data'`（ESM），`node -e` 直接 import 源文件即可（项目为 ESM，`package.json` 有 `"type":"module"`）。若 node 因 `window` 引用报错，说明 `loadUserLoops` 在 module 顶层被调用——本设计中它只在函数体内访问 `window`，模块加载不会触发，不会报错。

- [ ] **Step 3: npm run build 编译 gate**

Run: `npm run build`
Expected: `✓ built` 且无报错（store.js 被 renderer 入口 tree-shake 掉若尚未被 import；此时还没被 import，build 仍应通过——只是确认 store.js 语法正确）。

- [ ] **Step 4: Commit**

```bash
git add src/renderer/store.js
git commit -m "feat: add store.js persistence layer for user-created loops

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: App.jsx 状态提升

**Files:**
- Modify: `src/renderer/components/App.jsx`

**Interfaces:**
- Consumes: `loadProjects` / `genLoopId` / `buildLoop` / `addUserLoop` from `../store`
- Produces:
  - `App` 向 `Hub` 传 `onCreateLoop(form)`（form 含 7 字段，不含 id/createdAt）
  - `App` 向 `Topbar` 传 `projects`（Task 3 消费）
  - `Sidebar` 接口不变：仍收 `proj`（project 对象）+ `setProj(p)`；App 内 `setProj` 包装为 `setProjId(p.id)`

- [ ] **Step 1: 改 App.jsx — 提升 projects state + projId 派生 + handleCreateLoop**

把当前 App.jsx 全文替换为：

```jsx
import { useState } from 'react'
import { C, SANS } from '../constants'
import { loadProjects, genLoopId, buildLoop, addUserLoop } from '../store'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import Hub from './Hub'
import ResultScreen from './ResultScreen'
import DeepScreen from './DeepScreen'

export default function App() {
  const [projects, setProjects] = useState(() => loadProjects())
  const [projId, setProjId] = useState(projects[0].id)
  const [screen, setScreen] = useState("hub")
  const [active, setActive] = useState(null)

  const proj = projects.find((p) => p.id === projId) || projects[0]

  function openResult(r) {
    setActive(r)
    setScreen(r.state === "escalated" ? "deep" : "result")
  }

  function handleCreateLoop(form) {
    const id = genLoopId(proj.loops)
    const loop = buildLoop({ ...form, id }, Date.now())
    setProjects((prev) =>
      prev.map((p) => (p.id === proj.id ? { ...p, loops: [...p.loops, loop] } : p))
    )
    addUserLoop(proj.id, loop)
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.body,
      fontFamily: SANS, fontSize: 14, display: "flex" }}>
      <Sidebar proj={proj} setProj={(p) => { setProjId(p.id); setScreen("hub"); }}
        screen={screen} onHome={() => setScreen("hub")} />
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
        <Topbar screen={screen} projects={projects} />
        <div style={{ flex: 1, overflowY: "auto" }}>
          <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 40px 90px" }}>
            {screen === "hub" && <Hub proj={proj} onOpen={openResult} onCreateLoop={handleCreateLoop} />}
            {screen === "result" && active && (
              <ResultScreen r={active} proj={proj} onBack={() => setScreen("hub")} onEscalate={() => setScreen("deep")} />
            )}
            {screen === "deep" && active && (
              <DeepScreen r={active} proj={proj} onBack={() => setScreen("hub")} />
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
```

> 关键差异：`proj` 由 `projects.find` 派生；`Sidebar` 的 `setProj` 包装为 `setProjId(p.id)`（Sidebar 接口不变）；`Topbar` 多传 `projects` prop（Task 3 才消费，此步 Topbar 暂不读该 prop，不影响）；`Hub` 多传 `onCreateLoop`（Task 5 才消费，Hub 暂不读该 prop，不影响）。

- [ ] **Step 2: 编译 gate**

Run: `npm run build`
Expected: `✓ built`，无报错。

- [ ] **Step 3: dev 回归 — 现有 UI 零变化**

Run: `npm run dev`（后台）
- Electron 窗口启动，Hub 渲染与之前一致：3 个项目、loop 分区（待你审浮顶 / 自动收敛中 / 运行中 / 已收敛折叠）。
- DevTools console 无报错。
- 切换项目（点 Sidebar 项目）：Hub 跟随切换。
- 退出 dev。

Expected: 与改造前像素一致；console 无 error。

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/App.jsx
git commit -m "refactor: lift loop data into App state via loadProjects

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Topbar 从 projects prop 读计数

**Files:**
- Modify: `src/renderer/components/Topbar.jsx`

**Interfaces:**
- Consumes: `projects` prop from `App`（Task 2 已传）
- Produces: Topbar pill 计数随 `projects` 变化而更新

- [ ] **Step 1: 改 Topbar — 用 projects prop 替代直接 import PROJECTS**

把 Topbar.jsx 全文替换为：

```jsx
import { C, MONO } from '../constants'
import { ATTENTION } from '../data'

export default function Topbar({ screen, projects }) {
  const map = { hub: "项目总览", result: "结果审阅", deep: "攻关模式" }
  const all = projects.flatMap((p) => p.loops)
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
```

> 差异：删除 `import { PROJECTS, ATTENTION } from '../data'` 中的 `PROJECTS`；签名加 `projects`；`all` 改为 `projects.flatMap`。`ATTENTION` 仍从 data import（无变化）。外观零改动。

- [ ] **Step 2: 编译 gate**

Run: `npm run build`
Expected: `✓ built`。

- [ ] **Step 3: dev 回归 — 计数仍正确**

Run: `npm run dev`
- Topbar 右侧 pill 显示与改造前一致（如「14 个 loop 在跑」「3 待我」之类，取决于种子总数）。
- console 无报错。退出 dev。

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/Topbar.jsx
git commit -m "refactor: Topbar reads loop counts from projects prop

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: CreateLoopModal 组件

**Files:**
- Create: `src/renderer/components/CreateLoopModal.jsx`

**Interfaces:**
- Consumes: `C` / `SERIF` / `MONO` / `btnPrimary` / `btnGhost` from `../constants`
- Produces:
  - `export default function CreateLoopModal({ onSubmit, onClose })`
  - `onSubmit(form)` 其中 form = `{ title, deliverable, acceptance, maxRuns, maxDuration, model, pattern, escalateAfter }`（**不含** id/createdAt，由 App 补）
  - `onClose()` 无参

- [ ] **Step 1: 写 CreateLoopModal.jsx**

```jsx
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
```

- [ ] **Step 2: 编译 gate**

Run: `npm run build`
Expected: `✓ built`，无报错（modal 尚未被 import，但语法须正确）。

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/CreateLoopModal.jsx
git commit -m "feat: add CreateLoopModal component

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: Hub 接入按钮 + 模态 + 端到端验证

**Files:**
- Modify: `src/renderer/components/Hub.jsx`

**Interfaces:**
- Consumes: `onCreateLoop(form)` prop from `App`（Task 2 已传）；`CreateLoopModal`（Task 4）
- Produces: 完整的「点按钮 → 填表 → 启动 loop → 出现在运行中」流程

- [ ] **Step 1: 改 Hub — 加 import + 本地 modal state + 按钮 + 渲染 modal**

在 `Hub.jsx` 顶部 import 行后追加：

```jsx
import { btnPrimary } from '../constants'
import CreateLoopModal from './CreateLoopModal'
```

> 注：`useState` 已在文件顶部 `import { useState } from 'react'`，`C`/`SERIF`/`MONO` 已 import；只追加 `btnPrimary` 到现有 constants import 或单独一行均可。下面用单独一行 import 最简。

把 `Hub` 函数签名与项目卡 header 改为（替换 `export default function Hub({ proj, onOpen }) {` 到项目卡 `</div>` 闭合的那一段 header）：

原 header：
```jsx
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
        ...
      </header>

      {/* 项目概览卡 */}
      <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16,
        padding: "22px 24px", marginBottom: 30 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontFamily: SERIF, fontSize: 21, fontWeight: 500, color: C.ink }}>{proj.name}</h2>
          <span style={{ fontFamily: MONO, fontSize: 11.5, color: C.dim }}>{proj.id}</span>
        </div>
        ...
```

改为（签名加 `onCreateLoop`；加 `creating` state；header 行加按钮）：

```jsx
export default function Hub({ proj, onOpen, onCreateLoop }) {
  const st = projStats(proj)
  const loops = sortedLoops(proj)
  const attn = loops.filter((l) => ATTENTION.has(l.state))
  const conv = loops.filter((l) => l.state === "converging")
  const run = loops.filter((l) => l.state === "running")
  const done = loops.filter((l) => l.state === "done")
  const [creating, setCreating] = useState(false)

  return (
    <div className="fade">
      <header style={{ padding: "44px 0 30px" }}>
        ...
      </header>

      {/* 项目概览卡 */}
      <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16,
        padding: "22px 24px", marginBottom: 30 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <h2 style={{ margin: 0, fontFamily: SERIF, fontSize: 21, fontWeight: 500, color: C.ink }}>{proj.name}</h2>
            <span style={{ fontFamily: MONO, fontSize: 11.5, color: C.dim }}>{proj.id}</span>
          </div>
          <button onClick={() => setCreating(true)} style={{ ...btnPrimary, width: "auto", padding: "8px 14px", fontSize: 12.5 }}>
            + 新建 loop
          </button>
        </div>
        ...
```

> `<header>` 内部内容不变，`...` 仅代表省略的既有代码。**只改 header 那一个 `<div>`**（`alignItems: baseline` → `center`，name+id 包一层，加按钮）。

然后在 Hub return 的最外层 `<div className="fade">` 末尾、`</div>` 闭合前追加 modal：

```jsx
      {/* 4. 已收敛（折叠）*/}
      {done.length > 0 && <DoneFold loops={done} />}

      {creating && (
        <CreateLoopModal
          onSubmit={(form) => { onCreateLoop(form); setCreating(false) }}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: 编译 gate**

Run: `npm run build`
Expected: `✓ built`，无报错。

- [ ] **Step 3: 端到端手动走查**

Run: `npm run dev`

逐条核对（DevTools 打开）：
1. 项目卡 header 右侧出现「+ 新建 loop」按钮（赤陶橙）。其余 UI 不变。
2. 点「+ 新建 loop」→ 遮罩（半透明深色）+ 居中卡弹出，标题「新建 loop」，标题输入框 autofocus。
3. 标题为空时「启动 loop」按钮半透明 + 不可点（`disabled`）。
4. 填标题「测试 loop」+ 交付物 `test/x.ts` + 验收标准「通过」→ 点「启动 loop」。
5. modal 关闭；「运行中」网格出现新卡：标题「测试 loop」、id `loop-XXXX`、step `0/—`、runtime `0h 00m`、左上呼吸点。
6. 项目卡统计：`loop` total +1、`在跑` +1；StatusStrip 多一格（running 色）。
7. Topbar 右 pill「N 个 loop 在跑」+1。
8. DevTools → Application → Local Storage → `http://localhost:5173` → key `super-builder:user-loops` 存在，值为 `{"PRJ-xxx":[{...测试 loop...}]}`。
9. `Cmd+R` 刷新窗口 → 新 loop 仍在「运行中」。
10. 再点「+ 新建 loop」→ 按 `Esc` → modal 关闭，未创建。
11. 再点「+ 新建 loop」→ 点遮罩背景（卡外）→ modal 关闭，未创建。
12. 切到另一个 project（Sidebar）→ 该 project 无「测试 loop」（loop 挂在创建时的 project）；切回 → 仍在。
13. console 全程无 error / warn。

Expected: 全部通过。

- [ ] **Step 4: 清理 localStorage 测试数据**

DevTools → Application → Local Storage → 删除 `super-builder:user-loops`（或 `localStorage.clear()` in console）。刷新确认回到纯种子状态。

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/Hub.jsx
git commit -m "feat: wire create-loop button + modal into Hub

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage**（逐条对照 spec）：
- 表单 7 字段（标题/交付物/验收标准/停止条件/模型档位/loop 模式/升级阈值）→ Task 4 CreateLoopModal 全覆盖 ✓
- 模态对话框 + Esc/点背景关闭 + 标题空禁用 → Task 4 ✓
- 持久化分层（种子不可变 + localStorage 用户 loop + loadProjects 合并）→ Task 1 store.js ✓
- App 状态提升（projId 派生 + handleCreateLoop）→ Task 2 ✓
- 新 loop 对象 shape（state=running/pri=null/step=0/—/userCreated 等）→ Task 1 buildLoop ✓
- Sidebar 接口不变 → Task 2（setProj 包装）✓，Sidebar.jsx 不在 File Structure ✓
- Topbar 计数随 projects 变化 → Task 3 ✓
- 视觉沿用 C/SERIF/MONO/btnPrimary/btnGhost → Task 4 ✓
- 边界：localStorage 失败 try/catch → Task 1 ✓；id 防碰撞 → Task 1 genLoopId ✓；空标题禁用 → Task 4 ✓；createdAt 由调用方传入 → Task 1 buildLoop + Task 2 handleCreateLoop ✓
- 验证 8 条走查 → Task 5 Step 3 扩展为 13 条（覆盖 spec 全部 8 条 + 额外边界）✓
- out of scope：不接 result/deep、不做预算、不改现有 UI/状态机、不引入测试框架 → 全程未触碰 ✓

**2. Placeholder scan**：无 TBD/TODO；每步含完整代码或确切命令 ✓。Task 5 的 `...` 是「既有代码不动」的省略标注，已用文字说明只改 header 那一个 div，非占位符 ✓。

**3. Type consistency**：
- `onCreateLoop(form)` 签名：Task 2 App 定义 `handleCreateLoop(form)`，Task 5 Hub 透传 `onCreateLoop(form)`，form 字段集一致 ✓
- `buildLoop(form, createdAt)` form 含 `id`：Task 2 调用 `buildLoop({...form, id}, Date.now())`，Task 4 modal 的 onSubmit form 不含 id（App 补）✓
- `CreateLoopModal` props `{onSubmit, onClose}`：Task 5 使用一致 ✓
- `Topbar({screen, projects})`：Task 2 传 `projects={projects}`，Task 3 消费 ✓
- `genLoopId(proj.loops)`：proj.loops 是合并后的数组（含用户 loop），碰撞检查覆盖已建 loop ✓

无问题，计划可执行。
