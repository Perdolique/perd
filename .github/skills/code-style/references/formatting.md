# Code Formatting

General formatting rules for consistent code style across all file types.

## Code Block Spacing

Proper spacing between code blocks improves readability.

### Variable Declarations

Single-line declarations grouped together with blank line after:

```typescript
// ✅ Correct - grouped single-line declarations
const name = 'John'
const age = 30
const isActive = true

// Blank line after group
console.log(name)
```

Multi-line declarations separated by blank lines:

```typescript
// ✅ Correct - multi-line declarations separated
const user = {
  name: 'John',
  age: 30
}

const settings = {
  theme: 'dark',
  language: 'en'
}

// Function after blank line
function process() {
  // ...
}
```

### Between Blocks

All code blocks separated by blank lines:

```typescript
// ✅ Correct spacing
function fetchData() {
  const url = '/api/data'
  const options = { method: 'GET' }

  return fetch(url, options)
}

function processData(data: unknown) {
  if (data === null || data === undefined) {
    return null
  }

  return transform(data)
}

const result = await fetchData()
```

### Inside Blocks

```typescript
// ✅ Correct - blank lines inside blocks
async function handleSubmit() {
  // Group declarations
  const name = input.value
  const email = emailInput.value

  // Blank line before block
  if (name === '') {
    showError('Name required')
    return
  }

  // Blank line between blocks
  try {
    await saveUser({ name, email })

    showSuccess()
  } catch (error) {
    showError(error)
  }
}
```

### Key Rules

1. **Single-line declarations**: Group together, blank line after group
2. **Multi-line declarations**: Blank line before (unless block start) and after (unless block end)
3. **Between functions**: Always blank line
4. **Between blocks** (if, try, for, etc.): Always blank line
5. **Inside blocks**: Blank line to separate logical groups
