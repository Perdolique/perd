import { createError, isNuxtError } from 'nuxt/server'

type BrandWriteAction = 'create' | 'update' | 'delete'

function getDatabaseError(error: unknown): { code: string; constraint: string; } | null {
  let current = error

  for (let depth = 0; depth < 4; depth += 1) {
    if (current === null || typeof current !== 'object') {
      return null
    }

    const code: unknown = Reflect.get(current, 'code')
    const constraint: unknown = Reflect.get(current, 'constraint')

    if (typeof code === 'string' && typeof constraint === 'string') {
      return {
        code,
        constraint
      }
    }

    current = Reflect.get(current, 'cause')
  }

  return null
}

/** Maps only known brand constraints to public errors and keeps other failures private. */
function throwBrandWriteError(error: unknown, action: BrandWriteAction): never {
  const failureMessage = `Failed to ${action} brand`

  if (isNuxtError(error)) {
    if (error.status >= 500) {
      console.error(failureMessage, { error })
    }

    throw error
  }

  console.error(failureMessage, { error })

  const databaseError = getDatabaseError(error)

  if (databaseError?.code === '23505') {
    if (databaseError.constraint === 'brands_name_key') {
      throw createError({
        status: 409,
        statusText: 'Brand name already exists'
      })
    }

    if (databaseError.constraint === 'brands_slug_key') {
      throw createError({
        status: 409,
        statusText: 'Brand slug already exists'
      })
    }
  }

  if (action === 'delete'
    && databaseError?.code === '23503'
    && databaseError.constraint === 'equipment_items_brandId_brands_id_fkey') {
    throw createError({
      status: 409,
      statusText: 'Brand is used by equipment'
    })
  }

  throw createError({
    status: 500,
    statusText: failureMessage
  })
}

export { throwBrandWriteError }
