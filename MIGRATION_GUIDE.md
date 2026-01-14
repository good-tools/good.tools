# Vite + TypeScript Migration Guide

## Progress Status

### ✅ Phase 1: Foundation & Setup (COMPLETED)

**Completed Tasks:**

- [x] Created migration branch `vite-typescript-migration`
- [x] Updated `package.json` with Vite and TypeScript dependencies
- [x] Removed CRA dependencies (`react-scripts`, `react-app-rewired`)
- [x] Created `vite.config.ts` with optimal configuration
- [x] Created `tsconfig.json` with strict TypeScript settings
- [x] Created `tsconfig.node.json` for Vite config
- [x] Created environment variable configuration (`.env`, `.env.example`)
- [x] Created `src/vite-env.d.ts` for environment variable types
- [x] Migrated HTML entry point from `public/index.html` to root `index.html`
- [x] Updated `.gitignore` for Vite (added `dist/`, `.env`)
- [x] Removed `config-overrides.js` (no longer needed)
- [x] Updated package.json scripts to use Vite commands

### ✅ Phase 2: Type Definitions (COMPLETED)

**Completed Tasks:**

- [x] Created `src/types/` directory structure
- [x] Created `src/types/tool.types.ts` - Tool and dependency interfaces
- [x] Created `src/types/api.types.ts` - API response types
- [x] Created `src/types/store.types.ts` - Zustand store types
- [x] Created `src/types/component.types.ts` - Component prop types
- [x] Created `src/types/worker.types.ts` - Web Worker message types
- [x] Created `src/types/index.ts` - Barrel export file

### ✅ Phase 3: Infrastructure Migration (COMPLETED)

**Completed Tasks:**

- [x] Created new directory structure (`src/config/`, `src/hooks/`, `src/stores/`, etc.)
- [x] Moved `src/index.css` → `src/assets/styles/index.css`
- [x] Created `src/config/api.config.ts` - Centralized API URLs with environment variables
- [x] Created `src/config/routes.config.ts` - Typed route configuration (migrated from `urls.js`)
- [x] Created `src/config/tools.config.tsx` - Typed tools registry (migrated from `tools.js`)

---

## 📦 Installation Instructions

Before you can run the project, you need to install dependencies:

```bash
npm install
```

This will install:

- **Vite** (v5.4.18) - Fast build tool and dev server
- **TypeScript** (v5.7.3) - Type system
- **@vitejs/plugin-react** (v4.3.4) - React support for Vite
- All type definition packages (`@types/*`)
- Updated React Query (v5.62.16) - Latest stable version
- Updated React Virtual (v3.12.0) - Stable version (was alpha)

---

## 🚀 Running the Project

After installation, you can use these commands:

```bash
# Development server (with HMR)
npm run dev

# Type checking (without building)
npm run type-check

# Production build
npm run build

# Preview production build locally
npm run preview
```

---

## 📋 Next Steps - Phase 4: Utilities & Hooks Migration

### Utilities to Migrate

All files in `src/lib/` need to be converted from `.js` to `.ts`:

1. **`src/lib/utils.js` → `src/lib/utils.ts`**
   - Add types to `cn()` function
   - Already using `clsx` and `tailwind-merge`

2. **`src/lib/categories.js` → `src/lib/categories.ts`**
   - Add types for category matching
   - Import `ToolCategory` type from `@/types`

3. **`src/lib/tracking.js` → `src/lib/tracking.ts`**
   - Add types for tracking functions
   - Type the `usePageTracking` hook

4. **`src/lib/remToPx.js` → `src/lib/remToPx.ts`**
   - Simple utility, just rename and add return type

### Hooks to Extract and Type

Need to create `src/hooks/` with these files:

1. **`src/hooks/useDarkMode.ts`**
   - Extract from `src/components/ModeToggle.js`
   - Add proper TypeScript types
   - Return type: `[boolean, (value: boolean) => void]`

2. **`src/hooks/usePageTracking.ts`**
   - Extract from `src/lib/tracking.js`
   - Add proper TypeScript types

3. **`src/hooks/index.ts`**
   - Barrel export for all hooks

---

## 📋 Next Steps - Phase 5: Stores Migration

Need to create `src/stores/` with these files:

1. **`src/stores/base64.store.ts`**
   - Consolidate encoder and decoder stores from `src/tools/Base64.js`
   - Use `Base64State` type from `@/types`
   - Single store with both encode and decode functionality

2. **`src/stores/url.store.ts`**
   - Consolidate encoder and decoder stores from `src/tools/URL.js`
   - Use `URLState` type from `@/types`

3. **`src/stores/json-formatter.store.ts`**
   - Extract from `src/tools/JsonFormatter.js`
   - Use `JSONFormatterState` type from `@/types`

4. **`src/stores/index.ts`**
   - Barrel export for all stores

---

## 📋 Next Steps - Phase 6: Component Migration

### Priority Order:

1. **Error Boundaries (NEW)**
   - Create `src/components/layout/ErrorBoundary.tsx`
   - Create `src/components/layout/ToolErrorBoundary.tsx`

2. **UI Components (Shadcn)** - Convert `.jsx` → `.tsx`
   - `src/components/ui/button.jsx` → `.tsx`
   - `src/components/ui/card.jsx` → `.tsx`
   - `src/components/ui/input.jsx` → `.tsx`
   - `src/components/ui/label.jsx` → `.tsx`
   - `src/components/ui/badge.jsx` → `.tsx`

3. **Common Components** - Convert `.js` → `.tsx`
   - All components in `src/components/`
   - Add proper prop interfaces
   - Use types from `@/types/component.types.ts`

4. **Pages** - Convert `.js` → `.tsx`
   - `src/pages/Home.js` → `.tsx`
   - `src/pages/Layout.js` → `.tsx`
   - `src/pages/WrappedTool.js` → `.tsx`
   - `src/pages/NotFound.js` → `.tsx`

5. **Tools** - Convert `.js` → `.tsx`
   - Start with simple tools (Base64, URL, Hash)
   - Then formatters (JSON, XML)
   - Then complex tools (Diff, Certificate, Protobuf, Java)
   - Finally online tools and Packet Dissector

6. **Entry Point**
   - Rename `src/index.js` → `src/main.tsx`
   - Convert `src/App.js` → `src/App.tsx`
   - Update all imports to use `@/` path alias

---

## 🔧 Migration Patterns

### Import Path Updates

All imports need to be updated to use the new structure:

```typescript
// OLD
import { tools } from "./tools";
import { urls } from "./urls";

// NEW
import { tools } from "@/config/tools.config";
import { ROUTES } from "@/config/routes.config";
import { API_CONFIG } from "@/config/api.config";
```

### Type Import Pattern

```typescript
// Import types from centralized location
import type { Tool, DNSResponse, Base64State } from "@/types";
```

### Component Props Pattern

```typescript
// OLD (no types)
export function Button({ variant, children, ...props }) {
  // ...
}

// NEW (typed)
import type { ButtonProps } from "@/types";

export function Button({
  variant = "default",
  children,
  ...props
}: ButtonProps) {
  // ...
}
```

### Store Pattern (Zustand with TypeScript)

```typescript
import { create } from "zustand";
import type { Base64State } from "@/types";

export const useBase64Store = create<Base64State>((set) => ({
  input: "",
  output: null,
  setInput: (value) => set({ input: value }),
  setOutput: (value) => set({ output: value }),
  reset: () => set({ input: "", output: null }),
}));
```

### API Call Pattern (with React Query)

```typescript
import { useQuery } from "@tanstack/react-query";
import { API_ENDPOINTS } from "@/config/api.config";
import type { DNSResponse } from "@/types";

export function useDNSLookup(domain: string, recordType: string) {
  return useQuery<DNSResponse>({
    queryKey: ["dns", domain, recordType],
    queryFn: async () => {
      const response = await fetch(API_ENDPOINTS.dns(domain, recordType));
      if (!response.ok) {
        throw new Error("DNS lookup failed");
      }
      return response.json();
    },
    enabled: !!domain,
  });
}
```

---

## 🛠️ Key Configuration Files

### vite.config.ts

- ✅ React plugin configured
- ✅ Path alias (`@/` → `src/`)
- ✅ Web Worker support
- ✅ Buffer polyfill
- ✅ Manual chunk splitting (Monaco, vendor, tools)
- ✅ Dev server on port 3000

### tsconfig.json

- ✅ Strict mode enabled (all flags)
- ✅ Path mapping (`@/*` → `./src/*`)
- ✅ Modern target (ES2020)
- ✅ React JSX support

### Environment Variables

All API URLs are now environment variables:

```env
VITE_API_BASE_URL=https://api.good.tools
VITE_INTERNET_TOOLS_URL=https://internet-tools.fly.dev
VITE_IMAGE_BROWSER_URL=https://image-browser.fly.dev
VITE_GA_TRACKING_ID=G-XX2FY53B5V
```

---

## 📝 Code Quality Checklist

When migrating each file, ensure:

- [ ] All `any` types are avoided (use `unknown` if type is truly unknown)
- [ ] All function parameters have types
- [ ] All function return types are explicit
- [ ] All component props have interfaces
- [ ] All exported functions have JSDoc comments
- [ ] No `@ts-ignore` or `@ts-expect-error` comments
- [ ] No unused imports
- [ ] Consistent import order (React, third-party, local, types)
- [ ] Use `@/` path alias for all internal imports

---

## 🐛 Common Issues & Solutions

### Issue: "Cannot find module '@/...'"

**Solution:** TypeScript may not have picked up the path alias yet. Try:

```bash
npm run type-check
```

### Issue: "Type 'X' is not assignable to type 'Y'"

**Solution:** Check the type definitions in `src/types/`. The strict mode catches all type mismatches.

### Issue: "Module not found: Can't resolve 'buffer'"

**Solution:** The `buffer` polyfill is configured in `vite.config.ts`. Make sure you import it where needed:

```typescript
import { Buffer } from "buffer";
```

### Issue: Web Worker not loading

**Solution:** Vite handles workers differently. Import with:

```typescript
import WiregasmWorker from "@/workers/wiregasm.worker?worker";
const worker = new WiregasmWorker();
```

---

## 📊 Bundle Size Expectations

After migration, expect these improvements:

- **Dev server startup**: < 2 seconds (was ~30s with CRA)
- **HMR**: < 100ms (was ~5s with CRA)
- **Production build**: ~20 seconds (was ~60s with CRA)
- **Bundle size**: Similar or slightly smaller due to better tree-shaking

Large chunks you'll see:

- `monaco-editor`: ~2MB (code editor)
- `wiregasm`: ~18MB (Wireshark WASM, lazy loaded)
- `vendor-react`: ~150KB (React, React DOM, Router)

---

## 🔍 Testing Strategy

After completing migration:

1. **Build test**: `npm run build` should complete without errors
2. **Type check**: `npm run type-check` should show zero errors
3. **Dev server**: `npm run dev` should start and all tools should load
4. **Functionality**: Test each tool individually
5. **Dark mode**: Toggle should work without flash
6. **Routing**: All routes should navigate correctly

---

## 📚 Additional Resources

- [Vite Documentation](https://vitejs.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)
- [Zustand TypeScript Guide](https://github.com/pmndrs/zustand#typescript)
- [TanStack Query TypeScript](https://tanstack.com/query/latest/docs/react/typescript)

---

## 🎯 Success Criteria

Migration is complete when:

- ✅ `npm run build` completes without errors or warnings
- ✅ `npm run type-check` shows 0 TypeScript errors
- ✅ All 15 tools are functional
- ✅ Dark mode works correctly
- ✅ All routes navigate properly
- ✅ Error boundaries catch and display errors
- ✅ API calls use React Query
- ✅ No console errors in development
- ✅ Lighthouse score >= 90
- ✅ Bundle size is reasonable

---

## 🚀 Current Status Summary

**Foundation is complete!** You now have:

1. ✅ Full Vite + TypeScript setup
2. ✅ Comprehensive type system
3. ✅ New project structure
4. ✅ Configuration files migrated
5. ✅ Environment variables configured

**Next major steps:**

1. Migrate utilities and hooks
2. Migrate Zustand stores
3. Create error boundaries
4. Migrate components
5. Migrate tools

**Estimated remaining work:** 3-4 weeks of focused development

The foundation is solid - now it's a matter of systematically converting each file from JavaScript to TypeScript following the patterns established in this guide.
