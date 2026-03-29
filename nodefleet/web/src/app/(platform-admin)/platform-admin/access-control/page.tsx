"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Loader2,
  Shield,
  Plus,
  Users,
  Lock,
  ChevronRight,
} from "lucide-react";

interface CustomRole {
  id: string;
  name: string;
  description: string | null;
  permissions: Record<string, string[]>;
  createdAt: string;
}

const RESOURCES = [
  "device",
  "fleet",
  "schedule",
  "content",
  "audit",
  "settings",
  "billing",
  "commerce",
  "analytics",
  "crm",
  "marketing",
  "operations",
  "development",
  "security",
  "notification",
] as const;

const ACTIONS = ["create", "read", "update", "delete", "manage"] as const;

const BUILTIN_ROLES = [
  {
    name: "Platform Admin",
    description: "Full system access across all organizations",
    builtin: true,
  },
  {
    name: "Owner",
    description: "Full organization access including billing and danger zone",
    builtin: true,
  },
  {
    name: "Admin",
    description: "Manage devices, fleets, users, and settings",
    builtin: true,
  },
  {
    name: "Member",
    description: "Create and manage own devices and content",
    builtin: true,
  },
  {
    name: "Viewer",
    description: "Read-only access to dashboards and devices",
    builtin: true,
  },
];

export default function AccessControlPage() {
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<CustomRole | null>(null);
  const [selectedBuiltin, setSelectedBuiltin] = useState<string | null>(
    "Owner"
  );

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPermissions, setNewPermissions] = useState<
    Record<string, string[]>
  >({});
  const [creating, setCreating] = useState(false);

  const fetchRoles = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/auth/roles");
      if (!res.ok) return;
      const data = await res.json();
      setRoles(data.data || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  function togglePermission(resource: string, action: string) {
    setNewPermissions((prev) => {
      const current = prev[resource] || [];
      if (current.includes(action)) {
        const next = current.filter((a) => a !== action);
        if (next.length === 0) {
          const { [resource]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [resource]: next };
      }
      return { ...prev, [resource]: [...current, action] };
    });
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/auth/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          description: newDescription || undefined,
          permissions: newPermissions,
        }),
      });
      if (res.ok) {
        setCreateOpen(false);
        setNewName("");
        setNewDescription("");
        setNewPermissions({});
        fetchRoles();
      }
    } catch {
      /* ignore */
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const activeRole = selectedRole;
  const activePermissions = activeRole?.permissions || {};

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Access Control
          </h1>
          <p className="text-slate-400">
            Manage roles and permissions for your organization
          </p>
        </div>
        <Button
          className="bg-primary hover:bg-primary/90 gap-2"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="w-4 h-4" /> Create Role
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Panel — Role List */}
        <div className="lg:col-span-4 space-y-4">
          {/* Built-in Roles */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Lock className="w-4 h-4" /> Built-in Roles
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 pt-0">
              {BUILTIN_ROLES.map((role) => (
                <button
                  key={role.name}
                  onClick={() => {
                    setSelectedBuiltin(role.name);
                    setSelectedRole(null);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors ${
                    selectedBuiltin === role.name && !selectedRole
                      ? "bg-primary/10 border border-primary/30"
                      : "hover:bg-slate-800/50 border border-transparent"
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium text-white">
                      {role.name}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {role.description}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Custom Roles */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4" /> Custom Roles ({roles.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 pt-0">
              {roles.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">
                  No custom roles yet
                </p>
              ) : (
                roles.map((role) => (
                  <button
                    key={role.id}
                    onClick={() => {
                      setSelectedRole(role);
                      setSelectedBuiltin(null);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors ${
                      selectedRole?.id === role.id
                        ? "bg-primary/10 border border-primary/30"
                        : "hover:bg-slate-800/50 border border-transparent"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium text-white">
                        {role.name}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {role.description || "No description"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className="text-xs bg-slate-800"
                      >
                        {Object.keys(role.permissions).length} resources
                      </Badge>
                      <ChevronRight className="w-4 h-4 text-slate-600" />
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Panel — Permission Grid */}
        <div className="lg:col-span-8">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-primary" />
                <div>
                  <CardTitle>
                    {activeRole
                      ? activeRole.name
                      : selectedBuiltin || "Select a role"}
                  </CardTitle>
                  <p className="text-sm text-slate-400 mt-1">
                    {activeRole
                      ? activeRole.description || "Custom role"
                      : selectedBuiltin
                        ? BUILTIN_ROLES.find(
                            (r) => r.name === selectedBuiltin
                          )?.description
                        : "Select a role to view permissions"}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!activeRole && !selectedBuiltin ? (
                <div className="text-center py-12 text-slate-500">
                  <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Select a role to view its permission matrix</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-2 text-slate-400 font-normal pr-4">
                          Resource
                        </th>
                        {ACTIONS.map((action) => (
                          <th
                            key={action}
                            className="text-center py-2 text-slate-400 font-normal px-2 capitalize"
                          >
                            {action}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {RESOURCES.map((resource) => (
                        <tr
                          key={resource}
                          className="border-b border-slate-800/50"
                        >
                          <td className="py-2.5 text-slate-300 capitalize pr-4">
                            {resource.replace(/_/g, " ")}
                          </td>
                          {ACTIONS.map((action) => {
                            const hasPermission = activeRole
                              ? (
                                  activePermissions[resource] || []
                                ).includes(action)
                              : true; // Built-in roles show all as granted for display
                            return (
                              <td key={action} className="text-center py-2.5">
                                {selectedBuiltin && !activeRole ? (
                                  <span
                                    className={`inline-block w-3 h-3 rounded-full ${
                                      hasPermission
                                        ? "bg-green-500/60"
                                        : "bg-slate-700"
                                    }`}
                                  />
                                ) : (
                                  <span
                                    className={`inline-block w-3 h-3 rounded-full ${
                                      hasPermission
                                        ? "bg-green-500/60"
                                        : "bg-slate-700"
                                    }`}
                                  />
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeRole && (
                <div className="mt-4 flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500/60" />{" "}
                    Granted
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-700" />{" "}
                    Denied
                  </span>
                  <span className="ml-auto">
                    Created{" "}
                    {new Date(activeRole.createdAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create Role Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Custom Role</DialogTitle>
            <DialogDescription>
              Define a new role with specific permissions for your organization.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Role Name
              </label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Fleet Manager"
                className="bg-slate-800 border-slate-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Description
              </label>
              <Input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Optional description"
                className="bg-slate-800 border-slate-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">
                Permissions
              </label>
              <div className="overflow-x-auto border border-slate-800 rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 bg-slate-800/30">
                      <th className="text-left py-2 px-3 text-slate-400 font-normal">
                        Resource
                      </th>
                      {ACTIONS.map((action) => (
                        <th
                          key={action}
                          className="text-center py-2 px-2 text-slate-400 font-normal capitalize text-xs"
                        >
                          {action}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {RESOURCES.map((resource) => (
                      <tr
                        key={resource}
                        className="border-b border-slate-800/50"
                      >
                        <td className="py-2 px-3 text-slate-300 capitalize text-xs">
                          {resource.replace(/_/g, " ")}
                        </td>
                        {ACTIONS.map((action) => (
                          <td key={action} className="text-center py-2">
                            <button
                              onClick={() => togglePermission(resource, action)}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                (newPermissions[resource] || []).includes(action)
                                  ? "bg-primary"
                                  : "bg-slate-700"
                              }`}
                            >
                              <span
                                className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                                  (newPermissions[resource] || []).includes(
                                    action
                                  )
                                    ? "translate-x-5"
                                    : "translate-x-1"
                                }`}
                              />
                            </button>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="bg-primary hover:bg-primary/90 gap-2"
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
              >
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Role
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
