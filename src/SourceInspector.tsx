import { useLayoutEffect, useRef } from "react";
import Moveable from "react-moveable";
import { createPortal } from "react-dom";
import type { SourceDesign } from "./freeform";
import type { Line } from "./flow";
import { NumericInput } from "./interaction";

export interface SourceSelection {
  id: string;
  tag?: string;
  target: HTMLElement;
}
export function SourceInspector({
  selection,
  design,
  line,
  container,
  onChange,
  onFrame,
  onText,
}: {
  selection: SourceSelection;
  design: SourceDesign;
  line?: Line;
  container: HTMLElement | null;
  onChange: (patch: Partial<SourceDesign>) => void;
  onFrame: (patch: Partial<SourceDesign>) => void;
  onText?: (value: string) => void;
}) {
  const moveable = useRef<Moveable>(null);
  const handle = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    moveable.current?.updateRect();
    if (container && handle.current) {
      const r = selection.target.getBoundingClientRect(),
        p = container.getBoundingClientRect();
      handle.current.style.left = `${r.left - p.left}px`;
      handle.current.style.top = `${r.top - p.top - 25}px`;
    }
  }, [design, line, selection.target, container]);
  const tag = selection.tag !== undefined;
  return (
    <>
      {container &&
        createPortal(
          <>
            <Moveable
              ref={moveable}
              target={selection.target}
              container={container}
              checkInput
              draggable={!tag}
              resizable={!tag}
              rotatable={false}
              origin={false}
              throttleDrag={0}
              throttleResize={0}
              onDrag={({ target, beforeTranslate }) => {
                target.style.transform = `translate(${beforeTranslate[0]}px,${beforeTranslate[1]}px)`;
              }}
              onDragEnd={({ lastEvent }) => {
                if (lastEvent)
                  onFrame({
                    dx: lastEvent.beforeTranslate[0],
                    dy: lastEvent.beforeTranslate[1],
                  });
              }}
              onResize={({ target, width, drag }) => {
                target.style.width = width + "px";
                target.style.transform = drag.transform;
              }}
              onResizeEnd={({ lastEvent }) => {
                if (lastEvent)
                  onFrame({
                    width: lastEvent.width,
                    dx: lastEvent.drag.beforeTranslate[0],
                    dy: lastEvent.drag.beforeTranslate[1],
                  });
              }}
            />
            {!tag && (
              <button
                ref={handle}
                className="free-source-drag"
                aria-label="拖动原稿元素"
                onTouchStart={(e) => {
                  moveable.current?.dragStart(e.nativeEvent, selection.target);
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  moveable.current?.dragStart(e.nativeEvent, selection.target);
                }}
              >
                拖动
              </button>
            )}
          </>,
          container,
        )}
      <section className="source-inspector">
        <h3>{tag ? "标签外观" : "原稿文字与排版"}</h3>
        <p>这里直接修改原简历；切换到简单编辑或 Markdown 后，效果保持一致。</p>
        {!tag && line && (
          <label className="free-full-label">
            内容
            <textarea
              aria-label="原稿内容"
              value={line.text}
              onChange={(e) => onText?.(e.target.value)}
            />
          </label>
        )}
        <div className="free-property-grid">
          {!tag && (
            <>
              <label>
                X 偏移
                <NumericInput
                  label="原稿 X 偏移"
                  value={design.dx || 0}
                  min={-3000}
                  max={3000}
                  onChange={(n) => onFrame({ dx: n })}
                />
              </label>
              <label>
                Y 偏移
                <NumericInput
                  label="原稿 Y 偏移"
                  value={design.dy || 0}
                  min={-3000}
                  max={3000}
                  onChange={(n) => onFrame({ dy: n })}
                />
              </label>
            </>
          )}
          <label>
            字号
            <NumericInput
              label="原稿字号"
              value={
                design.fontSize ??
                (parseFloat(
                  getComputedStyle(
                    selection.target.querySelector(".flow-row") ||
                      selection.target,
                  ).fontSize,
                ) ||
                  13)
              }
              min={1}
              max={300}
              onChange={(n) => onChange({ fontSize: n })}
            />
          </label>
          <label>
            内边距
            <NumericInput
              label="标签内边距"
              value={design.padding ?? 0}
              min={0}
              max={60}
              onChange={(n) => onChange({ padding: n })}
            />
          </label>
          <label>
            文字颜色
            <input
              type="color"
              aria-label="原稿文字颜色"
              value={design.color?.startsWith("#") ? design.color : "#171717"}
              onChange={(e) => onChange({ color: e.target.value })}
            />
          </label>
          <label>
            底色
            <input
              type="color"
              aria-label="原稿底色"
              value={
                design.backgroundColor?.startsWith("#")
                  ? design.backgroundColor
                  : "#eef1f5"
              }
              onChange={(e) => onChange({ backgroundColor: e.target.value })}
            />
          </label>
          <label>
            边框颜色
            <input
              type="color"
              aria-label="原稿边框颜色"
              value={
                design.borderColor?.startsWith("#")
                  ? design.borderColor
                  : "#0756a5"
              }
              onChange={(e) =>
                onChange({
                  borderColor: e.target.value,
                  borderWidth: design.borderWidth || 1,
                })
              }
            />
          </label>
          <label>
            边框宽度
            <NumericInput
              label="原稿边框宽度"
              value={design.borderWidth ?? 0}
              min={0}
              max={20}
              step={0.5}
              onChange={(n) => onChange({ borderWidth: n })}
            />
          </label>
          <label>
            圆角
            <NumericInput
              label="标签圆角"
              value={design.borderRadius ?? 0}
              min={0}
              max={80}
              onChange={(n) => onChange({ borderRadius: n })}
            />
          </label>
        </div>
        <div className="free-text-tools">
          <button onClick={() => onChange({ backgroundColor: "transparent" })}>
            无底色
          </button>
          <button onClick={() => onChange({ borderWidth: 0 })}>无边框</button>
        </div>
      </section>
    </>
  );
}
