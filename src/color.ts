export function normalizeHex(text: string): string | null {
  const raw = text.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(raw))
    return (
      "#" +
      [...raw]
        .map((c) => c + c)
        .join("")
        .toLowerCase()
    );
  return /^[0-9a-f]{6}$/i.test(raw) ? "#" + raw.toLowerCase() : null;
}
export function hexToHsv(hex: string) {
  const rgb = (normalizeHex(hex) || "#000000")
    .slice(1)
    .match(/../g)!
    .map((c) => parseInt(c, 16) / 255);
  const [r, g, b] = rgb,
    max = Math.max(...rgb),
    min = Math.min(...rgb),
    d = max - min;
  const hue =
    d === 0
      ? 0
      : max === r
        ? ((g - b) / d) % 6
        : max === g
          ? (b - r) / d + 2
          : (r - g) / d + 4;
  return { h: (hue * 60 + 360) % 360, s: max ? d / max : 0, v: max };
}
export function hsvToHex(h: number, s: number, v: number) {
  const c = v * s,
    x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
    m = v - c;
  const rgb =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return (
    "#" +
    rgb
      .map((n) =>
        Math.round((n + m) * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
