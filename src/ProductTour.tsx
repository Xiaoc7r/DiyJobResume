import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Table2,
  Circle,
  Triangle,
  Mail,
  Phone,
  Github,
  Link,
  LockKeyhole,
  Eye,
  Palette,
  BriefcaseBusiness,
  Award,
  Code2,
  GraduationCap,
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
import { lineHtml } from "./render";
import "./product-tour.css";
import { TourResume } from "./TourResume";
import { QQIcon, GiteeIcon } from "./BrandIcons";

const steps = [
  {
    title: "两种写法，同一份简历",
    text: "· 简单编辑直观且清晰，适合小白直接修改简历内容本身，",
    detail: "· Markdown灵活且自由，适合从底层直接修改简历内容格式。",
  },
  {
    title: "自由摆放，不受版式限制",
    text: "简历所有元素可在画布内自由管理，允许额外添加任意元素。",
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
  const sample = useMemo(() => initialResume(), []);
  const choices = templates.filter((t) => t.id !== "blank");
  const selected = choices[(step === 2 ? tick : 0) % choices.length];
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
        timer = setInterval(() => setTick((n) => n + 1), 1400);
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
  const phase = tick % 4;
  const demoObjects = sample.freeform!.pages[0].canvas.objects;
  return createPortal(
    <div
      className={`product-tour tour-immersive ${dark ? "tour-dark" : ""}`}
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label="四步使用指引"
      data-step={step + 1}
      data-phase={phase}
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
                    <h3>文字与板块</h3>
                    <div className="tour-tools-grid tour-free-tools">
                      <span>
                        <Pencil />
                        文字
                      </span>
                      <span className="tour-table-tool">
                        <Table2 />
                        表格
                      </span>
                      <span>
                        <BriefcaseBusiness />
                        经历板块
                      </span>
                      <span>
                        <Square />
                        双栏板块
                      </span>
                    </div>
                    <h3>图片与图形</h3>
                    <div className="tour-tools-grid tour-free-tools">
                      <span className="tour-upload">
                        <ImagePlus />
                        上传图片
                      </span>
                      <span>
                        <Square />
                        矩形
                      </span>
                      <span>
                        <Circle />
                        圆形
                      </span>
                      <span>
                        <Triangle />
                        三角形
                      </span>
                    </div>
                    <h3>常用图标</h3>
                    <div className="tour-demo-icons">
                      {[
                        Mail,
                        Phone,
                        Github,
                        GraduationCap,
                        BriefcaseBusiness,
                        Award,
                        Link,
                        QQIcon,
                        GiteeIcon,
                      ].map((Icon, i) => (
                        <span key={i}>
                          <Icon size={23} />
                        </span>
                      ))}
                    </div>
                    <div className="tour-table-demo">
                      <span>技能</span>
                      <span>熟悉程度</span>
                      <span>Java</span>
                      <span>熟练</span>
                    </div>
                  </>
                ) : (
                  <>
                    <h3>当前页元素</h3>
                    {demoObjects.map((object, i) => (
                      <div
                        className={`tour-object ${i === phase ? "active" : ""}`}
                        key={String(object.id)}
                      >
                        {object.type === "Image" ? (
                          <img src={String(object.src)} alt="" />
                        ) : object.type === "Group" ? (
                          <Link size={18} />
                        ) : (
                          <Square size={18} />
                        )}
                        <span>
                          {object.type === "Image"
                            ? i === 0
                              ? "视频.png"
                              : "京东.png"
                            : object.type === "Group"
                              ? "链接"
                              : "标题色带"}
                        </span>
                        <Eye size={15} />
                        <LockKeyhole size={15} />
                      </div>
                    ))}
                    <div className="tour-selected-detail">
                      <h4>当前画布元素</h4>
                      <div className="tour-icon-samples">
                        {demoObjects
                          .filter((o) => o.type === "Image")
                          .map((o) => (
                            <img
                              key={String(o.id)}
                              src={String(o.src)}
                              alt=""
                            />
                          ))}
                      </div>
                      <span>定位 · 移动 · 锁定</span>
                    </div>
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
                  <span key={i} className={phase === i ? "active" : ""}>
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
                  <span>
                    <Check size={14} />
                    吸附
                  </span>
                  <span>
                    <Check size={14} />
                    网格
                  </span>
                </>
              ) : (
                <>
                  <span data-tip="间距与字号" className="tour-tool-mark">
                    <SlidersHorizontal size={25} />
                  </span>
                  <b className="tour-swatch" />
                  <i />
                  <Undo2 />
                  <Redo2 />
                  <i />
                  <span data-tip="上传证件照" className="tour-tool-mark">
                    <ImagePlus size={25} />
                  </span>
                  <span data-tip="上传校徽" className="tour-tool-mark">
                    <GraduationCap size={27} />
                  </span>
                  <Code2 />
                  <span>上下 30</span>
                  <span>左右 42</span>
                </>
              )}
            </div>
            {step === 0 && (
              <div className="tour-sync-note">
                <Check size={16} />
                内容同步，允许直接点简历进行文字修改
              </div>
            )}
          </div>
          <div
            ref={paperArea}
            className={`tour-paper-area ${step === 0 || step === 2 || free || maker ? "tour-lit" : ""}`}
          >
            {maker ? (
              <div className="tour-maker-sheet">
                <div
                  className={`tour-maker-header tour-maker-phase-${phase}`}
                  style={{ height: phase > 0 ? 88 : 80 }}
                >
                  <strong>{phase > 0 ? "示例姓名" : "姓名"}</strong>
                  <small>手机 · 邮箱 · 个人主页</small>
                </div>
                {headings.map((h, index) => (
                  <div className="tour-maker-section" key={h}>
                    <div
                      className={`tour-maker-zone tour-art-${Math.min(phase, 2)}`}
                    >
                      <strong>{h}</strong>
                      <span />
                      <i className="tour-maker-emblem">
                        {
                          [
                            <GraduationCap size={18} />,
                            <BriefcaseBusiness size={18} />,
                            <Code2 size={18} />,
                            <Award size={18} />,
                          ][index]
                        }
                      </i>
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
              <TourResume
                doc={resume}
                scale={Math.min(paperScale, 0.76)}
                grid={free}
                editing={step === 0}
                height={free && tick % 2 ? 1360 : undefined}
                changed={step === 2 ? selected.name : undefined}
              />
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
                className={`tour-page-outline ${tick % 2 ? "is-tall" : ""}`}
                style={{ height: tick % 2 ? 240 : 160 }}
              >
                <span>{tick % 2 ? "1360 px" : "1165 px"}</span>
                <strong>1 页</strong>
              </div>
              <div className="tour-size-difference">
                {tick % 2 ? "拉长纸张，容纳更多内容" : "保持宽度，调整高度"}
              </div>
              <h4>页面操作</h4>
              <p>
                <Plus size={16} /> 新增页面
              </p>
            </div>
          ) : maker ? (
            <div className="tour-panel-body">
              <div className={`tour-demo-save ${phase === 3 ? "active" : ""}`}>
                <Save size={16} />
                {phase === 3 ? "已保存到整套模板" : "保存模板"}
              </div>
              <h4>区域与文字</h4>
              {["个人信息高度", "板块标题高度", "姓名字号", "板块标题字号"].map(
                (s, i) => (
                  <div className="tour-setting" key={s}>
                    {s}
                    <b>{[phase > 0 ? 88 : 80, 29, 24, 17][i]}</b>
                  </div>
                ),
              )}
              {phase === 3 && (
                <div className="tour-saved-template">
                  <Palette size={20} />
                  <strong>我的模板</strong>
                  <span>已加入整套模板</span>
                </div>
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
                    transform: `translateY(-${step === 2 ? Math.max(0, (tick % choices.length) - 1) * 124 : 0}px)`,
                  }}
                >
                  {choices.map((t) => (
                    <div
                      className={`tour-template ${selected.id === t.id ? "active" : ""}`}
                      key={t.id}
                    >
                      <div
                        className={`tour-mini-page template-${t.id} mini-${t.id}`}
                        style={
                          {
                            "--accent": t.color,
                            "--mini-accent": t.color,
                          } as CSSProperties
                        }
                      >
                        <b>炒肉多</b>
                        {headings.slice(0, 3).map((h) => (
                          <div key={h}>
                            <strong className="row-section">
                              <span className="ink" data-title={h}>
                                {h}
                              </span>
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
