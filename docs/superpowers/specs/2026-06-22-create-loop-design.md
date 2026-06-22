# Design: 新建 loop 创建功能

**Date**: 2026-06-22
**Status**: Approved
**Scope**: 在 super-builder Electron demo 的 Hub 屏增加「新建 loop」能力——一个按钮 + 模态表单，创建的 loop 持久化到 localStorage。

## 背景与目标

super-builder 当前是 Converge demo 的 Electron 移植：`PROJECTS` 是静态 mock 常量，App 持有 `proj`/`active`/`screen` 三个 state，没有任何创建/变更 loop 的路径。loop 数据形状见 `src/renderer/data.js`：

```js
{ id, title, deliverable, state, pri, rounds, runtime, step, [routeReason|confidence|sub] }
```

目标：让用户在 Hub 屏随手起一个新 loop。表单字段除标题/交付物/验收标准外，还从 ECC `loop-start` 与 `loop-operator` 工具中拾取真实 loop 应具备的要素（停止条件、模型档位、loop 模式、升级阈值），使 demo 的创建动作贴近真实 loop 配置。

**已确认决策**：
- 表单字段：标题 / 交付物 / 验收标准 / 停止条件(轮数+时长) / 模型档位 / loop 模式 / 升级阈值。
- 交互形态：模态对话框（approach A）。
- 持久化：localStorage（纯 renderer 侧 web API，不走 Electron main/IPC，不违反 U3 延迟）。
- 新 loop 不接入 result/deep 屏的批注/收敛流程（仍用硬编码 DOC/REVIEW/TRACE）。

## 架构与数据流

### 持久化分层

`PROJECTS` 常量保持为不可变种子。localStorage 只存**用户创建的 loop**，按 projId 分组。加载时合并：

```js
projects = PROJECTS.map(p => ({
  ...p,
  loops: [...p.loops, ...(userLoops[p.id] || [])],
}))
```

理由：种子数据始终纯净，用户创建的 loop 清晰叠加其上；改 `PROJECTS` 代码后仍生效（不会被过期持久化覆盖）；读写面最小。

### App.jsx 状态提升

当前 `App.jsx` 持有 `proj`（项目对象）、`active`、`screen`。改造：

- `proj` state → 改为 `projId` state，`proj = projects.find(p => p.id === projId)` 派生（保持与 projects 同步）。
- 新增 `projects` state，由 `loadProjects()` 初始化（合并种子 + localStorage 用户 loop）。
- 新增 `handleCreateLoop(projId, loop)`：append 到 projects state + `addUserLoop()` 持久化。
- `Sidebar` 的 `setProj` 回调：`App` 传入 `(p) => setProjId(p.id)` 适配——`Sidebar.jsx` 接口不变（仍传 project 对象），无需改 Sidebar。
- 「+ 新建 loop」按钮位置：放在项目卡 header 行右侧——`proj.name`（左）与按钮（右）`space-between`，`proj.id` mono 标签移到按钮左侧或按钮下方。最终布局由 plan 定，但按钮归属 header 右侧。

数据流：

```
[localStorage] --loadUserLoops()--> App.projects (合并种子)
Hub 按钮 --> CreateLoopModal (本地 open state)
  --> onSubmit(formData)
  --> buildLoop(formData) --> loop 对象
  --> App.handleCreateLoop(projId, loop)
      --> setProjects(append)
      --> addUserLoop(projId, loop) --> [localStorage]
```

### 新建 loop 对象

比种子 loop 多带 loop-start 要素字段；渲染时只用需要的字段，多余字段存储不渲染。

```js
{
  id: "loop-XXXX",            // 4 位随机，与当前 project 内 id 防碰撞
  title,                      // 用户填（必填）
  deliverable,                // 用户填
  state: "running",           // 刚启动
  pri: null,                  // 未到 needYou 阶段
  rounds: 0,
  runtime: "0h 00m",
  step: "0/—",                // 刚启动，无步骤
  acceptance,                 // 验收标准 = completion signal / eval baseline
  maxRuns,                    // 停止条件：最大轮数
  maxDuration,                // 停止条件：最大时长
  model,                      // 模型档位：sonnet/opus/haiku
  pattern,                    // loop 模式：sequential/continuous-pr/rfc-dag/infinite
  escalateAfter,              // 升级阈值：连续 N 轮无进展 → 浮给你（对接现有 needYou/escalated 语义）
  createdAt,                  // 时间戳（由调用方传入，避免 store 函数依赖 Date.now）
  userCreated: true,          // 标记，区分种子与用户创建
}
```

## 组件

| 文件 | 改动 | 职责 |
|---|---|---|
| `src/renderer/store.js` | **新建** | `STORAGE_KEY`、`loadUserLoops()`、`addUserLoop(projId, loop)`、`genLoopId(existing)`、`buildLoop(form)`。纯函数，localStorage 访问 try/catch 包裹 |
| `src/renderer/components/CreateLoopModal.jsx` | **新建** | 遮罩 + 居中卡 + 7 字段表单；Esc/点背景关闭；标题为空时禁用提交 |
| `src/renderer/components/Hub.jsx` | 改 | 项目卡 header 加 "+ 新建 loop" 按钮（`btnPrimary` 风格）；modal open 状态本地 `useState` 持有；提交回调 `onCreateLoop` 透传 App |
| `src/renderer/components/App.jsx` | 改 | 提升 `projects` state + `projId` 派生 + `handleCreateLoop` |

### 表单字段与默认值

- **标题**（必填）— 文本输入
- **交付物** — 文本输入（如 `auth/x.ts`）
- **验收标准** — 文本输入（completion signal / done 定义）
- **停止条件** — 轮数（默认 `6`）+ 时长（默认 `2h`），两输入并排
- **模型档位** — select：`sonnet`（默认）/ `opus` / `haiku`
- **loop 模式** — select：`sequential`（默认）/ `continuous-pr` / `rfc-dag` / `infinite`
- **升级阈值** — 数字输入，默认 `2`（连续 N 轮无进展 → 浮给你）

### 视觉

沿用现有 Claude Cowork 视觉语言：

- 遮罩：fixed 全屏，`rgba` ink 低透明度，点击关闭。
- 卡：居中，max-width ~520px，`C.surface` 底 + `C.line` 边 + 16 圆角 + padding。
- 标题：SERIF「新建 loop」+ 右上 × 关闭。
- 字段 label：MONO 小字 `C.dim`。
- 输入框：`C.surface2` 底 + `C.line` 边 + 8 圆角 + padding。
- 停止条件：轮数 + 时长两输入并排一行。
- 提交行：右对齐 `btnPrimary`「启动 loop」+ ghost「取消」。

## 边界与错误处理

- **新 loop 不可点**：running 状态的 loop 在 Hub 里渲染为 `LoopChip`（`div`，非 `button`），与种子 running loop 行为一致——不会点到没有的 ResultScreen。无需为 created loop 接 result/deep 屏。
- **localStorage 失败**：`loadUserLoops`/`addUserLoop` 用 try/catch 包裹；保存失败时内存 state 照常更新（本会话可见，仅不持久化）；加载失败返回空 map（退化为纯种子数据）。
- **id 碰撞**：`genLoopId` 对当前 project 的 loops 查重，碰撞则重生成。
- **空标题**：提交按钮在标题为空时 `disabled`。
- **createdAt 时间戳**：store 函数不调用 `Date.now()`（保持纯函数可测）；由 `App.handleCreateLoop` 调用时传入。

## 验证（手动走查）

项目无测试框架（UI demo），验证 = 手动走查：

1. 点项目卡 header 的「+ 新建 loop」→ 遮罩 + 卡弹出。
2. 填标题 + 交付物 + 验收标准，其余留默认 → 「启动 loop」。
3. modal 关闭；新 loop 出现在「运行中」网格，title + step `0/—` + runtime `0h 00m`。
4. 项目统计 total / 在跑 +1；StatusStrip 多一格。
5. `Cmd+R` 刷新窗口 → 新 loop 仍在「运行中」。
6. `Esc` / 点遮罩背景 → modal 关闭，不创建。
7. 标题为空 → 「启动 loop」禁用。
8. 对照原 `converge-cowork-demo.html`：现有 UI/文案/状态机零变化。

## out of scope

- created loop 不接入 ResultScreen/DeepScreen 的批注/收敛/攻关流程（仍用硬编码 DOC/REVIEW/TRACE）。
- 不做预算字段（loop-operator 借鉴只取「升级阈值」一项）。
- 不改任何现有 UI 逻辑/文案/状态机。
- 不引入测试框架。
