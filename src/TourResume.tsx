import { memo, useMemo } from "react";
import type { CSSProperties } from "react";
import type { Resume } from "./flow";
import { fonts, lineHtml, rowStyle } from "./render";
import { headerLines, lineDesignResolver } from "./templateStyle";
import { sourceContentStyle, sourceFrameStyle } from "./freeform";
import { FreeLayers } from "./FreeLayers";

/** Uses the same flow styles, source overrides and vector layers as the real editor. */
export const TourResume = memo(function TourResume({
  doc,
  scale,
  grid,
  height,
  editing,
  changed,
}: {
  doc: Resume;
  scale: number;
  grid?: boolean;
  height?: number;
  editing?: boolean;
  changed?: string;
}) {
  const designs = useMemo(() => lineDesignResolver(doc), [doc]);
  const headers = useMemo(
    () => new Set(headerLines(doc.lines).map((line) => line.id)),
    [doc.lines],
  );
  const page = doc.freeform?.pages[0],
    s = doc.settings;
  return (
    <article
      className={`tour-paper resume-paper template-${doc.template} ${grid ? "tour-grid" : ""} ${editing ? "tour-paper-editing" : ""}`}
      data-demo-template={doc.template}
      style={
        {
          zoom: scale,
          width: page?.width || 794,
          height: height || page?.height || 1165,
          padding: `${s.top}px ${s.right}px ${s.bottom}px ${s.left}px`,
          fontFamily: fonts[s.font],
          "--accent": s.accent,
          "--ink": s.color,
          "--header-align": s.headerAlign === "left" ? "left" : "center",
          "--tour-art-height": `${page?.height || 1165}px`,
        } as CSSProperties
      }
    >
      <FreeLayers page={page} plane="background" />
      {doc.lines
        .filter((line) => line.kind !== "blank")
        .map((line) => (
          <div
            className="paper-row"
            style={sourceFrameStyle(designs(line))}
            key={line.id}
          >
            <div
              className={`flow-row row-${line.kind} ${headers.has(line.id) ? "row-header" : ""}`}
              data-tour-line={line.kind}
              style={{
                ...rowStyle(line, s),
                ...sourceContentStyle(designs(line)),
              }}
              dangerouslySetInnerHTML={{ __html: lineHtml(line) }}
            />
          </div>
        ))}
      {doc.pictures.map((p) => (
        <img
          className="tour-original-picture"
          key={p.id}
          src={p.src}
          alt=""
          style={{ left: p.x, top: p.y, width: p.w, height: p.h }}
        />
      ))}
      <FreeLayers page={page} plane="foreground" />
      {changed && (
        <span className="tour-style-change" key={changed}>
          {changed}
        </span>
      )}
    </article>
  );
});
