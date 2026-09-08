import { createHash } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { assertPasswordNotPwned } from '../pwned-passwords'

const password = 'only used for password screening tests'
const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase()
const prefix = sha1.slice(0, 5)
const suffix = sha1.slice(5)
const fetchMock = vi.fn<typeof fetch>()

describe('pwned Passwords screening', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)

    vi.spyOn(console, 'error').mockImplementation(() => {
 // Inspect diagnostics without writing expected errors to the test log.
 })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    fetchMock.mockReset()
  })

  it('should send only a hash prefix and ignore zero-count padding matches', async () => {
    fetchMock.mockResolvedValue(new Response(`${suffix}:0\r\n${'A'.repeat(35)}:99`))
    await assertPasswordNotPwned(password)

    expect(fetchMock).toHaveBeenCalledWith(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
      signal: expect.any(AbortSignal) as unknown
    })

    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain(password)
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain(sha1)
  })

  it('should reject a matching breached password', async () => {
    fetchMock.mockResolvedValue(new Response(`${suffix}:1`))
    await expect(assertPasswordNotPwned(password)).rejects.toMatchObject({ statusCode: 400 })
  })

  it.each(['', 'not a range', `${suffix}:invalid`])('should fail closed on a malformed response %s', async (body) => {
    fetchMock.mockResolvedValue(new Response(body))
    await expect(assertPasswordNotPwned(password)).rejects.toMatchObject({ statusCode: 503 })
  })

  it('should redact password material from provider diagnostics', async () => {
    fetchMock.mockRejectedValue(new Error(`Network failed: ${password} ${sha1} ${suffix}`))
    await expect(assertPasswordNotPwned(password)).rejects.toMatchObject({ statusCode: 503 })

    const logged = JSON.stringify(vi.mocked(console.error).mock.calls)

    expect(logged).toContain('Network failed')
    expect(logged).not.toContain(password)
    expect(logged).not.toContain(sha1)
    expect(logged).not.toContain(suffix)
  })
})
