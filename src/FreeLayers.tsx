import { useEffect, useState } from "react";
import type { FreePage } from "./freeform";
import "./free-layers.css";

export interface LayerSvg {
  background: string;
  foreground: string;
}
export function FreeLayers({
  page,
  plane,
  ready,
}: {
  page?: FreePage;
  plane: "background" | "foreground";
  ready?: LayerSvg;
}) {
  const [svg, setSvg] = useState("");
  const signature = page
    ? JSON.stringify([page.width, page.height, page.canvas.objects])
    : "";
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
  }, [signature, plane, ready]);
  return (
    <div
      aria-hidden="true"
      className={`free-layer-svg free-layer-${plane}`}
      dangerouslySetInnerHTML={{ __html: ready ? ready[plane] : svg }}
    />
  );
}
