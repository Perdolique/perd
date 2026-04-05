import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { createEvent } from 'h3'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import apiSessionCheckHandler from '#server/middleware/api-session-check'

const {
  getAppSessionMock
} = vi.hoisted(() => {
  return {
    getAppSessionMock: vi.fn()
  }
})

vi.mock(import('#server/utils/session'), () => {
  return {
    getAppSession: getAppSessionMock
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

    getAppSessionMock.mockResolvedValue({
      data: {}
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('should redirect browser document requests for protected api routes to login', async () => {
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

  test('should reject non-browser api requests with 401', async () => {
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

  test('should skip redirects for public api routes', async () => {
    const event = createMiddlewareEvent({
      path: '/api/oauth/twitch',

      headers: {
        accept: 'text/html',
        host: 'localhost',
        'sec-fetch-dest': 'document'
      }
    })

    await expect(apiSessionCheckHandler(event)).resolves.toBeUndefined()
    expect(event.node.res.getHeader('location')).toBeUndefined()
  })
})
