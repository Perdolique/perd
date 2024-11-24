export type EquipmentStatus = 'draft' | 'active'

export const equipmentStatuses : Record<EquipmentStatus, EquipmentStatus> = {
  draft: 'draft',
  active: 'active'
} as const
