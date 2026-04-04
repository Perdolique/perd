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

const sampleItems: SampleItemDefinition[] = [
  {
    brandSlug: 'therm-a-rest',
    categorySlug: 'sleeping-pads',
    name: 'Therm-a-Rest NeoAir XLite NXT Regular',
    properties: [
      {
        propertySlug: 'r-value',
        valueBoolean: null,
        valueNumber: '4.5',
        valueText: null
      },
      {
        propertySlug: 'weight',
        valueBoolean: null,
        valueNumber: '370',
        valueText: null
      },
      {
        propertySlug: 'type',
        valueBoolean: null,
        valueNumber: null,
        valueText: 'inflatable'
      },
      {
        propertySlug: 'thickness',
        valueBoolean: null,
        valueNumber: '7.6',
        valueText: null
      }
    ]
  },
  {
    brandSlug: 'nemo',
    categorySlug: 'sleeping-pads',
    name: 'Nemo Tensor Insulated Regular',
    properties: [
      {
        propertySlug: 'r-value',
        valueBoolean: null,
        valueNumber: '4.2',
        valueText: null
      },
      {
        propertySlug: 'weight',
        valueBoolean: null,
        valueNumber: '410',
        valueText: null
      },
      {
        propertySlug: 'type',
        valueBoolean: null,
        valueNumber: null,
        valueText: 'inflatable'
      },
      {
        propertySlug: 'thickness',
        valueBoolean: null,
        valueNumber: '8',
        valueText: null
      }
    ]
  },
  {
    brandSlug: 'enlightened-equipment',
    categorySlug: 'sleeping-bags',
    name: 'Enlightened Equipment Enigma 20F Regular',
    properties: [
      {
        propertySlug: 'temperature-rating',
        valueBoolean: null,
        valueNumber: '-7',
        valueText: null
      },
      {
        propertySlug: 'weight',
        valueBoolean: null,
        valueNumber: '540',
        valueText: null
      },
      {
        propertySlug: 'fill-type',
        valueBoolean: null,
        valueNumber: null,
        valueText: 'down'
      },
      {
        propertySlug: 'shape',
        valueBoolean: null,
        valueNumber: null,
        valueText: 'quilt'
      }
    ]
  },
  {
    brandSlug: 'big-agnes',
    categorySlug: 'tents',
    name: 'Big Agnes Copper Spur HV UL2',
    properties: [
      {
        propertySlug: 'weight',
        valueBoolean: null,
        valueNumber: '1420',
        valueText: null
      },
      {
        propertySlug: 'capacity',
        valueBoolean: null,
        valueNumber: '2',
        valueText: null
      },
      {
        propertySlug: 'freestanding',
        valueBoolean: true,
        valueNumber: null,
        valueText: null
      }
    ]
  },
  {
    brandSlug: 'msr',
    categorySlug: 'stoves',
    name: 'MSR PocketRocket Deluxe',
    properties: [
      {
        propertySlug: 'weight',
        valueBoolean: null,
        valueNumber: '83',
        valueText: null
      },
      {
        propertySlug: 'fuel-type',
        valueBoolean: null,
        valueNumber: null,
        valueText: 'canister'
      },
      {
        propertySlug: 'integrated-pot',
        valueBoolean: false,
        valueNumber: null,
        valueText: null
      }
    ]
  },
  {
    brandSlug: 'msr',
    categorySlug: 'water-filters',
    name: 'MSR Guardian Purifier',
    properties: [
      {
        propertySlug: 'weight',
        valueBoolean: null,
        valueNumber: '490',
        valueText: null
      },
      {
        propertySlug: 'filter-type',
        valueBoolean: null,
        valueNumber: null,
        valueText: 'pump'
      },
      {
        propertySlug: 'squeeze-compatible',
        valueBoolean: false,
        valueNumber: null,
        valueText: null
      }
    ]
  }
]

export {
  sampleItems
}
