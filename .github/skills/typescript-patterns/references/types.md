# TypeScript Types & Interfaces

## Models

```typescript
// ✅ Preferred for data models
export interface BrandModel {
  id: number;
  name: string;
  websiteUrl: string | null;
}

export interface ChecklistItemModel {
  id: string;
  name: string;
  checked: boolean;
  createdAt: Date;
}
```

## Component Props

```typescript
// ✅ Component props
interface Props {
  item: ChecklistItemModel;
  checkMode: boolean;
}

const { checkMode, item } = defineProps<Props>()
```

## When to Use Interface vs Type

- **Interface**: For object shapes, especially models and component props
- **Type**: For unions, intersections, or mapped types

## Examples

```typescript
// ✅ Interface for object shapes
interface UserModel {
  id: string;
  email: string;
}

// ✅ Type for unions
type Status = 'active' | 'retired' | 'lost'

// ✅ Type for intersections
type UserWithRole = UserModel & { role: string }

// ✅ Type for mapped types
type Nullable<T> = { [K in keyof T]: T[K] | null }
```

## Best Practices

- Use const assertions for literal types: `as const`
- Prefer union types over enums when possible
- Use branded types for IDs if needed (e.g., `type BrandId = string & { __brand: 'BrandId' }`)
