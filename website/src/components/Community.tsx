import { Github } from "lucide-react";
import Link from "next/link";

export default function Community() {
  const avatarInitials = [
    "AC", "SK", "MW", "PP", "JD", "LR", "KT", "NB", "RG", "YL", "EM", "DH",
  ];

  return (
    <section className="py-20 md:py-28 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Heading */}
        <h2 className="text-3xl md:text-4xl font-bold text-foreground text-center mb-10">
          Open Source. Privacy First.
        </h2>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Left card: Built in the open */}
          <div className="rounded-xl border border-white/10 bg-card p-6 md:p-8">
            <h3 className="text-2xl font-bold text-foreground mb-3">
              Built in the open.
            </h3>
            <p className="text-sm text-muted leading-relaxed mb-6">
              Tracely is 100% open source, powered by community contributions.
              Self-host or use the cloud — your data stays yours.
            </p>

            <div className="flex flex-wrap gap-3 mb-8">
              <a
                href="https://github.com/TracelyOrg/tracely"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-foreground hover:bg-white/10 transition-colors"
              >
                <Github size={16} />
                GitHub
              </a>
              <Link
                href="/docs"
                className="inline-flex items-center rounded-md border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-foreground hover:bg-white/10 transition-colors"
              >
                Documentation
              </Link>
            </div>

            {/* Contributor avatar grid */}
            <div className="flex flex-wrap gap-2 items-center">
              {avatarInitials.map((initials, i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-medium text-muted border border-white/5"
                >
                  {initials}
                </div>
              ))}
              <span className="text-xs text-muted ml-1">+28 more</span>
            </div>
          </div>

          {/* Right card: START MONITORING */}
          <div className="relative rounded-xl border border-white/10 bg-card overflow-hidden flex flex-col items-center justify-center p-6 md:p-8 min-h-[340px]">
            {/* Gradient sphere background */}
            <div
              className="absolute inset-0 opacity-60"
              style={{
                background:
                  "radial-gradient(ellipse at 50% 80%, #f59e0b33, #ea580c22 40%, transparent 70%)",
              }}
            />
            <div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[300px] h-[200px] rounded-t-full opacity-40"
              style={{
                background:
                  "radial-gradient(ellipse at center bottom, #f59e0b, #ea580c 40%, #0a0a0a 80%)",
              }}
            />

            <div className="relative z-10 text-center">
              <h3 className="text-3xl md:text-4xl font-bold font-mono tracking-wider text-foreground mb-3">
                START MONITORING
              </h3>
              <p className="text-sm text-muted font-mono">
                fast and private, just like it should be.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
