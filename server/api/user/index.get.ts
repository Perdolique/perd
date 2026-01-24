import { defineEventHandler } from 'h3'
import { getSessionUser } from '#server/utils/user'

export default defineEventHandler(async (event) => {
  return await getSessionUser(event)
})
