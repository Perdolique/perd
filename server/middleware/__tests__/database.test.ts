import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { createEvent, createError, sendRedirect } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requireEmailRegistrationEnabled } from '#server/utils/config'
import databaseHandler from '#server/middleware/database'

const {
  createHttpClientMock,
  getRuntimeDatabaseConfigMock
} = vi.hoisted(() => {
  return {
    createHttpClientMock: vi.fn(),
    getRuntimeDatabaseConfigMock: vi.fn()
  }
})

vi.mock(import('#server/utils/database'), () => {
  return {
    createHttpClient: createHttpClientMock
  }
})

vi.mock(import('#server/utils/config'), () => {
  return {
    requireEmailRegistrationEnabled: vi.fn<() => void>(),
    getRuntimeDatabaseConfig: getRuntimeDatabaseConfigMock
  }
})

function createMiddlewareEvent(path: string) {
  const request = new IncomingMessage(new Socket())

  request.headers.host = 'localhost'
  request.url = path

  const response = new ServerResponse(request)

  return createEvent(request, response)
}

describe('database middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should skip database configuration for application pages', () => {
    const event = createMiddlewareEvent('/login')

    databaseHandler(event)
    expect(getRuntimeDatabaseConfigMock).not.toHaveBeenCalled()
    expect(createHttpClientMock).not.toHaveBeenCalled()
  })

  it('should skip database configuration for Nuxt Icon assets', () => {
    const event = createMiddlewareEvent('/api/_nuxt_icon/hugeicons.json?icons=tent')

    databaseHandler(event)
    expect(getRuntimeDatabaseConfigMock).not.toHaveBeenCalled()
    expect(createHttpClientMock).not.toHaveBeenCalled()
  })

  it('should skip database configuration after an earlier middleware handles the request', async () => {
    const event = createMiddlewareEvent('/api/equipment/brands')

    await sendRedirect(event, '/login?redirectTo=%2Fapi%2Fequipment%2Fbrands')
    databaseHandler(event)
    expect(event.handled).toBe(true)
    expect(getRuntimeDatabaseConfigMock).not.toHaveBeenCalled()
    expect(createHttpClientMock).not.toHaveBeenCalled()
  })

  it.each(['/api/auth/email/registration', '/api/auth/email/registration/verify/'])('should return 404 before creating a database client when registration is disabled: %s', (path) => {
    vi.mocked(requireEmailRegistrationEnabled).mockImplementationOnce(() => {
      throw createError({ status: 404 })
    })

    expect(() => {
      databaseHandler(createMiddlewareEvent(path))
    }).toThrow(expect.objectContaining({ statusCode: 404 }))

    expect(getRuntimeDatabaseConfigMock).not.toHaveBeenCalled()
    expect(createHttpClientMock).not.toHaveBeenCalled()
  })

  it('should attach the database client to api requests', () => {
    const databaseConfig = {
      databaseUrl: 'postgres://unused.invalid/test',
      isLocalDatabase: false
    }

    const databaseClient = { query: {} }
    const event = createMiddlewareEvent('/api/equipment/items')

    getRuntimeDatabaseConfigMock.mockReturnValue(databaseConfig)
    createHttpClientMock.mockReturnValue(databaseClient)
    databaseHandler(event)
    expect(getRuntimeDatabaseConfigMock).toHaveBeenCalledWith(event)
    expect(createHttpClientMock).toHaveBeenCalledWith(databaseConfig)
    expect(event.context.dbHttp).toBe(databaseClient)
  })

  it('should attach the database client to email sign-in without checking the registration flag', () => {
    const databaseConfig = {
      databaseUrl: 'postgres://unused.invalid/test',
      isLocalDatabase: false
    }

    const databaseClient = { query: {} }
    const event = createMiddlewareEvent('/api/auth/email/sign-in')

    getRuntimeDatabaseConfigMock.mockReturnValue(databaseConfig)
    createHttpClientMock.mockReturnValue(databaseClient)
    databaseHandler(event)
    expect(requireEmailRegistrationEnabled).not.toHaveBeenCalled()
    expect(event.context.dbHttp).toBe(databaseClient)
  })

  it.each([
    '/api/auth/email/password-recovery',
    '/api/auth/email/password-recovery/reset'
  ])('should defer password recovery database setup until after request security checks: %s', (path) => {
    const event = createMiddlewareEvent(path)

    databaseHandler(event)
    expect(requireEmailRegistrationEnabled).not.toHaveBeenCalled()
    expect(getRuntimeDatabaseConfigMock).not.toHaveBeenCalled()
    expect(createHttpClientMock).not.toHaveBeenCalled()
  })
})
