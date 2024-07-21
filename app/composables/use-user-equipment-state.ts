interface EquipmentItem {
  readonly id: string;
  readonly name: string;
  readonly weight: number;
  readonly createdAt: string;
}

export function useUserEquipmentState() {
  return useState<EquipmentItem[]>('userEquipment', () => [])
}
