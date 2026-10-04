import type { CategoryDetailResponse } from '#server/api/equipment/categories/by-slug/[slug].get'
import { isFiniteDecimalNumber, normalizeDecimalNumber } from '#shared/utils/decimal-number'

type MappingProperty = CategoryDetailResponse['properties'][number]

interface EquipmentPropertySource {
  property: MappingProperty;
  value: boolean | string;
}

type EquipmentPropertyAssignments = Partial<Record<number, number | null>>

/** Includes invalid drafts, zero, and false so category changes cannot silently lose them. */
function getEquipmentPropertySources(properties: MappingProperty[], values: Record<number, unknown>): EquipmentPropertySource[] {
  const sources = properties.flatMap((property) => {
    const rawValue = values[property.id]

    if (typeof rawValue !== 'string' && typeof rawValue !== 'boolean') { return [] }

    if (typeof rawValue === 'string' && rawValue.trim() === '') { return [] }

    let value = rawValue

    if (property.dataType === 'boolean' && (rawValue === 'true' || rawValue === 'false')) {
      value = rawValue === 'true'
    }

    return [{
      property,
      value
    }]
  })

  return sources
}

/** Tests lossless transfer, not whether two characteristics have the same meaning. */
function canTransferEquipmentProperty(source: EquipmentPropertySource, target: MappingProperty): boolean {
  if (source.property.dataType !== target.dataType) { return false }

  const { value } = source

  if (target.dataType === 'boolean') { return typeof value === 'boolean' }

  if (typeof value !== 'string') { return false }

  if (target.dataType === 'text') { return value.trim() !== '' }

  if (target.dataType === 'enum') {
    const validSource = source.property.enumOptions?.some((option) => option.slug === value) ?? false
    const validTarget = target.enumOptions?.some((option) => option.slug === value) ?? false

    return validSource && validTarget
  }

  if (source.property.unit !== target.unit) { return false }

  const trimmed = value.trim()

  if (!isFiniteDecimalNumber(trimmed)) { return false }

  const normalized = normalizeDecimalNumber(trimmed)

  return !normalized.startsWith('-') || (source.property.allowsNegativeValues && target.allowsNegativeValues)
}

function suggestEquipmentPropertyAssignments(sources: EquipmentPropertySource[], targets: MappingProperty[]): EquipmentPropertyAssignments {
  const assignments: EquipmentPropertyAssignments = {}
  const used = new Set<number>()

  for (const source of sources) {
    const target = targets.find((property) => property.slug === source.property.slug && canTransferEquipmentProperty(source, property))

    if (target !== undefined && !used.has(target.id)) {
      assignments[source.property.id] = target.id

      used.add(target.id)
    }
  }

  return assignments
}

/** Returns null until every source is mapped once or explicitly discarded. */
function applyEquipmentPropertyAssignments(sources: EquipmentPropertySource[], targets: MappingProperty[], assignments: EquipmentPropertyAssignments): Record<number, boolean | string> | null {
  const values: Record<number, boolean | string> = {}
  const used = new Set<number>()

  for (const source of sources) {
    const targetId = assignments[source.property.id]

    if (targetId !== null) {
      if (targetId === undefined || used.has(targetId)) { return null }

      const target = targets.find((property) => property.id === targetId)

      if (target === undefined || !canTransferEquipmentProperty(source, target)) { return null }

      used.add(targetId)

      values[targetId] = source.value
    }
  }

  return values
}

export { getEquipmentPropertySources, canTransferEquipmentProperty, suggestEquipmentPropertyAssignments, applyEquipmentPropertyAssignments }
export type { EquipmentPropertyAssignments }
