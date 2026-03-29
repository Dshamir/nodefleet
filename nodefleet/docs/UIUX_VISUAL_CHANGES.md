# NodeFleet UI/UX Visual Changes

> Comprehensive changelog of all visual, UI, and UX improvements made during the gap closure sessions.
> Each entry describes what changed, what the user sees, and which files were modified.

---

## Table of Contents

1. [Toast Notification System](#1-toast-notification-system)
2. [Error Boundary with Retry](#2-error-boundary-with-retry)
3. [Skeleton Loading Screen](#3-skeleton-loading-screen)
4. [Skip-to-Content Accessibility Link](#4-skip-to-content-accessibility-link)
5. [Sidebar ARIA Navigation](#5-sidebar-aria-navigation)
6. [Header Accessibility](#6-header-accessibility)
7. [DataTable with Sorting and Pagination](#7-datatable-with-sorting-and-pagination)
8. [FormField with Validation Errors](#8-formfield-with-validation-errors)
9. [Debounced Search Input](#9-debounced-search-input)
10. [Input Component ARIA Enhancement](#10-input-component-aria-enhancement)
11. [Dialog Accessibility](#11-dialog-accessibility)
12. [Empty State CTAs](#12-empty-state-ctas)
13. [Responsive Map Container](#13-responsive-map-container)
14. [Responsive Table Text](#14-responsive-table-text)
15. [Light Theme Foundation](#15-light-theme-foundation)
16. [Multi-Protocol Network Scanner](#16-multi-protocol-network-scanner)

---

## 1. Toast Notification System

**Status:** Wired up (was disconnected)

### Before

The toast component existed in the codebase (113 lines in `toast.tsx`) but was **never connected** to the application. Users received zero visual feedback after performing actions such as adding a device, saving settings, or encountering an error. Every action felt like clicking into the void.

### After

**What the user sees:** A small notification card slides up from the bottom-right corner of the screen whenever an action completes. Each toast is color-coded by type:

| Toast Type | Icon         | Color  | Example Message                  |
|------------|--------------|--------|----------------------------------|
| Success    | CheckCircle  | Green  | "Device added successfully"      |
| Error      | AlertCircle  | Red    | "Failed to save configuration"   |
| Warning    | AlertTriangle| Amber  | "Connection unstable"            |
| Info       | Info         | Blue   | "Firmware update available"      |
| Default    | (none)       | Slate  | Generic notifications            |

**Visual description:** A rounded rectangle (~320px wide) with a colored left border accent, an icon on the left, message text in white, and an X close button on the right. Toasts auto-dismiss after 4 seconds with a fade-out. Multiple toasts stack vertically. Entry animation is a slide-up from below the viewport.

**How it works:** `ToastProvider` wraps the entire app via `providers.tsx`. Any component anywhere in the tree can call `useToast()` to trigger a notification without prop drilling.

### Files Changed

- `web/src/components/ui/toast.tsx` -- Toast component with 5 types, auto-dismiss, animations
- `web/src/app/providers.tsx` -- ToastProvider added to app wrapper

---

## 2. Error Boundary with Retry

**Status:** New (did not exist)

### Before

If any unhandled JavaScript error occurred inside the dashboard, the entire page crashed to a **blank white screen**. No error message, no recovery option, no way back except manually refreshing the browser or navigating away. There was no `error.tsx` file in the dashboard route group.

### After

**What the user sees:** Instead of a white screen, a centered error card appears with:

- A large red `AlertCircle` icon at the top
- The error message in readable text (e.g., "Something went wrong")
- A **"Try again"** button with a `RefreshCw` icon that re-renders the failed route segment
- A small error digest ID at the bottom (for support/debugging purposes)

**Visual description:** Dark-themed card, vertically and horizontally centered on the page. The background matches the dashboard theme. The "Try again" button uses the primary accent color with a hover state. The layout is minimal and calming -- it does not alarm the user.

### Files Changed

- `web/src/app/(dashboard)/error.tsx` -- Error boundary component with retry functionality

---

## 3. Skeleton Loading Screen

**Status:** Replaced spinner

### Before

Every page navigation showed a **full-page spinning Loader2 icon** centered on the screen. The spinner gave no indication of what content was loading or how the page would be laid out. When content finally appeared, the entire layout shifted abruptly (layout shift / CLS issue).

### After

**What the user sees:** A pulsing gray skeleton that mirrors the actual dashboard layout:

- **Top row:** 4 stat card placeholders (rounded rectangles with gray pulse animation) matching the dashboard's stat cards in size and spacing
- **Below:** A table skeleton with 5 rows, each containing a circle (avatar placeholder) and 3-4 horizontal bars of varying widths (text placeholders)
- The skeleton uses the same grid layout as the real content, so when data loads in, there is **zero layout shift**

**Visual description:** Light gray rectangles on the dark background with a CSS `animate-pulse` shimmer effect. The shapes are rounded (`rounded-md` / `rounded-full` for circles). The skeleton fades seamlessly into the real content.

### Files Changed

- `web/src/app/(dashboard)/loading.tsx` -- Skeleton layout matching dashboard structure
- `web/src/components/ui/skeleton.tsx` -- Reusable Skeleton primitive component

---

## 4. Skip-to-Content Accessibility Link

**Status:** New (did not exist)

### Before

Keyboard-only users and screen reader users had to **tab through every single sidebar navigation link** on every page load before reaching the main content area. With 10+ sidebar items, this meant 10+ tab presses just to start interacting with the page.

### After

**What the user sees (keyboard users):** The very first press of the Tab key reveals a **"Skip to main content"** button at the top-left corner of the viewport. Pressing Enter jumps focus directly to the `<main id="main-content">` area, bypassing the entire sidebar.

**What sighted mouse users see:** Nothing -- the link is completely invisible (`sr-only`) until it receives keyboard focus, at which point it appears as a cyan/blue button with clear text at the top of the page. When focus moves away, it disappears again.

**Visual description:** A small button with cyan background and white text, positioned absolutely at the top-left with a slight offset. Uses `focus:not-sr-only` to toggle visibility. Z-index ensures it appears above the sidebar.

### Files Changed

- `web/src/app/layout.tsx` -- Skip link element added as first child
- `web/src/app/(dashboard)/layout.tsx` -- `id="main-content"` added to main element

---

## 5. Sidebar ARIA Navigation

**Status:** Enhanced (existed without semantics)

### Before

The sidebar was a plain `<div>` with styled links. Screen readers announced it as generic content with no navigational context. The currently active page was visually highlighted (different background color) but **not announced** to assistive technology. A screen reader user had no way to know which page they were currently on from the sidebar alone.

### After

**What the user sees:** No visual change -- the sidebar looks identical. The improvement is entirely in the accessibility layer.

**What screen reader users hear:**

- The sidebar is announced as a navigation landmark: `<aside role="navigation">`
- The nav element has a label: `<nav aria-label="Main navigation">`
- The active link is announced as the current page: `aria-current="page"` on the active item
- Screen readers now say something like: *"Main navigation, Devices, current page"*

### Files Changed

- `web/src/components/dashboard/sidebar.tsx` -- Added `role="navigation"`, `aria-label`, `aria-current="page"`

---

## 6. Header Accessibility

**Status:** Enhanced (existed without semantics)

### Before

The header bar was a styled `<div>`. The search input had no accessible label (screen readers would announce it as just "edit text"). The breadcrumb trail had no semantic meaning -- it was just styled text links.

### After

**What the user sees:** No visual change. The header looks identical.

**What screen reader users experience:**

- Header announced as a banner landmark: `<header role="banner">`
- Breadcrumbs wrapped in `<nav aria-label="Breadcrumb">` -- screen readers announce "Breadcrumb navigation"
- Search input has `aria-label="Search"` -- screen readers announce "Search, edit text"

### Files Changed

- `web/src/components/dashboard/header.tsx` -- Added `role="banner"`, `aria-label="Breadcrumb"`, search `aria-label`

---

## 7. DataTable with Sorting and Pagination

**Status:** New component (TanStack Table was unused)

### Before

TanStack Table (`@tanstack/react-table`) was listed as a dependency in `package.json` but was **completely unused**. All tables in the app were raw `<table>` elements with hardcoded rows. There was:

- No column sorting
- No pagination (all rows rendered at once, even hundreds)
- No "Showing X of Y" indicator
- No empty state handling

### After

**What the user sees:** A fully interactive data table with:

1. **Sortable column headers** -- clicking a column header cycles through ascending, descending, and unsorted states. Each header shows an icon:
   - `ChevronUp` for ascending sort
   - `ChevronDown` for descending sort
   - `ChevronsUpDown` (subtle gray) for unsorted/sortable columns

2. **Pagination bar** at the bottom of the table:
   - Left side: "Showing 1-10 of 50" text
   - Right side: "Previous" and "Next" buttons with a "Page 1 of 5" indicator between them
   - Disabled buttons when at the first/last page (reduced opacity)

3. **Empty state** -- when the table has no data, a centered "No data available" message appears instead of an empty table frame

4. **Hover rows** -- rows highlight on hover with a subtle slate background change

**Visual description:** Dark-themed table with `border-slate-700` dividers. Headers have a darker background (`bg-slate-800/50`). Sort icons are 16px Lucide icons in slate-400. Pagination buttons are small rounded buttons with slate borders. The entire component matches the existing dark dashboard aesthetic.

### Files Changed

- `web/src/components/ui/data-table.tsx` -- Generic DataTable component with sorting + pagination

---

## 8. FormField with Validation Errors

**Status:** New component

### Before

Form inputs had **no client-side validation feedback**. When a submission failed, users saw only a generic error (or no error at all). There were:

- No field-level error messages
- No visual indication of which field was invalid
- No required field markers
- No connection between labels and error messages for screen readers

### After

**What the user sees:**

1. **Required field indicator** -- labels for required fields display a red asterisk (*) after the label text
2. **Error state styling** -- when a field has an error, the input border turns red (`border-error`)
3. **Inline error messages** -- a red error message appears directly below the invalid field (e.g., "Device name is required")
4. **Description text** -- optional helper text below the input in muted gray (`slate-500`) when there is no error

**Visual description:** The label sits above the input in white text. Required fields show "Label *" with the asterisk in red. On error, the input gets a red border and a red error message appears below in small text. The error message has a `role="alert"` so screen readers announce it immediately.

**Accessibility:** Each input is linked to its error message via `aria-describedby`. Invalid inputs have `aria-invalid="true"`. Screen readers announce: *"Device name, required, invalid entry, Device name is required"*.

### Files Changed

- `web/src/components/ui/form-field.tsx` -- FormField wrapper with label, error, description, and ARIA

---

## 9. Debounced Search Input

**Status:** New component (replaced raw input)

### Before

The search input in the header/toolbar fired a filter/search query **on every single keystroke**. Typing "temperature" would trigger 11 separate search operations. The input also had no ARIA label and no search icon.

### After

**What the user sees:**

- A search input with a **magnifying glass icon** on the left side
- Typing triggers the search callback only after **300ms of inactivity** (debounce)
- A proper focus ring appears when the input is focused
- The input has placeholder text indicating its purpose

**Visual description:** Rounded input field with a `Search` icon (Lucide) in slate-400 on the left, padded to make room for the icon. Dark background matching the theme. Focus state shows a cyan/blue ring. The input text is white on dark background.

**Performance impact:** Reduces search/filter operations by approximately 80-90% during active typing, preventing UI jank and unnecessary API calls.

### Files Changed

- `web/src/components/ui/search-input.tsx` -- SearchInput with 300ms debounce, icon, ARIA label

---

## 10. Input Component ARIA Enhancement

**Status:** Enhanced (existing component)

### Before

The base `<Input>` component accepted standard HTML input props but did not explicitly forward accessibility attributes. There was no `aria-invalid`, `aria-describedby`, or `aria-label` support in the component interface.

### After

**What the user sees:** No visual change.

**What the component supports:** The Input component now explicitly accepts and forwards:

- `aria-label` -- for inputs without visible labels
- `aria-invalid` -- to mark inputs as invalid for screen readers
- `aria-describedby` -- to link inputs to error messages or descriptions

These props are passed through to the underlying `<input>` element, enabling the FormField component and other consumers to build accessible forms.

### Files Changed

- `web/src/components/ui/input.tsx` -- Added ARIA prop forwarding

---

## 11. Dialog Accessibility

**Status:** Enhanced (existing component)

### Before

The dialog/modal close button (X icon in the top-right corner) had **no accessible name**. Screen readers would announce it as simply "button" with no indication of what it does. The X icon was decorative but not marked as such.

### After

**What the user sees:** No visual change. The close button looks the same.

**What screen reader users hear:** The close button is now announced as "Close, button" thanks to `aria-label="Close"`. The X icon has `aria-hidden="true"` so it is not announced as "X" or read as separate content.

### Files Changed

- `web/src/components/ui/dialog.tsx` -- Added `aria-label="Close"` to close button, `aria-hidden="true"` to icon

---

## 12. Empty State CTAs

**Status:** New (empty states were dead ends)

### Before

When a section had no data, the user saw an icon and a text message (e.g., "No devices found") but **no actionable button**. This was a dead end -- the user had to figure out on their own where to go or what to do next.

### After

**What the user sees:** Each empty state now includes a clear call-to-action button:

| Page | Empty State Message | CTA Button | Action |
|------|-------------------|------------|--------|
| Dashboard | "No recent activity" | "Go to Devices &rarr;" | Link/navigation to the devices page |
| Devices | "No devices found" | "Add your first device" | Opens the add device dialog |
| Schedules | "No schedules found" | "Create your first schedule" | Opens the create schedule dialog |

**Visual description:** The empty state layout is vertically centered within the content area. The icon (muted gray) sits above the message text, which sits above the CTA button. The button uses the primary accent color and stands out as the clear next step. Arrow or plus icons reinforce the action.

### Files Changed

- `web/src/app/(dashboard)/page.tsx` -- Dashboard empty state with "Go to Devices" link
- `web/src/app/(dashboard)/devices/page.tsx` -- Devices empty state with "Add your first device" button
- `web/src/app/(dashboard)/schedules/page.tsx` -- Schedules empty state with "Create your first schedule" button

---

## 13. Responsive Map Container

**Status:** Enhanced (fixed height replaced)

### Before

The map container had a **hardcoded height of 500px** (`h-[500px]`). On small screens (mobile, tablets), 500px consumed nearly the entire viewport, leaving no room for controls below. On large monitors, 500px felt unnecessarily short for a map view.

### After

**What the user sees:**

- On a **1080p monitor**: The map takes up roughly half the viewport (~540px), leaving comfortable room for controls and info below
- On a **mobile device (667px tall)**: The map takes up ~334px but never goes below 300px, ensuring it remains usable
- On a **1440p/4K monitor**: The map scales up proportionally, using the available space

**Technical change:** `h-[500px]` replaced with `h-[50vh] min-h-[300px]` -- the map now scales with the viewport while maintaining a minimum usable height.

### Files Changed

- `web/src/app/(dashboard)/map/page.tsx` -- Responsive map height

---

## 14. Responsive Table Text

**Status:** Enhanced (fixed text replaced)

### Before

Table cells in the devices table used a **fixed text size** regardless of screen width. On mobile devices, the text was often too large for the available column width, causing text truncation or horizontal scrolling.

### After

**What the user sees:**

- On **mobile** (< 640px): Table cell text for model, fleet, heartbeat, and serial columns renders at `text-xs` (12px) -- compact and readable without overflow
- On **desktop** (>= 640px): The same columns render at `text-sm` (14px) -- the standard comfortable reading size

**Technical change:** Applied `text-xs sm:text-sm` responsive classes to the model, fleet, heartbeat, and serial number columns.

### Files Changed

- `web/src/app/(dashboard)/devices/page.tsx` -- Responsive text sizing on table columns

---

## 15. Light Theme Foundation

**Status:** New (CSS custom properties added)

### Before

The entire application was **dark mode only** with hardcoded dark color values throughout. There was no theming system, no CSS custom properties for colors, and no way to switch to a light palette.

### After

**What the user sees (currently):** No immediate visual change -- the app still defaults to dark mode. However, the foundation is now in place.

**What is now possible:** Adding `class="light"` to the `<html>` element activates a complete light color palette. All 12 design tokens are mapped:

| Token | Dark Value | Light Value |
|-------|-----------|-------------|
| `--background` | Near-black | White |
| `--foreground` | White | Near-black |
| `--card` | Dark slate | Light gray |
| `--card-foreground` | White | Dark text |
| `--primary` | Cyan/blue accent | Blue accent |
| `--primary-foreground` | White | White |
| `--secondary` | Dark slate | Light slate |
| `--muted` | Muted dark | Muted light |
| `--muted-foreground` | Gray text | Darker gray text |
| `--border` | Slate-700 | Slate-200 |
| `--destructive` | Red | Red |
| `--accent` | Slate accent | Light accent |

**Visual description (light mode when activated):** White/off-white backgrounds, dark text, blue primary accents, light gray cards with subtle borders. The same layout and components, just with an inverted color scheme. Dark mode remains the default and is unchanged.

### Files Changed

- `web/src/app/globals.css` -- Added `html.light { ... }` block with all 12 CSS custom property overrides

---

## Summary

| Category | Changes | Impact |
|----------|---------|--------|
| **Notifications & Feedback** | Toast system, Error boundary | Users get confirmation and graceful error recovery |
| **Loading Experience** | Skeleton screen | Eliminates layout shift, feels faster |
| **Accessibility (WCAG)** | Skip link, ARIA navigation, ARIA header, Dialog labels, Input ARIA, FormField | Screen reader and keyboard support across the app |
| **Data Interaction** | DataTable, SearchInput, FormField | Sorting, pagination, debounced search, validated forms |
| **Empty States** | 3 CTA buttons added | No more dead ends when content is missing |
| **Responsiveness** | Map container, Table text | Proper scaling on mobile through large displays |
| **Theming** | Light theme CSS variables | Foundation for theme switching without refactoring |
| **Device Discovery** | Multi-protocol network scanner | Devices found instantly via 3 redundant protocols |

**Total: 16 distinct UI/UX improvements across 20+ files.**

---

## 16. Multi-Protocol Network Scanner

**Before:** Clicking "Scan Network" only sent a UDP broadcast on port 5556. Connected devices communicate via WebSocket, so the scanner always returned "No devices found" even with an online device sending heartbeats.

**After:** The scanner now uses 3 redundant discovery protocols with deduplication:
1. **WebSocket** (green badge) — Queries the ws-server `/devices` endpoint for live connections. Most reliable for active devices.
2. **UDP Broadcast** (blue badge) — Scans LAN on port 5556 for unpaired ESP32 devices. Zero-config discovery.
3. **Database** (yellow badge) — Queries PostgreSQL for devices with `status='online'`. Fallback for any devices missed by the other protocols.

**What the user sees:**
- "1 device found" banner with protocol count breakdown ("1 via WebSocket")
- Each device shows: name/ID, device ID in monospace, last heartbeat timestamp
- Color-coded protocol badge per device (green=WebSocket, blue=UDP, yellow=Database)
- "Live" status badge for WebSocket-connected devices
- Initial state shows all 3 protocols with icons and descriptions
- Scanning animation says "Scanning 3 protocols: WebSocket, UDP broadcast, Database..."

**Visual description:** Each discovered device appears in a dark card (`bg-slate-800/50`) with the device name on the left, protocol badge on the right. WebSocket devices get a green Zap icon badge and a "Live" outline badge. Database-only devices show a yellow warning note. Protocol breakdown badges appear between the service status and device list.

**Files:**
- `web/src/components/dashboard/network-scanner.tsx` — Complete rewrite with multi-protocol UI
- `web/src/app/api/discovery/route.ts` — 3-protocol scan with deduplication
- `ws-server/src/index.ts` — Added `/devices` HTTP endpoint
