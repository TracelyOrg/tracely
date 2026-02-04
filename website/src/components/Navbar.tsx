"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Github, Menu, X } from "lucide-react";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-12 flex items-center justify-between px-6 backdrop-blur-sm bg-background/80 border-b border-white/10">
      {/* Left: Logo */}
      <div className="flex items-center gap-8">
        <Link href="/" className="text-sm font-semibold tracking-tight text-foreground">
          Tracely
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

      {/* Right: Search + GitHub + Mobile toggle */}
      <div className="flex items-center gap-3">
        <button className="hidden md:flex items-center gap-2 text-sm text-muted hover:text-foreground bg-white/5 rounded-md px-3 py-1.5 border border-white/10 transition-colors">
          <Search size={14} />
          <span>Search</span>
          <kbd className="ml-2 text-xs text-muted bg-white/5 rounded px-1.5 py-0.5 border border-white/10">
            ⌘K
          </kbd>
        </button>

        <a
          href="https://github.com/anthropics/tracely"
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted hover:text-foreground transition-colors"
        >
          <Github size={18} />
        </a>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-muted hover:text-foreground"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
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
            <button className="flex items-center gap-2 text-sm text-muted hover:text-foreground bg-white/5 rounded-md px-3 py-1.5 border border-white/10 w-fit">
              <Search size={14} />
              <span>Search</span>
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
