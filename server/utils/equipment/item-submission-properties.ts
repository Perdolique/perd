import { createError } from 'h3'
import { isFiniteDecimalNumber, normalizeDecimalNumber } from '#shared/utils/decimal-number'

interface ItemSubmissionPropertyInput {
  propertyId: number;
  value: boolean | string;
}

interface ItemSubmissionEnumOptionDefinition {
  slug: string;
}

interface ItemSubmissionPropertyDefinition {
  allowsNegativeValues: boolean;
  categoryId: number;
  dataType: string;
  enumOptions: ItemSubmissionEnumOptionDefinition[];
  id: number;
}

interface ItemSubmissionPropertyValue {
  propertyId: number;
  valueBoolean: boolean | null;
  valueNumber: string | null;
  valueText: string | null;
}

function createInvalidPropertyError(message: string) {
  return createError({
    status: 400,
    message
  })
}

function normalizeTextValue(value: boolean | string) {
  if (typeof value !== 'string') {
    throw createInvalidPropertyError('Text property value must be a string')
  }

  const normalizedValue = value.trim()

  if (normalizedValue === '') {
    throw createInvalidPropertyError('Text property value must not be empty')
  }

  return normalizedValue
}

function normalizeNumberValue(value: boolean | string, allowsNegativeValues: boolean) {
  if (typeof value !== 'string') {
    throw createInvalidPropertyError('Number property value must be a string')
  }

  const trimmedValue = value.trim()
  const hasValidNumber = isFiniteDecimalNumber(trimmedValue)

  if (hasValidNumber === false) {
    throw createInvalidPropertyError('Number property value must be a finite decimal')
  }

  const normalizedValue = normalizeDecimalNumber(trimmedValue)
  const isNegativeValue = normalizedValue.startsWith('-')

  if (isNegativeValue && allowsNegativeValues === false) {
    throw createInvalidPropertyError('Number property value must not be negative')
  }

  return normalizedValue
}

function normalizeBooleanValue(value: boolean | string) {
  if (typeof value !== 'boolean') {
    throw createInvalidPropertyError('Boolean property value must be a boolean')
  }

  return value
}

function normalizeEnumValue(
  value: boolean | string,
  options: ItemSubmissionEnumOptionDefinition[]
) {
  if (typeof value !== 'string') {
    throw createInvalidPropertyError('Enum property value must be a string')
  }

  const normalizedValue = value.trim()
  const hasMatchingOption = options.some((option) => option.slug === normalizedValue)

  if (hasMatchingOption === false) {
    throw createInvalidPropertyError('Enum property value must match an available option')
  }

  return normalizedValue
}

/** Validates submitted category properties and maps them to the EAV value columns. */
function normalizeItemSubmissionProperties(
  categoryId: number,
  definitions: ItemSubmissionPropertyDefinition[],
  inputs: ItemSubmissionPropertyInput[]
): ItemSubmissionPropertyValue[] {
  const definitionsById = new Map(definitions.map((definition) => [definition.id, definition]))

  return inputs.map((input) => {
    const definition = definitionsById.get(input.propertyId)

    if (definition === undefined || definition.categoryId !== categoryId) {
      throw createInvalidPropertyError('Property does not belong to the selected category')
    }

    const valueColumns: ItemSubmissionPropertyValue = {
      propertyId: input.propertyId,
      valueBoolean: null,
      valueNumber: null,
      valueText: null
    }

    if (definition.dataType === 'text') {
      valueColumns.valueText = normalizeTextValue(input.value)

      return valueColumns
    }

    if (definition.dataType === 'number') {
      valueColumns.valueNumber = normalizeNumberValue(input.value, definition.allowsNegativeValues)

      return valueColumns
    }

    if (definition.dataType === 'boolean') {
      valueColumns.valueBoolean = normalizeBooleanValue(input.value)

      return valueColumns
    }

    if (definition.dataType === 'enum') {
      valueColumns.valueText = normalizeEnumValue(input.value, definition.enumOptions)

      return valueColumns
    }

    throw createError({
      status: 500,
      message: `Unsupported equipment property data type: ${definition.dataType}`
    })
  })
}

export { normalizeItemSubmissionProperties }

export type {
  ItemSubmissionPropertyDefinition,
  ItemSubmissionPropertyInput,
  ItemSubmissionPropertyValue
}
