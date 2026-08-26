import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import * as healthApi from './api/health'

describe('App', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows both services as up once the health check resolves', async () => {
    vi.spyOn(healthApi, 'fetchHealth').mockResolvedValue({ backend: 'up', sidecar: 'up' })

    render(<App />)

    expect(await screen.findByText(/backend: up/i)).toBeInTheDocument()
    expect(screen.getByText(/sidecar: up/i)).toBeInTheDocument()
  })

  it('shows the sidecar as down without hiding the backend status', async () => {
    vi.spyOn(healthApi, 'fetchHealth').mockResolvedValue({ backend: 'up', sidecar: 'down' })

    render(<App />)

    expect(await screen.findByText(/sidecar: down/i)).toBeInTheDocument()
    expect(screen.getByText(/backend: up/i)).toBeInTheDocument()
  })

  it('reports an error when the backend cannot be reached at all', async () => {
    vi.spyOn(healthApi, 'fetchHealth').mockRejectedValue(new Error('Failed to fetch'))

    render(<App />)

    expect(await screen.findByText(/could not reach the backend/i)).toBeInTheDocument()
  })
})
