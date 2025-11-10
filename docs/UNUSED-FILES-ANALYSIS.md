# Unused Files Analysis

This document identifies files that don't do anything, are unused, or serve no purpose in the codebase.

## ✅ Deleted Files (2024)

The following unused files have been removed from the codebase:

1. **`web/src/app/api/icons/route.refactored.ts`** - Deleted (unused refactored version)
2. **`web/src/lib/icons-service.test.ts`** - Deleted (test file for unused service)
3. **`web/src/lib/icons-service.ts`** - Deleted (only used by deleted refactored route)
4. **`balancer/mapping_import.py`** - Deleted (never imported or used)

**Verification:** Tests were run before and after deletion. No new test failures were introduced by these deletions.

---

## 🟡 Potentially Unused / Questionable

### 1. **`balancer/__init__.py`**
**Status:** Empty file (kept for package structure)  
**Reason:** Contains only `__all__ = []` with no actual exports or initialization code.

**Current Content:**
```python
__all__ = []
```

**Evidence:**
- File is essentially empty
- No imports, no initialization, no exports
- However, kept for Python package structure (harmless)

**Recommendation:**
- **Option A:** Keep as-is (harmless, marks package)
- **Option B:** Delete if not needed (Python packages don't require `__init__.py` in modern Python 3.3+)
- **Option C:** Add actual package-level exports if needed

---

### 2. **`qa/suggestions.md`**
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

### 3. **`docs/REFACTORING-SUGGESTIONS.md`**
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
- **`balancer/mapping_import.py`** - ❌ **DELETED** (was unused)

---

## 📋 Summary & Action Plan

### ✅ Completed Actions
1. ✅ **`web/src/app/api/icons/route.refactored.ts`** - **DELETED**
2. ✅ **`web/src/lib/icons-service.test.ts`** - **DELETED**
3. ✅ **`web/src/lib/icons-service.ts`** - **DELETED**
4. ✅ **`balancer/mapping_import.py`** - **DELETED**

### Remaining Items (Questionable)
1. ⚠️ **`balancer/__init__.py`** - Empty but kept for package structure
2. ⚠️ **`qa/suggestions.md`** - Move to docs or convert to issues
3. ⚠️ **`docs/REFACTORING-SUGGESTIONS.md`** - Keep if planning refactoring

### Low Priority (Minimal but Used)
4. ✅ **`web/src/lib/utils.ts`** - Keep (actively used)

---

## 🎯 Remaining Recommended Actions

### Follow-up Actions
1. **Review `qa/suggestions.md`** - determine if it's still relevant
2. **Clean up `__init__.py`** - either delete or add meaningful content (optional)
3. **Update `REFACTORING-SUGGESTIONS.md`** - mark as implemented or remove

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


