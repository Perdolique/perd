# Test formatting style

These notes capture the current preferred formatting style for TypeScript test files in this repository.
They are intended as source material for a future skill.

## Scope

Use these rules for test files, especially API handler tests and validation tests.

## Rules

1. Single-line `const` declarations stay grouped together.
2. Single-line `expect(...)` assertions stay grouped together.
3. Multiline `const` declarations are separated from surrounding code with a blank line.
4. Multiline `expect(...)` blocks are separated from surrounding code with a blank line.
5. Arrays of multiline objects use compact outer brackets.

Preferred:

```ts
const items = [{
  id: 1,
  name: 'MSR'
}, {
  id: 2,
  name: 'Nemo'
}]
```

Not preferred:

```ts
const items = [
  {
    id: 1,
    name: 'MSR'
  },
  {
    id: 2,
    name: 'Nemo'
  }
]
```

6. The same compact outer-bracket rule applies to `test.each([...])` when the array contains objects.

Preferred:

```ts
test.each([{
  name: 'MSR',
  slug: 'msr'
}, {
  name: 'Nemo',
  slug: 'nemo'
}])('...', (value) => {
  expect(value).toBeDefined()
})
```

7. Inside multiline objects, one-line properties should come first when that keeps the object readable.
8. Nested multiline properties inside objects should be separated from same-level one-line properties with a blank line.
9. Formatting passes must stay structural only.
   - Do not rename tests.
   - Do not change mock behavior.
   - Do not change payload values.
   - Do not change assertion logic.

## Heuristics

- Small one-line objects may stay on one line when they are already compact and readable.
- Apply the compact outer-bracket rule when array items themselves are multiline objects.
- When in doubt, match the style used in equipment API tests and validation schema tests after the latest formatting pass.

## Reference files

- `server/api/equipment/brands/__tests__/reads.test.ts`
- `server/api/equipment/categories/__tests__/properties.test.ts`
- `server/api/equipment/categories/__tests__/property-enum-options.test.ts`
- `server/api/equipment/categories/__tests__/reads.test.ts`
- `server/api/equipment/items/__tests__/reads.test.ts`
- `server/utils/validation/__tests__/schemas.test.ts`
