const testimonials = [
  {
    name: "Alex Chen",
    title: "Backend Engineer",
    quote:
      "Setting up monitoring took 30 seconds. Zero config, just works with FastAPI.",
  },
  {
    name: "Sarah Kim",
    title: "DevOps Lead",
    quote:
      "The live request stream changed how we debug. We catch issues before users report them.",
  },
  {
    name: "Marcus Webb",
    title: "CTO",
    quote:
      "Smart redaction means we never worry about leaking PII to our monitoring stack.",
  },
  {
    name: "Priya Patel",
    title: "Senior Developer",
    quote:
      "The trace waterfall view is incredible for finding exactly where latency comes from.",
  },
];

function TestimonialCard({
  name,
  title,
  quote,
}: {
  name: string;
  title: string;
  quote: string;
}) {
  return (
    <div className="shrink-0 w-80 rounded-xl border border-white/10 bg-card p-6">
      <p className="text-sm text-muted leading-relaxed mb-4">&ldquo;{quote}&rdquo;</p>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-xs font-semibold text-accent">
          {name
            .split(" ")
            .map((n) => n[0])
            .join("")}
        </div>
        <div>
          <div className="text-sm font-medium text-foreground">{name}</div>
          <div className="text-xs text-muted">{title}</div>
        </div>
      </div>
    </div>
  );
}

export default function SocialProof() {
  // Duplicate cards for seamless infinite scroll
  const allCards = [...testimonials, ...testimonials];

  return (
    <section className="py-20 md:py-28 px-6 overflow-hidden">
      <div className="max-w-5xl mx-auto mb-10">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
          Built for developers who ship fast.
        </h2>
        <p className="text-muted text-base max-w-xl mb-6">
          Used by Python developers building APIs, microservices, and web
          applications.
        </p>
        <a
          href="#"
          className="inline-flex items-center rounded-md bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          Showcase
        </a>
      </div>

      {/* Scrolling marquee */}
      <div className="relative">
        <div className="flex gap-6 animate-marquee">
          {allCards.map((t, i) => (
            <TestimonialCard key={i} {...t} />
          ))}
        </div>
      </div>

      {/* Marquee animation via inline style tag */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>
    </section>
  );
}
