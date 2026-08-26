export type HealthPayload = {
  backend: string
  sidecar: string
}

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

export async function fetchHealth(): Promise<HealthPayload> {
  const response = await fetch(`${API_BASE_URL}/api/health`)
  return (await response.json()) as HealthPayload
}
