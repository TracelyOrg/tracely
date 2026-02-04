export default function FrameworkSupport() {
  return (
    <section className="py-20 md:py-28 px-6">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-sm font-semibold tracking-[0.2em] uppercase text-accent text-center mb-10">
          Docs For Engineers.
        </h2>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Left card: Framework Support */}
          <div className="rounded-xl border border-white/10 bg-card p-6 md:p-8">
            <h3 className="text-2xl font-bold text-foreground mb-3">
              Framework Support
            </h3>
            <p className="text-sm text-muted leading-relaxed mb-6">
              Official support for FastAPI, Django, Flask — and any ASGI or WSGI
              framework. Drop in tracely and start monitoring instantly.
            </p>

            {/* Framework badges */}
            <div className="flex flex-wrap gap-3">
              {[
                { name: "FastAPI", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
                { name: "Django", color: "bg-green-500/15 text-green-400 border-green-500/20" },
                { name: "Flask", color: "bg-slate-500/15 text-slate-300 border-slate-500/20" },
              ].map((fw) => (
                <span
                  key={fw.name}
                  className={`inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-medium ${fw.color}`}
                >
                  {fw.name}
                </span>
              ))}
            </div>
          </div>

          {/* Right card: Composable SDK */}
          <div className="rounded-xl border border-white/10 bg-card p-6 md:p-8">
            <h3 className="text-2xl font-bold text-foreground mb-3">
              A composable SDK.
            </h3>
            <p className="text-sm text-muted leading-relaxed mb-6">
              Separated as Detection → Instrumentation → Transport, offering the
              composability engineers love — use what you need, nothing more.
            </p>

            {/* Component list */}
            <div className="space-y-3">
              {[
                {
                  name: "tracely",
                  desc: "Main package, zero-config initialization",
                },
                {
                  name: "tracely.init()",
                  desc: "Auto-detection and instrumentation",
                },
                {
                  name: "tracely.span()",
                  desc: "Custom span creation",
                },
                {
                  name: "OTLP/HTTP",
                  desc: "Standard transport protocol",
                },
              ].map((item) => (
                <div
                  key={item.name}
                  className="flex items-center gap-4 rounded-md bg-white/[0.03] border border-white/5 px-4 py-2.5"
                >
                  <code className="text-sm font-mono text-accent shrink-0 w-28">
                    {item.name}
                  </code>
                  <span className="text-xs text-muted">{item.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
