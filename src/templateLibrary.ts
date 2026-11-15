import { readResume, uid } from "./flow";
import type { Resume, Settings } from "./flow";
import { readTemplateStyle } from "./templateStyle";
import type { TemplateStyle } from "./templateStyle";

export const TEMPLATES_KEY = "diyjobresume.templates.v1";
export const MAKER_DRAFT_KEY = "diyjobresume.template-draft.v1";
export interface UserTemplate extends TemplateStyle {
  settings: Settings;
  draft: Resume;
  updatedAt: number;
}
export function readUserTemplate(raw: unknown): UserTemplate {
  const style = readTemplateStyle(raw),
    data = raw as UserTemplate;
  const draft = readResume(data.draft);
  if (!draft.freeform || draft.freeform.base !== "flow")
    throw new Error("模板草稿缺少画布数据。");
  delete draft.templateStyle;
  const settings = readResume({
    version: 2,
    name: style.name,
    template: "blue",
    lines: [],
    pictures: [],
    settings: data.settings,
  }).settings;
  return {
    ...style,
    settings,
    draft,
    updatedAt: Number(data.updatedAt) || Date.now(),
  };
}
export function loadUserTemplates(): UserTemplate[] {
  try {
    const data = JSON.parse(localStorage.getItem(TEMPLATES_KEY) || "[]");
    if (!Array.isArray(data)) return [];
    return data.flatMap((raw) => {
      try {
        return [readUserTemplate(raw)];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}
export function saveUserTemplate(template: UserTemplate) {
  const valid = readUserTemplate(template);
  const items = [
    valid,
    ...loadUserTemplates().filter((item) => item.id !== valid.id),
  ];
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(items));
  return items;
}
export function removeUserTemplate(id: string) {
  const items = loadUserTemplates().filter((item) => item.id !== id);
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(items));
  return items;
}
export function applyUserTemplate(doc: Resume, template: UserTemplate): Resume {
  const { settings, ...rest } = template;
  const style = readTemplateStyle(rest);
  return {
    ...doc,
    template: "blue",
    templateStyle: style,
    settings: {
      ...(style.regions ? doc.settings : settings),
      headerAlign: doc.settings.headerAlign,
      customCss: doc.settings.customCss,
    },
  };
}
export const newTemplateId = () => "template-" + uid();
