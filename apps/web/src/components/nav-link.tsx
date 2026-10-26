"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

/**
 * A navigation link that marks the current section and dims its label while the next page loads,
 * so a tap always gets an answer.
 */
export function NavLink({
  href,
  className,
  activeClassName = "",
  children,
}: {
  href: string;
  className: string;
  activeClassName?: string;
  children: string;
}) {
  const pathname = usePathname();
  const current = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link href={href} aria-current={current ? "page" : undefined} className={`${className} ${current ? activeClassName : ""}`.trim()}>
      <PendingLabel>{children}</PendingLabel>
    </Link>
  );
}

function PendingLabel({ children }: { children: string }) {
  const { pending } = useLinkStatus();
  return <span className={`transition-opacity duration-150 ${pending ? "opacity-50" : ""}`}>{children}</span>;
}
