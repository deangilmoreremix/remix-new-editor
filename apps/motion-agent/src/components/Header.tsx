/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

interface HeaderProps {
  asLink?: boolean;
}

export function Header({ asLink = false }: HeaderProps) {
  const content = (
    <div className="flex items-center gap-3">
      {/* SmartVid: served under /motion-agent/, so resolve public assets against the base. */}
      <img
        src={`${import.meta.env.BASE_URL}logo-white.svg`}
        alt="Remotion"
        style={{
          width: 32,
        }}
      />
      <span className="text-xl font-bold text-white font-sans">
        SmartVid Video Agent
      </span>
      <span className="text-xs text-muted-foreground font-sans hidden sm:inline">
        Prompt to motion graphics · powered by Remotion
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
