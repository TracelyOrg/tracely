import Link from "next/link";
import { Clock, Shield, Code, Github } from "lucide-react";

export default function BottomCta() {
  return (
    <section className="py-20 md:py-28 px-6">
      <div className="max-w-3xl mx-auto rounded-xl border border-white/10 bg-card p-8 md:p-12">
        {/* Feature bullets */}
        <div className="space-y-6 mb-10">
          <div className="flex items-start gap-4">
            <div className="mt-0.5 shrink-0 w-8 h-8 rounded-md bg-accent/10 flex items-center justify-center">
              <Clock size={16} className="text-accent" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1">
                Zero-config setup.
              </h3>
              <p className="text-sm text-muted">
                Install the SDK and start monitoring in under 60 seconds.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="mt-0.5 shrink-0 w-8 h-8 rounded-md bg-accent/10 flex items-center justify-center">
              <Shield size={16} className="text-accent" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1">
                Privacy by default.
              </h3>
              <p className="text-sm text-muted">
                Smart redaction ensures sensitive data never leaves your app.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="mt-0.5 shrink-0 w-8 h-8 rounded-md bg-accent/10 flex items-center justify-center">
              <Code size={16} className="text-accent" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1">
                Fully open-source.
              </h3>
              <p className="text-sm text-muted">
                Self-host or use the cloud. Your data, your choice.
              </p>
            </div>
          </div>
        </div>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/docs"
            className="inline-flex items-center justify-center rounded-md bg-accent text-accent-foreground px-6 py-2.5 text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            Read docs
          </Link>
          <a
            href="https://github.com/TracelyOrg/tracely"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-white/15 bg-white/5 px-6 py-2.5 text-sm font-medium text-foreground hover:bg-white/10 transition-colors"
          >
            <Github size={16} />
            View on GitHub
          </a>
        </div>
      </div>

      {/* Copyright */}
      <p className="text-center text-xs text-muted mt-8">
        &copy; 2026 Tracely. All rights reserved.
      </p>
    </section>
  );
}
