import type { SVGProps } from "react";

export type IconName =
  | "building"
  | "chevron"
  | "clipboard"
  | "district"
  | "document"
  | "home"
  | "logout"
  | "review"
  | "search"
  | "society";

type IconProps = SVGProps<SVGSVGElement> & { name: IconName };

const paths: Record<IconName, React.ReactNode> = {
  building: <><path d="M4 21V10l8-6 8 6v11"/><path d="M9 21v-6h6v6M3 21h18"/></>,
  chevron: <path d="m9 18 6-6-6-6" />,
  clipboard: <><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5V3h6v1.5M9 10h6M9 14h6M9 18h4"/></>,
  district: <><path d="M4 20V8l5-4 5 4v12"/><path d="M14 11l3-2 3 2v9M2 20h20M8 11h2M8 15h2"/></>,
  document: <><path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h5M9 12h6M9 16h6"/></>,
  home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v11h14V10M9 21v-7h6v7"/></>,
  logout: <><path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10"/></>,
  review: <><path d="M4 4h16v13H8l-4 4z"/><path d="M8 9h8M8 13h5"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  society: <><circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M2.5 20v-2a5.5 5.5 0 0 1 11 0v2M13 13a5.5 5.5 0 0 1 8.5 4.6V20"/></>,
};

export function Icon({ name, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
