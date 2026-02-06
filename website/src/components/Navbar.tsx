"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, Github, Menu, X, ArrowRight } from "lucide-react";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [stars, setStars] = useState<string | null>(null);

  useEffect(() => {
    fetch("https://api.github.com/repos/TracelyOrg/tracely")
      .then((res) => res.json())
      .then((data) => {
        const count = data.stargazers_count;
        if (typeof count === "number") {
          setStars(count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count));
        }
      })
      .catch(() => {});
  }, []);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-12 backdrop-blur-sm bg-background/80 border-b border-white/10">
      <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-6">
      {/* Left: Logo */}
      <div className="flex items-center gap-8">
        <Link href="/" className="flex items-center">
          <Image
            src="/tracely-logo.png"
            alt="Tracely"
            width={140}
            height={36}
            className="dark:hidden"
            priority
          />
          <Image
            src="/tracely-logo-white.png"
            alt="Tracely"
            width={140}
            height={36}
            className="hidden dark:block"
            priority
          />
        </Link>

        {/* Center links — desktop */}
        <div className="hidden md:flex items-center gap-6">
          <Link
            href="/docs"
            className="text-sm text-muted hover:text-foreground transition-colors"
          >
            Documentation
          </Link>
          <Link
            href="#"
            className="text-sm text-muted hover:text-foreground transition-colors"
          >
            Blog
          </Link>
          <Link
            href="#"
            className="text-sm text-muted hover:text-foreground transition-colors"
          >
            Pricing
          </Link>
        </div>
      </div>

      {/* Right: Search + GitHub stars + Sign In + CTA + Mobile toggle */}
      <div className="flex items-center gap-3">
        <button className="hidden md:flex items-center gap-2 text-sm text-muted hover:text-foreground bg-white/5 rounded-full px-4 py-1.5 border border-white/10 transition-colors">
          <Search size={14} />
          <span>Search docs...</span>
          <kbd className="ml-2 text-xs text-muted bg-white/5 rounded px-1.5 py-0.5 border border-white/10">
            ⌘K
          </kbd>
        </button>

        <a
          href="https://github.com/TracelyOrg/tracely"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden md:inline-flex items-center gap-2 text-sm text-muted hover:text-foreground bg-white/5 rounded-full px-4 py-1.5 border border-white/10 transition-colors"
        >
          <Github size={14} />
          {stars !== null && <span className="font-medium">{stars}</span>}
        </a>

        <a
          href="https://app.tracely.sh"
          className="hidden md:inline-flex items-center text-sm font-medium text-muted hover:text-foreground bg-white/5 rounded-full px-4 py-1.5 border border-white/10 transition-colors"
        >
          Sign In
        </a>

        <a
          href="https://app.tracely.sh/register"
          className="hidden md:inline-flex items-center gap-2 rounded-full bg-accent text-accent-foreground px-4 py-1.5 text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          Get Started - Free
          <ArrowRight size={14} />
        </a>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-muted hover:text-foreground"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="absolute top-12 left-0 right-0 bg-background/95 backdrop-blur-md border-b border-white/10 md:hidden">
          <div className="flex flex-col px-6 py-4 gap-4">
            <Link
              href="/docs"
              className="text-sm text-muted hover:text-foreground transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              Documentation
            </Link>
            <Link
              href="#"
              className="text-sm text-muted hover:text-foreground transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              Blog
            </Link>
            <Link
              href="#"
              className="text-sm text-muted hover:text-foreground transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              Pricing
            </Link>
            <a
              href="https://github.com/TracelyOrg/tracely"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              <Github size={16} />
              {stars !== null && <span className="font-medium">{stars}</span>}
            </a>
            <a
              href="https://app.tracely.sh"
              className="text-sm text-muted hover:text-foreground transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              Sign In
            </a>
            <a
              href="https://app.tracely.sh/register"
              className="inline-flex items-center gap-2 rounded-full bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:bg-accent/90 transition-colors w-fit"
              onClick={() => setMobileOpen(false)}
            >
              Get Started - Free
              <ArrowRight size={14} />
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}
