import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent } from "react";
import { createPortal } from "react-dom";
import { Check, Pipette, RotateCcw, X } from "lucide-react";
import { hexToHsv, hsvToHex, normalizeHex } from "./color";
import { CanvasColorSampler } from "./CanvasColorSampler";
const colors = [
  ["墨黑", "#202124"],
  ["石墨", "#475569"],
  ["藏蓝", "#203b63"],
  ["经典蓝", "#1059a5"],
  ["青灰", "#426773"],
  ["松绿", "#356653"],
  ["酒红", "#853c4b"],
  ["砖红", "#a33f36"],
  ["陶土", "#a56c50"],
  ["咖啡", "#745741"],
  ["橄榄", "#62663e"],
  ["烟紫", "#67577d"],
];
export function ColorControl({
  label,
  value,
  defaultValue,
  presets = false,
  onChange,
  onOpenChange,
}: {
  label: string;
  value: string;
  defaultValue: string;
  presets?: boolean;
  onChange: (value: string) => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const button = useRef<HTMLButtonElement>(null),
    panel = useRef<HTMLDivElement>(null),
    active = useRef(false),
    session = useRef(0),
    apply = useRef(onChange);
  apply.current = onChange;
  const notify = useRef(onOpenChange);
  notify.current = onOpenChange;
  const [open, setOpen] = useState(false),
    [picking, setPicking] = useState(false),
    [error, setError] = useState("");
  const [draft, setDraft] = useState(value),
    [hsv, setHsv] = useState(() => hexToHsv(value)),
    [position, setPosition] = useState({ left: 0, top: 0 });
  useEffect(() => {
    setDraft(value);
    const next = hexToHsv(value);
    setHsv((old) => ({
      ...next,
      h: next.s === 0 || next.v === 0 ? old.h : next.h,
    }));
  }, [value]);
  const cancel = () => {
    active.current = false;
    session.current++;
    setPicking(false);
  };
  const close = () => {
    cancel();
    setOpen(false);
    notify.current?.(false);
  };
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = button.current!.getBoundingClientRect(),
        height = panel.current?.offsetHeight || 410;
      setPosition({
        left: Math.max(8, Math.min(r.left, innerWidth - 292)),
        top: Math.max(8, Math.min(r.bottom + 9, innerHeight - height - 8)),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const outside = (e: globalThis.PointerEvent) => {
      if (
        !active.current &&
        !panel.current?.contains(e.target as Node) &&
        !button.current?.contains(e.target as Node)
      )
        close();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (active.current) cancel();
        else {
          close();
          button.current?.focus();
        }
      }
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("keydown", key, true);
    return () => {
      session.current++;
      active.current = false;
      document.body.classList.remove("color-picking");
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("keydown", key, true);
    };
  }, [open]);
  const changeHsv = (next: typeof hsv) => {
    setHsv(next);
    onChange(hsvToHex(next.h, next.s, next.v));
  };
  const setPoint = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    changeHsv({
      ...hsv,
      s: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      v: 1 - Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    });
  };
  const finish = () => {
    const hex = normalizeHex(draft);
    if (hex) {
      onChange(hex);
      setError("");
    } else {
      setDraft(value);
      setError("请输入 #RRGGBB 或 #RGB。");
    }
  };
  return (
    <div className="color-control">
      {picking && (
        <CanvasColorSampler
          onPick={(hex) => {
            apply.current(hex);
            cancel();
          }}
          onError={() => {
            cancel();
            setError("取色未完成，请重试。");
          }}
        />
      )}
      <span>{label}</span>
      <button
        ref={button}
        type="button"
        className="color-trigger"
        style={{ backgroundColor: value }}
        aria-label={`${label}颜色`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (open) close();
          else {
            notify.current?.(true);
            setOpen(true);
          }
        }}
      />
      {open &&
        createPortal(
          <div
            ref={panel}
            className={`color-popover ${picking ? "is-picking" : ""}`}
            style={position}
            role="dialog"
            aria-label={`${label}调色板`}
          >
            <header>
              <strong>{label}颜色</strong>
              <button type="button" aria-label="关闭调色板" onClick={close}>
                <X size={15} />
              </button>
            </header>
            <div
              className="color-sv"
              role="slider"
              tabIndex={0}
              aria-label="饱和度与亮度"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(hsv.s * 100)}
              aria-valuetext={`饱和度 ${Math.round(hsv.s * 100)}%，亮度 ${Math.round(hsv.v * 100)}%`}
              style={{ "--hue": hsv.h } as CSSProperties}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                setPoint(e);
              }}
              onPointerMove={(e) => {
                if (e.currentTarget.hasPointerCapture(e.pointerId)) setPoint(e);
              }}
              onKeyDown={(e) => {
                if (
                  ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                    e.key,
                  )
                ) {
                  e.preventDefault();
                  changeHsv({
                    ...hsv,
                    s: Math.max(
                      0,
                      Math.min(
                        1,
                        hsv.s +
                          (e.key === "ArrowRight"
                            ? 0.01
                            : e.key === "ArrowLeft"
                              ? -0.01
                              : 0),
                      ),
                    ),
                    v: Math.max(
                      0,
                      Math.min(
                        1,
                        hsv.v +
                          (e.key === "ArrowUp"
                            ? 0.01
                            : e.key === "ArrowDown"
                              ? -0.01
                              : 0),
                      ),
                    ),
                  });
                }
              }}
            >
              <i
                style={{
                  left: `${hsv.s * 100}%`,
                  top: `${(1 - hsv.v) * 100}%`,
                }}
              />
            </div>
            <input
              className="color-hue"
              type="range"
              aria-label={`${label}色相`}
              min="0"
              max="359"
              value={Math.round(hsv.h)}
              onChange={(e) => changeHsv({ ...hsv, h: Number(e.target.value) })}
            />
            <div className="color-hex">
              <span style={{ backgroundColor: value }} />
              <input
                aria-label={`${label} HEX`}
                spellCheck={false}
                value={draft}
                maxLength={7}
                onChange={(e) => {
                  const text = e.target.value;
                  setDraft(text);
                  if (/^#[0-9a-f]{6}$/i.test(text)) {
                    onChange(text.toLowerCase());
                    setError("");
                  }
                }}
                onBlur={finish}
                onKeyDown={(e) => {
                  if (e.key === "Enter") finish();
                }}
              />
            </div>
            {presets && (
              <div className="theme-swatches">
                {colors.map(([name, color]) => (
                  <button
                    type="button"
                    key={color}
                    aria-label={`${label === "主题" ? "主题色" : label + "色"}：${name}`}
                    title={name}
                    aria-pressed={value.toLowerCase() === color}
                    style={{ backgroundColor: color }}
                    onClick={() => onChange(color)}
                  >
                    {value.toLowerCase() === color && <Check size={12} />}
                  </button>
                ))}
              </div>
            )}
            <footer>
              <button
                type="button"
                className="color-pipette"
                aria-pressed={picking}
                onClick={() => {
                  if (active.current) cancel();
                  else {
                    session.current++;
                    active.current = true;
                    setError("");
                    setPicking(true);
                  }
                }}
              >
                <Pipette size={15} />
                {picking ? "取消取色" : "画布取色"}
              </button>
              <button
                type="button"
                title="恢复默认色"
                aria-label={`恢复${label}默认色`}
                onClick={() => onChange(defaultValue)}
              >
                <RotateCcw size={15} />
              </button>
            </footer>
            {error && <small role="status">{error}</small>}
          </div>,
          document.body,
        )}
    </div>
  );
}
