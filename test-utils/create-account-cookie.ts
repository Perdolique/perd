import { updateSession } from 'nuxt/server'

/** Seals a native Nuxt session for built Worker tests. */
async function createAccountCookie(userId: string, password: string, sessionVersion = 0): Promise<string> {
  const request = new globalThis.Request('https://metsik.app')
  const headers = new globalThis.Headers()

  const event = {
    req: request,
    res: { headers }
  }

  await updateSession(event, {
    name: 'perdSession',
    password
  }, {
    userId,
    sessionVersion
  })

  const [cookie] = event.res.headers.getSetCookie()

  if (cookie === undefined) {
    throw new Error('Expected a native Nuxt session cookie')
  }

  const [cookieValue] = cookie.split(';')

  return cookieValue ?? ''
}

export { createAccountCookie }
