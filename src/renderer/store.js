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
