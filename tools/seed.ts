import { reset, seed } from 'drizzle-seed'
import { createDrizzleWebsocket, tables } from '~~/server/utils/database'

if (process.env.DATABASE_URL === undefined) {
  throw new Error('DATABASE_URL is not defined')
}

const websiteUrls = [
  'https://mountaineersupply.com',
  'https://alpinegearco.com',
  'https://outdooressentials.net',
  'https://trailblazergear.com',
  'https://wildernessoutfitters.co',
  'https://summitgear.com',
  'https://backcountrybasics.net',
  'https://peakperformance.io',
  'https://hikingheaven.com',
  'https://campingworld.co',
  'https://climbinggear.io',
  'https://adventureequip.net',
  'https://trailsupply.com',
  'https://outdoorsman.co',
  'https://gearexperts.io'
]

const singleWordBrands = [
  'Primus',
  'Osprey',
  'Marmot',
  'Granite',
  'Apex',
  'Summit',
  'Atlas',
  'Vertex',
  'Timber',
  'Nordic',
  'Alpine',
  'Ridge',
  'Crest',
  'Terra',
  'Boreal'
]

const prefixWords = [
  'Wilderness',
  'Mountain',
  'Alpine',
  'Summit',
  'Trail',
  'Forest',
  'Valley',
  'Boulder',
  'Hilltop',
  'Highland'
]

const natureWords = [
  'Mountain',
  'Alpine',
  'Peak',
  'Ridge',
  'Trail',
  'Forest',
  'Summit',
  'Valley',
  'Boulder',
  'Hilltop',
  'Highland'
]

const productTypes = [
  'Gear',
  'Packs',
  'Equipment',
  'Outfitting',
  'Basics',
  'Essentials',
  'Technical',
  'Apparel',
  'Hardware',
  'Tools'
]

const brands = [
  ...singleWordBrands,

  ...prefixWords.flatMap(
    (prefix) => natureWords.flatMap(nature =>
      productTypes.map(
        (product) => `${prefix} ${nature} ${product}`
      )
    )
  )
]

const db = createDrizzleWebsocket()

async function seedDatabase() {
  // Seed brands
  await reset(db, { brands: tables.brands })

  await seed(db, { brands: tables.brands }, {
    seed: 1487,
    count: 300,
  }).refine((funcs) => ({
    brands: {
      columns: {
        name: funcs.valuesFromArray({
          values: brands,
          isUnique: true
        }),

        websiteUrl: funcs.valuesFromArray({
          values: websiteUrls
        }),

        createdAt: funcs.date({
          maxDate: '2024-11-26'
        })
      }
    }
  }));
}

await seedDatabase()

await db.$client.end()
