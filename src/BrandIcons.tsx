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
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M7 10C6 4 8.2 1.5 12 1.5S18 4 17 10c2.2 2.2 4 5.5 2.8 6.2-.7.4-1.4-.2-2.1-.9.3 2.8-2 5.2-5.7 5.2s-6-2.4-5.7-5.2c-.7.7-1.4 1.3-2.1.9C3 15.5 4.8 12.2 7 10Z"
        fill="currentColor"
      />
      <ellipse cx="12" cy="15.6" rx="4.4" ry="4.2" fill="#ffffff" />
      <ellipse cx="10.1" cy="6.3" rx="1.3" ry="2" fill="#ffffff" />
      <ellipse cx="13.9" cy="6.3" rx="1.3" ry="2" fill="#ffffff" />
      <ellipse cx="10.5" cy="6.6" rx=".5" ry=".9" fill="currentColor" />
      <ellipse cx="13.5" cy="6.6" rx=".5" ry=".9" fill="currentColor" />
      <path
        d="M8.7 9c1.7-1.2 4.9-1.2 6.6 0-1.2 2.3-5.4 2.3-6.6 0ZM6 20.3c1.6-.9 3.4-.5 4.1 1.2-1.7.9-4.2 1-5.3.2-.3-.4.1-.9 1.2-1.4Zm12 0c-1.6-.9-3.4-.5-4.1 1.2 1.7.9 4.2 1 5.3.2.3-.4-.1-.9-1.2-1.4Z"
        fill="#f3b443"
      />
      <path
        d="M7 10.4c2.4 1.6 7.6 1.6 10 0l.5 2.1c-3.4 1.5-7.6 1.5-11 0Z"
        fill="#e74343"
      />
    </svg>
  );
}
