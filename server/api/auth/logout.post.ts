import { defineEventHandler, setResponseStatus } from 'nuxt/server'
import { clearAppSession } from '#server/utils/session'

export default defineEventHandler(async (event): Promise<void> => {
  await clearAppSession(event)
  setResponseStatus(event, 204)
})
