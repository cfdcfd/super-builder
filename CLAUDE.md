# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

**super-builder** 是面向超级个体的工作台——帮助 1 个人指挥几十上百个 agent 并行完成项目。核心理念：

- 人只看**结果**，批注结果触发自动归因重跑；改不动的极少数才看过程（攻关模式）
- loop = 一个长程 agent 任务；多个 loop 挂在一个 project 下并行跑
- 收敛循环：批注 → 强制归因 → agent 重跑（仅受影响节点）→ 独立审查 → 归档

## Current State

目前仓库只有一个文件：`converge-cowork-demo.html`——这是 **Converge** 功能的交互原型 demo，纯前端（React 18 via CDN + Babel standalone，无构建步骤）。

### 运行方式

直接在浏览器打开 HTML 文件即可，无需安装依赖或构建：

```bash
open converge-cowork-demo.html
```

或启动简单 HTTP server（避免某些浏览器的本地文件限制）：

```bash
python3 -m http.server 8080
# 访问 http://localhost:8080/converge-cowork-demo.html
```

## Architecture（demo 内）

单文件 React 应用，所有代码在 `<script type="text/babel">` 中：

| 层次 | 说明 |
|------|------|
| **数据层** | `PROJECTS` 常量，包含多个 project，每个 project 挂多个 loop；loop 有状态机：`running → converging → needYou / escalated / done` |
| **状态机** | `needYou`（待人审）/ `escalated`（已升级攻关）/ `converging`（自动收敛中）/ `running`（在跑）/ `done`（已收敛） |
| **三屏路由** | `screen` state 控制：`hub`（项目总览）→ `result`（结果批注）→ `deep`（攻关模式） |
| **收敛对比** | `ResultScreen` 中的 naive vs converge 两栏演示「直接丢回 agent」与「强制归因」的差异 |

### 关键组件

- `Hub` — 项目总览，loop 按状态分区（待你审浮顶 → 自动收敛中 → 运行中 → 已收敛折叠）
- `ResultScreen` — 结果批注界面；`AnnotatableDoc`（左侧可批注文档）+ `NotePanel`（右侧批注侧栏）
- `DeepScreen` — 攻关模式，展示自动收敛失败的归因轨迹

### 视觉体系

颜色常量在 `C` 对象中，沿用 Claude Cowork 视觉语言：暖奶油底（`#F5F1EB`）+ 赤陶橙强调（`#CC785C`）。字体变量：`SERIF` / `SANS` / `MONO`。
