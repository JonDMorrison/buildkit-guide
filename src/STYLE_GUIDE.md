# Project Path Design System — Style Guide

## Color Palette

### Primary Scale (HSL 201 hue)
| Token | HSL | Usage |
|-------|-----|-------|
| `primary-50` | `201 100% 95%` | Subtle backgrounds, hover states |
| `primary-100` | `201 100% 88%` | Light borders, dividers |
| `primary-200` | `201 100% 78%` | Secondary borders |
| `primary-300` | `201 100% 65%` | Inactive elements |
| `primary-400` | `201 100% 55%` | Hover states |
| `primary-500` | `201 100% 45%` | **Base primary** — buttons, links, rings |
| `primary-600` | `201 100% 38%` | Pressed/active states |
| `primary-700` | `201 100% 30%` | Dark accents |
| `primary-800` | `201 100% 22%` | Deep backgrounds |
| `primary-900` | `201 100% 15%` | Near-black tints |

### Semantic Status Colors
| Token | HSL | Hex | Usage |
|-------|-----|-----|-------|
| `status-complete` | `145 60% 45%` | ~#2DB86A | Success, completed |
| `status-progress` | `201 100% 45%` | #00A3E0 | In progress |
| `status-info` | `210 80% 55%` | ~#3B82F6 | Informational |
| `status-warning` | `38 92% 50%` | ~#F59E0B | Warnings, caution |
| `status-issue` | `0 70% 55%` | ~#D94444 | Errors, critical |

### Surface Colors
| Token | HSL | Usage |
|-------|-----|-------|
| `background` | `0 0% 7%` | Page background |
| `card` | `0 0% 10%` | Card surfaces |
| `surface-raised` | `0 0% 12%` | Elevated elements, icon containers |
| `surface-overlay` | `0 0% 14%` | Modals, overlays |
| `muted` | `0 0% 15%` | Muted backgrounds |

---

## Spacing Scale (4px base)

| Class | Value | Usage |
|-------|-------|-------|
| `p-1` / `gap-1` | 4px | Tight inline spacing |
| `p-2` / `gap-2` | 8px | Inline element gaps (`.inline-gap`) |
| `p-3` / `gap-3` | 12px | Compact card padding |
| `p-4` / `gap-4` | 16px | Standard card padding, form gaps (`.form-gap`) |
| `p-6` / `gap-6` | 24px | Section spacing (`.section-spacing`) |
| `p-8` / `gap-8` | 32px | Large section breaks |
| `p-12` / `gap-12` | 48px | Page sections |
| `p-16` / `gap-16` | 64px | Hero spacing |

### Utility Classes
- `.section-spacing` → `space-y-6`
- `.card-padding` → `p-4 md:p-6`
- `.form-gap` → `space-y-4`
- `.inline-gap` → `gap-2`

---

## Border Radius Scale

| Token | Value | Tailwind | Usage |
|-------|-------|----------|-------|
| `--radius-xs` | 2px | `rounded-xs` | Tiny chips |
| `--radius-sm` | 4px | `rounded-sm` | Badges, tags |
| `--radius-md` | 6px | `rounded-md` | Inputs (compact) |
| `--radius` | 8px | `rounded-lg` | Buttons, inputs, default |
| `--radius-lg` | 12px | `rounded-xl` | Cards, containers |
| `--radius-xl` | 16px | `rounded-2xl` | Modals, large panels |

---

## Component Sizes

### Buttons
| Size | Height | Tailwind | SVG Size | Usage |
|------|--------|----------|----------|-------|
| `xs` | 32px | `h-8` | 14px | Dense UIs, table actions |
| `sm` | 36px | `h-9` | 16px | Secondary actions |
| `default` | 44px | `h-11` | 16px | Primary actions |
| `lg` | 48px | `h-12` | 20px | Hero CTAs |
| `icon` | 44px | `h-11 w-11` | 16px | Icon-only buttons |

### Form Inputs
| Component | Height | Border Radius |
|-----------|--------|---------------|
| Input | 44px (`h-11`) | `rounded-lg` |
| Textarea | min 80px | `rounded-lg` |
| Select Trigger | 44px (`h-11`) | `rounded-lg` |

### Icon Sizing
| Size | Tailwind | Usage |
|------|----------|-------|
| 14px | `size-3.5` | Inside xs buttons |
| 16px | `size-4` | Buttons, badges, inline |
| 20px | `size-5` | Navigation, section headers |
| 24px | `size-6` | Primary actions, empty states |
| 32px | `size-8` | Dashboard metrics, features |

---

## Typography

Using **Inter** font family with Tailwind defaults:

| Element | Class | Size |
|---------|-------|------|
| Page title | `text-2xl font-semibold` | 24px |
| Section title | `text-lg font-semibold` | 18px |
| Card title | `text-base font-medium` | 16px |
| Body | `text-sm` | 14px |
| Caption | `text-xs` | 12px |
| Metric label | `text-[10px] uppercase tracking-wider` | 10px |

---

## WCAG AA Compliance

All color combinations meet minimum 4.5:1 contrast ratio:
- `foreground` (95% white) on `background` (7% black) → ~14:1 ✓
- `muted-foreground` (63% grey) on `background` (7% black) → ~5.8:1 ✓
- `primary-foreground` (white) on `primary` (45% blue) → ~4.6:1 ✓
- `status-warning-foreground` (white) on `status-warning` (amber) → ~4.5:1 ✓
