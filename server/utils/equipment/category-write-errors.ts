import { inspect } from 'node:util'
import { createError, isNuxtError } from 'nuxt/server'

type CategoryWriteAction = 'create' | 'update' | 'delete'

interface DatabaseConstraintError {
  code: string;
  constraint: string;
}

function getDatabaseError(error: unknown): DatabaseConstraintError | null {
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

/** Keeps native error fields and nested causes in the serialized Worker log. */
function logCategoryWriteError(message: string, error: unknown) {
  const details = inspect(error, { depth: null })

  console.error(message, error, { details })
}

/** Maps known category constraints to public errors and keeps other failures private. */
function throwCategoryWriteError(error: unknown, action: CategoryWriteAction): never {
  const failureMessage = `Failed to ${action} category`

  if (isNuxtError(error)) {
    if (error.status >= 500) {
      logCategoryWriteError(failureMessage, error)
    }

    throw error
  }

  logCategoryWriteError(failureMessage, error)

  const databaseError = getDatabaseError(error)

  if (databaseError?.code === '23505'
    && databaseError.constraint === 'equipment_categories_slug_key') {
    throw createError({
      status: 409,
      statusText: 'Category slug already exists'
    })
  }

  if (action === 'delete'
    && databaseError?.code === '23503'
    && databaseError.constraint === 'equipment_items_categoryId_equipment_categories_id_fkey') {
    throw createError({
      status: 409,
      statusText: 'Category is used by equipment'
    })
  }

  throw createError({
    status: 500,
    statusText: failureMessage
  })
}

export { logCategoryWriteError, throwCategoryWriteError }
