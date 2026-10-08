import type { LocationQueryRaw, RouteLocationAsRelative } from 'vue-router'

const appRoutes = {
  account: '/account',
  accountSubmissions: '/account/submissions',
  admin: '/admin',
  adminEquipmentBrands: '/admin/equipment/brands',
  adminEquipmentCategories: '/admin/equipment/categories',
  adminEquipmentPhotoSubmissions: '/admin/equipment/photo-submissions',
  adminEquipmentSubmissions: '/admin/equipment/submissions',
  gearLibrary: '/gear-library',
  gearLibraryNew: '/gear-library/new',
  home: '/',
  myGear: '/my-gear',
  packingLists: '/packing-lists'
} as const

const appLocations = {
  account: { name: 'account' },
  accountSubmissions: { name: 'account-submissions' },
  admin: { name: 'admin' },
  adminEquipmentBrands: { name: 'admin-equipment-brands' },
  adminEquipmentCategories: { name: 'admin-equipment-categories' },
  adminEquipmentPhotoSubmissions: { name: 'admin-equipment-photo-submissions' },
  adminEquipmentSubmissions: { name: 'admin-equipment-submissions' },
  gearLibrary: { name: 'gear-library' },
  gearLibraryCompare: { name: 'gear-library-compare' },
  gearLibraryNew: { name: 'gear-library-new' },
  home: { name: 'index' },
  myGear: { name: 'my-gear' },
  packingLists: { name: 'packing-lists' },
  login: { name: 'login' },
  register: { name: 'register' },
  forgotPassword: { name: 'forgot-password' },
  authTwitch: { name: 'auth-twitch' }
} satisfies Record<string, RouteLocationAsRelative>

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

/** Creates the named route for one gear-library item. */
function createGearLibraryItemLocation(itemId: string, query?: LocationQueryRaw) {
  return {
    name: 'gear-library-id',
    params: { id: itemId },
    query
  } satisfies RouteLocationAsRelative<'gear-library-id'>
}

/** Creates the photo-submission path for one published gear-library item. */
function createGearLibraryPhotoSubmissionPath(itemId: string) {
  return `${createGearLibraryItemPath(itemId)}/submit-photo`
}

/** Creates the named gear-library-id-submit-photo route. */
function createGearLibraryPhotoSubmissionLocation(itemId: string, query?: LocationQueryRaw) {
  return {
    name: 'gear-library-id-submit-photo',
    params: { id: itemId },
    query
  } satisfies RouteLocationAsRelative<'gear-library-id-submit-photo'>
}

/** Creates the named admin-equipment-submissions-id route. */
function createAdminEquipmentSubmissionLocation(itemId: string) {
  return {
    name: 'admin-equipment-submissions-id',
    params: { id: itemId }
  } satisfies RouteLocationAsRelative<'admin-equipment-submissions-id'>
}

/** Creates the named admin-equipment-photo-submissions-id route. */
function createAdminEquipmentPhotoSubmissionLocation(submissionId: string) {
  return {
    name: 'admin-equipment-photo-submissions-id',
    params: { id: submissionId }
  } satisfies RouteLocationAsRelative<'admin-equipment-photo-submissions-id'>
}

/** Creates the named packing-lists-id route. */
function createPackingListLocation(packingListId: string) {
  return {
    name: 'packing-lists-id',
    params: { id: packingListId }
  } satisfies RouteLocationAsRelative<'packing-lists-id'>
}

/** Creates the named admin-equipment-items-id-edit route. */
function createAdminEquipmentItemEditLocation(itemId: string, query?: LocationQueryRaw) {
  return {
    name: 'admin-equipment-items-id-edit',
    params: { id: itemId },
    query
  } satisfies RouteLocationAsRelative<'admin-equipment-items-id-edit'>
}

/** Creates the named admin-equipment-items-id-images route. */
function createAdminEquipmentItemImagesLocation(itemId: string, query?: LocationQueryRaw) {
  return {
    name: 'admin-equipment-items-id-images',
    params: { id: itemId },
    query
  } satisfies RouteLocationAsRelative<'admin-equipment-items-id-images'>
}

/** Creates the named admin-equipment-categories-categoryId-properties route. */
function createAdminCategoryPropertiesLocation(categoryId: number) {
  return {
    name: 'admin-equipment-categories-categoryId-properties',
    params: { categoryId }
  } satisfies RouteLocationAsRelative<'admin-equipment-categories-categoryId-properties'>
}

export {
  appLocations,
  appRoutes,
  createAdminCategoryPropertiesLocation,
  createAdminEquipmentItemEditLocation,
  createAdminEquipmentItemImagesLocation,
  createAdminEquipmentPhotoSubmissionLocation,
  createAdminEquipmentSubmissionLocation,
  createGearLibraryItemLocation,
  createGearLibraryItemPath,
  createGearLibraryPhotoSubmissionLocation,
  createGearLibraryPhotoSubmissionPath,
  createPackingListLocation,
  navigationIcons,
  navigationLabels
}
