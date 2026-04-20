import { createError, defineEventHandler, isError, readValidatedBody, setResponseStatus } from 'h3'
import { userEquipment } from '#server/database/schema'
import { validateSessionUser } from '#server/utils/session'
import { validateUserEquipmentCreateBody } from '#server/utils/validation/schemas'

interface CreatedInventoryRecord {
  createdAt: Date | string;
  id: string;

  item: {
    id: string;
    name: string;

    brand: {
      name: string;
      slug: string;
    };

    category: {
      name: string;
      slug: string;
    };
  };
}

interface InventoryQueryRow {
  createdAt: Date | string;
  id: string;

  item: {
    id: string;
    name: string;

    brand: {
      name: string;
      slug: string;
    } | null;

    category: {
      name: string;
      slug: string;
    } | null;
  } | null;
}

function isUniqueViolation(error: unknown) {
  if (error !== null && typeof error === 'object' && 'code' in error && error.code === '23505') {
    return true
  }

  return error instanceof Error && /duplicate|unique/u.test(error.message)
}

export default defineEventHandler(async (event) : Promise<CreatedInventoryRecord> => {
  const userId = await validateSessionUser(event)
  const { itemId } = await readValidatedBody(event, validateUserEquipmentCreateBody)

  const approvedItem = await event.context.dbHttp.query.equipmentItems.findFirst({
    columns: {
      id: true
    },

    where: {
      id: itemId,
      status: 'approved'
    }
  })

  if (approvedItem === undefined) {
    throw createError({ status: 404 })
  }

  const existingInventoryRow = await event.context.dbHttp.query.userEquipment.findFirst({
    columns: {
      id: true
    },

    where: {
      itemId,
      userId
    }
  })

  if (existingInventoryRow !== undefined) {
    throw createError({
      status: 409,
      message: 'Item is already in inventory'
    })
  }

  try {
    const [createdInventoryRow] = await event.context.dbHttp
      .insert(userEquipment)
      .values({
        itemId,
        userId
      })
      .returning({
        id: userEquipment.id
      })

    if (createdInventoryRow === undefined) {
      throw createError({
        status: 500,
        message: 'Failed to create inventory row'
      })
    }

    const inventoryRow: InventoryQueryRow | undefined = await event.context.dbHttp.query.userEquipment.findFirst({
      columns: {
        createdAt: true,
        id: true
      },

      where: {
        id: createdInventoryRow.id,
        userId
      },

      with: {
        item: {
          columns: {
            id: true,
            name: true
          },

          with: {
            brand: {
              columns: {
                name: true,
                slug: true
              }
            },

            category: {
              columns: {
                name: true,
                slug: true
              }
            }
          }
        }
      }
    })

    const inventoryItem = inventoryRow?.item
    const inventoryBrand = inventoryItem?.brand
    const inventoryCategory = inventoryItem?.category

    if (
      inventoryRow === undefined ||
      inventoryItem === undefined ||
      inventoryItem === null ||
      inventoryBrand === undefined ||
      inventoryBrand === null ||
      inventoryCategory === undefined ||
      inventoryCategory === null
    ) {
      throw createError({
        status: 500,
        message: 'Failed to load created inventory row'
      })
    }

    setResponseStatus(event, 201)

    return {
      createdAt: inventoryRow.createdAt,
      id: inventoryRow.id,

      item: {
        id: inventoryItem.id,
        name: inventoryItem.name,

        brand: {
          name: inventoryBrand.name,
          slug: inventoryBrand.slug
        },

        category: {
          name: inventoryCategory.name,
          slug: inventoryCategory.slug
        }
      }
    }
  } catch (error) {
    if (isError(error)) {
      throw error
    }

    if (isUniqueViolation(error)) {
      throw createError({
        status: 409,
        message: 'Item is already in inventory'
      })
    }

    throw createError({
      status: 500,
      message: 'Failed to create inventory row'
    })
  }
})
