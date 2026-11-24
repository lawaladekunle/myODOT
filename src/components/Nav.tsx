"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HistoryIcon, MatrixIcon, SettingsIcon, TrashIcon } from "./icons";
import { cx } from "./ui";

const LINKS = [
  { href: "/", label: "Planner", Icon: MatrixIcon },
  { href: "/history", label: "History", Icon: HistoryIcon },
  { href: "/trash", label: "Trash", Icon: TrashIcon },
  { href: "/settings", label: "Settings", Icon: SettingsIcon },
];

export function NavLinks() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="flex items-center gap-1">
      {LINKS.map(({ href, label, Icon }) => {
        const on = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={on ? "page" : undefined}
            title={label}
            className={cx(
              "flex h-10 items-center gap-2 rounded-xl px-3 text-[15px] font-semibold transition-colors",
              on ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            <Icon size={17} />
            <span className="hidden md:inline">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
