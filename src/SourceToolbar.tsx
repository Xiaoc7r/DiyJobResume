import {
  Undo2,
  Redo2,
  ImagePlus,
  GraduationCap,
  Code2,
  SlidersHorizontal,
} from "lucide-react";
import { ColorControl } from "./ColorControl";
import { NumberField } from "./NumberField";
import type { Settings } from "./flow";
export function SourceToolbar({
  value,
  defaultAccent,
  canUndo,
  canRedo,
  onChange,
  onUndo,
  onRedo,
  onPhoto,
  onCrest,
  onCss,
  onTypes,
}: {
  value: Settings;
  defaultAccent: string;
  canUndo: boolean;
  canRedo: boolean;
  onChange: (patch: Partial<Settings>) => void;
  onUndo: () => void;
  onRedo: () => void;
  onPhoto: () => void;
  onCrest: () => void;
  onCss: () => void;
  onTypes: () => void;
}) {
  return (
    <div
      className="format-toolbar source-toolbar"
      role="toolbar"
      aria-label="简历工具"
    >
      <div className="toolbar-styles">
        <button title="间距与字号" aria-label="间距与字号" onClick={onTypes}>
          <SlidersHorizontal size={17} />
        </button>
        <select
          aria-label="简历字体"
          value={value.font}
          onChange={(event) =>
            onChange({ font: event.target.value as Settings["font"] })
          }
        >
          <option value="sans">思源黑体</option>
          <option value="serif">思源宋体</option>
          <option value="nunito">Nunito</option>
        </select>
        <ColorControl
          label="主题"
          value={value.accent}
          defaultValue={defaultAccent}
          presets
          onChange={(accent) => onChange({ accent })}
        />
      </div>
      <div className="toolbar-actions">
        <button
          title="撤销 Ctrl+Z"
          aria-label="撤销"
          disabled={!canUndo}
          onClick={onUndo}
        >
          <Undo2 size={17} />
        </button>
        <button
          title="重做 Ctrl+Shift+Z"
          aria-label="重做"
          disabled={!canRedo}
          onClick={onRedo}
        >
          <Redo2 size={17} />
        </button>
        <button title="上传证件照" aria-label="上传证件照" onClick={onPhoto}>
          <ImagePlus size={17} />
        </button>
        <button title="上传校徽" aria-label="上传校徽" onClick={onCrest}>
          <GraduationCap size={19} />
        </button>
        <button title="自定义 CSS" aria-label="自定义 CSS" onClick={onCss}>
          <Code2 size={19} />
        </button>
      </div>
      <div className="toolbar-extras">
        <ColorControl
          label="正文"
          value={value.color}
          defaultValue="#171717"
          onChange={(color) => onChange({ color })}
        />
        <NumberField
          label="上下"
          value={value.top}
          min={12}
          onChange={(n) => onChange({ top: n, bottom: n })}
        />
        <NumberField
          label="左右"
          value={value.left}
          min={12}
          onChange={(n) => onChange({ left: n, right: n })}
        />
      </div>
    </div>
  );
}
