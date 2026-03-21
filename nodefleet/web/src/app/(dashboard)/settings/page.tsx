"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import Link from "next/link";

export default function SettingsPage() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const apiKeys = [
    {
      id: 1,
      name: "Production API Key",
      key: "nf_prod_xxx...xxx",
      fullKey: "nf_prod_1a2b3c4d5e6f7g8h9i0j",
      createdAt: "2024-01-10",
      lastUsed: "2 minutes ago",
    },
    {
      id: 2,
      name: "Development API Key",
      key: "nf_dev_yyy...yyy",
      fullKey: "nf_dev_a1b2c3d4e5f6g7h8i9j0",
      createdAt: "2024-01-05",
      lastUsed: "1 hour ago",
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-slate-400">Manage your account and organization</p>
      </div>

      {/* Organization Settings */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="text-xl">Organization</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Organization Name
            </label>
            <Input
              defaultValue="Acme Corporation"
              className="bg-slate-800 border-slate-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Organization Slug
            </label>
            <Input
              defaultValue="acme-corp"
              className="bg-slate-800 border-slate-700"
            />
          </div>
          <Button className="bg-primary hover:bg-primary-dark">
            Save Changes
          </Button>
        </CardContent>
      </Card>

      {/* Profile Settings */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="text-xl">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Full Name
            </label>
            <Input
              defaultValue="John Doe"
              className="bg-slate-800 border-slate-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Email Address
            </label>
            <Input
              type="email"
              defaultValue="john@example.com"
              className="bg-slate-800 border-slate-700"
            />
          </div>
          <Button className="bg-primary hover:bg-primary-dark">
            Update Profile
          </Button>
        </CardContent>
      </Card>

      {/* Password Change */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="text-xl">Change Password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Current Password
            </label>
            <Input
              type="password"
              placeholder="••••••••"
              className="bg-slate-800 border-slate-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              New Password
            </label>
            <Input
              type="password"
              placeholder="••••••••"
              className="bg-slate-800 border-slate-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Confirm New Password
            </label>
            <Input
              type="password"
              placeholder="••••••••"
              className="bg-slate-800 border-slate-700"
            />
          </div>
          <Button className="bg-primary hover:bg-primary-dark">
            Change Password
          </Button>
        </CardContent>
      </Card>

      {/* API Keys */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">API Keys</CardTitle>
            <Button size="sm" className="bg-primary hover:bg-primary-dark">
              Generate New Key
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {apiKeys.map((apiKey) => (
              <div
                key={apiKey.id}
                className="p-4 bg-slate-900/30 rounded-lg border border-slate-800"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-medium text-white">{apiKey.name}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Created: {apiKey.createdAt} • Last used: {apiKey.lastUsed}
                    </p>
                  </div>
                  <Badge variant="success" className="text-xs">
                    Active
                  </Badge>
                </div>
                <div className="flex items-center gap-2 bg-slate-950 rounded p-3 mb-3">
                  <code className="flex-1 text-xs text-slate-400 font-mono">
                    {apiKey.key}
                  </code>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleCopyKey(apiKey.fullKey)}
                  >
                    {copiedKey === apiKey.fullKey ? (
                      <Check className="w-4 h-4 text-success" />
                    ) : (
                      <Copy className="w-4 h-4 text-slate-500" />
                    )}
                  </Button>
                </div>
                <Button size="sm" variant="destructive">
                  Revoke Key
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Billing Link */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="text-xl">Billing & Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-400 mb-4">
            Manage your subscription, billing information, and plan details.
          </p>
          <Link href="/settings/billing">
            <Button className="bg-primary hover:bg-primary-dark">
              Go to Billing
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="bg-error/10 border-error/30">
        <CardHeader>
          <CardTitle className="text-xl text-error">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium text-white mb-2">Delete Account</h4>
            <p className="text-sm text-slate-400 mb-4">
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
            <Button variant="destructive">
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
