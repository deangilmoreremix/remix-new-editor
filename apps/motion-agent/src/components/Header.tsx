import Link from "next/link";

interface HeaderProps {
  asLink?: boolean;
}

export function Header({ asLink = false }: HeaderProps) {
  const content = (
    <div className="flex items-center gap-3">
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polygon points="6 4 20 12 6 20 6 4" />
      </svg>
      <span className="text-xl font-bold text-white font-sans">
        Animation Agent
      </span>
      <span className="text-xs text-muted-foreground font-sans hidden sm:inline">
        Prompt to animation
      </span>
    </div>
  );

  if (asLink) {
    return (
      <Link
        href="/"
        className="flex items-center hover:opacity-80 transition-opacity"
      >
        {content}
      </Link>
    );
  }

  return content;
}
