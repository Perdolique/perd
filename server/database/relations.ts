import { defineRelations } from 'drizzle-orm'
import * as schema from './schema'

export const relations = defineRelations(schema, (r) => ({
  users: {
    equipment: r.many.equipment({
      from: r.users.id,
      to: r.equipment.creatorId
    }),

    userEquipment: r.many.userEquipment({
      from: r.users.id,
      to: r.userEquipment.userId
    }),

    checklists: r.many.checklists({
      from: r.users.id,
      to: r.checklists.userId
    }),

    oauthAccounts: r.many.oauthAccounts({
      from: r.users.id,
      to: r.oauthAccounts.userId
    })
  },

  oauthProviders: {
    oauthAccounts: r.many.oauthAccounts({
      from: r.oauthProviders.id,
      to: r.oauthAccounts.providerId
    })
  },

  equipmentTypes: {
    equipment: r.many.equipment({
      from: r.equipmentTypes.id,
      to: r.equipment.equipmentTypeId
    }),

    equipmentTypeAttributes: r.many.equipmentTypeAttributes({
      from: r.equipmentTypes.id,
      to: r.equipmentTypeAttributes.equipmentTypeId
    })
  },

  equipmentGroups: {
    equipment: r.many.equipment({
      from: r.equipmentGroups.id,
      to: r.equipment.equipmentGroupId
    })
  },

  brands: {
    equipment: r.many.equipment({
      from: r.brands.id,
      to: r.equipment.brandId
    })
  },

  equipment: {
    userEquipment: r.many.userEquipment({
      from: r.equipment.id,
      to: r.userEquipment.equipmentId
    }),

    checklistItems: r.many.checklistItems({
      from: r.equipment.id,
      to: r.checklistItems.equipmentId
    }),

    equipmentAttributeValues: r.many.equipmentAttributeValues({
      from: r.equipment.id,
      to: r.equipmentAttributeValues.equipmentId
    })
  },

  equipmentAttributes: {
    equipmentTypeAttributes: r.many.equipmentTypeAttributes({
      from: r.equipmentAttributes.id,
      to: r.equipmentTypeAttributes.equipmentAttributeId
    }),

    equipmentAttributeValues: r.many.equipmentAttributeValues({
      from: r.equipmentAttributes.id,
      to: r.equipmentAttributeValues.equipmentAttributeId
    })
  },

  checklists: {
    checklistItems: r.many.checklistItems({
      from: r.checklists.id,
      to: r.checklistItems.checklistId
    })
  },

  checklistItems: {
    equipment: r.one.equipment({
      from: r.checklistItems.equipmentId,
      to: r.equipment.id,
      optional: false
    })
  }
}))
