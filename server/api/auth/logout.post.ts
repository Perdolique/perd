import { sessionCookieName } from "~~/constants"

export default defineEventHandler(async (event) => {
  const cookie = getCookie(event, sessionCookieName)

  setCookie(event, sessionCookieName, '', {
    expires: new Date(0)
  })

  return {}
})
