import { execFile } from 'node:child_process'
import { execPath } from 'node:process'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'
import { createVerificationToken, hashPassword, hashToken, verifyPassword } from '../password'
import { isRegistrationPasswordValid, normalizeEmail } from '#shared/utils/email-registration'

const password = 'a long password with spaces 🔥'

// oxlint-disable-next-line typescript/strict-void-return -- Node provides a custom promisify implementation for execFile's ChildProcess-returning signature.
const execFileAsync = promisify(execFile)

describe('registration credentials', () => {
  it('should use independently salted scrypt hashes and verify only the original password', async () => {
    const first = await hashPassword(password)
    const second = await hashPassword(password)

    expect(first).toMatch(/^scrypt\$16384\$8\$5\$[\da-f]{32}\$[\da-f]{128}$/u)
    expect(second).not.toBe(first)
    expect(first).not.toContain(password)
    await expect(verifyPassword(password, first)).resolves.toBe(true)
    await expect(verifyPassword(`${password}x`, first)).resolves.toBe(false)
    await expect(verifyPassword(password, 'scrypt$999999999$8$5$bad$hash')).resolves.toBe(false)
  })

  it('should generate random 32-byte bearer tokens and deterministic SHA-256 storage hashes', () => {
    const first = createVerificationToken()
    const second = createVerificationToken()
    const stored = hashToken(first)

    expect(first).toMatch(/^[\w-]{43}$/u)
    expect(second).not.toBe(first)
    expect(Buffer.from(first, 'base64url')).toHaveLength(32)
    expect(stored).toMatch(/^[\da-f]{64}$/u)
    expect(stored).not.toContain(first)
    expect(hashToken(first)).toBe(stored)
  })

  it('should normalize only email casing and surrounding whitespace', () => {
    expect(normalizeEmail('  One.Two+Trip@Example.COM  ')).toBe('one.two+trip@example.com')
  })

  it('should reject an oversized password within a bounded heap', async () => {
    const moduleUrl = new URL('../../../../shared/utils/email-registration.ts', import.meta.url).href
    const moduleSpecifier = JSON.stringify(moduleUrl)

    const source = `
      import { isRegistrationPasswordValid } from ${moduleSpecifier};
      const password = 'a'.repeat(16 * 1024 * 1024);
      process.stdout.write(String(isRegistrationPasswordValid(password)));
    `

    const args = [
      '--max-old-space-size=64',
      '--input-type=module',
      '--eval',
      source
    ]

    const result = await execFileAsync(execPath, args)

    expect(result.stdout).toBe('false')
  })

  it.each([
    ['a'.repeat(14), false],
    ['a'.repeat(15), true],
    ['a'.repeat(128), true],
    ['a'.repeat(129), false],
    ['🔥'.repeat(14), false],
    ['🔥'.repeat(15), true],
    ['🔥'.repeat(128), true],
    ['🔥'.repeat(129), false],
    [`${'🔥'.repeat(127)}a`, true],
    [' '.repeat(15), true]
  ])('should validate Unicode code-point length for %s', (value, expected) => {
    expect(isRegistrationPasswordValid(value)).toBe(expected)
  })
})
