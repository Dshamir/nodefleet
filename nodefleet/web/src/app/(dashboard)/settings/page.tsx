"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, User, Building2, Lock, KeyRound } from "lucide-react";
import Link from "next/link";

interface SessionUser {
  name: string;
  email: string;
  orgId: string;
  role: string;
}

export default function SettingsPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSession() {
      try {
        setLoading(true);
        const res = await fetch("/api/auth/session");
        if (!res.ok) throw new Error("Failed to fetch session");
        const data = await res.json();
        const sessionUser: SessionUser = {
          name: data.user?.name || "",
          email: data.user?.email || "",
          orgId: data.user?.orgId || "",
          role: data.user?.role || "member",
        };
        setUser(sessionUser);
        setProfileName(sessionUser.name);
        setProfileEmail(sessionUser.email);
      } catch {
        // Session fetch failed - user may not be authenticated
      } finally {
        setLoading(false);
      }
    }
    fetchSession();
  }, []);

  const handleUpdateProfile = async () => {
    try {
      setProfileSaving(true);
      setProfileMessage(null);
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: profileName, email: profileEmail }),
      });
      if (res.ok) {
        setProfileMessage("Profile updated successfully.");
        setUser((prev) =>
          prev ? { ...prev, name: profileName, email: profileEmail } : prev
        );
      } else {
        setProfileMessage("Failed to update profile. Please try again.");
      }
    } catch {
      setProfileMessage("Failed to update profile. Please try again.");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError(null);
    setPasswordMessage(null);

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    try {
      setPasswordSaving(true);
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      if (res.ok) {
        setPasswordMessage("Password changed successfully.");
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setShowPasswordForm(false);
      } else {
        const data = await res.json().catch(() => ({}));
        setPasswordError(data.error || "Failed to change password.");
      }
    } catch {
      setPasswordError("Failed to change password. Please try again.");
    } finally {
      setPasswordSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-3 text-slate-400">Loading settings...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-slate-400">Manage your account and organization</p>
      </div>

      {/* Profile Settings */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Full Name
            </label>
            <Input
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              className="bg-slate-800 border-slate-700"
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Email Address
            </label>
            <Input
              type="email"
              value={profileEmail}
              onChange={(e) => setProfileEmail(e.target.value)}
              className="bg-slate-800 border-slate-700"
              placeholder="your@email.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Role
            </label>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="capitalize">
                {user?.role || "member"}
              </Badge>
            </div>
          </div>
          {profileMessage && (
            <p className="text-sm text-primary">{profileMessage}</p>
          )}
          <Button
            className="bg-primary hover:bg-primary-dark gap-2"
            onClick={handleUpdateProfile}
            disabled={profileSaving}
          >
            {profileSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            Update Profile
          </Button>
        </CardContent>
      </Card>

      {/* Organization Settings */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Organization
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Organization ID
            </label>
            <Input
              value={user?.orgId || ""}
              readOnly
              className="bg-slate-800 border-slate-700 text-slate-400"
            />
          </div>
          <p className="text-sm text-slate-500">
            Organization settings are managed by your administrator.
          </p>
        </CardContent>
      </Card>

      {/* Password Change */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" />
            Change Password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!showPasswordForm ? (
            <Button
              variant="outline"
              onClick={() => setShowPasswordForm(true)}
              className="gap-2"
            >
              <Lock className="w-4 h-4" />
              Change Password
            </Button>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Current Password
                </label>
                <Input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="bg-slate-800 border-slate-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  New Password
                </label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="bg-slate-800 border-slate-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Confirm New Password
                </label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="bg-slate-800 border-slate-700"
                />
              </div>
              {passwordError && (
                <p className="text-sm text-red-400">{passwordError}</p>
              )}
              {passwordMessage && (
                <p className="text-sm text-green-400">{passwordMessage}</p>
              )}
              <div className="flex items-center gap-2">
                <Button
                  className="bg-primary hover:bg-primary-dark gap-2"
                  onClick={handleChangePassword}
                  disabled={passwordSaving}
                >
                  {passwordSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Change Password
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowPasswordForm(false);
                    setOldPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                    setPasswordError(null);
                    setPasswordMessage(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* API Keys - Coming Soon */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" />
            API Keys
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <KeyRound className="w-10 h-10 mx-auto mb-3 text-slate-600" />
            <p className="text-slate-400">API keys coming soon</p>
            <p className="text-sm text-slate-500 mt-1">
              Programmatic access to your fleet will be available in a future update.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Billing Link */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="text-xl">Billing &amp; Plan</CardTitle>
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
            <Button variant="destructive">Delete Account</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
