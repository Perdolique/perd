import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { createEvent } from 'h3'
import { describe, expect, it, vi } from 'vitest'
import { readLimitedValidatedJsonBody } from '../email-authentication-request'

function createRequestEvent(chunks: readonly Uint8Array[], contentLength?: string) {
  const request = new IncomingMessage(new Socket())

  request.method = 'POST'

  if (contentLength !== undefined) {
    request.headers['content-length'] = contentLength
  }

  for (const chunk of chunks) {
    request.push(chunk)
  }

  request.push(null)

  return createEvent(request, new ServerResponse(request))
}

function encode(value: string): Uint8Array {
  return new TextEncoder().encode(value)
}

describe('limited email authentication JSON body', () => {
  it('should decode and validate a body split across byte chunks', async () => {
    const encoded = encode('{"value":"яблоко"}')

    const event = createRequestEvent([
      encoded.slice(0, 12),
      encoded.slice(12, 15),
      encoded.slice(15)
    ])

    const result = await readLimitedValidatedJsonBody(event, encoded.byteLength, (value) => {
      expect(value).toStrictEqual({ value: 'яблоко' })

      return { value: 'яблоко' }
    })

    expect(result).toStrictEqual({ value: 'яблоко' })
  })

  it('should reject a declared body that is too large before reading or validating it', async () => {
    const validate = vi.fn(() => {
      return { accepted: true }
    })

    const event = createRequestEvent([encode('{}')], '4097')

    await expect(readLimitedValidatedJsonBody(event, 4096, validate)).rejects.toMatchObject({
      statusCode: 413,
      statusMessage: 'Request body is too large'
    })

    expect(validate).not.toHaveBeenCalled()
  })

  it('should reject an actually oversized chunked body before validation', async () => {
    const validate = vi.fn(() => {
      return { accepted: true }
    })

    const event = createRequestEvent([
      encode('{"padding":"'),
      new Uint8Array(4096),
      encode('"}')
    ])

    await expect(readLimitedValidatedJsonBody(event, 4096, validate)).rejects.toMatchObject({
      statusCode: 413,
      statusMessage: 'Request body is too large'
    })

    expect(validate).not.toHaveBeenCalled()
  })

  it('should reject an invalid Content-Length before reading or validating it', async () => {
    const validate = vi.fn(() => {
      return { accepted: true }
    })

    const event = createRequestEvent([encode('{}')], 'not-a-number')

    await expect(readLimitedValidatedJsonBody(event, 4096, validate)).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Invalid Content-Length'
    })

    expect(validate).not.toHaveBeenCalled()
  })

  it('should reject JSON that does not satisfy the endpoint validator', async () => {
    const event = createRequestEvent([encode('{}')])

    await expect(readLimitedValidatedJsonBody(event, 4096, () => false)).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Request body is invalid'
    })
  })
})
