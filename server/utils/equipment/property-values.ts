import { createError } from 'h3'

type EquipmentPropertyDataType = 'boolean' | 'enum' | 'number' | 'text'
type EquipmentPropertyValue = string | number | boolean | null

interface EquipmentPropertyValueColumns {
  dataType: EquipmentPropertyDataType;
  valueBoolean: boolean | null;
  valueNumber: string | null;
  valueText: string | null;
}

function getEquipmentPropertyDataType(dataType: string): EquipmentPropertyDataType {
  const isSupportedDataType = dataType === 'boolean'
    || dataType === 'enum'
    || dataType === 'number'
    || dataType === 'text'

  if (!isSupportedDataType) {
    throw createError({
      status: 500,
      message: `Unsupported equipment property data type: ${dataType}`
    })
  }

  return dataType
}

/** Normalizes the EAV value columns into the public equipment property value contract. */
function normalizeEquipmentPropertyValue(input: EquipmentPropertyValueColumns): EquipmentPropertyValue {
  if (input.dataType === 'number') {
    return input.valueNumber === null ? null : Number(input.valueNumber)
  }

  if (input.dataType === 'boolean') {
    return input.valueBoolean
  }

  return input.valueText
}

export {
  getEquipmentPropertyDataType,
  normalizeEquipmentPropertyValue
}

export type {
  EquipmentPropertyDataType,
  EquipmentPropertyValue,
  EquipmentPropertyValueColumns
}
