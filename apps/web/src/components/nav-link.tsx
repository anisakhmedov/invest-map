"use client";

import Link, { useLinkStatus } from "next/link";

/** A navigation link that dims its label while the next page loads, so a tap always gets an answer. */
export function NavLink({ href, className, children }: { href: string; className: string; children: string }) {
  return (
    <Link href={href} className={className}>
      <PendingLabel>{children}</PendingLabel>
    </Link>
  );
}

function PendingLabel({ children }: { children: string }) {
  const { pending } = useLinkStatus();
  return <span className={`transition-opacity duration-150 ${pending ? "opacity-50" : ""}`}>{children}</span>;
}
