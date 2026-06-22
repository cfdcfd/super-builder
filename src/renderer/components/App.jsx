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
