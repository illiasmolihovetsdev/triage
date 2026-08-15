import { afterEach, describe, expect, it, vi } from 'vitest'
import { notify } from '@/lib/notify'

describe('notify', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('resolves after about one second when random is at or above the failure rate', async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0.2)

    const notifyPromise = notify()
    await vi.advanceTimersByTimeAsync(1000)

    await expect(notifyPromise).resolves.toBeUndefined()
  })

  it('throws after about one second when random is below the failure rate', async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const notifyPromise = notify()
    const expectedRejection = expect(notifyPromise).rejects.toThrow(
      'Notification delivery failed.'
    )

    await vi.advanceTimersByTimeAsync(1000)
    await expectedRejection
  })

  it('does not finish before the delay has elapsed', async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0.5)

    let hasSettled = false
    const notifyPromise = notify().then(() => {
      hasSettled = true
    })

    await vi.advanceTimersByTimeAsync(999)
    expect(hasSettled).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    await notifyPromise
    expect(hasSettled).toBe(true)
  })
})
