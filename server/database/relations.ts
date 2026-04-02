import { defineRelations } from 'drizzle-orm'
import * as schema from './schema'

export const relations = defineRelations(schema, (relation) => {
  return {
    users: {
      oauthAccounts: relation.many.oauthAccounts({
        from: relation.users.id,
        to: relation.oauthAccounts.userId
      }),

      userEquipment: relation.many.userEquipment({
        from: relation.users.id,
        to: relation.userEquipment.userId
      }),

      contributions: relation.many.contributions({
        from: relation.users.id,
        to: relation.contributions.userId
      }),

      createdItems: relation.many.equipmentItems({
        from: relation.users.id,
        to: relation.equipmentItems.createdBy
      })
    },

    oauthProviders: {
      oauthAccounts: relation.many.oauthAccounts({
        from: relation.oauthProviders.id,
        to: relation.oauthAccounts.providerId
      })
    },

    equipmentGroups: {},

    equipmentCategories: {
      items: relation.many.equipmentItems({
        from: relation.equipmentCategories.id,
        to: relation.equipmentItems.categoryId
      }),

      properties: relation.many.categoryProperties({
        from: relation.equipmentCategories.id,
        to: relation.categoryProperties.categoryId
      })
    },

    brands: {
      items: relation.many.equipmentItems({
        from: relation.brands.id,
        to: relation.equipmentItems.brandId
      })
    },

    equipmentItems: {
      category: relation.one.equipmentCategories({
        from: relation.equipmentItems.categoryId,
        to: relation.equipmentCategories.id
      }),

      brand: relation.one.brands({
        from: relation.equipmentItems.brandId,
        to: relation.brands.id
      }),

      creator: relation.one.users({
        from: relation.equipmentItems.createdBy,
        to: relation.users.id
      }),

      propertyValues: relation.many.itemPropertyValues({
        from: relation.equipmentItems.id,
        to: relation.itemPropertyValues.itemId
      }),

      userEquipment: relation.many.userEquipment({
        from: relation.equipmentItems.id,
        to: relation.userEquipment.itemId
      })
    },

    categoryProperties: {
      category: relation.one.equipmentCategories({
        from: relation.categoryProperties.categoryId,
        to: relation.equipmentCategories.id
      }),

      enumOptions: relation.many.propertyEnumOptions({
        from: relation.categoryProperties.id,
        to: relation.propertyEnumOptions.propertyId
      }),

      values: relation.many.itemPropertyValues({
        from: relation.categoryProperties.id,
        to: relation.itemPropertyValues.propertyId
      })
    },

    propertyEnumOptions: {
      property: relation.one.categoryProperties({
        from: relation.propertyEnumOptions.propertyId,
        to: relation.categoryProperties.id
      })
    },

    itemPropertyValues: {
      item: relation.one.equipmentItems({
        from: relation.itemPropertyValues.itemId,
        to: relation.equipmentItems.id
      }),

      property: relation.one.categoryProperties({
        from: relation.itemPropertyValues.propertyId,
        to: relation.categoryProperties.id
      })
    },

    userEquipment: {
      user: relation.one.users({
        from: relation.userEquipment.userId,
        to: relation.users.id
      }),

      item: relation.one.equipmentItems({
        from: relation.userEquipment.itemId,
        to: relation.equipmentItems.id
      })
    },

    contributions: {
      user: relation.one.users({
        from: relation.contributions.userId,
        to: relation.users.id
      })
    }
  }
})
