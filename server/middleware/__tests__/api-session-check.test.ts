import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { createError, createEvent } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import apiSessionCheckHandler from '#server/middleware/api-session-check'

const {
  validateSessionUserMock
} = vi.hoisted(() => {
  return {
    validateSessionUserMock: vi.fn()
  }
})

vi.mock(import('#server/utils/session'), () => {
  return {
    validateSessionUser: validateSessionUserMock
  }
})

function createMiddlewareEvent({
  headers = {},
  path
}: {
  headers?: IncomingMessage['headers'];
  path: string;
}) {
  const request = new IncomingMessage(new Socket())

  request.headers = headers
  request.url = path

  const response = new ServerResponse(request)

  return createEvent(request, response)
}

describe('api session check middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    validateSessionUserMock.mockRejectedValue(createError({ status: 401 }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should redirect browser document requests for protected api routes to login', async () => {
    const event = createMiddlewareEvent({
      path: '/api/equipment/brands',

      headers: {
        accept: 'text/html',
        host: 'localhost',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate'
      }
    })

    await apiSessionCheckHandler(event)
    expect(event.node.res.statusCode).toBe(302)
    expect(event.node.res.getHeader('location')).toBe('/login?redirectTo=%2Fapi%2Fequipment%2Fbrands')
  })

  it('should reject non-browser api requests with 401', async () => {
    const event = createMiddlewareEvent({
      path: '/api/equipment/brands',

      headers: {
        accept: 'application/json',
        host: 'localhost'
      }
    })

    await expect(apiSessionCheckHandler(event)).rejects.toMatchObject({
      statusCode: 401
    })
  })

  it.each([
    '/api/oauth/twitch',
    '/api/auth/email/sign-in',
    '/api/auth/email/password-recovery',
    '/api/auth/email/password-recovery/reset'
  ])('should skip redirects for public api routes: %s', async (path) => {
    const event = createMiddlewareEvent({
      path,

      headers: {
        accept: 'text/html',
        host: 'localhost',
        'sec-fetch-dest': 'document'
      }
    })

    await expect(apiSessionCheckHandler(event)).resolves.toBeUndefined()
    expect(event.node.res.getHeader('location')).toBeUndefined()
    expect(validateSessionUserMock).not.toHaveBeenCalled()
  })

  it('should allow Nuxt Icon collection requests without a session', async () => {
    const event = createMiddlewareEvent({
      path: '/api/_nuxt_icon/hugeicons.json?icons=tent',

      headers: {
        accept: 'application/json',
        host: 'localhost'
      }
    })

    await expect(apiSessionCheckHandler(event)).resolves.toBeUndefined()
    expect(validateSessionUserMock).not.toHaveBeenCalled()
  })

  it('should allow a protected API request with a validated session version', async () => {
    validateSessionUserMock.mockResolvedValue('user-1')

    const event = createMiddlewareEvent({
      path: '/api/equipment/brands',

      headers: {
        accept: 'application/json',
        host: 'localhost'
      }
    })

    await expect(apiSessionCheckHandler(event)).resolves.toBeUndefined()
    expect(validateSessionUserMock).toHaveBeenCalledWith(event)
  })
})
