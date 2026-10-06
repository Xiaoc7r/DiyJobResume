import { useState } from "react";
import { X } from "lucide-react";

// Parse with the browser, then scope every selector to resume content.
// Disallow resource loading and global at-rules in imported as well as typed CSS.
export function compileCustomCss(source: string): string {
  if (!source.trim()) return "";
  if (source.length > 20000 || /\\|@|url\s*\(|image-set\s*\(/i.test(source))
    throw new Error("请使用普通 CSS 规则，不支持外部资源、转义或 @ 规则。");
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(source);
  if (!sheet.cssRules.length)
    throw new Error("没有找到有效的 CSS 规则，请检查大括号和属性。");
  const scope = ":is(.resume-paper, .measure-host)";
  return Array.from(sheet.cssRules)
    .map((rule) => {
      if (!(rule instanceof CSSStyleRule) || !rule.style.length)
        throw new Error(
          "请检查 CSS 选择器和属性，例如 code { color: #0756a5; }",
        );
      const selector = rule.selectorText;
      // :is() keeps comma-separated selectors inside the scoped descendant.
      return `${scope} :is(${selector}) { ${rule.style.cssText} }`;
    })
    .join("\n");
}

export function CustomCss({
  value,
  onApply,
  onClose,
}: {
  value: string;
  onApply: (css: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState("");
  return (
    <div className="modal-backdrop css-backdrop" onClick={onClose}>
      <section
        className="modal css-panel"
        role="dialog"
        aria-modal="true"
        aria-label="自定义 CSS"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-heading">
          <div>
            <h2>自定义 CSS</h2>
            <p>仅作用于简历，预览与 PDF 同步。应用后自动保存。</p>
          </div>
          <button aria-label="关闭 CSS 编辑" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <p className="css-hint">
          姓名用 .row-name，板块标题用 .row-section，正文用 .row-text，标签用
          code。覆盖字号可加 !important。
        </p>
        <textarea
          aria-label="CSS 样式"
          spellCheck={false}
          value={draft}
          maxLength={20000}
          onChange={(e) => {
            setDraft(e.target.value);
            setError("");
          }}
          placeholder={
            "code {\n  border-radius: 4px;\n  padding: 1px 5px;\n}\n\n.row-section { letter-spacing: 1px; }"
          }
        />
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="css-actions">
          <button
            onClick={() => {
              setDraft("");
              setError("");
              onApply("");
            }}
          >
            重置样式
          </button>
          <button
            className="primary"
            onClick={() => {
              try {
                compileCustomCss(draft);
                onApply(draft);
                setError("");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            应用样式
          </button>
        </div>
      </section>
    </div>
  );
}
