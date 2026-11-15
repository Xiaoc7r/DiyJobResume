import type { CSSProperties } from "react";
import type { Piece, Settings } from "./flow";
import type { SourceDesign } from "./freeform";
import type { TemplateStyle } from "./templateStyle";

export interface TemplateZone {
  x: number;
  y: number;
  width: number;
  height: number;
  role: "header" | "section";
}
export function templateZones(
  pieces: Piece[],
  settings: Settings,
  width: number,
  design: (line: Piece["line"]) => SourceDesign,
) {
  let y = settings.top;
  const zones: TemplateZone[] = [];
  let headerStart: number | undefined;
  for (const piece of pieces) {
    if (piece.line.kind === "name") headerStart = y;
    if (piece.line.kind === "section") {
      if (headerStart !== undefined) {
        zones.push({
          role: "header",
          x: settings.left,
          y: headerStart,
          width: width - settings.left - settings.right,
          height: y - headerStart,
        });
        headerStart = undefined;
      }
      const style = design(piece.line);
      zones.push({
        role: "section",
        x: settings.left + (style.dx || 0),
        y: y + (style.dy || 0),
        width: style.width || width - settings.left - settings.right,
        height: piece.height,
      });
    }
    y += piece.height;
  }
  return zones;
}
export function TemplateDecorations({
  template,
  zones,
  art,
  editing = false,
}: {
  template?: TemplateStyle;
  zones: TemplateZone[];
  art: { sectionSvg: string; headerSvg: string };
  editing?: boolean;
}) {
  if (!template?.regions) return null;
  let firstSection = true;
  return (
    <>
      {zones.map((zone, i) => {
        const skip = editing && (zone.role === "header" || firstSection);
        if (zone.role === "section") firstSection = false;
        if (skip) return null;
        const svg = zone.role === "section" ? art.sectionSvg : art.headerSvg;
        return svg ? (
          <div
            key={i}
            aria-hidden
            className={`template-region-art region-${zone.role}`}
            style={
              {
                left: zone.x,
                top: zone.y,
                width: zone.width,
                height: zone.height,
              } as CSSProperties
            }
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : null;
      })}
    </>
  );
}
