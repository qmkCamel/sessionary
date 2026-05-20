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
