export default function FeatureCards() {
  return (
    <section className="py-20 md:py-28 px-6">
      <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-6">
        {/* Left: Live request stream */}
        <div className="rounded-xl border border-white/10 bg-card p-6 md:p-8">
          <h3 className="text-2xl font-bold text-foreground mb-3">
            Live request stream.
          </h3>
          <p className="text-sm text-muted leading-relaxed mb-6">
            Watch every HTTP request in real-time as it flows through your
            application. Filter by method, status, and path — with sub-500ms
            latency from ingestion to screen.
          </p>

          {/* Pulse View mockup */}
          <div className="rounded-lg border border-white/5 bg-white/[0.02] overflow-hidden">
            <div className="px-4 py-2 border-b border-white/5">
              <span className="text-xs text-muted font-mono">Pulse View</span>
            </div>
            <div className="p-3 space-y-1.5 font-mono text-xs">
              {[
                { method: "GET", path: "/api/users", status: "200", dur: "12ms", color: "text-emerald-400" },
                { method: "POST", path: "/api/orders", status: "201", dur: "87ms", color: "text-emerald-400" },
                { method: "GET", path: "/api/health", status: "200", dur: "2ms", color: "text-emerald-400" },
                { method: "PUT", path: "/api/users/42", status: "200", dur: "34ms", color: "text-emerald-400" },
                { method: "GET", path: "/api/products", status: "500", dur: "245ms", color: "text-red-400" },
              ].map((row, i) => (
                <div key={i} className="flex items-center gap-3 px-2 py-1 rounded bg-white/[0.02]">
                  <span className={`font-semibold w-10 ${
                    row.method === "GET" ? "text-emerald-400" :
                    row.method === "POST" ? "text-blue-400" :
                    "text-accent"
                  }`}>{row.method}</span>
                  <span className="text-muted flex-1">{row.path}</span>
                  <span className={row.color}>{row.status}</span>
                  <span className="text-muted w-12 text-right">{row.dur}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Smart data redaction */}
        <div className="rounded-xl border border-white/10 bg-card p-6 md:p-8">
          <h3 className="text-2xl font-bold text-foreground mb-3">
            Smart data redaction.
          </h3>
          <p className="text-sm text-muted leading-relaxed mb-6">
            Automatically mask passwords, tokens, API keys, and PII before data
            ever leaves your application. Configurable rules, zero data leaks.
          </p>

          {/* JSON mockup */}
          <div className="rounded-lg border border-white/5 bg-white/[0.02] overflow-hidden">
            <div className="px-4 py-2 border-b border-white/5">
              <span className="text-xs text-muted font-mono">Response Body</span>
            </div>
            <pre className="p-4 text-sm font-mono leading-relaxed">
              <span className="text-muted">{"{"}</span>
              {"\n"}
              <span className="text-foreground">  &quot;user&quot;</span>
              <span className="text-muted">: </span>
              <span className="text-accent">&quot;jane@example.com&quot;</span>
              <span className="text-muted">,</span>
              {"\n"}
              <span className="text-foreground">  &quot;password&quot;</span>
              <span className="text-muted">: </span>
              <span className="text-red-400">&quot;[REDACTED]&quot;</span>
              <span className="text-muted">,</span>
              {"\n"}
              <span className="text-foreground">  &quot;token&quot;</span>
              <span className="text-muted">: </span>
              <span className="text-red-400">&quot;[REDACTED]&quot;</span>
              <span className="text-muted">,</span>
              {"\n"}
              <span className="text-foreground">  &quot;order_id&quot;</span>
              <span className="text-muted">: </span>
              <span className="text-accent">&quot;ORD-12345&quot;</span>
              {"\n"}
              <span className="text-muted">{"}"}</span>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}
