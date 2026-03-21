"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Zap } from "lucide-react";

export default function BillingPage() {
  const currentPlan = "pro";

  const plans = [
    {
      id: "free",
      name: "Free",
      price: "$0",
      period: "/month",
      description: "Perfect for getting started",
      features: [
        "Up to 5 devices",
        "Basic monitoring",
        "1 GB storage",
        "Community support",
        "7-day data retention",
      ],
      cta: "Current Plan",
      disabled: true,
    },
    {
      id: "pro",
      name: "Pro",
      price: "$99",
      period: "/month",
      description: "For growing operations",
      features: [
        "Up to 50 devices",
        "Real-time monitoring",
        "100 GB storage",
        "Email support",
        "30-day data retention",
        "Custom integrations",
        "Team members (5)",
      ],
      cta: "Current Plan",
      disabled: true,
      highlight: true,
    },
    {
      id: "team",
      name: "Team",
      price: "$299",
      period: "/month",
      description: "For established teams",
      features: [
        "Unlimited devices",
        "Advanced analytics",
        "1 TB storage",
        "Priority support",
        "90-day data retention",
        "Custom integrations",
        "Team members (20)",
        "Advanced permissions",
      ],
      cta: "Upgrade",
      disabled: false,
    },
    {
      id: "enterprise",
      name: "Enterprise",
      price: "Custom",
      period: "",
      description: "For large organizations",
      features: [
        "Unlimited everything",
        "Dedicated support",
        "Custom storage",
        "SLA guarantee",
        "Unlimited data retention",
        "Custom development",
        "Unlimited team members",
        "Advanced security",
        "On-premise option",
      ],
      cta: "Contact Sales",
      disabled: false,
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Billing & Plans</h1>
        <p className="text-slate-400">Manage your subscription and billing information</p>
      </div>

      {/* Current Plan Info */}
      <Card className="bg-gradient-to-r from-primary/10 to-cyan-500/10 border-primary/30">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400 mb-1">Current Plan</p>
              <h3 className="text-2xl font-bold text-white">Pro Plan</h3>
              <p className="text-sm text-slate-400 mt-1">
                $99/month • 18 of 50 devices used • Next billing date: Feb 10, 2024
              </p>
            </div>
            <Button className="bg-primary hover:bg-primary-dark">
              Manage Billing
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Plan Comparison */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-6">Choose Your Plan</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={`bg-slate-900/50 border-slate-800 transition-all ${
                plan.highlight ? "ring-2 ring-primary shadow-glow-primary" : ""
              }`}
            >
              <CardHeader>
                {plan.highlight && (
                  <Badge variant="success" className="w-fit mb-2">
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
                  {plan.id === "enterprise" && (
                    <p className="text-xs text-slate-500">Contact for custom pricing</p>
                  )}
                </div>

                <ul className="space-y-3">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <Check className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-slate-300">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={`w-full ${
                    plan.disabled
                      ? "bg-slate-800 hover:bg-slate-800 cursor-not-allowed"
                      : plan.highlight
                        ? "bg-primary hover:bg-primary-dark"
                        : "border border-slate-700 text-slate-300 hover:bg-slate-800"
                  }`}
                  disabled={plan.disabled}
                  variant={plan.disabled ? "secondary" : plan.highlight ? "default" : "outline"}
                >
                  {plan.cta}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Billing History */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle>Billing History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { date: "Jan 10, 2024", amount: "$99.00", status: "paid" },
              { date: "Dec 10, 2023", amount: "$99.00", status: "paid" },
              { date: "Nov 10, 2023", amount: "$99.00", status: "paid" },
              { date: "Oct 10, 2023", amount: "$69.00", status: "paid" },
            ].map((invoice, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 bg-slate-900/30 rounded-lg border border-slate-800"
              >
                <div>
                  <p className="text-white font-medium">{invoice.date}</p>
                  <p className="text-sm text-slate-400">Pro Plan</p>
                </div>
                <div className="text-right">
                  <p className="text-white font-medium">{invoice.amount}</p>
                  <Badge variant="success" className="text-xs mt-1">
                    {invoice.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
          <Button variant="outline" className="w-full mt-4">
            Download All Invoices
          </Button>
        </CardContent>
      </Card>

      {/* Payment Method */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle>Payment Method</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-slate-900/30 rounded-lg border border-slate-800">
            <p className="text-sm text-slate-400 mb-2">Visa Card ending in</p>
            <p className="text-white font-medium">•••• •••• •••• 4242</p>
            <p className="text-xs text-slate-500 mt-2">Expires 12/25</p>
          </div>
          <Button variant="outline">Update Payment Method</Button>
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
            <p className="text-sm text-slate-400">
              Yes, you can upgrade or downgrade your plan at any time. Changes take effect at the start of your next billing cycle.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-white mb-2">What happens when I exceed my device limit?</h4>
            <p className="text-sm text-slate-400">
              You'll be notified before reaching the limit. You can either upgrade to a higher plan or temporarily disable devices.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-white mb-2">Do you offer discounts for annual billing?</h4>
            <p className="text-sm text-slate-400">
              Yes! Annual plans get 20% off. Contact our sales team for details.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-white mb-2">Can I cancel my subscription?</h4>
            <p className="text-sm text-slate-400">
              You can cancel anytime. Your access continues until the end of your current billing period.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
