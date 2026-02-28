# 01 - Design System Specification

> **Scope:** Global theme tokens, Tailwind configuration, CSS variables, and all shared UI component primitives.
> **Owner:** Any frontend agent can implement this independently.
> **Prerequisites:** Monorepo scaffolded per `docs/technical/01-monorepo-setup.md`.

---

## 1. Design Vibe

Modern Web3 meets clean enterprise SaaS. Dark mode is the default experience --- deep navy backgrounds, subtle blue-glow borders, gradient accents. Light mode is clean and minimal with cool whites and soft shadows.

---

## 2. Color Palette

| Token | Dark Mode | Light Mode | Tailwind Class |
|-------|-----------|------------|----------------|
| Background | `#0A0E1A` (deep navy) | `#F8FAFC` (cool white) | `bg-background` |
| Card / Surface | `#111827` (dark slate) | `#FFFFFF` | `bg-surface` |
| Card Border | `rgba(59, 130, 246, 0.1)` (subtle blue glow) | `rgba(0,0,0,0.05)` | `border-card` |
| Primary | Linear gradient `#3B82F6` -> `#8B5CF6` (blue to purple) | Same | `bg-gradient-primary` |
| Primary Solid | `#3B82F6` | `#3B82F6` | `bg-primary` |
| Secondary | `#8B5CF6` | `#8B5CF6` | `bg-secondary` |
| Success | `#10B981` (emerald) | `#10B981` | `text-success` |
| Warning | `#F59E0B` (amber) | `#F59E0B` | `text-warning` |
| Error | `#EF4444` (red) | `#EF4444` | `text-error` |
| Text Primary | `#F9FAFB` | `#111827` | `text-foreground` |
| Text Muted | `#9CA3AF` | `#6B7280` | `text-muted` |

---

## 3. Typography

**Font Family:** Inter (loaded via `next/font/google`).

| Level | Size | Weight | Tailwind |
|-------|------|--------|----------|
| H1 | 2.25rem (36px) | `font-bold` (700) | `text-4xl font-bold` |
| H2 | 1.5rem (24px) | `font-semibold` (600) | `text-2xl font-semibold` |
| H3 | 1.25rem (20px) | `font-semibold` (600) | `text-xl font-semibold` |
| Body | 1rem (16px) | `font-normal` (400) | `text-base` |
| Small | 0.875rem (14px) | `font-normal` (400) | `text-sm` |
| Caption | 0.75rem (12px) | `font-medium` (500) | `text-xs font-medium text-muted` |

---

## 4. Tailwind Configuration

**File:** `packages/frontend/tailwind.config.ts`

Key decisions:

- Dark mode strategy: `'class'` (toggled via a `dark` class on `<html>`).
- All color tokens are mapped to CSS custom properties so theme switching is a single class flip.
- The gradient-primary utility is registered as a custom Tailwind plugin or via `backgroundImage` extension.

```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/**/*.{ts,tsx,js,jsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--color-background)',
        surface: 'var(--color-surface)',
        'card-border': 'var(--color-card-border)',
        primary: 'var(--color-primary)',
        secondary: 'var(--color-secondary)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        error: 'var(--color-error)',
        foreground: 'var(--color-foreground)',
        muted: 'var(--color-muted)',
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-status': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.5s infinite linear',
        'fade-in': 'fade-in 200ms ease-out',
        'slide-up': 'slide-up 250ms ease-out',
        'pulse-status': 'pulse-status 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
```

---

## 5. Global CSS & Theme Variables

**File:** `packages/frontend/src/app/globals.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Light mode (default variables, overridden by .dark) */
    --color-background: #F8FAFC;
    --color-surface: #FFFFFF;
    --color-card-border: rgba(0, 0, 0, 0.05);
    --color-primary: #3B82F6;
    --color-secondary: #8B5CF6;
    --color-success: #10B981;
    --color-warning: #F59E0B;
    --color-error: #EF4444;
    --color-foreground: #111827;
    --color-muted: #6B7280;
  }

  .dark {
    --color-background: #0A0E1A;
    --color-surface: #111827;
    --color-card-border: rgba(59, 130, 246, 0.1);
    --color-primary: #3B82F6;
    --color-secondary: #8B5CF6;
    --color-success: #10B981;
    --color-warning: #F59E0B;
    --color-error: #EF4444;
    --color-foreground: #F9FAFB;
    --color-muted: #9CA3AF;
  }

  body {
    @apply bg-background text-foreground font-sans antialiased;
  }
}
```

---

## 6. Theme Toggle

- Dark mode is the **default** theme.
- Use `next-themes` (`ThemeProvider` with `attribute="class"`, `defaultTheme="dark"`).
- Persistence is handled automatically by `next-themes` (localStorage).
- The toggle component lives in the header (see `docs/frontend/02-app-shell.md`).

---

## 7. Component Primitives

All shared components live in `packages/frontend/src/components/shared/`.

Every component must:
- Accept a `className` prop for composition.
- Use Tailwind classes referencing the CSS-variable tokens (not hardcoded hex).
- Be a client component only if it uses hooks; otherwise prefer server components.

---

### 7.1 Card

**File:** `packages/frontend/src/components/shared/Card.tsx`

```tsx
interface CardProps {
  children: React.ReactNode;
  className?: string;
  /** Adds a gradient border glow effect (dark mode). */
  glow?: boolean;
}
```

**Styling rules:**
- Dark: `bg-surface border border-card-border backdrop-blur-sm rounded-xl p-6`
- Light: `bg-white shadow-sm border border-gray-100 rounded-xl p-6`
- When `glow` is true, wrap in an outer container that applies a `bg-gradient-primary` with `p-[1px] rounded-xl` and renders the inner card inside it (gradient border technique).
- Hover: `transition-all duration-200 hover:scale-[1.01] hover:shadow-lg`

---

### 7.2 StatCard

**File:** `packages/frontend/src/components/shared/StatCard.tsx`

```tsx
interface StatCardProps {
  label: string;
  value: string | number;
  /** Percentage change. Positive = green arrow up, negative = red arrow down. */
  change?: number;
  icon?: React.ReactNode;
  className?: string;
}
```

**Behavior:**
- Built on top of `<Card>`.
- Layout: icon (top-right), label (caption style), value (h2 size, bold), change indicator below value.
- Change indicator: green text + up-arrow icon for positive, red text + down-arrow icon for negative.
- Value should animate with a count-up effect on mount (use a small `useEffect` + requestAnimationFrame or a lightweight lib like `countup.js`).

---

### 7.3 Button

**File:** `packages/frontend/src/components/shared/Button.tsx`

```tsx
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
}
```

**Variant styles:**

| Variant | Background | Text | Border |
|---------|-----------|------|--------|
| `primary` | `bg-gradient-primary` | white | none |
| `secondary` | transparent | primary | `border border-primary` |
| `ghost` | transparent | foreground | none |
| `danger` | `bg-error` | white | none |

**Sizes:**

| Size | Padding | Text | Height |
|------|---------|------|--------|
| `sm` | `px-3 py-1.5` | `text-sm` | 32px |
| `md` | `px-4 py-2` | `text-base` | 40px |
| `lg` | `px-6 py-3` | `text-lg` | 48px |

**States:**
- Hover: `brightness-110` filter.
- Disabled: `opacity-50 cursor-not-allowed`.
- Loading: show a small spinner SVG to the left of children text; button is also disabled.
- All buttons: `rounded-lg font-medium transition-all duration-150`.

---

### 7.4 StatusBadge

**File:** `packages/frontend/src/components/shared/StatusBadge.tsx`

```tsx
interface StatusBadgeProps {
  status: 'COMPLETED' | 'PENDING' | 'PROCESSING' | 'FAILED' | string;
  className?: string;
}
```

**Color mapping:**

| Status | Background (dark) | Text |
|--------|-------------------|------|
| `COMPLETED` | `bg-success/10` | `text-success` |
| `PENDING` | `bg-warning/10` | `text-warning` |
| `PROCESSING` | `bg-primary/10` | `text-primary` |
| `FAILED` | `bg-error/10` | `text-error` |

- Shape: `rounded-full px-3 py-1 text-xs font-medium inline-flex items-center gap-1`.
- `PROCESSING` status includes the `animate-pulse-status` animation.
- Unknown statuses default to muted styling.

---

### 7.5 DataTable

**File:** `packages/frontend/src/components/shared/DataTable.tsx`

```tsx
interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
  };
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
}
```

**Styling:**
- Wrapper: `overflow-x-auto` for mobile scroll.
- Header row: `bg-surface text-muted text-xs font-medium uppercase tracking-wider`.
- Body rows: alternating `bg-transparent` / `bg-surface/50` (striped).
- Hover row: `hover:bg-primary/5`.
- Sortable headers show a chevron icon; active sort column is highlighted.
- Pagination bar at the bottom: previous/next buttons, page indicator "Page X of Y".
- When `loading` is true, render `<Skeleton>` rows instead of data.
- When `data` is empty, show centered `emptyMessage` (default: "No data found").

---

### 7.6 Modal

**File:** `packages/frontend/src/components/shared/Modal.tsx`

```tsx
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}
```

**Behavior:**
- Renders a portal (use React `createPortal` or a `<dialog>` element).
- Backdrop: `fixed inset-0 bg-black/60 backdrop-blur-sm z-50`.
- Content: centered, `bg-surface rounded-2xl p-6 max-w-lg w-full mx-4 animate-slide-up`.
- Header: title (h3) + close button (X icon) top-right.
- Close on backdrop click and Escape key.
- Body scroll lock when open.

---

### 7.7 Input

**File:** `packages/frontend/src/components/shared/Input.tsx`

```tsx
interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string;
  error?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}
```

**Styling:**
- Label: `text-sm font-medium text-foreground mb-1.5 block`.
- Input container (for prefix/suffix): `flex items-center rounded-lg border transition-colors`.
- Dark: `bg-gray-800 border-gray-700 focus-within:border-primary`.
- Light: `bg-white border-gray-300 focus-within:border-primary`.
- Input element: `bg-transparent flex-1 px-3 py-2 text-sm outline-none`.
- Prefix/suffix: `px-3 text-muted` (rendered inside the container, before/after input).
- Error state: `border-error` + error message `text-xs text-error mt-1`.

---

### 7.8 Select

**File:** `packages/frontend/src/components/shared/Select.tsx`

```tsx
interface SelectOption {
  label: string;
  value: string;
}

interface SelectProps {
  label?: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  className?: string;
}
```

**Behavior:**
- Custom-styled dropdown (not native `<select>`).
- Trigger button shows selected label or placeholder.
- Dropdown panel: `absolute z-10 bg-surface border border-card-border rounded-lg shadow-lg mt-1 py-1 w-full`.
- Options: `px-3 py-2 text-sm hover:bg-primary/10 cursor-pointer`.
- Selected option: `bg-primary/10 text-primary`.
- Click outside or Escape closes dropdown.
- Chevron icon rotates on open.

---

### 7.9 Skeleton

**File:** `packages/frontend/src/components/shared/Skeleton.tsx`

```tsx
interface SkeletonProps {
  className?: string;
  /** Predefined shape variants */
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
}
```

**Styling:**
- Base: `rounded bg-gray-700/50 dark:bg-gray-700/50 bg-gray-200` (adapts to theme).
- Shimmer effect: uses the `animate-shimmer` keyframe with a `background: linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)` overlay and `background-size: 200% 100%`.
- `variant='text'`: `h-4 w-full rounded`.
- `variant='circular'`: `rounded-full` with equal width/height.
- `variant='rectangular'`: `rounded-lg` with given width/height.

---

## 8. Animation Reference

| Animation | Trigger | CSS |
|-----------|---------|-----|
| Page fade-in | Route change | `animate-fade-in` (200ms ease-out) |
| Card hover lift | Mouse enter | `hover:scale-[1.01] hover:shadow-lg transition-all duration-200` |
| Number count-up | StatCard mount / value change | JS-driven (requestAnimationFrame) |
| Status pulse | PROCESSING badge | `animate-pulse-status` (1.5s ease-in-out infinite) |
| Skeleton shimmer | Loading state | `animate-shimmer` (1.5s linear infinite) |
| Modal entrance | Modal open | `animate-slide-up` (250ms ease-out) |
| Dropdown open | Select open | `transition-all duration-150 origin-top scale-y-100` |

---

## 9. Responsive Breakpoints

| Breakpoint | Range | Behavior |
|------------|-------|----------|
| Mobile | < 768px | Sidebar collapses to hamburger menu. Cards stack vertically. Tables scroll horizontally. |
| Tablet | 768px -- 1024px | Sidebar can be toggled. 2-column card grid. |
| Desktop | > 1024px | Full sidebar visible. 3--4 column grids. Full table display. |

---

## 10. Files to Create or Modify

| File | Action |
|------|--------|
| `packages/frontend/tailwind.config.ts` | Extend with custom colors, keyframes, animations |
| `packages/frontend/src/app/globals.css` | Add CSS variable definitions and base layer |
| `packages/frontend/src/components/shared/Card.tsx` | New |
| `packages/frontend/src/components/shared/StatCard.tsx` | New |
| `packages/frontend/src/components/shared/Button.tsx` | New |
| `packages/frontend/src/components/shared/StatusBadge.tsx` | New |
| `packages/frontend/src/components/shared/DataTable.tsx` | New |
| `packages/frontend/src/components/shared/Modal.tsx` | New |
| `packages/frontend/src/components/shared/Input.tsx` | New |
| `packages/frontend/src/components/shared/Select.tsx` | New |
| `packages/frontend/src/components/shared/Skeleton.tsx` | New |

---

## 11. Cross-References

- **`docs/technical/01-monorepo-setup.md`** -- Base Tailwind config and project scaffolding.
- **`docs/frontend/02-app-shell.md`** -- App shell layout consumes these primitives (Card, Button, etc.).
- **`docs/frontend/03-dashboard-page.md`** through **`docs/frontend/07-quick-pay.md`** -- All page-level docs reference these shared components.
- **`docs/frontend/08-hooks-and-state.md`** -- Hooks that drive data into StatCard, DataTable, etc.
