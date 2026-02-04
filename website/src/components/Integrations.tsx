export default function Integrations() {
  return (
    <section className="py-20 md:py-28 px-6">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
          Works with your stack.
        </h2>
        <p className="text-muted text-base max-w-2xl leading-relaxed mb-10">
          TRACELY automatically captures database queries, external HTTP calls,
          and middleware — all as child spans in your trace tree.
        </p>

        <div className="grid md:grid-cols-2 gap-8 items-start">
          {/* Left: Code snippet */}
          <div className="rounded-xl border border-white/10 bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10 bg-white/[0.02]">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
              <span className="ml-2 text-xs text-muted font-mono">routes.py</span>
            </div>
            <pre className="p-4 text-sm font-mono leading-relaxed overflow-x-auto">
              <span className="text-muted"># SQLAlchemy queries auto-captured</span>
              {"\n"}
              <span className="text-foreground">user</span>
              <span className="text-muted"> = </span>
              <span className="text-blue-400">await</span>
              <span className="text-foreground"> session.execute(</span>
              {"\n"}
              <span className="text-foreground">    select(User).where(User.id == user_id)</span>
              {"\n"}
              <span className="text-foreground">)</span>
              {"\n\n"}
              <span className="text-muted"># External HTTP calls auto-captured</span>
              {"\n"}
              <span className="text-foreground">response</span>
              <span className="text-muted"> = </span>
              <span className="text-blue-400">await</span>
              <span className="text-foreground"> httpx.get(</span>
              {"\n"}
              <span className="text-accent">    &quot;https://api.stripe.com/v1/charges&quot;</span>
              {"\n"}
              <span className="text-foreground">)</span>
            </pre>
          </div>

          {/* Right: Trace tree mockup */}
          <div className="rounded-xl border border-white/10 bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10 bg-white/[0.02]">
              <span className="text-xs text-muted font-mono">Trace Tree</span>
            </div>
            <div className="p-4 font-mono text-sm leading-loose">
              {/* Root span */}
              <div className="flex items-center gap-3">
                <span className="text-muted">▼</span>
                <span className="text-emerald-400 font-semibold">GET</span>
                <span className="text-foreground">/users/42</span>
                <span className="ml-auto text-emerald-400">200</span>
                <span className="text-muted w-14 text-right">54ms</span>
              </div>

              {/* Child: DB query */}
              <div className="flex items-center gap-3 pl-6">
                <span className="text-muted">├─</span>
                <span className="text-blue-400 font-semibold">db.query</span>
                <span className="text-muted">SELECT * FROM users</span>
                <span className="ml-auto text-muted">—</span>
                <span className="text-muted w-14 text-right">12ms</span>
              </div>

              {/* Child: External HTTP */}
              <div className="flex items-center gap-3 pl-6">
                <span className="text-muted">├─</span>
                <span className="text-accent font-semibold">httpx</span>
                <span className="text-muted">GET stripe.com</span>
                <span className="ml-auto text-emerald-400">200</span>
                <span className="text-muted w-14 text-right">38ms</span>
              </div>

              {/* Child: Notification */}
              <div className="flex items-center gap-3 pl-6">
                <span className="text-muted">└─</span>
                <span className="text-purple-400 font-semibold">task</span>
                <span className="text-muted">send-notification</span>
                <span className="ml-auto text-muted">—</span>
                <span className="text-muted w-14 text-right">3ms</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
