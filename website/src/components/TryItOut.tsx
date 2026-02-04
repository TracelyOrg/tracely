"use client";

import { useState } from "react";
import { Copy, Check, CheckCircle } from "lucide-react";

export default function TryItOut() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText("pip install tracely");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="relative py-20 md:py-28 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Heading */}
        <h2 className="text-center text-sm font-semibold tracking-[0.2em] uppercase text-accent mb-12">
          TRY IT OUT.
        </h2>

        <div className="grid md:grid-cols-2 gap-6 items-start">
          {/* Left: Install command */}
          <div>
            {/* Code block with copy */}
            <div className="rounded-xl border border-white/10 bg-card overflow-hidden mb-4">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-white/[0.02]">
                <span className="text-xs text-muted font-mono">pip install tracely</span>
                <button
                  onClick={handleCopy}
                  className="text-muted hover:text-foreground transition-colors"
                >
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                </button>
              </div>
              <div className="p-4">
                <pre className="text-sm font-mono text-foreground">
                  <span className="text-muted">$</span> pip install tracely
                </pre>
              </div>
            </div>
          </div>

          {/* Right: Terminal mockup */}
          <div className="relative">
            <div className="rounded-xl border border-white/10 bg-card overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10 bg-white/[0.02]">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
                <span className="ml-2 text-xs text-muted font-mono">Terminal</span>
              </div>
              <div className="p-4 font-mono text-sm leading-relaxed">
                <div className="text-muted">pip install tracely</div>
                <div className="mt-2">
                  <span className="text-muted">◇</span>{" "}
                  <span className="text-foreground">Installing tracely-sdk...</span>
                </div>
                <div className="text-muted">│ <span className="text-emerald-400">✓</span> Done</div>
                <div className="text-muted">│</div>
                <div>
                  <span className="text-accent">◆</span>{" "}
                  <span className="text-foreground">Add to your app:</span>
                </div>
                <div className="text-muted">
                  │ &nbsp;&nbsp;<span className="text-blue-400">import</span>{" "}
                  <span className="text-foreground">tracely</span>
                </div>
                <div className="text-muted">
                  │ &nbsp;&nbsp;<span className="text-foreground">tracely</span>
                  <span className="text-muted">.init()</span>
                </div>
                <div className="text-muted">│</div>
                <div>
                  <span className="text-muted">◇</span>{" "}
                  <span className="text-foreground">Environment</span>
                </div>
                <div className="text-muted">
                  │ TRACELY_API_KEY=<span className="text-accent">trly_your_key</span>
                </div>
                <div className="text-muted">│</div>
                <div>
                  <span className="text-muted">└</span>{" "}
                  <span className="text-emerald-400">✓</span>{" "}
                  <span className="text-foreground">Ready to monitor!</span>
                </div>
              </div>
            </div>

            {/* Floating toast */}
            <div className="absolute -bottom-4 -right-2 md:right-4 flex items-center gap-2 rounded-lg border border-white/10 bg-card px-3 py-2 shadow-lg shadow-black/30">
              <CheckCircle size={14} className="text-emerald-400 shrink-0" />
              <span className="text-xs text-foreground whitespace-nowrap">
                localhost:8000 — First event received!
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
