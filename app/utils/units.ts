// TODO: Add some tests

/**
 * @param weight Weight in grams, e.g.: `1400880`
 * @returns Weight in kilograms, e.g.: `1,400.88 kg`
 */
export function formatWeight(weight: number) : string {
  const formatter = Intl.NumberFormat(undefined, {
    style: 'unit',
    unitDisplay: 'short',
    unit: 'kilogram',
    maximumFractionDigits: 2,
    roundingMode: 'ceil'
  })

  const weightInKilograms = weight / 1000

  return formatter.format(weightInKilograms)
}

/**
 * Convert metric to imperial (weight)
 *
 * @param weight Weight in grams, e.g.: `1400880`
 * @returns Weight in pounds, e.g.: `3,088.18 lb`
 */
export function formatWeightImperial(weight: number) : string {
  const formatter = Intl.NumberFormat(undefined, {
    style: 'unit',
    unitDisplay: 'short',
    unit: 'pound',
    maximumFractionDigits: 2,
    roundingMode: 'ceil'
  })

  const weightInPounds = weight * 0.00220462

  return formatter.format(weightInPounds)
}
