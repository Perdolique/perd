const appRoutes = {
  account: '/account',
  admin: '/admin',
  adminEquipmentSubmissions: '/admin/equipment/submissions',
  gearLibrary: '/gear-library',
  gearLibraryNew: '/gear-library/new',
  home: '/',
  myGear: '/my-gear',
  packingLists: '/packing-lists'
} as const

const navigationLabels = {
  account: 'Profile',
  admin: 'Admin',
  gearLibrary: 'Gear library',
  home: 'Home',
  myGear: 'My gear',
  packingLists: 'Packing lists',
  packingListsDock: 'Lists'
} as const

const navigationIcons = {
  account: 'hugeicons:user',
  admin: 'hugeicons:settings-02',
  gearLibrary: 'hugeicons:package-search',
  home: 'hugeicons:tent',
  myGear: 'hugeicons:backpack-03',
  packingLists: 'hugeicons:check-list'
} as const

/** Creates the detail path for one gear-library item. */
function createGearLibraryItemPath(itemId: string) {
  return `${appRoutes.gearLibrary}/${itemId}`
}

/** Creates the admin review path for one equipment submission. */
function createAdminEquipmentSubmissionPath(itemId: string) {
  return `${appRoutes.adminEquipmentSubmissions}/${itemId}`
}

/** Creates the detail path for one packing list. */
function createPackingListPath(packingListId: string) {
  return `${appRoutes.packingLists}/${packingListId}`
}

export {
  appRoutes,
  createAdminEquipmentSubmissionPath,
  createGearLibraryItemPath,
  createPackingListPath,
  navigationIcons,
  navigationLabels
}
