import { NumericInput } from "./interaction";
export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max = 150,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="number-label">
      <span>{label}</span>
      <NumericInput
        label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={onChange}
      />
    </label>
  );
}
