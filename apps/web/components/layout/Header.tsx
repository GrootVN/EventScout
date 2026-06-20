import Link from "next/link";
import { env } from "@/lib/config/env";

export function Header() {
  return (
    <header className="site-header">
      <div>
        <Link href="/" className="brand-mark">
          {env.appName}
        </Link>
        <p className="eyebrow">City onboarding through events, not generic listings.</p>
      </div>
      <nav className="nav-links" aria-label="Primary">
        <Link href="/">Discover</Link>
        <Link href="/saved">Saved</Link>
        <Link href="/sources">Sources</Link>
      </nav>
    </header>
  );
}
