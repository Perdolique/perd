import { describe, expect, it, vi } from 'vitest'
import { getPrimaryEquipmentImageIds } from '#server/utils/equipment/primary-images'

type PrimaryImageOptions = Parameters<typeof getPrimaryEquipmentImageIds>[0]

describe(getPrimaryEquipmentImageIds, () => {
  it('should index primary Cloudflare image IDs by equipment item ID', async () => {
    const rows = [{
      cloudflareImageId: 'cloudflare-image-1',
      itemId: 'item-1'
    }, {
      cloudflareImageId: 'cloudflare-image-2',
      itemId: 'item-2'
    }]

    const findManyMock = vi.fn(() => rows)

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Drizzle's fluent client type is impractical to construct in a focused unit test.
    const dbHttp = {
      query: {
        equipmentItemImages: {
          findMany: findManyMock
        }
      }
    } as unknown as PrimaryImageOptions['dbHttp']

    const result = await getPrimaryEquipmentImageIds({
      dbHttp,
      itemIds: ['item-1', 'item-2']
    })

    expect(result).toStrictEqual(new Map([
      ['item-1', 'cloudflare-image-1'],
      ['item-2', 'cloudflare-image-2']
    ]))

    expect(findManyMock).toHaveBeenCalledWith({
      columns: {
        cloudflareImageId: true,
        itemId: true
      },

      where: {
        displayOrder: 0,

        itemId: {
          in: ['item-1', 'item-2']
        }
      }
    })
  })

  it('should return an empty map without querying for an empty item list', async () => {
    const findManyMock = vi.fn()

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Drizzle's fluent client type is impractical to construct in a focused unit test.
    const dbHttp = {
      query: {
        equipmentItemImages: {
          findMany: findManyMock
        }
      }
    } as unknown as PrimaryImageOptions['dbHttp']

    const result = await getPrimaryEquipmentImageIds({
      dbHttp,
      itemIds: []
    })

    expect(result).toStrictEqual(new Map())
    expect(findManyMock).not.toHaveBeenCalled()
  })
})
