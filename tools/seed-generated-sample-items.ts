interface SampleItemPropertyValue {
  propertySlug: string;
  valueBoolean: boolean | null;
  valueNumber: string | null;
  valueText: string | null;
}

interface SampleItemDefinition {
  brandSlug: string;
  categorySlug: string;
  name: string;
  properties: SampleItemPropertyValue[];
}

type SampleCategorySlug =
  | 'sleeping-bags'
  | 'sleeping-pads'
  | 'stoves'
  | 'tents'
  | 'water-filters'

interface GeneratedSampleCategoryDefinition {
  brandSlugs: readonly [string, ...string[]];
  categorySlug: SampleCategorySlug;
  count: number;
  namePrefix: string;
}

const generatedSampleCategoryDefinitions: GeneratedSampleCategoryDefinition[] = [
  {
    brandSlugs: ['enlightened-equipment', 'nemo', 'sea-to-summit'],
    categorySlug: 'sleeping-bags',
    count: 9,
    namePrefix: 'Seed Sleeping Bag'
  },
  {
    brandSlugs: ['therm-a-rest', 'nemo', 'sea-to-summit'],
    categorySlug: 'sleeping-pads',
    count: 8,
    namePrefix: 'Seed Sleeping Pad'
  },
  {
    brandSlugs: ['big-agnes', 'zpacks', 'gossamer-gear'],
    categorySlug: 'tents',
    count: 9,
    namePrefix: 'Seed Tent'
  },
  {
    brandSlugs: ['msr', 'sea-to-summit', 'gossamer-gear'],
    categorySlug: 'stoves',
    count: 9,
    namePrefix: 'Seed Stove'
  },
  {
    brandSlugs: ['msr', 'sea-to-summit', 'therm-a-rest'],
    categorySlug: 'water-filters',
    count: 9,
    namePrefix: 'Seed Water Filter'
  }
]

function createBooleanProperty(
  propertySlug: string,
  valueBoolean: boolean
): SampleItemPropertyValue {
  return {
    propertySlug,
    valueBoolean,
    valueNumber: null,
    valueText: null
  }
}

function createNumberProperty(
  propertySlug: string,
  value: number
): SampleItemPropertyValue {
  const valueNumber = String(value)

  return {
    propertySlug,
    valueBoolean: null,
    valueNumber,
    valueText: null
  }
}

function createTextProperty(
  propertySlug: string,
  valueText: string
): SampleItemPropertyValue {
  return {
    propertySlug,
    valueBoolean: null,
    valueNumber: null,
    valueText
  }
}

function getCycledValue<ValueType>(
  values: readonly [ValueType, ...ValueType[]],
  sequence: number
): ValueType {
  const valueIndex = (sequence - 1) % values.length
  const value = values[valueIndex]

  if (value === undefined) {
    throw new Error('Expected a non-empty seed value list')
  }

  return value
}

function createGeneratedProperties(
  categorySlug: SampleCategorySlug,
  sequence: number
): SampleItemPropertyValue[] {
  if (categorySlug === 'sleeping-bags') {
    const temperatureRating = -4 - sequence
    const weight = 480 + sequence * 35
    const fillType = getCycledValue(['down', 'synthetic'], sequence)
    const shape = getCycledValue(['mummy', 'rectangular', 'quilt'], sequence)

    return [
      createNumberProperty('temperature-rating', temperatureRating),
      createNumberProperty('weight', weight),
      createTextProperty('fill-type', fillType),
      createTextProperty('shape', shape)
    ]
  }

  if (categorySlug === 'sleeping-pads') {
    const rValue = (30 + sequence * 3) / 10
    const weight = 320 + sequence * 45
    const type = getCycledValue(['inflatable', 'foam', 'self-inflating'], sequence)
    const thickness = (50 + sequence * 4) / 10

    return [
      createNumberProperty('r-value', rValue),
      createNumberProperty('weight', weight),
      createTextProperty('type', type),
      createNumberProperty('thickness', thickness)
    ]
  }

  if (categorySlug === 'tents') {
    const weight = 850 + sequence * 110
    const capacity = ((sequence - 1) % 3) + 1
    const isFreestanding = sequence % 2 === 0

    return [
      createNumberProperty('weight', weight),
      createNumberProperty('capacity', capacity),
      createBooleanProperty('freestanding', isFreestanding)
    ]
  }

  if (categorySlug === 'stoves') {
    const weight = 45 + sequence * 18
    const fuelType = getCycledValue(['canister', 'alcohol', 'liquid-fuel'], sequence)
    const hasIntegratedPot = sequence % 3 === 0

    return [
      createNumberProperty('weight', weight),
      createTextProperty('fuel-type', fuelType),
      createBooleanProperty('integrated-pot', hasIntegratedPot)
    ]
  }

  const weight = 55 + sequence * 38
  const filterType = getCycledValue(['squeeze', 'pump', 'gravity'], sequence)
  const isSqueezeCompatible = filterType !== 'pump'

  return [
    createNumberProperty('weight', weight),
    createTextProperty('filter-type', filterType),
    createBooleanProperty('squeeze-compatible', isSqueezeCompatible)
  ]
}

const generatedSampleItems = generatedSampleCategoryDefinitions.flatMap((definition) =>
  Array.from({ length: definition.count }, (_unusedValue, index) => {
    const sequence = index + 1
    const sequenceLabel = String(sequence).padStart(2, '0')
    const brandSlug = getCycledValue(definition.brandSlugs, sequence)
    const properties = createGeneratedProperties(definition.categorySlug, sequence)

    return {
      brandSlug,
      categorySlug: definition.categorySlug,
      name: `${definition.namePrefix} ${sequenceLabel}`,
      properties
    }
  })
)

export {
  generatedSampleItems
}

export type {
  SampleItemDefinition
}
