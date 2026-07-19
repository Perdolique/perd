import { describe, expect, it } from 'vitest'
import {
  compareDecimalNumbers,
  isFiniteDecimalNumber,
  normalizeDecimalNumber
} from '../decimal-number'

describe(compareDecimalNumbers, () => {
  it.each([
    ['9007199254740993', '9007199254740992', 1],
    ['0.10000000000000001', '0.1', 1],
    ['-9007199254740993', '-9007199254740992', -1],
    ['-1.1', '-1.01', -1],
    ['10', '2', 1],
    ['+001.2300', '1.23', 0],
    ['.5', '0.500', 0],
    ['-0', '0', 0]
  ])('should compare %s and %s exactly', (left, right, expected) => {
    const comparison = compareDecimalNumbers(left, right)

    expect(comparison).toBe(expected)
  })
})

describe(normalizeDecimalNumber, () => {
  it.each([
    ['+001.2300', '1.23'],
    ['-.5000', '-0.5'],
    ['-0.000', '0'],
    ['9007199254740993', '9007199254740993']
  ])('should normalize %s without losing precision', (value, expected) => {
    const normalizedValue = normalizeDecimalNumber(value)

    expect(normalizedValue).toBe(expected)
  })
})

describe(isFiniteDecimalNumber, () => {
  it('should preserve the existing finite decimal input boundary', () => {
    expect(isFiniteDecimalNumber('9007199254740993')).toBe(true)
    expect(isFiniteDecimalNumber('1e3')).toBe(false)
    expect(isFiniteDecimalNumber('Infinity')).toBe(false)
    expect(isFiniteDecimalNumber('9'.repeat(309))).toBe(false)
  })
})
