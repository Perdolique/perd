import { appendResponseHeader, H3Event } from 'h3'
import { sessionCookieName } from '~~/constants'

interface FetchOptions {
  headers: HeadersInit;
}

export async function fetchWithCookies(event: H3Event, url: string, options?: FetchOptions) {
  const response = await $fetch.raw(url, {
    headers: options?.headers
  })

  const rawCookie = response.headers.get('set-cookie') || ''
  const cookies = rawCookie.split(',')

  const sessionCookie = cookies.find(
    cookie => cookie.split('=')[0] === sessionCookieName
  )

  if (sessionCookie !== undefined) {
    appendResponseHeader(event, 'set-cookie', sessionCookie)
  }

  return response._data
}
