# Quick Wins - Duplicate Logic Consolidation

This document identifies the easiest, highest-impact fixes from the duplicate logic analysis. These can be implemented quickly with minimal risk.

## 🚀 Immediate Quick Wins (5-15 minutes each)

### 1. **Money Formatting Function** ⚡ EASIEST
**Effort:** 2 minutes  
**Impact:** Removes duplicate code, ensures consistency

**Issue:** `market-cap-badge.tsx` duplicates `formatMoney` from `portfolio/format.ts`

**Fix:**
```typescript
// web/src/components/market-cap-badge.tsx
// Remove lines 22-27, add import:
import { formatMoney } from "@/components/portfolio/format"
```

**Files to change:** 1 file  
**Risk:** Very low - just replacing identical function with import

---

### 2. **Time Calculation Constants** ⚡ VERY EASY
**Effort:** 5 minutes  
**Impact:** Standardises time calculations across routes

**Issue:** Time constants duplicated in `changes/route.ts` and `portfolio/summary/route.ts`

**Fix:**
1. Create `web/src/lib/time-utils.ts`:
```typescript
export const ONE_HOUR_MS = 60 * 60 * 1000
export const ONE_DAY_MS = 24 * ONE_HOUR_MS
export const days = (n: number) => n * ONE_DAY_MS
```

2. Replace in both routes:
```typescript
// Before
const oneHour = 60 * 60 * 1000
const oneDay = 24 * oneHour
const days = (n: number) => n * oneDay

// After
import { ONE_HOUR_MS, ONE_DAY_MS, days } from "@/lib/time-utils"
```

**Files to change:** 3 files (1 new, 2 updates)  
**Risk:** Very low - simple constant extraction

---

### 3. **Percentage Change Function** ⚡ VERY EASY
**Effort:** 5 minutes  
**Impact:** Reusable utility for future use

**Issue:** `pctChange` function only used in `changes/route.ts` but could be reused

**Fix:**
1. Create `web/src/lib/math-utils.ts`:
```typescript
export function pctChange(latest: number, ref: number | null | undefined): number | null {
  if (!isFinite(latest)) return null
  if (!ref || ref === 0) return null
  return ((latest - ref) / ref) * 100
}
```

2. Update `changes/route.ts`:
```typescript
import { pctChange } from "@/lib/math-utils"
```

**Files to change:** 2 files (1 new, 1 update)  
**Risk:** Very low - simple function extraction

---

## 🎯 High-Impact Quick Wins (15-30 minutes each)

### 4. **Project Root & Database Path** ⚡ HIGH IMPACT
**Effort:** 20-30 minutes  
**Impact:** Affects 12 API routes, single point of truth for path resolution

**Issue:** `path.resolve(process.cwd(), '..')` and DB path calculation duplicated in 12 routes

**Fix:**
1. Create `web/src/lib/db-config.ts`:
```typescript
import path from 'path'

export function getProjectRoot(): string {
  return path.resolve(process.cwd(), '..')
}

export function getDbPath(): string {
  const projectRoot = getProjectRoot()
  return process.env.DB_PATH || path.join(projectRoot, 'balancer.db')
}

export function getCacheDir(): string {
  return path.join(getProjectRoot(), '.cache')
}
```

2. Replace in all 12 routes:
```typescript
// Before
const projectRoot = path.resolve(process.cwd(), '..')
const dbPath = process.env.DB_PATH || path.join(projectRoot, 'balancer.db')

// After
import { getProjectRoot, getDbPath } from "@/lib/db-config"
const projectRoot = getProjectRoot()
const dbPath = getDbPath()
```

**Files to change:** 13 files (1 new, 12 updates)  
**Risk:** Low - straightforward refactoring, easy to test  
**Routes affected:**
- `portfolio/route.ts`
- `icons/route.ts`
- `changes/route.ts`
- `portfolio/summary/route.ts`
- `indicators/route.ts`
- `data/health/route.ts`
- `dev/db/route.ts`
- `positions/update/route.ts`
- `alerts/route.ts`
- `admin/portfolio/resolve/route.ts`
- `admin/portfolio/import/route.ts`
- `admin/portfolio/export/route.ts`

---

### 5. **Cache Directory Path** ⚡ EASY (depends on #4)
**Effort:** 5 minutes (after #4 is done)  
**Impact:** Uses the new `getCacheDir()` function

**Issue:** Cache directory path duplicated in `icons/route.ts` and `changes/route.ts`

**Fix:**
```typescript
// After #4 is done, just use:
import { getCacheDir } from "@/lib/db-config"
const cacheDir = getCacheDir()
const cachePath = path.join(cacheDir, 'icons.json') // or 'changes.json'
```

**Files to change:** 2 files  
**Risk:** Very low - depends on #4

---

## 📊 Quick Wins Summary

| # | Task | Effort | Impact | Risk | Priority |
|---|------|--------|--------|------|----------|
| 1 | Money Formatting | 2 min | Low | Very Low | ⚡ Do First |
| 2 | Time Constants | 5 min | Medium | Very Low | ⚡ Do First |
| 3 | Percentage Change | 5 min | Low | Very Low | ⚡ Do First |
| 4 | Project Root/DB Path | 20-30 min | **Very High** | Low | 🎯 High Priority |
| 5 | Cache Directory | 5 min | Medium | Very Low | 🎯 After #4 |

**Total Quick Wins Time:** ~40-50 minutes  
**Total Files Changed:** ~18 files  
**Impact:** Removes duplication from 12+ API routes

---

## 🎯 Recommended Order

1. **Start with #1** (Money Formatting) - 2 minutes, instant win
2. **Then #2 and #3** (Time & Math utils) - 10 minutes total, sets up pattern
3. **Then #4** (Project Root/DB Path) - Biggest impact, affects 12 routes
4. **Finally #5** (Cache Directory) - Quick follow-up to #4

---

## ✅ Verification

After each change:
- Run `npm test` to ensure nothing broke
- Run `npm run build` to check for TypeScript errors
- Manually test affected routes if possible

---

## 📝 Notes

- These are all **frontend-only** changes (no backend work needed)
- All changes are **additive** (creating new utilities, not removing functionality)
- Low risk because we're extracting existing code, not changing logic
- Each change can be done independently and tested separately

