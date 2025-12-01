import type { SVGProps } from 'react';

export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      stroke="currentColor"
      strokeWidth="8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 80 V 30 A 10 10 0 0 1 30 20 H 70 A 10 10 0 0 1 80 30 V 80" />
      <path d="M20 80 H 80" />
      <path d="M40 50 L 50 60 L 60 50" />
      <path d="M50 20 V 60" />
    </svg>
  );
}
