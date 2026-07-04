const appRoutes = {
  account: '/account',
  gearLibrary: '/gear-library',
  home: '/',
  myGear: '/my-gear',
  packingLists: '/packing-lists'
} as const

const navigationLabels = {
  account: 'Profile',
  gearLibrary: 'Gear library',
  home: 'Home',
  myGear: 'My gear',
  packingLists: 'Packing lists',
  packingListsDock: 'Lists'
} as const

const navigationIcons = {
  account: 'hugeicons:user',
  gearLibrary: 'hugeicons:package-search',
  home: 'hugeicons:tent',
  myGear: 'hugeicons:backpack-03',
  packingLists: 'hugeicons:check-list'
} as const

function createGearLibraryItemPath(itemId: string) {
  return `${appRoutes.gearLibrary}/${itemId}`
}

function createPackingListPath(packingListId: string) {
  return `${appRoutes.packingLists}/${packingListId}`
}

export {
  appRoutes,
  createGearLibraryItemPath,
  createPackingListPath,
  navigationIcons,
  navigationLabels
}
