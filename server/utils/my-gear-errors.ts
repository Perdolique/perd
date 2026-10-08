import { inspect } from 'node:util'
import { createError, isNuxtError } from 'nuxt/server'

/** Keeps database failures private while preserving their nested details in Worker logs. */
function throwMyGearError(error: unknown, action: 'create' | 'rename' | 'delete' | 'load'): never {
  if (isNuxtError(error) && error.status < 500) {
    throw error
  }

  const message = `Failed to ${action} my gear row`
  const details = inspect(error, { depth: null })

  console.error(message, error, { details })

  let current = error

  for (let depth = 0; depth < 4 && current !== null && typeof current === 'object'; depth += 1) {
    const code: unknown = Reflect.get(current, 'code')

    if (action === 'create' && code === '23505') {
      throw createError({
        status: 409,
        message: 'Item is already in my gear'
      })
    }

    if (action === 'delete' && (code === '23503' || code === '23001')) {
      throw createError({
        status: 409,
        message: 'My gear item is still used in a list'
      })
    }

    current = Reflect.get(current, 'cause')
  }

  throw createError({
    status: 500,
    message
  })
}

export { throwMyGearError }
