import { createError, isError } from 'h3'

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

/** Maps known category constraints to public errors and keeps other failures private. */
function throwCategoryWriteError(error: unknown, action: CategoryWriteAction): never {
  const failureMessage = `Failed to ${action} category`

  if (isError(error)) {
    if (error.statusCode >= 500) {
      console.error(failureMessage, { error })
    }

    throw error
  }

  console.error(failureMessage, { error })

  const databaseError = getDatabaseError(error)

  if (databaseError?.code === '23505'
    && databaseError.constraint === 'equipment_categories_slug_key') {
    throw createError({
      status: 409,
      statusMessage: 'Category slug already exists'
    })
  }

  if (action === 'delete'
    && databaseError?.code === '23503'
    && databaseError.constraint === 'equipment_items_categoryId_equipment_categories_id_fkey') {
    throw createError({
      status: 409,
      statusMessage: 'Category is used by equipment'
    })
  }

  throw createError({
    status: 500,
    statusMessage: failureMessage
  })
}

export { throwCategoryWriteError }
