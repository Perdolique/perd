export type EquipmentStatus = 'draft' | 'active'

export const equipmentTypes : Record<EquipmentStatus, EquipmentStatus> = {
  draft: 'draft',
  active: 'active'
} as const
