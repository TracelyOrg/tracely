import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Github } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative w-full pt-12 overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/hero.jpg"
          alt=""
          fill
          className="object-cover opacity-60"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/60 to-background" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 pt-24 pb-16 md:pt-32 md:pb-24">
        {/* Pill badge */}
        <div className="inline-flex items-center rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent mb-6">
          the observability platform Python developers love.
        </div>

        {/* Heading */}
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.1] mb-6 max-w-3xl">
          Monitor your Python apps{" "}
          <span className="text-accent">in real-time.</span>
        </h1>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <Link
            href="/docs"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-accent text-accent-foreground px-5 py-2.5 text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            Get Started
            <ArrowRight size={16} />
          </Link>
          <a
            href="https://github.com/anthropics/tracely"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-foreground hover:bg-white/10 transition-colors"
          >
            <Github size={16} />
            View on GitHub
          </a>
        </div>

        {/* Description */}
        <p className="text-base text-muted max-w-2xl leading-relaxed mb-12">
          <strong className="text-foreground">Real-time observability</strong> for{" "}
          <strong className="text-foreground">Python</strong> applications.{" "}
          <strong className="text-foreground">Zero-config</strong> auto-instrumentation for
          FastAPI, Django, and Flask with{" "}
          <strong className="text-foreground">smart data redaction</strong> and live request
          streaming.
        </p>

        {/* Dashboard preview mockup */}
        <div className="hidden md:block relative rounded-xl border border-white/10 bg-card overflow-hidden shadow-2xl shadow-black/50">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/[0.02]">
            <div className="w-3 h-3 rounded-full bg-red-500/70" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
            <div className="w-3 h-3 rounded-full bg-green-500/70" />
            <span className="ml-3 text-xs text-muted font-mono">
              tracely — dashboard
            </span>
          </div>
          <div className="p-6">
            {/* Mock dashboard content */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              {[
                { label: "Total Requests", value: "12,847", color: "text-foreground" },
                { label: "Avg Latency", value: "54ms", color: "text-emerald-400" },
                { label: "Error Rate", value: "0.3%", color: "text-emerald-400" },
                { label: "Active Spans", value: "23", color: "text-accent" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-lg bg-white/[0.03] border border-white/5 p-4"
                >
                  <div className="text-xs text-muted mb-1">{stat.label}</div>
                  <div className={`text-xl font-semibold font-mono ${stat.color}`}>
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>
            {/* Mock request rows */}
            <div className="space-y-2">
              {[
                { method: "GET", path: "/api/users/42", status: "200", time: "23ms" },
                { method: "POST", path: "/api/orders", status: "201", time: "87ms" },
                { method: "GET", path: "/api/products", status: "200", time: "12ms" },
                { method: "DELETE", path: "/api/sessions/abc", status: "204", time: "8ms" },
              ].map((req, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 rounded-md bg-white/[0.02] border border-white/5 px-4 py-2.5 font-mono text-xs"
                >
                  <span
                    className={`font-semibold w-16 ${
                      req.method === "GET"
                        ? "text-emerald-400"
                        : req.method === "POST"
                          ? "text-blue-400"
                          : req.method === "DELETE"
                            ? "text-red-400"
                            : "text-accent"
                    }`}
                  >
                    {req.method}
                  </span>
                  <span className="text-muted flex-1">{req.path}</span>
                  <span className="text-emerald-400">{req.status}</span>
                  <span className="text-muted w-16 text-right">{req.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
