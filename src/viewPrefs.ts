export const VIEW_KEY = "diyjobresume.view.v1";
export function readViewPrefs(): {
  zoom?: number;
  leftWidth?: number;
  autoZoom?: boolean;
} {
  try {
    const value = JSON.parse(localStorage.getItem(VIEW_KEY) || "{}");
    return {
      zoom:
        typeof value.zoom === "number" && value.zoom >= 0.2 && value.zoom <= 2
          ? value.zoom
          : undefined,
      leftWidth:
        typeof value.leftWidth === "number" && value.leftWidth >= 260
          ? value.leftWidth
          : undefined,
      autoZoom:
        typeof value.autoZoom === "boolean" ? value.autoZoom : undefined,
    };
  } catch {
    return {};
  }
}
export function saveViewPrefs(value: {
  zoom: number;
  leftWidth: number;
  autoZoom: boolean;
}) {
  try {
    localStorage.setItem(VIEW_KEY, JSON.stringify(value));
  } catch {
    /* Editing still works if view preferences cannot be saved. */
  }
}
