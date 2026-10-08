import { describe, expect, it, vi } from 'vitest'
import { getAppSession, updateAppSession } from '../session'
import { getRequestMethod } from '../request-runtime'
import { validateEmailAuthenticationRequest } from '../auth/email-authentication-request'
import { getTrustedClientIp } from '../cloudflare'
import { createTestEvent } from '~~/test-utils/create-test-event'

vi.mock(import('#server/utils/config'), () => {
  return { getRuntimeSessionSecret: () => 'native-session-transport-test-secret-2026' }
})

function createUnreadBodyEvent(cookie?: string) {
  const event = createTestEvent({})

  event.node.req.method = 'POST'
  event.node.req.headers['content-type'] = 'application/json'
  event.node.req.headers.origin = 'https://perd.example'
  event.node.req.headers['cf-connecting-ip'] = '203.0.113.20'

  if (cookie !== undefined) {
    event.node.req.headers.cookie = cookie
  }

  Object.defineProperty(event, 'req', {
    get() {
      throw new Error('Request metadata must not start the buffered body reader')
    }
  })

  return event
}

describe('native sessions on the Nitro request transport', () => {
  it('reads request metadata and seals a session without reading the request body', async () => {
    const event = createUnreadBodyEvent()

    const data = {
      userId: 'user-1',
      sessionVersion: 3
    }

    expect(getRequestMethod(event)).toBe('POST')
    validateEmailAuthenticationRequest(event, 'https://perd.example')
    expect(getTrustedClientIp(event, false)).toBe('203.0.113.20')
    await updateAppSession(event, data)

    const session = await getAppSession(event)

    expect(session.data).toMatchObject(data)
    expect(event.node.req.readableFlowing).toBeNull()

    const [cookie] = event.res.headers.getSetCookie()

    expect(cookie).toContain('perdSession=')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('SameSite=Lax')
  })

  it('unseals a native cookie on the next request and keeps its session identity', async () => {
    const first = createUnreadBodyEvent()

    const data = {
      userId: 'user-1',
      sessionVersion: 4
    }

    await updateAppSession(first, data)

    const previous = await getAppSession(first)
    const [setCookie] = first.res.headers.getSetCookie()
    const cookie = setCookie?.split(';')[0]

    expect(cookie).toBeDefined()

    const next = createUnreadBodyEvent(cookie)
    const session = await getAppSession(next)

    expect(session).toStrictEqual({
      id: previous.id,
      data
    })

    expect(next.node.req.readableFlowing).toBeNull()
  })
})
