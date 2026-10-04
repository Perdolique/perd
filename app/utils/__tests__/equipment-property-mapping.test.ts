import { describe, expect, it } from 'vitest'
import type { CategoryDetailResponse } from '#server/api/equipment/categories/by-slug/[slug].get'

import {
  applyEquipmentPropertyAssignments,
  canTransferEquipmentProperty,
  getEquipmentPropertySources,
  suggestEquipmentPropertyAssignments
} from '../equipment-property-mapping'

type Property = CategoryDetailResponse['properties'][number]

const weight: Property = {
  id: 1,
  name: 'Weight',
  slug: 'weight',
  dataType: 'number',
  unit: 'g',
  allowsNegativeValues: false
}

const targetWeight: Property = {
  ...weight,
  id: 11
}

const flag: Property = {
  id: 2,
  name: 'Waterproof',
  slug: 'waterproof',
  dataType: 'boolean',
  unit: null,
  allowsNegativeValues: false
}

const notes: Property = {
  id: 3,
  name: 'Notes',
  slug: 'notes',
  dataType: 'text',
  unit: null,
  allowsNegativeValues: false
}

const fill: Property = {
  id: 4,
  name: 'Fill',
  slug: 'fill',
  dataType: 'enum',
  unit: null,
  allowsNegativeValues: false,

  enumOptions: [{
    id: 1,
    name: 'Down',
    slug: 'down'
  }]
}

describe('equipment property transfer', () => {
  it('keeps zero, false, precision, and invalid drafts visible while omitting empty fields', () => {
    const sources = getEquipmentPropertySources([weight, flag, notes, fill], {
      1: '0',
      2: 'false',
      3: ' ',
      4: 'unknown'
    })

    const sourceValues = sources.map((source) => [source.property.id, source.value])

    expect(sourceValues).toStrictEqual([[1, '0'], [2, false], [4, 'unknown']])

    const exact = '9007199254740993.123456789'

    const assignments = applyEquipmentPropertyAssignments([{
      property: weight,
      value: exact
    }], [targetWeight], { 1: 11 })

    expect(assignments).toStrictEqual({ 11: exact })
  })

  it.each([
    {
      source: weight,
      value: '0',
      target: targetWeight,
      expected: true
    },
    {
      source: weight,
      value: '-1',
      target: targetWeight,
      expected: false
    },
    {
      source: weight,
      value: '-0',
      target: targetWeight,
      expected: true
    },
    {
      source: {
        ...weight,
        allowsNegativeValues: true
      },

      value: '-1',

      target: {
        ...targetWeight,
        allowsNegativeValues: true
      },

      expected: true
    },
    {
      source: weight,
      value: '-1',

      target: {
        ...targetWeight,
        allowsNegativeValues: true
      },

      expected: false
    },
    {
      source: weight,
      value: 'abc',
      target: targetWeight,
      expected: false
    },
    {
      source: weight,
      value: 'Infinity',
      target: targetWeight,
      expected: false
    },
    {
      source: weight,
      value: '12',

      target: {
        ...targetWeight,
        unit: 'oz'
      },

      expected: false
    },
    {
      source: weight,
      value: '12',

      target: {
        ...targetWeight,
        unit: null
      },

      expected: false
    },
    {
      source: {
        ...weight,
        unit: null
      },

      value: '12',

      target: {
        ...targetWeight,
        unit: null
      },

      expected: true
    },
    {
      source: weight,
      value: '12',
      target: notes,
      expected: false
    },
    {
      source: flag,
      value: false,

      target: {
        ...flag,
        id: 12
      },

      expected: true
    },
    {
      source: notes,
      value: 'hello',

      target: {
        ...notes,
        id: 13
      },

      expected: true
    },
    {
      source: fill,
      value: 'down',

      target: {
        ...fill,
        id: 14
      },

      expected: true
    },
    {
      source: {
        ...fill,
        enumOptions: []
      },

      value: 'down',
      target: fill,
      expected: false
    },
    {
      source: fill,
      value: 'down',

      target: {
        ...fill,
        id: 14,
        enumOptions: []
      },

      expected: false
    }
  ])('checks $source.dataType value $value against $target.dataType ($target.unit)', ({ source, value, target, expected }) => {
    const canTransfer = canTransferEquipmentProperty({
      property: source,
      value
    }, target)

    expect(canTransfer).toBe(expected)
  })

  it('suggests only compatible exact slugs and permits an explicit manual match', () => {
    const sources = [{
      property: weight,
      value: '35'
    }, {
      property: notes,
      value: 'draft'
    }]

    const manual = {
      ...notes,
      id: 13,
      slug: 'description'
    }

    const targets = [targetWeight, manual]
    const suggestions = suggestEquipmentPropertyAssignments(sources, targets)
    const incompleteMapping = applyEquipmentPropertyAssignments(sources, targets, { 1: 11 })

    expect(suggestions).toStrictEqual({ 1: 11 })
    expect(incompleteMapping).toBeNull()

    const manualMapping = applyEquipmentPropertyAssignments(sources, targets, {
      1: 11,
      3: 13
    })

    expect(manualMapping).toStrictEqual({
      11: '35',
      13: 'draft'
    })

    const mappingWithDiscard = applyEquipmentPropertyAssignments(sources, targets, {
      1: null,
      3: 13
    })

    expect(mappingWithDiscard).toStrictEqual({ 13: 'draft' })
  })

  it('rejects duplicate targets and incompatible or missing manual targets', () => {
    const sources = [{
      property: weight,
      value: '35'
    }, {
      property: {
        ...weight,
        id: 5
      },

      value: '40'
    }]

    const duplicateMapping = applyEquipmentPropertyAssignments(sources, [targetWeight], {
      1: 11,
      5: 11
    })

    expect(duplicateMapping).toBeNull()

    const incompatibleMapping = applyEquipmentPropertyAssignments(sources, [notes], {
      1: 3,
      5: null
    })

    expect(incompatibleMapping).toBeNull()

    const missingTargetMapping = applyEquipmentPropertyAssignments(sources, [targetWeight], {
      1: 99,
      5: null
    })

    expect(missingTargetMapping).toBeNull()

    const discardedMapping = applyEquipmentPropertyAssignments(sources, [], {
      1: null,
      5: null
    })

    expect(discardedMapping).toStrictEqual({})
  })
})
