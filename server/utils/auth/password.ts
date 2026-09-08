import { promisify } from 'node:util'
import { createHash, randomBytes, scrypt, timingSafeEqual, type BinaryLike, type ScryptOptions } from 'node:crypto'

const passwordHashPrefix = 'scrypt$16384$8$5'
const hashBytes = 64
const saltBytes = 16

function hashToken(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function createVerificationToken(): string {
  return randomBytes(32).toString('base64url')
}

const scryptAsync = promisify<BinaryLike, BinaryLike, number, ScryptOptions, Buffer>(scrypt)

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(saltBytes)

  const hash = await scryptAsync(password, salt, hashBytes, {
    cost: 16_384,
    blockSize: 8,
    parallelization: 5,
    maxmem: 33_554_432
  })

  const encodedSalt = salt.toString('hex')
  const encodedHash = hash.toString('hex')

  return `${passwordHashPrefix}$${encodedSalt}$${encodedHash}`
}

async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const match = /^scrypt\$16384\$8\$5\$(?<salt>[\da-f]{32})\$(?<hash>[\da-f]{128})$/u.exec(encoded)

  if (match?.groups?.salt === undefined || match.groups.hash === undefined) {
    return false
  }

  const salt = Buffer.from(match.groups.salt, 'hex')
  const expected = Buffer.from(match.groups.hash, 'hex')

  const actual = await scryptAsync(password, salt, hashBytes, {
    cost: 16_384,
    blockSize: 8,
    parallelization: 5,
    maxmem: 33_554_432
  })

  return timingSafeEqual(actual, expected)
}

export { createVerificationToken, hashPassword, hashToken, verifyPassword }
