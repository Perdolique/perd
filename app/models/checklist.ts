interface ChecklistEquipment {
  readonly id: string;
  readonly name: string;
  readonly weight: number;
}

export interface ChecklistItemModel {
  readonly id: string;
  readonly equipment: ChecklistEquipment;
}
