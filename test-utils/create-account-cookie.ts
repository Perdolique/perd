import { updateSession } from 'nuxt/server'

/** Seals a native Nuxt session for built Worker tests. */
async function createAccountCookie(userId: string, password: string, sessionVersion = 0): Promise<string> {
  const event = {
    req: new globalThis.Request('https://metsik.app'),
    res: { headers: new globalThis.Headers() }
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

  return cookie.split(';')[0] ?? ''
}

export { createAccountCookie }
