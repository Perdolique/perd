import { createError } from 'h3'
import type { NitroErrorHandler } from 'nitropack/types'
import { describe, expect, it, vi } from 'vitest'
import passkeyErrorHandler from '../passkey-error-handler'
import { createTestEvent } from '~~/test-utils/create-test-event'

vi.mock(import('nitropack/runtime'), () => {
  return { defineNitroErrorHandler: (handler: NitroErrorHandler) => handler }
})

function createRequestEvent(path: string) {
  const event = createTestEvent({})

  event.node.req.headers.host = 'metsik.app'
  event.node.req.url = path

  return event
}

describe('passkey error response cache policy', () => {
  it('replaces the Nitro default cache policy for a passkey 404', async () => {
    const event = createRequestEvent('/api/account/passkeys/0195f6e8-8f44-74f6-bc9a-5c8f7df477dd')

    const error = createError({
      status: 404,
      statusMessage: 'Passkey was not found'
    })

    const defaultHandler = vi.fn().mockResolvedValue({
      status: 404,
      statusText: 'Passkey was not found',

      headers: {
        'cache-control': 'no-cache',
        'content-type': 'application/json'
      },

      body: {
        statusCode: 404,
        statusMessage: 'Passkey was not found'
      }
    })

    await passkeyErrorHandler(error, event, { defaultHandler })
    expect(defaultHandler).toHaveBeenCalledExactlyOnceWith(error, event)
    expect(event.node.res.getHeader('cache-control')).toBe('no-store')
    expect(event.node.res.statusCode).toBe(404)
    expect(event.handled).toBe(true)
  })

  it.each([
    ['/api/equipment/items/missing', 404],
    ['/api/account/passkeys/0195f6e8-8f44-74f6-bc9a-5c8f7df477dd', 403]
  ])('leaves unrelated %s status %i for the built-in handler', async (path, status) => {
    const event = createRequestEvent(path)
    const error = createError({ status })
    const defaultHandler = vi.fn()

    await passkeyErrorHandler(error, event, { defaultHandler })
    expect(defaultHandler).not.toHaveBeenCalled()
    expect(event.handled).toBe(false)
  })
})
