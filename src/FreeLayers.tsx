import { memo, useEffect, useState } from "react";
import type { FreePage } from "./freeform";
import "./free-layers.css";

export interface LayerSvg {
  background: string;
  foreground: string;
}
export const FreeLayers = memo(function FreeLayers({
  page,
  plane,
  ready,
}: {
  page?: FreePage;
  plane: "background" | "foreground";
  ready?: LayerSvg;
}) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let cancelled = false;
    if (ready || !page?.canvas.objects.length) {
      setSvg("");
      return;
    }
    import("./freeScene")
      .then(({ sceneSvg }) => sceneSvg(page, plane))
      .then((value) => {
        if (!cancelled) setSvg(value);
      })
      .catch(() => {
        if (!cancelled) setSvg("");
      });
    return () => {
      cancelled = true;
    };
  }, [page, plane, ready]);
  return (
    <div
      aria-hidden="true"
      className={`free-layer-svg free-layer-${plane}`}
      dangerouslySetInnerHTML={{ __html: ready ? ready[plane] : svg }}
    />
  );
});
