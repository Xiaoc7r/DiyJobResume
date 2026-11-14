import { Check } from "lucide-react";
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
export function ThemePalette({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="theme-palette" role="group" aria-label="主题配色">
      <label className="color-control" title="自定义主题颜色">
        <span>主题</span>
        <input
          type="color"
          aria-label="主题颜色"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
      <div className="theme-swatches">
        {colors.map(([name, color]) => (
          <button
            type="button"
            key={color}
            aria-label={`主题色：${name}`}
            title={name}
            aria-pressed={value.toLowerCase() === color}
            style={{ backgroundColor: color }}
            onClick={() => onChange(color)}
          >
            {value.toLowerCase() === color && <Check size={12} />}
          </button>
        ))}
      </div>
    </div>
  );
}
