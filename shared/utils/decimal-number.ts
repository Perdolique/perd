const decimalNumberPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/u

interface DecimalNumberParts {
  fractionPart: string;
  integerPart: string;
  isNegative: boolean;
}

/** Reports whether a string is a finite decimal number accepted by the API. */
function isFiniteDecimalNumber(value: string) {
  const hasValidFormat = decimalNumberPattern.test(value)

  if (hasValidFormat === false) {
    return false
  }

  const numericValue = Number(value)

  return Number.isFinite(numericValue)
}

/** Normalizes a valid decimal string to its stable filter representation. */
function normalizeDecimalNumber(value: string) {
  const hasValidFormat = decimalNumberPattern.test(value)

  if (hasValidFormat === false) {
    return value
  }

  const sign = value.startsWith('-') ? '-' : ''
  const unsignedValue = value.startsWith('-') || value.startsWith('+') ? value.slice(1) : value
  const [rawIntegerPart = '', rawFractionPart = ''] = unsignedValue.split('.')
  const integerPart = (rawIntegerPart === '' ? '0' : rawIntegerPart).replace(/^0+(?=\d)/u, '')
  const fractionPart = rawFractionPart.replace(/0+$/u, '')
  const hasNonZeroDigit = /[1-9]/u.test(integerPart) || /[1-9]/u.test(fractionPart)
  const normalizedSign = sign === '-' && hasNonZeroDigit ? '-' : ''

  return fractionPart === ''
    ? `${normalizedSign}${integerPart}`
    : `${normalizedSign}${integerPart}.${fractionPart}`
}

/** Splits a normalized decimal string into sign, integer, and fraction parts. */
function getDecimalNumberParts(value: string): DecimalNumberParts {
  const normalizedValue = normalizeDecimalNumber(value)
  const isNegative = normalizedValue.startsWith('-')
  const unsignedValue = isNegative ? normalizedValue.slice(1) : normalizedValue
  const [integerPart = '0', fractionPart = ''] = unsignedValue.split('.')

  return {
    fractionPart,
    integerPart,
    isNegative
  }
}

/** Compares two parsed decimal numbers without considering their signs. */
function compareAbsoluteDecimalNumbers(left: DecimalNumberParts, right: DecimalNumberParts) {
  if (left.integerPart.length !== right.integerPart.length) {
    return left.integerPart.length < right.integerPart.length ? -1 : 1
  }

  if (left.integerPart !== right.integerPart) {
    return left.integerPart < right.integerPart ? -1 : 1
  }

  const fractionLength = Math.max(left.fractionPart.length, right.fractionPart.length)
  const leftFraction = left.fractionPart.padEnd(fractionLength, '0')
  const rightFraction = right.fractionPart.padEnd(fractionLength, '0')

  if (leftFraction === rightFraction) {
    return 0
  }

  return leftFraction < rightFraction ? -1 : 1
}

/** Compares valid decimal strings without converting them to floating-point numbers. */
/** Compares two valid decimal strings without converting them to floating point. */
function compareDecimalNumbers(leftValue: string, rightValue: string) {
  const left = getDecimalNumberParts(leftValue)
  const right = getDecimalNumberParts(rightValue)

  if (left.isNegative !== right.isNegative) {
    return left.isNegative ? -1 : 1
  }

  const absoluteComparison = compareAbsoluteDecimalNumbers(left, right)

  return left.isNegative ? -absoluteComparison : absoluteComparison
}

export {
  compareDecimalNumbers,
  decimalNumberPattern,
  isFiniteDecimalNumber,
  normalizeDecimalNumber
}
