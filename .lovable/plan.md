

# Color, Spacing, and Component Standardization -- Design System Overhaul

## Overview
This plan perfects the existing dark-theme design system by fixing WCAG contrast issues, establishing a formal spacing/radius scale, and standardizing all core UI components for visual consistency.

---

## PART 1: Color and Contrast Optimization

### Current Issues Found
- **Muted foreground** (`0 0% 60%`) on dark background (`0 0% 7%`) yields roughly 5.3:1 -- passes AA but is borderline for small text
- **Status progress** and **status info** are identical to primary (`201 100% 45%`) -- no semantic differentiation
- **Warning status** is missing entirely -- the badge has a "warning" variant mapped to progress/blue, which is semantically wrong (warnings should be amber/yellow)
- **`brand-accent-cyan`** is referenced in Tailwind config but the CSS variable `--brand-accent-cyan` does not exist (only `--brand-accent-blue`)
- **Accent** is identical to primary -- provides no visual distinction for hover/interactive states
- No color scale (50-900) exists for extending brand usage across subtle backgrounds, borders, and hover states

### Changes

**`src/index.css`** -- Expand CSS custom properties:
- Add a full primary color scale: `--primary-50` through `--primary-900` (blue 201 hue variants)
- Add dedicated **warning** color: `--status-warning: 38 92% 50%` (amber) with foreground
- Differentiate **accent** from primary: shift accent to `201 90% 55%` (lighter interactive blue)
- Differentiate **status-info**: `210 80% 55%` (a cooler, distinguishable blue)
- Fix `--brand-accent-cyan` to match what Tailwind references, or rename the Tailwind key to `accent-blue`
- Add `--status-warning` and `--status-warning-foreground` variables
- Add subtle surface variants: `--surface-raised: 0 0% 12%`, `--surface-overlay: 0 0% 14%`

**`tailwind.config.ts`** -- Register new tokens:
- Add `primary` scale: `primary.50`, `primary.100`, ..., `primary.900`
- Add `status.warning` and `status.warning-foreground`
- Fix `brand.accent-cyan` to reference the correct CSS variable
- Add `surface.raised` and `surface.overlay` utility colors

**`src/components/ui/badge.tsx`** -- Fix warning variant:
- Change `warning` from blue (`bg-status-progress`) to amber (`bg-status-warning`)

---

## PART 2: Spacing and Layout Refinement

### Current Issues
- Spacing is ad-hoc across components (mix of `p-4`, `p-6`, `space-y-2`, `space-y-6`, `gap-2`, `gap-3`, `gap-4`)
- Border radius uses 3 computed values (`--radius`, `--radius - 2px`, `--radius - 4px`) but components also use `rounded-xl`, `rounded-full` inconsistently
- No formal spacing documentation -- developers pick arbitrary values

### Changes

**`tailwind.config.ts`** -- Formalize spacing and radius:
- Add named spacing tokens: `spacing.1` (4px), `spacing.2` (8px), `spacing.3` (12px), `spacing.4` (16px), `spacing.6` (24px), `spacing.8` (32px), `spacing.12` (48px), `spacing.16` (64px) -- these already exist in Tailwind defaults, so this is mostly documentation
- Standardize border-radius scale:
  - `--radius-xs: 2px`
  - `--radius-sm: 4px` (calc already does this)
  - `--radius-md: 6px`
  - `--radius: 8px` (base, unchanged)
  - `--radius-lg: 12px`
  - `--radius-xl: 16px`
- Register these in Tailwind's `borderRadius` extend

**`src/index.css`** -- Add spacing/radius CSS variables and component utility classes:
- Add `--radius-xs`, `--radius-lg`, `--radius-xl` variables
- Add component-level spacing utility classes:
  - `.section-spacing` -- consistent vertical section gaps (`space-y-6`)
  - `.card-padding` -- standardized card internal padding (`p-4 md:p-6`)
  - `.form-gap` -- consistent form field spacing (`space-y-4`)
  - `.inline-gap` -- inline element spacing (`gap-2`)

---

## PART 3: Component Standardization

### 3A. Button Standardization

**Current state**: 4 sizes (`default: h-10`, `sm: h-9`, `lg: h-11`, `icon: h-10`). Global CSS forces `min-h-[44px]` on ALL buttons and anchors for field touch targets, which overrides `sm` and `default` sizes.

**`src/components/ui/button.tsx`** changes:
- Adjust sizes to respect the 44px minimum while being intentional:
  - `sm`: `h-9` (unchanged -- global min-h overrides to 44px anyway, but keep for padding context)
  - `default`: `h-11` (bump from h-10 to align with field-first 44px+)
  - `lg`: `h-12` (bump from h-11 for clearer hierarchy)
  - `icon`: `h-11 w-11` (from h-10 w-10)
- Add `xs` size for compact inline contexts: `h-8 px-2 text-xs` (used inside tables/dense UIs where 44px is excessive)
- Add consistent focus ring styling and active state scale
- Standardize icon sizing within buttons: `[&_svg]:size-4` for sm/default, `[&_svg]:size-5` for lg

### 3B. Form Input Standardization

**`src/components/ui/input.tsx`** and **`src/components/ui/textarea.tsx`** changes:
- Standardize height to `h-11` (44px) for field usability (from h-10)
- Add consistent transition: `transition-colors duration-150`
- Add subtle hover state: `hover:border-primary/50`
- Ensure matching border radius (`rounded-lg` to match --radius)

**`src/components/ui/select.tsx`** changes:
- Match SelectTrigger height to `h-11`
- Add hover border state matching inputs
- Standardize focus ring to match Input component

### 3C. Card Standardization

**`src/components/ui/card.tsx`** changes:
- Update base Card to use `rounded-xl` (12px) consistently matching widget-card
- Add subtle `shadow-sm` by default (already present)
- Standardize CardHeader padding to `p-4 md:p-6` for responsive consistency
- Standardize CardContent padding to `px-4 pb-4 md:px-6 md:pb-6`

### 3D. Icon Sizing Standards

Document and enforce icon size tiers:
- **16px** (`h-4 w-4`): Inside buttons, badges, inline text
- **20px** (`h-5 w-5`): Navigation icons, section headers, medium prominence
- **24px** (`h-6 w-6`): Primary action icons, empty states
- **32px** (`h-8 w-8`): Dashboard metric icons, feature highlights

No code change needed -- this is enforced via the existing `[&_svg]:size-4` in button and maintained as convention.

### 3E. Loading, Empty, and Error State Consistency

**`src/components/LoadingCard.tsx`** changes:
- Add subtle pulse animation timing alignment
- Standardize skeleton widths for visual rhythm

**`src/components/EmptyState.tsx`** changes:
- Standardize icon container to `w-14 h-14` with `rounded-xl` (from `w-16 h-16 rounded-full`)
- Use `surface-raised` background for icon container
- Tighten spacing: `mb-3` for icon, `mb-1.5` for title

**`src/components/ui/alert.tsx`** changes:
- Add `info` and `warning` variants using the new semantic status colors
- Standardize padding to `p-4` with consistent icon positioning

### 3F. Table Standardization

**`src/components/ui/table.tsx`** changes:
- Standardize TableHead height to `h-11` (from h-12) for compactness
- Add `text-xs uppercase tracking-wider` to TableHead for clearer hierarchy
- Standardize TableCell padding to `px-4 py-3` for tighter rows

### 3G. Dialog/Modal Standardization

**`src/components/ui/dialog.tsx`** changes:
- Standardize DialogContent to use `rounded-xl` on all breakpoints (currently only sm:rounded-lg)
- Add consistent max-height with scroll: `max-h-[85vh] overflow-y-auto`
- Standardize internal gap to `gap-6` (from gap-4)

---

## PART 4: Style Guide Documentation

Create **`src/STYLE_GUIDE.md`** documenting:
- Color palette with HSL values, hex equivalents, and usage rules
- Spacing scale with pixel values and Tailwind class mappings
- Border radius scale
- Component size chart (buttons, inputs, icons)
- Status color semantic meanings
- Typography scale (already using Inter with Tailwind defaults)

---

## Implementation Sequence

1. CSS variables and Tailwind config (foundation layer)
2. Core UI primitives (button, input, select, card, dialog, table, alert, badge)
3. Composite components (EmptyState, LoadingCard, SectionHeader)
4. Style guide documentation

### Files Modified
- `src/index.css` -- new CSS variables, utility classes, surface tokens
- `tailwind.config.ts` -- color scale, radius scale, new tokens
- `src/components/ui/button.tsx` -- size adjustments, xs variant
- `src/components/ui/input.tsx` -- height, hover, transitions
- `src/components/ui/textarea.tsx` -- matching input styles
- `src/components/ui/select.tsx` -- trigger height and hover
- `src/components/ui/card.tsx` -- rounded-xl, responsive padding
- `src/components/ui/badge.tsx` -- fix warning variant
- `src/components/ui/dialog.tsx` -- rounded-xl, max-height
- `src/components/ui/table.tsx` -- compact headers, tighter cells
- `src/components/ui/alert.tsx` -- info/warning variants
- `src/components/EmptyState.tsx` -- spacing tightening
- `src/components/LoadingCard.tsx` -- animation alignment
- `src/STYLE_GUIDE.md` -- new file

