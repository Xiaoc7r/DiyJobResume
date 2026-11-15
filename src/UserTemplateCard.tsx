import { Check, Pencil, Trash2 } from "lucide-react";
import type { CSSProperties } from "react";
import type { UserTemplate } from "./templateLibrary";
import { useTemplateArt } from "./templateArt";
export function UserTemplateCard({
  template,
  selected,
  onUse,
  onEdit,
  onDelete,
}: {
  template: UserTemplate;
  selected: boolean;
  onUse: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const art = useTemplateArt(template),
    page = template.drawings.pages[0];
  return (
    <div className="user-template-entry">
      <button
        className={`template-card ${selected ? "active" : ""}`}
        aria-label={`使用${template.name}模板`}
        onClick={onUse}
      >
        <div
          className="mini-paper mini-user"
          style={
            {
              "--mini-accent": template.settings.accent,
              backgroundImage: art.page,
              backgroundSize: "100% 100%",
              aspectRatio: `${page.width} / ${page.height}`,
              ...art.style,
            } as CSSProperties
          }
        >
          <strong>示例姓名</strong>
          <small>手机号码 | 邮箱地址</small>
          {["教育背景", "工作经历", "项目经历", "专业技能"].map((name) => (
            <div key={name}>
              <b
                style={{
                  backgroundImage: art.section,
                  backgroundSize: "100% 100%",
                  borderColor: "transparent",
                }}
              >
                {name}
              </b>
              <span />
              <span />
              <span />
            </div>
          ))}
        </div>
        <div className="template-name">
          {template.name}
          {selected && <Check size={15} />}
        </div>
        <p>我的模板</p>
      </button>
      <div className="user-template-actions">
        <button
          title="编辑模板"
          aria-label={`编辑模板 ${template.name}`}
          onClick={onEdit}
        >
          <Pencil size={14} />
        </button>
        <button
          title="删除模板"
          aria-label={`删除模板 ${template.name}`}
          onClick={onDelete}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
