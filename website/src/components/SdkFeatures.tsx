"use client";

import { useState } from "react";
import { Check } from "lucide-react";

const tabs = [
  {
    id: "auto",
    label: "Auto-Instrumentation",
    code: `from fastapi import FastAPI
import tracely

tracely.init()
app = FastAPI()

@app.get("/users/{user_id}")
async def get_user(user_id: int):
    user = await db.get(User, user_id)
    return user
# Every route, query, and response — auto-captured.`,
    heading: "The familiar stack.",
    features: [
      "Auto-detects FastAPI, Django, Flask at startup",
      "Instruments routes, middleware, and DB queries",
      "Captures full request/response bodies",
      "Sub-1ms overhead per request",
      "Zero runtime dependencies beyond your framework",
    ],
  },
  {
    id: "spans",
    label: "Custom Spans",
    code: `import tracely

async def process_payment(order):
    with tracely.span("payment-processing"):
        charge = await stripe.charge(order.total)

        with tracely.span("send-receipt"):
            await email.send(order.user, charge)

        return charge`,
    heading: "Full control when you need it.",
    features: [
      "Create custom spans for business-critical operations",
      "Add attributes and metadata to any span",
      "Nest spans for detailed trace trees",
      "Associate logs with their parent span",
      "Works alongside auto-instrumentation",
    ],
  },
  {
    id: "redaction",
    label: "Redaction",
    code: `{
  "user": "jane@example.com",
  "password": "[REDACTED]",
  "token": "[REDACTED]",
  "credit_card": "[REDACTED]",
  "order_id": "ORD-12345",
  "items": ["Widget A", "Widget B"]
}`,
    heading: "Privacy by default.",
    features: [
      "Automatically redacts passwords, tokens, and API keys",
      "Built-in rules for common PII patterns",
      "Custom redaction rules via configuration",
      "Redaction happens before data leaves your app",
      "Full audit trail of what was redacted",
    ],
  },
];

export default function SdkFeatures() {
  const [activeTab, setActiveTab] = useState("auto");
  const current = tabs.find((t) => t.id === activeTab)!;

  return (
    <section className="py-20 md:py-28 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Heading */}
        <h2 className="text-3xl md:text-4xl font-bold text-foreground text-center mb-10">
          Built for Python Engineers.
        </h2>

        {/* Tab row */}
        <div className="flex items-center justify-center gap-1 mb-10">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-white/10 text-foreground"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content: code left, features right */}
        <div className="grid md:grid-cols-2 gap-8 items-start">
          {/* Code block */}
          <div className="rounded-xl border border-white/10 bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10 bg-white/[0.02]">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
            </div>
            <pre className="p-4 text-sm font-mono leading-relaxed overflow-x-auto text-muted">
              {current.code}
            </pre>
          </div>

          {/* Feature list */}
          <div>
            <h3 className="text-xl font-semibold text-foreground mb-4">
              {current.heading}
            </h3>
            <ul className="space-y-3">
              {current.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-3">
                  <Check
                    size={16}
                    className="text-accent mt-0.5 shrink-0"
                  />
                  <span className="text-sm text-muted leading-relaxed">
                    {feature}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
