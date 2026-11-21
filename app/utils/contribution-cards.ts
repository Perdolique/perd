import type { RouteLocationRaw } from 'vue-router'
import type { UserItemSubmission, UserItemSubmissionProperty } from '#server/api/user/item-submissions/index.get'
import type { UserPhotoSubmission } from '#server/api/user/photo-submissions/index.get'
import { createGearLibraryItemLocation } from '~/utils/navigation'

type SubmissionStatusTone = 'danger' | 'success' | 'warning'

interface SubmissionPropertyCard {
  displayValue: string;
  name: string;
  propertyId: number;
}

interface SubmissionCard {
  brandName: string;
  categoryName: string;
  createdAt: Date | string;
  detailLocation: RouteLocationRaw | null;
  hasProperties: boolean;
  hasRejectionReason: boolean;
  id: string;
  name: string;
  properties: SubmissionPropertyCard[];
  rejectionReason: string | null;
  statusLabel: string;
  statusTone: SubmissionStatusTone;
  updatedAt: Date | string;
}

interface PhotoSubmissionCard {
  createdAt: Date | string;
  filename: string;
  hasRejectionReason: boolean;
  hasSourceUrl: boolean;
  id: string;
  itemName: string;
  itemLocation: RouteLocationRaw;
  rejectionReason: string | null;
  sourceLabel: string;
  sourceUrl: string;
  statusLabel: string;
  statusTone: SubmissionStatusTone;
  updatedAt: Date | string;
}

function formatBoolean(value: boolean) {
  return value ? 'Yes' : 'No'
}

function formatProperty(property: UserItemSubmissionProperty): SubmissionPropertyCard {
  const {
    name,
    propertyId,
    unit,
    value: rawValue
  } = property

  const value = typeof rawValue === 'boolean' ? formatBoolean(rawValue) : rawValue
  const displayValue = unit === null ? value : `${value} ${unit}`

  return {
    displayValue,
    name,
    propertyId
  }
}

function getStatusPresentation(statusValue: UserItemSubmission['status']) {
  if (statusValue === 'approved') {
    return {
      label: 'Published',
      tone: 'success' as const
    }
  }

  if (statusValue === 'rejected') {
    return {
      label: 'Rejected',
      tone: 'danger' as const
    }
  }

  return {
    label: 'Pending',
    tone: 'warning' as const
  }
}

function createItemSubmissionCard(item: UserItemSubmission): SubmissionCard {
  const detailLocation = item.status === 'approved' ? createGearLibraryItemLocation(item.id) : null
  const statusPresentation = getStatusPresentation(item.status)
  const properties = item.properties.map(formatProperty)

  return {
    brandName: item.brand.name,
    categoryName: item.category.name,
    createdAt: item.createdAt,
    detailLocation,
    hasProperties: properties.length > 0,
    hasRejectionReason: item.rejectionReason !== null,
    id: item.id,
    name: item.name,
    properties,
    rejectionReason: item.rejectionReason,
    statusLabel: statusPresentation.label,
    statusTone: statusPresentation.tone,
    updatedAt: item.updatedAt
  }
}

function getPhotoSourceLabel(sourceType: UserPhotoSubmission['sourceType']) {
  return sourceType === 'own' ? 'Own photo' : 'Official manufacturer photo'
}

function createPhotoSubmissionCard(photo: UserPhotoSubmission): PhotoSubmissionCard {
  const statusPresentation = getStatusPresentation(photo.status)
  const itemLocation = createGearLibraryItemLocation(photo.item.id)
  const sourceLabel = getPhotoSourceLabel(photo.sourceType)

  return {
    createdAt: photo.createdAt,
    filename: photo.filename,
    hasRejectionReason: photo.rejectionReason !== null,
    hasSourceUrl: photo.sourceUrl !== null,
    id: photo.id,
    itemName: photo.item.name,
    itemLocation,
    rejectionReason: photo.rejectionReason,
    sourceLabel,
    sourceUrl: photo.sourceUrl ?? '',
    statusLabel: statusPresentation.label,
    statusTone: statusPresentation.tone,
    updatedAt: photo.updatedAt
  }
}

export { createItemSubmissionCard, createPhotoSubmissionCard }
