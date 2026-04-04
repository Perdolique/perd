import {
  propertyDefinitionsByCategorySlug,
  sampleItems
} from './seed-data'

function getRequiredMapValue<ValueType>(
  lookup: Map<string, ValueType>,
  key: string,
  message: string
) {
  const value = lookup.get(key)

  if (value === undefined) {
    throw new Error(message)
  }

  return value
}

function assertSampleItemCoverage() {
  const propertyDataTypeByKey = new Map(
    Object.entries(propertyDefinitionsByCategorySlug).flatMap(([categorySlug, properties]) =>
      properties.map((property) => [`${categorySlug}:${property.slug}`, property.dataType] as const)
    )
  )

  const coveredPropertyKeys = new Set<string>()

  for (const item of sampleItems) {
    for (const property of item.properties) {
      const propertyKey = `${item.categorySlug}:${property.propertySlug}`
      const dataType = getRequiredMapValue(
        propertyDataTypeByKey,
        propertyKey,
        `Missing property definition for ${propertyKey}`
      )

      const definedValueCount = [
        property.valueBoolean,
        property.valueNumber,
        property.valueText
      ].filter((value) => value !== null).length

      if (definedValueCount !== 1) {
        throw new Error(`Expected exactly one value column for ${propertyKey}`)
      }

      if (dataType === 'boolean' && property.valueBoolean === null) {
        throw new Error(`Expected valueBoolean for ${propertyKey}`)
      }

      if (dataType === 'number' && property.valueNumber === null) {
        throw new Error(`Expected valueNumber for ${propertyKey}`)
      }

      if ((dataType === 'enum' || dataType === 'text') && property.valueText === null) {
        throw new Error(`Expected valueText for ${propertyKey}`)
      }

      coveredPropertyKeys.add(propertyKey)
    }
  }

  const missingPropertyKeys = [...propertyDataTypeByKey.keys()].filter(
    (propertyKey) => !coveredPropertyKeys.has(propertyKey)
  )

  if (missingPropertyKeys.length > 0) {
    throw new Error(`Missing sample coverage for properties: ${missingPropertyKeys.join(', ')}`)
  }
}

export {
  assertSampleItemCoverage
}
