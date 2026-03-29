"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { DetailDrawer, DrawerTabs } from "@/components/ui/detail-drawer";
import { Button } from "@/components/ui/button";
import {
  Users,
  Search,
  UserPlus,
  DollarSign,
  ShoppingBag,
  Loader2,
  AlertCircle,
  User,
  Mail,
  Building2,
  Tag,
  X,
  Clock,
  Activity,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Customer {
  id: string;
  name: string;
  email: string;
  company?: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  tags: string[];
  notes?: string;
  orderCount: number;
  totalSpent: number;
  createdAt: string;
  updatedAt?: string;
}

interface CustomerOrder {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
}

interface CustomerActivity {
  id: string;
  action: string;
  description?: string;
  timestamp: string;
}

interface CustomerStats {
  total: number;
  newThisMonth: number;
  totalRevenue: number;
  avgOrderValue: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCents(cents: number): string {
  return "$" + (cents / 100).toFixed(2);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
            {title}
          </span>
          <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400">
            {icon}
          </div>
        </div>
        <div className="text-xl font-bold text-white">
          {typeof value === "number" ? value.toLocaleString() : value}
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Customers Page
// ---------------------------------------------------------------------------

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [stats, setStats] = useState<CustomerStats>({
    total: 0,
    newThisMonth: 0,
    totalRevenue: 0,
    avgOrderValue: 0,
  });

  // Fetch customers
  const fetchCustomers = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (search) params.set("search", search);

    fetch(`/api/commerce/customers?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch customers");
        return r.json();
      })
      .then((data) => {
        const items: Customer[] = data.data || [];
        setCustomers(items);

        // Compute stats
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const newThisMonth = items.filter(
          (c) => new Date(c.createdAt) >= monthStart
        ).length;
        const totalRevenue = items.reduce((sum, c) => sum + (c.totalSpent || 0), 0);
        const avgOrder =
          items.length > 0
            ? Math.round(
                totalRevenue /
                  Math.max(
                    items.reduce((sum, c) => sum + (c.orderCount || 0), 0),
                    1
                  )
              )
            : 0;

        setStats({
          total: data.pagination?.total || items.length,
          newThisMonth,
          totalRevenue,
          avgOrderValue: avgOrder,
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Open customer drawer
  const openCustomerDrawer = useCallback((customer: Customer) => {
    setDrawerLoading(true);
    fetch(`/api/commerce/customers/${customer.id}`)
      .then((r) => r.json())
      .then((data) => {
        setSelectedCustomer(data.data || data || customer);
      })
      .catch(() => {
        setSelectedCustomer(customer);
      })
      .finally(() => setDrawerLoading(false));
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Users className="w-6 h-6 text-primary" /> Customers
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Manage customer profiles, order history, and lifetime value
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Customers"
          value={stats.total}
          icon={<Users className="w-4 h-4" />}
        />
        <StatCard
          title="New This Month"
          value={stats.newThisMonth}
          icon={<UserPlus className="w-4 h-4" />}
        />
        <StatCard
          title="Total Revenue"
          value={formatCents(stats.totalRevenue)}
          icon={<DollarSign className="w-4 h-4" />}
        />
        <StatCard
          title="Avg Order Value"
          value={formatCents(stats.avgOrderValue)}
          icon={<ShoppingBag className="w-4 h-4" />}
        />
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          placeholder="Search by name, email, or company..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Customers Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left text-xs text-slate-400 font-medium p-4 uppercase tracking-wide">
                    Name
                  </th>
                  <th className="text-left text-xs text-slate-400 font-medium p-4 uppercase tracking-wide">
                    Email
                  </th>
                  <th className="text-left text-xs text-slate-400 font-medium p-4 uppercase tracking-wide">
                    Company
                  </th>
                  <th className="text-center text-xs text-slate-400 font-medium p-4 uppercase tracking-wide">
                    Orders
                  </th>
                  <th className="text-right text-xs text-slate-400 font-medium p-4 uppercase tracking-wide">
                    Total Spent
                  </th>
                  <th className="text-left text-xs text-slate-400 font-medium p-4 uppercase tracking-wide">
                    Tags
                  </th>
                  <th className="text-left text-xs text-slate-400 font-medium p-4 uppercase tracking-wide">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-800/50">
                      <td className="p-4">
                        <div className="h-4 bg-slate-800 rounded w-28 animate-pulse" />
                      </td>
                      <td className="p-4">
                        <div className="h-4 bg-slate-800 rounded w-36 animate-pulse" />
                      </td>
                      <td className="p-4">
                        <div className="h-4 bg-slate-800 rounded w-24 animate-pulse" />
                      </td>
                      <td className="p-4">
                        <div className="h-4 bg-slate-800 rounded w-8 mx-auto animate-pulse" />
                      </td>
                      <td className="p-4">
                        <div className="h-4 bg-slate-800 rounded w-16 ml-auto animate-pulse" />
                      </td>
                      <td className="p-4">
                        <div className="h-4 bg-slate-800 rounded w-20 animate-pulse" />
                      </td>
                      <td className="p-4">
                        <div className="h-4 bg-slate-800 rounded w-20 animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : customers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-16">
                      <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                      <p className="text-slate-400 font-medium">No customers found</p>
                      <p className="text-slate-500 text-sm mt-1">
                        {search
                          ? "Try adjusting your search terms"
                          : "Customers will appear here as they register"}
                      </p>
                    </td>
                  </tr>
                ) : (
                  customers.map((customer) => (
                    <tr
                      key={customer.id}
                      className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer transition-colors"
                      onClick={() => openCustomerDrawer(customer)}
                    >
                      <td className="p-4 text-sm text-white font-medium">
                        {customer.name}
                      </td>
                      <td className="p-4 text-sm text-slate-400">
                        {customer.email}
                      </td>
                      <td className="p-4 text-sm text-slate-400">
                        {customer.company || "-"}
                      </td>
                      <td className="p-4 text-sm text-slate-300 text-center">
                        {customer.orderCount}
                      </td>
                      <td className="p-4 text-right text-sm text-white font-medium">
                        {formatCents(customer.totalSpent)}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {customer.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded text-xs border border-slate-700"
                            >
                              {tag}
                            </span>
                          ))}
                          {customer.tags.length > 3 && (
                            <span className="px-1.5 py-0.5 text-slate-500 text-xs">
                              +{customer.tags.length - 3}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-sm text-slate-400">
                        {formatDate(customer.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Detail Drawer */}
      <CustomerDetailDrawer
        customer={selectedCustomer}
        loading={drawerLoading}
        onClose={() => setSelectedCustomer(null)}
        onUpdate={fetchCustomers}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Customer Detail Drawer
// ---------------------------------------------------------------------------

function CustomerDetailDrawer({
  customer,
  loading,
  onClose,
  onUpdate,
}: {
  customer: Customer | null;
  loading: boolean;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const [activeTab, setActiveTab] = useState("profile");

  const tabs = [
    { id: "profile", label: "Profile", icon: <User className="w-3.5 h-3.5" /> },
    { id: "orders", label: "Orders", icon: <ShoppingBag className="w-3.5 h-3.5" /> },
    { id: "activity", label: "Activity", icon: <Activity className="w-3.5 h-3.5" /> },
  ];

  return (
    <DetailDrawer
      open={!!customer}
      onClose={onClose}
      title={customer?.name || "Loading..."}
      subtitle={customer?.email}
      width="max-w-2xl"
    >
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
        </div>
      ) : customer ? (
        <>
          <DrawerTabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

          <div className="p-6">
            {activeTab === "profile" && (
              <ProfileTab customer={customer} onUpdate={onUpdate} />
            )}
            {activeTab === "orders" && (
              <OrdersTab customerId={customer.id} />
            )}
            {activeTab === "activity" && (
              <ActivityTab customerId={customer.id} />
            )}
          </div>
        </>
      ) : null}
    </DetailDrawer>
  );
}

// ---------------------------------------------------------------------------
// Profile Tab
// ---------------------------------------------------------------------------

function ProfileTab({
  customer,
  onUpdate,
}: {
  customer: Customer;
  onUpdate: () => void;
}) {
  const [newTag, setNewTag] = useState("");
  const [tags, setTags] = useState<string[]>(customer.tags || []);
  const [notes, setNotes] = useState(customer.notes || "");
  const [saving, setSaving] = useState(false);

  const address = customer.address
    ? [
        customer.address.street,
        customer.address.city,
        customer.address.state,
        customer.address.zip,
        customer.address.country,
      ]
        .filter(Boolean)
        .join(", ")
    : "No address on file";

  const handleAddTag = () => {
    const tag = newTag.trim();
    if (tag && !tags.includes(tag)) {
      const updated = [...tags, tag];
      setTags(updated);
      setNewTag("");
      saveCustomer({ tags: updated });
    }
  };

  const handleRemoveTag = (tag: string) => {
    const updated = tags.filter((t) => t !== tag);
    setTags(updated);
    saveCustomer({ tags: updated });
  };

  const handleSaveNotes = () => {
    saveCustomer({ notes });
  };

  const saveCustomer = (payload: Record<string, unknown>) => {
    setSaving(true);
    fetch(`/api/commerce/customers/${customer.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to update");
        onUpdate();
      })
      .catch(() => {})
      .finally(() => setSaving(false));
  };

  return (
    <div className="space-y-6">
      {/* Customer Info */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
          Customer Information
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Name</p>
            <p className="text-sm text-slate-300 mt-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-500" />
              {customer.name}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Email</p>
            <p className="text-sm text-slate-300 mt-1 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-500" />
              {customer.email}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Company</p>
            <p className="text-sm text-slate-300 mt-1 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              {customer.company || "N/A"}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Phone</p>
            <p className="text-sm text-slate-300 mt-1">
              {customer.phone || "N/A"}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Orders</p>
            <p className="text-sm text-white mt-1 font-medium">
              {customer.orderCount}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Total Spent</p>
            <p className="text-sm text-white mt-1 font-medium">
              {formatCents(customer.totalSpent)}
            </p>
          </div>
        </div>
      </div>

      {/* Address */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
          Address
        </h3>
        <p className="text-sm text-slate-300">{address}</p>
      </div>

      {/* Tags */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
          Tags
        </h3>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {tags.length === 0 && (
            <span className="text-sm text-slate-500">No tags</span>
          )}
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-xs border border-slate-700"
            >
              <Tag className="w-3 h-3 text-slate-500" />
              {tag}
              <button
                onClick={() => handleRemoveTag(tag)}
                className="text-slate-500 hover:text-red-400 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddTag();
            }}
            placeholder="Add tag..."
            className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddTag}
            disabled={!newTag.trim() || saving}
          >
            Add
          </Button>
        </div>
      </div>

      {/* Notes */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
          Notes
        </h3>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes about this customer..."
          rows={3}
          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
        />
        <div className="flex justify-end mt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveNotes}
            disabled={notes === (customer.notes || "") || saving}
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
            ) : null}
            Save Notes
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Orders Tab
// ---------------------------------------------------------------------------

function OrdersTab({ customerId }: { customerId: string }) {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(`/api/commerce/customers/${customerId}/orders`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => setOrders(data.data || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [customerId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
        <AlertCircle className="w-4 h-4" />
        Failed to load orders
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-12">
        <ShoppingBag className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400">No orders found for this customer</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {orders.map((order) => (
        <div
          key={order.id}
          className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50 hover:bg-slate-800 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white font-mono">
                {order.orderNumber}
              </span>
              <StatusBadge status={order.status} />
            </div>
            <span className="text-sm font-medium text-white">
              {formatCents(order.total)}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1.5">
            <Clock className="w-3 h-3 inline mr-1" />
            {formatDate(order.createdAt)}
          </p>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity Tab
// ---------------------------------------------------------------------------

function ActivityTab({ customerId }: { customerId: string }) {
  const [activities, setActivities] = useState<CustomerActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(`/api/commerce/customers/${customerId}/activity`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => setActivities(data.data || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [customerId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
        <AlertCircle className="w-4 h-4" />
        Failed to load activity
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-12">
        <Activity className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400">No activity recorded</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-3 top-3 bottom-3 w-px bg-slate-700" />

      <div className="space-y-4">
        {activities.map((activity, index) => (
          <div key={activity.id || index} className="flex items-start gap-4 relative">
            {/* Dot */}
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${
                index === 0
                  ? "bg-primary text-white"
                  : "bg-slate-800 border-2 border-slate-600"
              }`}
            >
              {index === 0 && (
                <div className="w-2 h-2 rounded-full bg-white" />
              )}
            </div>

            <div className="flex-1">
              <p className="text-sm text-white font-medium">{activity.action}</p>
              {activity.description && (
                <p className="text-xs text-slate-400 mt-0.5">{activity.description}</p>
              )}
              <p className="text-xs text-slate-500 mt-1">
                {formatDateTime(activity.timestamp)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
