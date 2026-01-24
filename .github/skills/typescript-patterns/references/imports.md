# TypeScript Path Aliases

Use these import path aliases throughout the project:

- `~` or `~/` or `@/` - App directory (`/app/`)
- `~~/` - Project root
- `#shared` - Shared code directory (`/shared/`)
- `#server` - Server code directory (`/server/`)

## Import Examples

```typescript
// Components (~ and @ are equivalent)
import PageContent from '~/components/layout/PageContent.vue'
import FidgetSpinner from '@/components/FidgetSpinner.vue'

// Root constants
import { limits } from '~~/constants'

// Models
import type { ChecklistItemModel } from "~/models/checklist"

// Shared utilities
import { someSharedUtil } from '#shared/utils'

// Server-side code
import { db } from '#server/database/connection'
```

## Best Practices

- Always use `import type { ... }` when only importing types
- Use aliases consistently across the codebase
- Prefer shorter aliases (`~` over `~/`) when both work
