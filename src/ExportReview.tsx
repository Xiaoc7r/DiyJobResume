import { useEffect, useRef } from "react";
import type { ExportIssue } from "./productTools";

export function ExportReview({
  issues,
  onClose,
  onLocate,
  onContinue,
}: {
  issues: ExportIssue[];
  onClose: () => void;
  onLocate: (issue: ExportIssue) => void;
  onContinue: () => void;
}) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => previous?.focus();
  }, []);
  return (
    <div className="export-review-backdrop" onClick={onClose}>
      <section
        className="export-review"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-review-title"
        ref={panel}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key !== "Tab") return;
          const buttons = [
            ...e.currentTarget.querySelectorAll<HTMLButtonElement>("button"),
          ];
          const next = e.shiftKey ? buttons.at(-1) : buttons[0];
          if (
            document.activeElement ===
            (e.shiftKey ? buttons[0] : buttons.at(-1))
          ) {
            e.preventDefault();
            next?.focus();
          }
        }}
      >
        <h2 id="export-review-title">导出前，看看这几处</h2>
        <p>检查在本机完成，不会修改或上传简历。</p>
        <ul>
          {issues.map((issue, i) => (
            <li key={i}>
              <span>{issue.message}</span>
              {(issue.lineId || issue.page !== undefined) && (
                <button onClick={() => onLocate(issue)}>查看位置</button>
              )}
            </li>
          ))}
        </ul>
        <p className="export-note">
          这里只检查可见排版和未填写提示，不代表简历内容或招聘系统兼容性已通过审核。
        </p>
        <div className="export-review-actions">
          <button onClick={onClose}>返回修改</button>
          <button className="primary" onClick={onContinue}>
            仍然导出 PDF
          </button>
        </div>
      </section>
    </div>
  );
}
