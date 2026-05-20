# Sessionary Layout Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved Sessionary layout redesign so each page uses a task-appropriate layout instead of the current permanent three-column shell.

**Architecture:** Keep the existing React data flow and Tauri/Rust commands intact. Add a small tested layout-rule module, move global chrome into a page-aware shell/header, and refactor the current view markup/CSS so Today is command-center, Inbox is master-detail on wide screens, Timeline is canvas-first, and Report is document-first.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Tauri 2, CSS Grid/Flex.

---

### Task 1: Layout Rules Test And Module

**Files:**
- Create: `src/layout/layoutRules.test.ts`
- Create: `src/layout/layoutRules.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, test } from "vitest";
import { inspectorPresentationFor, shouldShowPersistentInspector, type LayoutView } from "./layoutRules";

describe("layout rules", () => {
  test("today never reserves a persistent detail column", () => {
    expect(shouldShowPersistentInspector("today", 1440, true)).toBe(false);
    expect(inspectorPresentationFor("today", 1440, true)).toBe("overlay");
  });

  test("inbox uses persistent master-detail only on expanded desktop", () => {
    expect(shouldShowPersistentInspector("inbox", 1440, true)).toBe(true);
    expect(shouldShowPersistentInspector("inbox", 1180, true)).toBe(false);
    expect(inspectorPresentationFor("inbox", 1180, true)).toBe("drawer");
  });

  test("timeline and report do not reserve inspector width when there is no context", () => {
    const views: LayoutView[] = ["timeline", "report"];

    for (const view of views) {
      expect(shouldShowPersistentInspector(view, 1440, false)).toBe(false);
      expect(inspectorPresentationFor(view, 1440, false)).toBe("hidden");
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/layout/layoutRules.test.ts`

Expected: FAIL because `src/layout/layoutRules.ts` does not exist yet.

- [ ] **Step 3: Implement the layout-rule module**

```ts
export type LayoutView = "today" | "inbox" | "timeline" | "report" | "settings";

export type InspectorPresentation = "hidden" | "persistent" | "drawer" | "overlay";

export const EXPANDED_DESKTOP_WIDTH = 1366;
export const COMPACT_DESKTOP_WIDTH = 1100;

export function shouldShowPersistentInspector(view: LayoutView, viewportWidth: number, hasContext: boolean): boolean {
  if (!hasContext) return false;
  if (viewportWidth < EXPANDED_DESKTOP_WIDTH) return false;
  return view === "inbox" || view === "timeline" || view === "report";
}

export function inspectorPresentationFor(
  view: LayoutView,
  viewportWidth: number,
  hasContext: boolean
): InspectorPresentation {
  if (!hasContext) return "hidden";
  if (shouldShowPersistentInspector(view, viewportWidth, hasContext)) return "persistent";
  if (viewportWidth < COMPACT_DESKTOP_WIDTH) return "drawer";
  return view === "today" ? "overlay" : "drawer";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/layout/layoutRules.test.ts`

Expected: PASS.

### Task 2: Global Shell And Header

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Replace permanent shell detail with page-aware shell**

Change the returned app structure so `.app-shell` has only sidebar + app workspace. Add `.workspace-header` above each page and remove unconditional `DetailPanel` from the shell-level grid.

- [ ] **Step 2: Move source health and rescan to workspace header**

Render source health chips, freshness, and rescan action in the header. Keep the sidebar focused on brand, date, nav, and local-only status.

- [ ] **Step 3: Add page-owned inspector slots**

Pass `DetailPanel` only to pages that need it:

- Today: no persistent inspector.
- Inbox: inspector inside the page grid.
- Timeline: inspector only when overlap/range/session context exists.
- Report: report overview, not session detail.

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

### Task 3: Page Layouts

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Today command center**

Replace the eight-metric grid with four key metrics: open review queue, needs repair, parallel time, human time estimate. Use `review-queue + timeline-preview + project-table` as the first viewport.

- [ ] **Step 2: Inbox master-detail**

Change Inbox markup to `inbox-layout`, with list/table in the main column and detail inspector in a right column only on wide screens.

- [ ] **Step 3: Timeline canvas-first**

Make timeline page use a large canvas panel and an optional context summary/inspector. The canvas must remain the widest element.

- [ ] **Step 4: Report document-first**

Center the report editor in a stable document column and add a compact report overview rail on wide screens.

- [ ] **Step 5: Run typecheck and build**

Run: `npm run typecheck && npm run build`

Expected: PASS.

### Task 4: Responsive CSS And Visual QA

**Files:**
- Modify: `src/styles.css`
- Modify: `openspec/changes/redesign-layout-information-architecture/tasks.md`

- [ ] **Step 1: Remove global min-width**

Remove `body { min-width: 1080px; }` and define responsive breakpoints for `>=1366px`, `1100-1365px`, `760-1099px`, and `<760px`.

- [ ] **Step 2: Add responsive inspector behavior**

At widths under 1366px, collapse inspector/overview into non-permanent layout. At widths under 760px, use single-column content and avoid horizontal overflow.

- [ ] **Step 3: Validate rendered app**

Start or reuse the local Vite/Tauri dev server. Prefer Browser plugin verification; if the Browser runtime is unavailable, use a temporary Playwright/Chrome script outside the repo.

Check:

- Today loads without a persistent empty detail column.
- Inbox shows master-detail on wide desktop.
- Timeline canvas is not squeezed by an always-on detail column.
- Report editor remains document-first.
- 760px width has no horizontal overflow.

- [ ] **Step 4: Run full verification**

Run:

```bash
npm run openspec:validate
npm run typecheck
npm run build
npm test
```

Expected: all pass.

### Task 5: OpenSpec Task Sync

**Files:**
- Modify: `openspec/changes/redesign-layout-information-architecture/tasks.md`

- [ ] **Step 1: Mark implementation tasks complete**

Mark shell, page layout, responsive, and validation tasks as complete only after the code and rendered validation pass.

- [ ] **Step 2: Re-run OpenSpec validation**

Run: `npm run openspec:validate`

Expected: PASS.

## Self-Review

- Spec coverage: covers page-specific layout, responsive breakpoints, navigation responsibility, local-first boundary, and multilingual layout readability.
- Placeholder scan: no placeholder implementation steps are left.
- Type consistency: `LayoutView` matches the app `View` string union.

