import { readdir } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

async function readCategoryRouteParameters() {
  const directory = new URL('../', import.meta.url)
  const files = await readdir(directory, { recursive: true })

  const parameterNames = files.flatMap((file) => {
    const segment = file.split('/')[0] ?? ''
    const match = /^\[(?<parameter>[^\]]+)\]/u.exec(segment)
    const parameter = match?.groups?.parameter

    return parameter === undefined ? [] : [parameter]
  })

  return new Set(parameterNames)
}

describe('category route configuration', () => {
  it('uses one category parameter name across category and nested characteristic routes', async () => {
    const configuredParameters = await readCategoryRouteParameters()
    const expectedParameters = new Set(['categoryId'])

    expect(configuredParameters).toStrictEqual(expectedParameters)
  })
})
