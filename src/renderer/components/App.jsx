import { useState } from 'react'
import { C, SANS } from '../constants'
import { PROJECTS } from '../data'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import Hub from './Hub'
import ResultScreen from './ResultScreen'
import DeepScreen from './DeepScreen'

export default function App() {
  const [screen, setScreen] = useState("hub")
  const [proj, setProj] = useState(PROJECTS[0])
  const [active, setActive] = useState(null)

  function openResult(r) {
    setActive(r)
    setScreen(r.state === "escalated" ? "deep" : "result")
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.body,
      fontFamily: SANS, fontSize: 14, display: "flex" }}>
      <Sidebar proj={proj} setProj={(p) => { setProj(p); setScreen("hub"); }}
        screen={screen} onHome={() => setScreen("hub")} />
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
        <Topbar screen={screen} />
        <div style={{ flex: 1, overflowY: "auto" }}>
          <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 40px 90px" }}>
            {screen === "hub" && <Hub proj={proj} onOpen={openResult} />}
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
