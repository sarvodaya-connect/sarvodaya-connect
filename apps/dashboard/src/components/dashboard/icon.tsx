import type { SVGProps } from "react";

export type IconName =
  | "alert"
  | "bell"
  | "building"
  | "check"
  | "chevron"
  | "clipboard"
  | "clock"
  | "close"
  | "district"
  | "document"
  | "offline"
  | "conflict"
  | "home"
  | "inbox"
  | "lock"
  | "logout"
  | "refresh"
  | "review"
  | "search"
  | "shield"
  | "society"
  | "undo";

type IconProps = SVGProps<SVGSVGElement> & { name: IconName };

const paths: Record<IconName, React.ReactNode> = {
  alert: <><path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/></>,
  conflict: <><path d="M20 11a8 8 0 0 0-14.7-3.5L4 9"/><path d="M4 4v5h5M4 13a8 8 0 0 0 14.7 3.5L20 15"/><path d="M20 20v-5h-5"/></>,
  bell: <><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  clock: <><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></>,
  lock: <><rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/></>,
  shield: <><path d="M12 3 5 6v5.5c0 4.4 3 7.9 7 9.5 4-1.6 7-5.1 7-9.5V6z"/><path d="m9 12 2 2 4-4"/></>,
  undo: <><path d="M9 5 4 10l5 5"/><path d="M4 10h10a5 5 0 0 1 0 10h-3"/></>,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  inbox: <><path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5.5 5h13L21 13v6H3v-6z"/></>,
  refresh: <><path d="M20 11a8 8 0 0 0-14.7-3.5L4 9"/><path d="M4 4v5h5M4 13a8 8 0 0 0 14.7 3.5L20 15"/><path d="M20 20v-5h-5"/></>,
  building: <><path d="M4 21V10l8-6 8 6v11"/><path d="M9 21v-6h6v6M3 21h18"/></>,
  chevron: <path d="m9 18 6-6-6-6" />,
  clipboard: <><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5V3h6v1.5M9 10h6M9 14h6M9 18h4"/></>,
  district: <><path d="M4 20V8l5-4 5 4v12"/><path d="M14 11l3-2 3 2v9M2 20h20M8 11h2M8 15h2"/></>,
  document: <><path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h5M9 12h6M9 16h6"/></>,
  home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v11h14V10M9 21v-7h6v7"/></>,
  logout: <><path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10"/></>,
  offline: <><path d="M2 8.5a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0M12 19h.01"/><path d="m3 3 18 18"/></>,
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
