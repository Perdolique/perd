import { defineEventHandler, sendNoContent } from 'h3'
import { clearAppSession } from '#server/utils/session'

export default defineEventHandler(async (event) => {
  await clearAppSession(event)

  sendNoContent(event)
})
