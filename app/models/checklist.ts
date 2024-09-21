interface ChecklistEquipment {
  readonly id: number;
  readonly name: string;
  readonly weight: number;
}

export interface ChecklistItemModel {
  readonly id: number;
  readonly equipment: ChecklistEquipment;
}
