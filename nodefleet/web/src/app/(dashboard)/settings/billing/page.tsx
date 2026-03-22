"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, Loader2 } from "lucide-react";

interface OrgData {
  name: string;
  plan: string;
  deviceLimit: number;
  storageLimit: number;
  stats: { devices: number; media: number; members: number };
}

const plans = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "/month",
    description: "Perfect for getting started",
    deviceLimit: 3,
    storage: "1 GB",
    features: ["Up to 3 devices", "Basic monitoring", "1 GB storage", "Community support", "7-day data retention"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$19.99",
    period: "/month",
    description: "For growing operations",
    deviceLimit: 50,
    storage: "50 GB",
    features: ["Up to 50 devices", "Real-time monitoring", "50 GB storage", "Email support", "30-day data retention", "Custom integrations", "5 team members"],
    highlight: true,
  },
  {
    id: "team",
    name: "Team",
    price: "$49.99",
    period: "/month",
    description: "For established teams",
    deviceLimit: 100,
    storage: "500 GB",
    features: ["Up to 100 devices", "Advanced analytics", "500 GB storage", "Priority support", "90-day data retention", "Custom integrations", "20 team members"],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For large organizations",
    deviceLimit: -1,
    storage: "Unlimited",
    features: ["Unlimited devices", "Dedicated support", "Custom storage", "SLA guarantee", "Unlimited retention", "Custom development", "Unlimited members", "On-premise option"],
  },
];

export default function BillingPage() {
  const [org, setOrg] = useState<OrgData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOrg() {
      try {
        const res = await fetch("/api/org");
        if (res.ok) {
          const data = await res.json();
          setOrg(data);
        }
      } catch {}
      finally { setLoading(false); }
    }
    fetchOrg();
  }, []);

  function formatStorage(bytes: number): string {
    if (bytes >= 1099511627776) return `${(bytes / 1099511627776).toFixed(0)} TB`;
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(0)} GB`;
    return `${(bytes / 1048576).toFixed(0)} MB`;
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentPlan = org?.plan || "free";
  const currentPlanInfo = plans.find((p) => p.id === currentPlan);

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Billing & Plans</h1>
        <p className="text-slate-400">Manage your subscription for {org?.name || "your organization"}</p>
      </div>

      {/* Current Plan */}
      <Card className="bg-gradient-to-r from-primary/10 to-cyan-500/10 border-primary/30">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-sm text-slate-400 mb-1">Current Plan</p>
              <h3 className="text-2xl font-bold text-white capitalize">{currentPlan} Plan</h3>
              <p className="text-sm text-slate-400 mt-1">
                {currentPlanInfo?.price}{currentPlanInfo?.period}
                {" "} — {org?.stats.devices || 0} of {org?.deviceLimit || 0} devices used
                {" "} — Storage: {formatStorage(org?.storageLimit || 0)}
              </p>
            </div>
            <Badge variant="secondary" className="text-sm capitalize px-3 py-1">
              <Zap className="w-4 h-4 mr-1" /> {currentPlan}
            </Badge>
          </div>

          {/* Usage bars */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Devices</span>
                <span>{org?.stats.devices || 0} / {org?.deviceLimit || 0}</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${Math.min(100, ((org?.stats.devices || 0) / (org?.deviceLimit || 1)) * 100)}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Members</span>
                <span>{org?.stats.members || 0}</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-cyan-500 rounded-full" style={{ width: "20%" }} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plan Comparison */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-6">Choose Your Plan</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => {
            const isCurrent = plan.id === currentPlan;
            const isUpgrade = plans.indexOf(plan) > plans.findIndex((p) => p.id === currentPlan);
            return (
              <Card
                key={plan.id}
                className={`bg-slate-900/50 border-slate-800 transition-all ${
                  plan.highlight && isCurrent ? "ring-2 ring-primary" : ""
                } ${isCurrent ? "border-primary/50" : ""}`}
              >
                <CardHeader>
                  {isCurrent && (
                    <Badge className="w-fit mb-2 bg-primary/20 text-primary border-primary/30">
                      Current Plan
                    </Badge>
                  )}
                  {plan.highlight && !isCurrent && (
                    <Badge className="w-fit mb-2 bg-green-500/20 text-green-400 border-green-500/30">
                      Recommended
                    </Badge>
                  )}
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <p className="text-sm text-slate-400 mt-2">{plan.description}</p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <div className="flex items-baseline gap-1 mb-1">
                      <span className="text-3xl font-bold text-white">{plan.price}</span>
                      {plan.period && <span className="text-slate-400">{plan.period}</span>}
                    </div>
                  </div>

                  <ul className="space-y-3">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-slate-300">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="w-full"
                    variant={isCurrent ? "secondary" : isUpgrade ? "default" : "outline"}
                    disabled={isCurrent}
                  >
                    {isCurrent ? "Current Plan" : isUpgrade ? "Upgrade" : "Downgrade"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Stripe Integration Note */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <h3 className="font-semibold text-primary mb-2">Stripe Integration</h3>
          <p className="text-sm text-slate-300 mb-2">
            Plan upgrades and payment processing are handled through Stripe. To enable billing:
          </p>
          <ul className="text-sm text-slate-400 space-y-1 list-disc list-inside">
            <li>Set <code className="text-xs bg-slate-900 px-1 rounded">STRIPE_SECRET_KEY</code> in your .env</li>
            <li>Set <code className="text-xs bg-slate-900 px-1 rounded">STRIPE_WEBHOOK_SECRET</code> for subscription events</li>
            <li>Configure price IDs for each plan tier</li>
          </ul>
        </CardContent>
      </Card>

      {/* FAQ */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle>Frequently Asked Questions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="font-medium text-white mb-2">Can I change plans anytime?</h4>
            <p className="text-sm text-slate-400">Yes. Upgrades take effect immediately. Downgrades apply at the next billing cycle.</p>
          </div>
          <div>
            <h4 className="font-medium text-white mb-2">What happens when I exceed my device limit?</h4>
            <p className="text-sm text-slate-400">You cannot add new devices beyond your limit. Upgrade your plan or remove existing devices.</p>
          </div>
          <div>
            <h4 className="font-medium text-white mb-2">Is there a free trial?</h4>
            <p className="text-sm text-slate-400">The Free plan is always available with 3 devices and 1 GB storage. No credit card required.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
