// Lightweight inline SVG icons for the Academy UI — avoids any third-party
// icon-library version risk. Each icon inherits color via currentColor.
import React from 'react';

const PATHS = {
  BookOpen: (
    <>
      <path d="M12 7c-2.76 0-5 2.24-5 5 0 2.76 2.24 5 5 5s5-2.24 5-5-2.24-5-5-5Z" />
      <path d="M3 5c0-1.1.9-2 2-2h5v16H5a2 2 0 0 1-2-2V5Zm16 0c0-1.1-.9-2-2-2h-5v16h5a2 2 0 0 0 2-2V5Z" />
    </>
  ),
  Eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  Sparkles: (
    <>
      <path d="M12 3l1.8 4.6L18.4 9l-4.6 1.4L12 15l-1.8-4.6L5.6 9l4.6-1.4L12 3Z" />
      <path d="M19 14l.9 2.3L22 17l-2.1.7L19 20l-.9-2.3L16 17l2.1-.7L19 14Z" />
    </>
  ),
  Image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="M21 16l-5-5L5 21" />
    </>
  ),
  Film: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" />
    </>
  ),
  Plus: <path d="M12 5v14M5 12h14" />,
  Check: <path d="M20 6 9 17l-5-5" />,
  Copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </>
  ),
  X: <path d="M18 6 6 18M6 6l12 12" />,
  ArrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  Layers: <path d="M12 3 3 8l9 5 9-5-9-5Zm0 9-9-5v7l9 5 9-5v-7l-9 5Z" />,
  User: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
    </>
  ),
  Mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  FileText: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </>
  ),
  ListChecks: (
    <>
      <path d="M3 6h11M3 12h11M3 18h11" />
      <path d="m17 6 1.5 1.5L21 5M17 12l1.5 1.5L21 11" />
    </>
  ),
  Grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  GraduationCap: (
    <>
      <path d="M22 9 12 5 2 9l10 4 10-4Z" />
      <path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5" />
    </>
  ),
  Play: <path d="M6 4l14 8-14 8V4Z" />,
  ChevronRight: <path d="m9 6 6 6-6 6" />,
  Search: <path d="M21 21l-4.3-4.3M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" />,
  ClipboardList: (
    <>
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <path d="M9 4V3h6v1M9 10h6M9 14h4" />
    </>
  ),
  Bookmark: (
    <>
      <path d="M5 3h14v18l-7-5-7 5V3Z" />
    </>
  ),
};

export function Icon({ name, size = 18, className = '', strokeWidth = 1.8 }) {
  const path = PATHS[name] || PATHS.FileText;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {path}
    </svg>
  );
}
