"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Save, Loader2 } from "lucide-react";

interface SeoData {
  defaultTitle: string;
  defaultDescription: string;
  ogImage: string;
  robots: string;
  googleAnalyticsId: string;
}

export default function SeoSettingsPage() {
  const [form, setForm] = useState<SeoData>({
    defaultTitle: "",
    defaultDescription: "",
    ogImage: "",
    robots: "",
    googleAnalyticsId: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/seo/settings")
      .then((r) => r.json())
      .then((data) => {
        setForm({
          defaultTitle: data.defaultTitle || "",
          defaultDescription: data.defaultDescription || "",
          ogImage: data.ogImage || "",
          robots: data.robots || "",
          googleAnalyticsId: data.googleAnalyticsId || "",
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/seo/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    } catch (err) {
      console.error("Failed to save SEO settings:", err);
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Search className="w-6 h-6 text-primary" /> SEO Settings
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Configure default metadata, Open Graph, and analytics tracking.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving || loading}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Changes
        </Button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-slate-800 rounded w-32 mb-2" />
              <div className="h-10 bg-slate-800 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white text-lg">Meta Tags</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Default Title</label>
                <Input
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="My Site — SaaS Platform"
                  value={form.defaultTitle}
                  onChange={(e) => setForm({ ...form, defaultTitle: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Default Description</label>
                <textarea
                  className="w-full rounded-md bg-slate-800 border border-slate-700 text-white px-3 py-2 text-sm min-h-[80px]"
                  placeholder="A brief description of your site..."
                  value={form.defaultDescription}
                  onChange={(e) => setForm({ ...form, defaultDescription: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Robots</label>
                <Input
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="index, follow"
                  value={form.robots}
                  onChange={(e) => setForm({ ...form, robots: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white text-lg">Tracking & Open Graph</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">OG Image URL</label>
                <Input
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="https://example.com/og-image.png"
                  value={form.ogImage}
                  onChange={(e) => setForm({ ...form, ogImage: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Google Analytics ID</label>
                <Input
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="G-XXXXXXXXXX"
                  value={form.googleAnalyticsId}
                  onChange={(e) => setForm({ ...form, googleAnalyticsId: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
