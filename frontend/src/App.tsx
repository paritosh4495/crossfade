import { useEffect, useState } from 'react'
import { fetchHealth, type HealthPayload } from './api/health'

type LoadState =
  | { status: 'loading' }
  | { status: 'loaded'; health: HealthPayload }
  | { status: 'error' }

function App() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    fetchHealth()
      .then((health) => {
        if (!cancelled) setState({ status: 'loaded', health })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' })
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-3xl font-semibold">Crossfade</h1>
      <p className="text-gray-500">Local dev scaffolding check-in.</p>

      {state.status === 'loading' && <p>Checking backend…</p>}
      {state.status === 'error' && <p role="alert">Could not reach the backend.</p>}
      {state.status === 'loaded' && (
        <ul className="flex flex-col gap-1">
          <li>Backend: {state.health.backend}</li>
          <li>Sidecar: {state.health.sidecar}</li>
        </ul>
      )}
    </main>
  )
}

export default App
