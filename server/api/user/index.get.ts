import { defineEventHandler } from 'nuxt/server'
import { getSessionUser, type SessionUser } from '#server/utils/user'

export default defineEventHandler(
  async (event): Promise<SessionUser> => getSessionUser(event)
)
