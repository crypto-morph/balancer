# Unused Files Analysis

This document identifies files that don't do anything, are unused, or serve no purpose in the codebase.

## 🔴 Definitely Unused / Dead Code

### 1. **`web/src/app/api/icons/route.refactored.ts`**
**Status:** Unused refactored version  
**Reason:** This is a refactored version of the icons route that was created as an example but is not actually being used. The original `route.ts` is still the active route handler.

**Evidence:**
- File exists but is never imported
- Next.js uses `route.ts` by default, not `route.refactored.ts`
- Created as part of refactoring suggestions but not integrated

**Recommendation:** 
- **Option A:** Delete if refactoring is not planned
- **Option B:** Replace `route.ts` with this refactored version if refactoring is approved
- **Option C:** Move to `docs/examples/` as reference implementation

---

### 2. **`web/src/lib/icons-service.test.ts`**
**Status:** Test file for unused service  
**Reason:** This test file tests `icons-service.ts`, which is only used by the unused `route.refactored.ts`. The service itself is not used in production.

**Evidence:**
- Tests `icons-service.ts` which is only imported by `route.refactored.ts`
- `route.refactored.ts` is not used
- No other files import from `icons-service.ts`

**Recommendation:**
- **Option A:** Delete if refactoring is not planned
- **Option B:** Keep if planning to use the refactored route

---

### 3. **`balancer/__init__.py`**
**Status:** Empty file  
**Reason:** Contains only `__all__ = []` with no actual exports or initialization code.

**Current Content:**
```python
__all__ = []
```

**Evidence:**
- File is essentially empty
- No imports, no initialization, no exports

**Recommendation:**
- **Option A:** Delete if not needed (Python packages don't require `__init__.py` in modern Python 3.3+)
- **Option B:** Keep if you want to explicitly mark it as a package (though it's not necessary)
- **Option C:** Add actual package-level exports if needed

---

### 4. **`balancer/mapping_import.py`**
**Status:** Unused module  
**Reason:** Contains `import_cg_mapping()` function but is never imported or called anywhere in the codebase.

**Evidence:**
- `grep` search found no imports of this module
- Function `import_cg_mapping()` is never called
- Not referenced in `balancerctl` or any other entry points

**Current Functionality:**
- Imports Coingecko mappings from JSON file
- Supports array format (list of IDs) or object format (symbol -> ID mapping)
- Updates `Asset.coingecko_id` by symbol

**Recommendation:**
- **Option A:** Delete if functionality is not needed
- **Option B:** Integrate into `balancerctl` if this is a useful utility
- **Option C:** Document and expose as a CLI command if it's meant to be used manually

---

## 🟡 Potentially Unused / Questionable

### 5. **`qa/suggestions.md`**
**Status:** Code review document  
**Reason:** This appears to be a code quality review document with suggestions. It's not code, but it's also not clear if it's actively maintained or if the suggestions have been addressed.

**Content:**
- Code structure issues
- Database session management concerns
- Dependency management notes
- Modularization issues

**Recommendation:**
- **Option A:** Keep if it's an active reference document
- **Option B:** Move to `docs/` if it's documentation
- **Option C:** Delete if suggestions have been addressed and it's outdated
- **Option D:** Convert to GitHub issues if items need tracking

---

### 6. **`docs/REFACTORING-SUGGESTIONS.md`**
**Status:** Documentation for unused refactoring  
**Reason:** Documents the refactoring approach for the icons route, but the refactoring hasn't been applied.

**Recommendation:**
- **Option A:** Keep as reference if refactoring is planned
- **Option B:** Delete if refactoring is not going to happen
- **Option C:** Update to reflect current state if refactoring is partially done

---

## 🟢 Used But Minimal

### 7. **`web/src/lib/utils.ts`**
**Status:** Used but minimal  
**Reason:** Only contains a single `cn()` utility function for className merging. However, it IS used by 10+ UI components.

**Current Content:**
```typescript
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**Evidence of Use:**
- Used by: `button.tsx`, `card.tsx`, `input.tsx`, `table.tsx`, `tabs.tsx`, `dialog.tsx`, `badge.tsx`, `alert.tsx`, `tooltip.tsx`, `separator.tsx`

**Recommendation:** ✅ **Keep** - This is a standard shadcn/ui utility pattern and is actively used.

---

## ✅ Files That Are Used (For Reference)

These files might look unused but are actually used:

- **`balancer/repair.py`** - Used by `balancerctl repair` command
- **`balancer/csv_io.py`** - Used by `balancerctl export-csv` and `import-csv` commands
- **`balancer/health.py`** - Used by `balancerctl health` and frontend health badge
- **`balancer/http_client.py`** - Used by `balancer/clients.py` (CoingeckoClient)
- **`balancer/mapping_import.py`** - ❌ Actually NOT used (see above)

---

## 📋 Summary & Action Plan

### High Priority (Definitely Unused)
1. ✅ **`web/src/app/api/icons/route.refactored.ts`** - Delete or integrate
2. ✅ **`web/src/lib/icons-service.test.ts`** - Delete or keep with refactoring
3. ✅ **`balancer/mapping_import.py`** - Delete or integrate into CLI

### Medium Priority (Questionable)
4. ⚠️ **`balancer/__init__.py`** - Delete or add actual content
5. ⚠️ **`qa/suggestions.md`** - Move to docs or convert to issues
6. ⚠️ **`docs/REFACTORING-SUGGESTIONS.md`** - Keep if planning refactoring

### Low Priority (Minimal but Used)
7. ✅ **`web/src/lib/utils.ts`** - Keep (actively used)

---

## 🎯 Recommended Actions

### Immediate Actions
1. **Delete `route.refactored.ts`** if refactoring is not planned, OR
   **Replace `route.ts` with refactored version** if refactoring is approved
2. **Delete `icons-service.test.ts`** if refactoring is not planned
3. **Delete or integrate `mapping_import.py`** - decide if this functionality is needed

### Follow-up Actions
4. **Review `qa/suggestions.md`** - determine if it's still relevant
5. **Clean up `__init__.py`** - either delete or add meaningful content
6. **Update `REFACTORING-SUGGESTIONS.md`** - mark as implemented or remove

---

## 📝 Notes

- Some files might be intentionally kept for reference (like refactoring examples)
- Test files for unused code should be removed to avoid confusion
- Empty `__init__.py` files are harmless but clutter the codebase
- Documentation files in `qa/` might be better placed in `docs/`

---

## 🔍 How to Verify

To verify if a file is truly unused:

```bash
# Python files
grep -r "from.*module_name\|import.*module_name" .

# TypeScript files  
grep -r "from.*file_name\|import.*file_name" web/src

# Check if file is referenced in build/test configs
grep -r "file_name" web/package.json web/vitest.config.ts
```

