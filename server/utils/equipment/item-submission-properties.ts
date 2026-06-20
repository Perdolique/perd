import { createError } from 'h3'

interface CategoryPropertyRecord {
  dataType: string;
  id: number;
  name: string;
  slug: string;
  unit: string | null;
}

interface EnumOptionRecord {
  propertyId: number;
  slug: string;
}

interface SubmittedItemProperty {
  dataType: string;
  name: string;
  slug: string;
  unit: string | null;
  value: string;
}

interface NormalizedPropertyValue {
  display: SubmittedItemProperty;
  propertyId: number;
  valueBoolean: boolean | null;
  valueNumber: string | null;
  valueText: string | null;
}

interface SubmittedPropertyInput {
  propertyId: number;
  value: boolean | string;
}

const numberValuePattern = /^-?\d+(?:\.\d+)?$/u

function getPropertyRecord(
  propertyById: Map<number, CategoryPropertyRecord>,
  propertyId: number
) {
  const property = propertyById.get(propertyId)

  if (property === undefined) {
    throw createError({
      status: 400,
      message: 'Property does not belong to selected category'
    })
  }

  return property
}

function assertStringValue(value: boolean | string, message: string) {
  if (typeof value !== 'string') {
    throw createError({
      status: 400,
      message
    })
  }

  return value
}

function normalizeTextProperty(
  property: CategoryPropertyRecord,
  value: boolean | string
): NormalizedPropertyValue {
  const textValue = assertStringValue(value, 'Text property value must be a string')

  return {
    display: {
      dataType: property.dataType,
      name: property.name,
      slug: property.slug,
      unit: property.unit,
      value: textValue
    },
    propertyId: property.id,
    valueBoolean: null,
    valueNumber: null,
    valueText: textValue
  }
}

function normalizeNumberProperty(
  property: CategoryPropertyRecord,
  value: boolean | string
): NormalizedPropertyValue {
  const numberValue = assertStringValue(value, 'Number property value must be a decimal string')
  const isNumberValue = numberValuePattern.test(numberValue)

  if (isNumberValue === false) {
    throw createError({
      status: 400,
      message: 'Number property value must be a decimal string'
    })
  }

  return {
    display: {
      dataType: property.dataType,
      name: property.name,
      slug: property.slug,
      unit: property.unit,
      value: numberValue
    },
    propertyId: property.id,
    valueBoolean: null,
    valueNumber: numberValue,
    valueText: null
  }
}

function normalizeBooleanProperty(
  property: CategoryPropertyRecord,
  value: boolean | string
): NormalizedPropertyValue {
  if (typeof value !== 'boolean') {
    throw createError({
      status: 400,
      message: 'Boolean property value must be a boolean'
    })
  }

  return {
    display: {
      dataType: property.dataType,
      name: property.name,
      slug: property.slug,
      unit: property.unit,
      value: String(value)
    },
    propertyId: property.id,
    valueBoolean: value,
    valueNumber: null,
    valueText: null
  }
}

function normalizeEnumProperty(
  enumOptionKeys: Set<string>,
  property: CategoryPropertyRecord,
  value: boolean | string
): NormalizedPropertyValue {
  const enumSlug = assertStringValue(value, 'Enum property value must be an option slug')
  const enumOptionKey = `${property.id}:${enumSlug}`

  if (enumOptionKeys.has(enumOptionKey) === false) {
    throw createError({
      status: 400,
      message: 'Enum property value must match a category option'
    })
  }

  return {
    display: {
      dataType: property.dataType,
      name: property.name,
      slug: property.slug,
      unit: property.unit,
      value: enumSlug
    },
    propertyId: property.id,
    valueBoolean: null,
    valueNumber: null,
    valueText: enumSlug
  }
}

function normalizePropertyValues(
  categoryPropertiesList: CategoryPropertyRecord[],
  enumOptions: EnumOptionRecord[],
  submittedProperties: SubmittedPropertyInput[]
) {
  const propertyById = new Map(
    categoryPropertiesList.map((property) => [
      property.id,
      property
    ])
  )
  const enumOptionKeys = new Set(
    enumOptions.map((option) => `${option.propertyId}:${option.slug}`)
  )

  return submittedProperties.map((submittedProperty) => {
    const property = getPropertyRecord(propertyById, submittedProperty.propertyId)

    if (property.dataType === 'text') {
      return normalizeTextProperty(property, submittedProperty.value)
    }

    if (property.dataType === 'number') {
      return normalizeNumberProperty(property, submittedProperty.value)
    }

    if (property.dataType === 'boolean') {
      return normalizeBooleanProperty(property, submittedProperty.value)
    }

    if (property.dataType === 'enum') {
      return normalizeEnumProperty(enumOptionKeys, property, submittedProperty.value)
    }

    throw createError({
      status: 500,
      message: 'Unsupported property data type'
    })
  })
}

export {
  normalizePropertyValues,
  type CategoryPropertyRecord,
  type EnumOptionRecord,
  type NormalizedPropertyValue,
  type SubmittedItemProperty,
  type SubmittedPropertyInput
}
