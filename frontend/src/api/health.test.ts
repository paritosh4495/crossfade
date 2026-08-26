import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchHealth } from './health'

describe('fetchHealth', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('resolves with the parsed health payload on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ backend: 'up', sidecar: 'up' }),
      }),
    )

    await expect(fetchHealth()).resolves.toEqual({ backend: 'up', sidecar: 'up' })
  })

  it('still resolves with the payload when the sidecar is reported down', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ backend: 'up', sidecar: 'down' }),
      }),
    )

    await expect(fetchHealth()).resolves.toEqual({ backend: 'up', sidecar: 'down' })
  })

  it('rejects when the backend is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(fetchHealth()).rejects.toThrow('Failed to fetch')
  })
})
