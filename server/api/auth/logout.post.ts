import { sessionCookieName } from "~~/constants"

export default defineEventHandler(async (event) => {
  setCookie(event, sessionCookieName, '', {
    expires: new Date(0)
  })

  return {}
})
