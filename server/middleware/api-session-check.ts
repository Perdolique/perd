import { isSamePath, withBase } from 'ufo'
import { publicApiPaths } from '~~/constants'

const apiBase = '/api'

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)
  const isApiPath = url.pathname.startsWith(apiBase)

  if (isApiPath) {
    const session = await getAppSession(event)
    const { userId } = session.data

    const isPublic = publicApiPaths.some((path) => {
      const apiPath = withBase(path, apiBase)

      return isSamePath(apiPath, url.pathname)
    })

    if (isPublic === false && userId === undefined) {
      throw createError({
        statusCode: 401
      })
    }
  }
})
