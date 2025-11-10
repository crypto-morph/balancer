# Refactoring Suggestions for Better Testability

## Icons Route Refactoring

The `/api/icons` route is currently difficult to test due to tight coupling and mixed concerns. Here's a suggested refactoring approach.

### Current Issues

1. **Tight Coupling**: File system, database, and API calls all in one function
2. **Hard to Mock**: Direct dependencies make testing complex
3. **Complex Error Handling**: Nested try-catch blocks obscure the flow
4. **Mixed Concerns**: Caching, database queries, and API calls intertwined

### Proposed Solution

**Separate into layers:**

1. **Service Layer** (`lib/icons-service.ts`)
   - Pure business logic
   - Accepts dependencies via dependency injection
   - Easy to unit test

2. **Route Handler** (`app/api/icons/route.ts`)
   - Thin HTTP layer
   - Wires up dependencies
   - Delegates to service

3. **Dependency Functions**
   - Database queries: `getCoingeckoIdsFromDb()`
   - Config: `getApiKeyFromEnv()`
   - File system: Wrapped in dependency object

### Benefits

✅ **Testability**: Each function can be tested in isolation  
✅ **Maintainability**: Clear separation of concerns  
✅ **Reusability**: Service can be used outside API routes  
✅ **Mockability**: Dependencies are explicit and injectable  

### Example Test

```typescript
// Before: Hard to test - need to mock fs, Database, fetch globally
// After: Easy to test - inject mocks
const deps = {
  readFile: vi.fn().mockResolvedValue(cacheJson),
  fetch: vi.fn().mockResolvedValue({ ok: true, json: () => apiData }),
  // ... other deps
}
const result = await getIcons(deps)
```

### Migration Path

1. Create `lib/icons-service.ts` with extracted logic
2. Update route to use service with dependency injection
3. Write comprehensive tests for service layer
4. Keep route handler minimal (just wiring)

### Files Created

- `web/src/lib/icons-service.ts` - Service layer with dependency injection
- `web/src/app/api/icons/route.refactored.ts` - Example refactored route
- `web/src/lib/icons-service.test.ts` - Example tests showing improved testability

### Next Steps

1. Review the refactored code
2. If approved, replace current route with refactored version
3. Update existing tests to use new structure
4. Apply similar pattern to other complex routes if needed


