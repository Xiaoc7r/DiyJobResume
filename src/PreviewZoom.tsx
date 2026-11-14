import type { CSSProperties } from "react";
import { Minus, Plus } from "lucide-react";

export function PreviewZoom({
  value,
  onChange,
  onFit,
}: {
  value: number;
  onChange: (value: number) => void;
  onFit: () => void;
}) {
  const percent = Math.round(value * 100);
  return (
    <div className="zoom-control" role="group" aria-label="预览缩放控制">
      <button
        type="button"
        aria-label="缩小预览"
        disabled={percent <= 20}
        onClick={() => onChange(Math.max(0.2, (percent - 10) / 100))}
      >
        <Minus size={15} />
      </button>
      <input
        type="range"
        aria-label="预览缩放"
        aria-valuetext={`${percent}%`}
        min="20"
        max="200"
        value={percent}
        style={
          { "--zoom-fill": `${((percent - 20) / 180) * 100}%` } as CSSProperties
        }
        onChange={(event) => onChange(Number(event.target.value) / 100)}
      />
      <button
        type="button"
        aria-label="放大预览"
        disabled={percent >= 200}
        onClick={() => onChange(Math.min(2, (percent + 10) / 100))}
      >
        <Plus size={15} />
      </button>
      <button
        type="button"
        className="zoom-value"
        title="自动适应窗口"
        aria-label={`当前缩放 ${percent}%，点击适应窗口`}
        onClick={onFit}
      >
        {percent}%
      </button>
    </div>
  );
}
