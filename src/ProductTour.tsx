import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Code2,
  GraduationCap,
  Grip,
  ImagePlus,
  MousePointer2,
  Pencil,
  Plus,
  Redo2,
  Save,
  SlidersHorizontal,
  Square,
  Undo2,
  X,
} from "lucide-react";
import { applyTemplate, initialResume, templates, toMarkdown } from "./flow";
import { lineHtml, rowStyle } from "./render";
import "./product-tour.css";

const steps = [
  {
    title: "两种写法，同一份简历",
    text: "简单编辑直接写，Markdown 整篇改；切换时内容同步。也可以直接点纸上的文字修改。",
    detail: "工具栏：统一调整间距与字号，上传证件照、校徽。",
  },
  {
    title: "自由摆放，不受版式限制",
    text: "添加图片、图标与图形，在画布元素里定位、锁定和管理。",
    detail: "右侧可自定义纸张高度，让更长的内容留在同一页。",
  },
  {
    title: "换个模板，内容照旧",
    text: "在右侧选择整套模板，实时比较不同风格。",
    detail: "写好的文字会保留，找到适合你的那一款。",
  },
  {
    title: "把自己的风格做成模板",
    text: "在亮起的表头与板块标题区域画线、放图形或导入图片，四个标题同步呈现。",
    detail: "调整区域高度与字号，保存后就在整套模板最前面使用。",
  },
];
const headings = ["教育背景", "工作经历", "项目经历", "专业技能"];

/** An isolated demonstration: never mounts editable studios or writes résumé/draft storage. */
export function ProductTour({
  onClose,
  dark,
}: {
  onClose: () => void;
  dark: boolean;
}) {
  const [step, setStep] = useState(0),
    [tick, setTick] = useState(0);
  const [paperScale, setPaperScale] = useState(0.65);
  const paperArea = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null),
    close = useRef<HTMLButtonElement>(null);
  const sample = useMemo(() => {
    const doc = initialResume();
    return {
      ...doc,
      lines: doc.lines.filter(
        (line) => line.kind !== "blank" && line.text.trim(),
      ),
    };
  }, []);
  const selected = templates[(step === 2 ? tick : 0) % 6];
  const resume = useMemo(
    () => applyTemplate(sample, selected.id),
    [sample, selected.id],
  );
  const markdown = useMemo(() => toMarkdown(sample.lines), [sample]);
  const advance = () =>
    step === 3 ? onClose() : (setStep(step + 1), setTick(0));

  useEffect(() => {
    const el = paperArea.current;
    if (!el) return;
    const resize = () => {
      const style = getComputedStyle(el);
      setPaperScale(
        Math.max(
          0.1,
          (el.clientWidth -
            parseFloat(style.paddingLeft) -
            parseFloat(style.paddingRight)) /
            794,
        ),
      );
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const root = document.getElementById("root");
    const wasInert = root?.inert;
    const focused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (root) root.inert = true;
    close.current?.focus();
    return () => {
      if (root) root.inert = !!wasInert;
      if (focused?.isConnected) focused.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setInterval> | undefined;
    const schedule = () => {
      clearInterval(timer);
      if (!document.hidden && !reduced.matches)
        timer = setInterval(() => setTick((n) => n + 1), 2600);
    };
    schedule();
    document.addEventListener("visibilitychange", schedule);
    reduced.addEventListener("change", schedule);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", schedule);
      reduced.removeEventListener("change", schedule);
    };
  }, [step]);

  const free = step === 1,
    maker = step === 3,
    md = step === 0 && tick % 2 === 1;
  return createPortal(
    <div
      className={`product-tour ${dark ? "tour-dark" : ""}`}
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label="四步使用指引"
      data-step={step + 1}
      onClick={advance}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        } else if (
          e.key === "ArrowRight" ||
          (e.key === "Enter" && e.target === dialog.current)
        ) {
          e.preventDefault();
          advance();
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          setStep(Math.max(0, step - 1));
          setTick(0);
        } else if (e.key === "Tab") {
          const buttons = Array.from(
            dialog.current!.querySelectorAll<HTMLButtonElement>(
              "button:not(:disabled)",
            ),
          );
          const i = buttons.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          if (
            (e.shiftKey && i <= 0) ||
            (!e.shiftKey && i === buttons.length - 1)
          ) {
            e.preventDefault();
            buttons[e.shiftKey ? buttons.length - 1 : 0]?.focus();
          }
        }
      }}
      tabIndex={-1}
    >
      <header className="tour-heading">
        <span>DiyJobResume</span>
        <button
          ref={close}
          aria-label="关闭指引"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          <X size={20} />
        </button>
      </header>
      <div className={`tour-scene tour-scene-${step}`} aria-hidden="true" inert>
        <aside className={`tour-left ${step !== 2 ? "tour-lit" : ""}`}>
          <div className="tour-modes">
            {["简单编辑", "Markdown", "自由模式", "模板制造"].map((name, i) => (
              <span
                className={
                  (maker ? i === 3 : free ? i === 2 : md ? i === 1 : i === 0)
                    ? "active"
                    : ""
                }
                key={name}
              >
                {name}
              </span>
            ))}
          </div>
          {free ? (
            <>
              <div className="tour-tabs">
                <span className={tick % 2 === 0 ? "active" : ""}>添加元素</span>
                <span className={tick % 2 ? "active" : ""}>画布元素</span>
              </div>
              <div className="tour-panel-body" key={tick % 2}>
                {tick % 2 === 0 ? (
                  <>
                    <h3>添加元素</h3>
                    <div className="tour-tools-grid">
                      <span className="tour-upload">
                        <ImagePlus />
                        上传图片
                      </span>
                      <span>
                        <Square />
                        矩形
                      </span>
                      <span>
                        <Pencil />
                        画笔
                      </span>
                      <span>
                        <Plus />
                        图标
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <h3>当前页元素</h3>
                    {["校徽", "公司图标", "项目图标"].map((s) => (
                      <div className="tour-object" key={s}>
                        <Grip size={16} />
                        {s}
                        <Check size={14} />
                      </div>
                    ))}
                  </>
                )}
              </div>
            </>
          ) : maker ? (
            <div className="tour-panel-body">
              <h3>图形与画笔</h3>
              <div className="tour-tools-grid">
                {[
                  <Pencil />,
                  <Square />,
                  <span className="tour-line-icon" />,
                  <ImagePlus />,
                ].map((icon, i) => (
                  <span key={i} className={tick % 4 === i ? "active" : ""}>
                    {icon}
                    {["画笔", "矩形", "直线", "上传图片"][i]}
                  </span>
                ))}
              </div>
            </div>
          ) : md ? (
            <pre className="tour-md" key="md">
              {markdown
                .split("\n")
                .slice(0, 24)
                .map((line, i) => (
                  <div key={i}>
                    <span>{i + 1}</span>
                    <code>{line || " "}</code>
                  </div>
                ))}
            </pre>
          ) : (
            <div className="tour-simple" key="simple">
              {sample.lines.slice(0, 14).map((line) => (
                <div
                  key={line.id}
                  className={`tour-edit-${line.kind}`}
                  dangerouslySetInnerHTML={{ __html: lineHtml(line) }}
                />
              ))}
            </div>
          )}
        </aside>
        <main className="tour-center">
          <div
            className={`tour-toolbar ${step === 0 || maker ? "tour-lit" : ""}`}
          >
            <div className="tour-zoom">
              <span />
              <i />
            </div>
            <div className="tour-tool-row">
              {free || maker ? (
                <>
                  <MousePointer2 />
                  <Pencil />
                  <Undo2 />
                  <Redo2 />
                  <i />
                  <span>✓ 吸附</span>
                  <span>✓ 网格</span>
                </>
              ) : (
                <>
                  <span
                    data-tip="间距与字号"
                    className={tick % 3 === 0 ? "tour-tool-mark" : ""}
                  >
                    <SlidersHorizontal size={18} />
                  </span>
                  <b className="tour-swatch" />
                  <i />
                  <Undo2 />
                  <Redo2 />
                  <i />
                  <span
                    data-tip="上传证件照"
                    className={tick % 3 === 1 ? "tour-tool-mark" : ""}
                  >
                    <ImagePlus size={18} />
                  </span>
                  <span
                    data-tip="上传校徽"
                    className={tick % 3 === 2 ? "tour-tool-mark" : ""}
                  >
                    <GraduationCap size={20} />
                  </span>
                  <Code2 />
                  <span>上下 30</span>
                  <span>左右 42</span>
                </>
              )}
            </div>
          </div>
          <div
            ref={paperArea}
            className={`tour-paper-area ${step === 0 || step === 2 || free || maker ? "tour-lit" : ""}`}
          >
            {maker ? (
              <div className="tour-maker-sheet">
                <div className="tour-maker-header">
                  <strong>姓名</strong>
                  <small>手机 · 邮箱 · 个人主页</small>
                </div>
                {headings.map((h) => (
                  <div className="tour-maker-section" key={h}>
                    <div className={`tour-maker-zone tour-art-${tick % 3}`}>
                      <strong>{h}</strong>
                      <span />
                    </div>
                    <div className="tour-placeholder">
                      <i />
                      <i />
                      <i />
                    </div>
                  </div>
                ))}
                <div
                  className="tour-pencil"
                  style={{ top: `${25 + (tick % 3) * 2}%` }}
                >
                  <Pencil size={22} />
                </div>
              </div>
            ) : (
              <div
                className={`tour-paper resume-paper template-${selected.id} ${free ? "tour-grid" : ""}`}
                style={
                  {
                    zoom: paperScale,
                    "--accent": resume.settings.accent,
                    "--ink": resume.settings.color,
                  } as CSSProperties
                }
              >
                {resume.lines.slice(0, free ? 28 : 24).map((line, i) => (
                  <div
                    key={line.id}
                    className={`flow-row row-${line.kind} ${i === 1 ? "row-contact" : ""}`}
                    style={rowStyle(line, resume.settings)}
                    dangerouslySetInnerHTML={{ __html: lineHtml(line) }}
                  />
                ))}
                {free && (
                  <span
                    className="tour-floating-icon"
                    style={{ left: `${7 + (tick % 2) * 5}%` }}
                  >
                    <ImagePlus size={22} />
                  </span>
                )}
              </div>
            )}
          </div>
        </main>
        <aside className={`tour-right ${step > 0 ? "tour-lit" : ""}`}>
          <h3>{free || maker ? "画布设置" : "简历样式"}</h3>
          {free ? (
            <div className="tour-panel-body">
              <h4>当前纸张</h4>
              <div className="tour-demo-select">自定义尺寸</div>
              <div className="tour-dimensions">
                <label>
                  宽度 px<strong>794</strong>
                </label>
                <label>
                  高度 px
                  <strong className="tour-number-change">
                    {tick % 2 ? "1360" : "1165"}
                  </strong>
                </label>
              </div>
              <div
                className="tour-page-outline"
                style={{ height: tick % 2 ? 172 : 144 }}
              />
              <h4>页面操作</h4>
              <p>
                <Plus size={16} /> 新增页面
              </p>
            </div>
          ) : maker ? (
            <div className="tour-panel-body">
              <div
                className={`tour-demo-save ${tick % 3 === 2 ? "active" : ""}`}
              >
                <Save size={16} />
                {tick % 3 === 2 ? "已保存到整套模板" : "保存模板"}
              </div>
              <h4>区域与文字</h4>
              {["个人信息高度", "板块标题高度", "姓名字号", "板块标题字号"].map(
                (s, i) => (
                  <div className="tour-setting" key={s}>
                    {s}
                    <b>{[84, 30, 24, 16][i]}</b>
                  </div>
                ),
              )}
            </div>
          ) : (
            <>
              <div className="tour-tabs">
                <span className="active">整套模板</span>
                <span>拼接内容</span>
              </div>
              <div className="tour-template-viewport">
                <div
                  className="tour-template-track"
                  style={{
                    transform: `translateY(-${step === 2 ? Math.max(0, (tick % 6) - 1) * 124 : 0}px)`,
                  }}
                >
                  {templates.slice(0, 6).map((t) => (
                    <div
                      className={`tour-template ${selected.id === t.id ? "active" : ""}`}
                      key={t.id}
                    >
                      <div
                        className={`tour-mini-page template-${t.id}`}
                        style={{ "--accent": t.color } as CSSProperties}
                      >
                        <b>炒肉多</b>
                        {headings.slice(0, 3).map((h) => (
                          <div key={h}>
                            <strong className="row-section">
                              <span className="ink">{h}</span>
                            </strong>
                            <i />
                            <i />
                          </div>
                        ))}
                      </div>
                      <span>{t.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </aside>
      </div>
      <section className="tour-caption">
        <div className="tour-copy" aria-live="polite" key={step}>
          <h2>{steps[step].title}</h2>
          <p>{steps[step].text}</p>
          <p className="tour-detail">{steps[step].detail}</p>
        </div>
        <div className="tour-navigation">
          <span
            className="tour-progress"
            aria-label={`第 ${step + 1} 步，共 4 步`}
          >
            {steps.map((_, i) => (
              <i key={i} className={i <= step ? "active" : ""} />
            ))}
            <small>{step + 1} / 4</small>
          </span>
          <div>
            <button
              aria-label="上一步"
              disabled={step === 0}
              onClick={(e) => {
                e.stopPropagation();
                setStep(step - 1);
                setTick(0);
              }}
            >
              <ArrowLeft size={17} />
            </button>
            <button
              className="primary"
              onClick={(e) => {
                e.stopPropagation();
                advance();
              }}
            >
              {step === 3 ? "开始制作" : "下一步"}
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
        <small className="tour-click-hint">点击画面任意处继续 · Esc 退出</small>
      </section>
    </div>,
    document.body,
  );
}
