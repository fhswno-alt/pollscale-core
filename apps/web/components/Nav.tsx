"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/guidelines", label: "Guidelines" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/support", label: "Support" },
  { href: "/delete-account", label: "Delete account" },
] as const;

export function Nav() {
  const pathname = usePathname();
  return (
    <nav>
      {LINKS.map((link) => (
        <Link key={link.href} href={link.href} className={pathname === link.href ? "active" : undefined}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
