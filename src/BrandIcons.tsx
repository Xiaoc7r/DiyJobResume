import type { SVGProps } from "react";
type Props = SVGProps<SVGSVGElement> & { size?: number };
export function GiteeIcon({ size = 20, ...props }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path
        d="M16 7H10a3 3 0 0 0-3 3v5a2 2 0 0 0 2 2h6v-5h-4v2h2v1H9v-5a1 1 0 0 1 1-1h6Z"
        fill="#ffffff"
      />
    </svg>
  );
}
export function DouyinIcon({ size = 20, ...props }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M14 3v12a4.5 4.5 0 1 1-4-4.47M14 3c.5 3.2 2.3 5 5 5" />
    </svg>
  );
}
