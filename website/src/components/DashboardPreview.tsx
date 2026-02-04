export default function DashboardPreview() {
  return (
    <section className="py-20 md:py-28 px-6">
      <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-10 items-center">
        {/* Left: Dashboard mockup */}
        <div className="rounded-xl border border-white/10 bg-card overflow-hidden">
          {/* Tab bar */}
          <div className="flex items-center gap-1 px-4 py-3 border-b border-white/10 bg-white/[0.02]">
            {["Live View", "Trace Inspector", "Dashboard"].map((tab, i) => (
              <button
                key={tab}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  i === 0
                    ? "bg-white/10 text-foreground"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Mock live view content */}
          <div className="p-4 space-y-2 font-mono text-xs">
            {[
              {
                time: "14:23:01",
                method: "GET",
                path: "/api/users",
                status: "200",
                dur: "12ms",
                color: "text-emerald-400",
              },
              {
                time: "14:23:02",
                method: "POST",
                path: "/api/auth/login",
                status: "200",
                dur: "45ms",
                color: "text-emerald-400",
              },
              {
                time: "14:23:03",
                method: "GET",
                path: "/api/orders/789",
                status: "200",
                dur: "23ms",
                color: "text-emerald-400",
              },
              {
                time: "14:23:04",
                method: "POST",
                path: "/api/payments",
                status: "500",
                dur: "134ms",
                color: "text-red-400",
              },
              {
                time: "14:23:05",
                method: "GET",
                path: "/api/products",
                status: "200",
                dur: "8ms",
                color: "text-emerald-400",
              },
              {
                time: "14:23:06",
                method: "PATCH",
                path: "/api/users/42",
                status: "200",
                dur: "31ms",
                color: "text-emerald-400",
              },
            ].map((row, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-md bg-white/[0.02] border border-white/5 px-3 py-2"
              >
                <span className="text-muted w-16">{row.time}</span>
                <span
                  className={`font-semibold w-12 ${
                    row.method === "GET"
                      ? "text-emerald-400"
                      : row.method === "POST"
                        ? "text-blue-400"
                        : "text-accent"
                  }`}
                >
                  {row.method}
                </span>
                <span className="text-muted flex-1">{row.path}</span>
                <span className={row.color}>{row.status}</span>
                <span className="text-muted w-14 text-right">{row.dur}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Text + code */}
        <div>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Real-time visibility.{" "}
            <span className="text-accent">Zero noise.</span>
          </h2>
          <p className="text-muted text-base leading-relaxed mb-6">
            Watch every request as it flows through your application. Inspect
            full trace trees, request and response bodies, database queries, and
            external calls — all with automatic PII redaction built in.
          </p>

          {/* Python code snippet */}
          <div className="rounded-xl border border-white/10 bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-white/[0.02]">
              <span className="text-xs text-muted font-mono">app.py</span>
            </div>
            <pre className="p-4 text-sm font-mono leading-relaxed overflow-x-auto">
              <span className="text-blue-400">import</span>{" "}
              <span className="text-foreground">tracely</span>
              {"\n\n"}
              <span className="text-foreground">tracely</span>
              <span className="text-muted">.init()</span>
              {"\n"}
              <span className="text-muted">
                # That&apos;s it. Every request is now monitored.
              </span>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}
