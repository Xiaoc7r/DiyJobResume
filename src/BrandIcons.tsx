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

export function QQIcon({ size = 20, ...props }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M7 10C6.4 4.8 8.3 2 12 2s5.6 2.8 5 8c1.6 1.7 2.8 4.5 2 5.2-.5.4-1.1 0-1.7-.7.2 3.6-1.9 5.7-5.3 5.7s-5.5-2.1-5.3-5.7c-.6.7-1.2 1.1-1.7.7-.8-.7.4-3.5 2-5.2Z" />
      <path d="M8 10.5c2.3 1 5.7 1 8 0M9 12.5c-.6 1.8-.4 3.8.7 5M9.3 20l-2.8 1.5h4M14.7 20l2.8 1.5h-4M10.2 8.8h3.6l-1.8 1Z" />
      <ellipse
        cx="10.2"
        cy="6.6"
        rx=".65"
        ry="1"
        fill="currentColor"
        stroke="none"
      />
      <ellipse
        cx="13.8"
        cy="6.6"
        rx=".65"
        ry="1"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}
export function XiaohongshuIcon({ size = 20, ...props }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="2.5" y="4.5" width="19" height="15" rx="4" />
      <path d="M7.5 8v8M5 11l-1 3M10 11l1 3M13 10h6M16 8v8M13 16h6" />
    </svg>
  );
}
