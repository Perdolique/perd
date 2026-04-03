import { sampleItems } from './seed-sample-items'

const referenceSeed = 1487

type PropertyDataType = 'boolean' | 'enum' | 'number' | 'text'

interface EnumOptionDefinition {
  name: string;
  slug: string;
}

interface PropertyDefinition {
  dataType: PropertyDataType;
  enumOptions?: EnumOptionDefinition[];
  name: string;
  slug: string;
  unit?: string;
}

interface ReferenceSeedDefinition {
  name: string;
  seedSlug: string;
  slug: string;
}

const groupDefinitions: ReferenceSeedDefinition[] = [
  { name: 'Shelter', seedSlug: 'group-seed-1', slug: 'shelter' },
  { name: 'Sleep', seedSlug: 'group-seed-2', slug: 'sleep' },
  { name: 'Packing', seedSlug: 'group-seed-3', slug: 'packing' },
  { name: 'Cooking', seedSlug: 'group-seed-4', slug: 'cooking' },
  { name: 'Water', seedSlug: 'group-seed-5', slug: 'water' },
  { name: 'Clothing', seedSlug: 'group-seed-6', slug: 'clothing' },
  { name: 'Footwear', seedSlug: 'group-seed-7', slug: 'footwear' },
  { name: 'Navigation', seedSlug: 'group-seed-8', slug: 'navigation' },
  { name: 'Lighting', seedSlug: 'group-seed-9', slug: 'lighting' },
  { name: 'Electronics', seedSlug: 'group-seed-10', slug: 'electronics' },
  { name: 'Trekking', seedSlug: 'group-seed-11', slug: 'trekking' },
  { name: 'Safety', seedSlug: 'group-seed-12', slug: 'safety' }
]

const categoryDefinitions: ReferenceSeedDefinition[] = [
  { name: 'Sleeping Bags', seedSlug: 'category-seed-1', slug: 'sleeping-bags' },
  { name: 'Sleeping Pads', seedSlug: 'category-seed-2', slug: 'sleeping-pads' },
  { name: 'Tents', seedSlug: 'category-seed-3', slug: 'tents' },
  { name: 'Stoves', seedSlug: 'category-seed-4', slug: 'stoves' },
  { name: 'Water Filters', seedSlug: 'category-seed-5', slug: 'water-filters' }
]

const brandDefinitions: ReferenceSeedDefinition[] = [
  { name: 'Therm-a-Rest', seedSlug: 'brand-seed-1', slug: 'therm-a-rest' },
  { name: 'Nemo', seedSlug: 'brand-seed-2', slug: 'nemo' },
  { name: 'Sea to Summit', seedSlug: 'brand-seed-3', slug: 'sea-to-summit' },
  { name: 'MSR', seedSlug: 'brand-seed-4', slug: 'msr' },
  { name: 'Big Agnes', seedSlug: 'brand-seed-5', slug: 'big-agnes' },
  { name: 'Zpacks', seedSlug: 'brand-seed-6', slug: 'zpacks' },
  { name: 'Gossamer Gear', seedSlug: 'brand-seed-7', slug: 'gossamer-gear' },
  { name: 'Enlightened Equipment', seedSlug: 'brand-seed-8', slug: 'enlightened-equipment' }
]

const propertyDefinitionsByCategorySlug: Record<string, PropertyDefinition[]> = {
  'sleeping-bags': [
    {
      dataType: 'number',
      name: 'Temperature Rating',
      slug: 'temperature-rating',
      unit: '°C'
    },
    {
      dataType: 'number',
      name: 'Weight',
      slug: 'weight',
      unit: 'g'
    },
    {
      dataType: 'enum',
      enumOptions: [
        { name: 'Down', slug: 'down' },
        { name: 'Synthetic', slug: 'synthetic' }
      ],
      name: 'Fill Type',
      slug: 'fill-type'
    },
    {
      dataType: 'enum',
      enumOptions: [
        { name: 'Mummy', slug: 'mummy' },
        { name: 'Rectangular', slug: 'rectangular' },
        { name: 'Quilt', slug: 'quilt' }
      ],
      name: 'Shape',
      slug: 'shape'
    }
  ],

  'sleeping-pads': [
    {
      dataType: 'number',
      name: 'R-Value',
      slug: 'r-value'
    },
    {
      dataType: 'number',
      name: 'Weight',
      slug: 'weight',
      unit: 'g'
    },
    {
      dataType: 'enum',
      enumOptions: [
        { name: 'Inflatable', slug: 'inflatable' },
        { name: 'Foam', slug: 'foam' },
        { name: 'Self Inflating', slug: 'self-inflating' }
      ],
      name: 'Type',
      slug: 'type'
    },
    {
      dataType: 'number',
      name: 'Thickness',
      slug: 'thickness',
      unit: 'cm'
    }
  ],

  tents: [
    {
      dataType: 'number',
      name: 'Weight',
      slug: 'weight',
      unit: 'g'
    },
    {
      dataType: 'number',
      name: 'Capacity',
      slug: 'capacity'
    },
    {
      dataType: 'boolean',
      name: 'Freestanding',
      slug: 'freestanding'
    }
  ],

  stoves: [
    {
      dataType: 'number',
      name: 'Weight',
      slug: 'weight',
      unit: 'g'
    },
    {
      dataType: 'enum',
      enumOptions: [
        { name: 'Canister', slug: 'canister' },
        { name: 'Alcohol', slug: 'alcohol' },
        { name: 'Liquid Fuel', slug: 'liquid-fuel' }
      ],
      name: 'Fuel Type',
      slug: 'fuel-type'
    },
    {
      dataType: 'boolean',
      name: 'Integrated Pot',
      slug: 'integrated-pot'
    }
  ],

  'water-filters': [
    {
      dataType: 'number',
      name: 'Weight',
      slug: 'weight',
      unit: 'g'
    },
    {
      dataType: 'enum',
      enumOptions: [
        { name: 'Squeeze', slug: 'squeeze' },
        { name: 'Pump', slug: 'pump' },
        { name: 'Gravity', slug: 'gravity' }
      ],
      name: 'Filter Type',
      slug: 'filter-type'
    },
    {
      dataType: 'boolean',
      name: 'Squeeze Compatible',
      slug: 'squeeze-compatible'
    }
  ]
}

export {
  brandDefinitions,
  categoryDefinitions,
  groupDefinitions,
  propertyDefinitionsByCategorySlug,
  referenceSeed,
  sampleItems
}
