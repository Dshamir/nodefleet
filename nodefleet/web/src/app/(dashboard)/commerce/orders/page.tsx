"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { DetailDrawer, DrawerTabs } from "@/components/ui/detail-drawer";
import { Button } from "@/components/ui/button";
import {
  ShoppingBag,
  Search,
  ChevronLeft,
  ChevronRight,
  Clock,
  Truck,
  CheckCircle2,
  DollarSign,
  Package,
  Loader2,
  AlertCircle,
  FileText,
  List,
  History,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrderItem {
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  total: number;
  material?: string;
}

interface StatusHistoryEntry {
  status: string;
  timestamp: string;
  changedBy: string;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus?: string;
  total: number;
  subtotal: number;
  tax: number;
  shippingCost: number;
  discount: number;
  refundAmount?: number;
  currency: string;
  customerId: string | null;
  customerEmail?: string;
  customerName?: string;
  items: OrderItem[];
  shippingAddress?: Record<string, string>;
  paymentGateway?: string;
  trackingNumber?: string;
  statusHistory: StatusHistoryEntry[];
  createdAt: string;
}

interface OrderStats {
  total: number;
  pending: number;
  processing: number;
  delivered: number;
  revenue: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: ["completed", "refunded"],
  completed: ["refunded"],
};

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
  { value: "refunded", label: "Refunded" },
];

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
// Orders Page
// ---------------------------------------------------------------------------

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [stats, setStats] = useState<OrderStats>({
    total: 0,
    pending: 0,
    processing: 0,
    delivered: 0,
    revenue: 0,
  });

  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  // Fetch orders
  const fetchOrders = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (search) params.set("search", search);

    fetch(`/api/commerce/orders?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch orders");
        return r.json();
      })
      .then((data) => {
        const items = data.data || [];
        setOrders(items);
        setTotal(data.pagination?.total || items.length);

        // Compute stats from available data
        const pending = items.filter((o: Order) => o.status === "pending").length;
        const processing = items.filter((o: Order) => o.status === "processing").length;
        const delivered = items.filter((o: Order) => o.status === "delivered").length;
        const revenue = items.reduce((sum: number, o: Order) => sum + (o.total || 0), 0);
        setStats({
          total: data.pagination?.total || items.length,
          pending,
          processing,
          delivered,
          revenue,
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, statusFilter, search]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Fetch single order for drawer
  const openOrderDrawer = useCallback((order: Order) => {
    setDrawerLoading(true);
    fetch(`/api/commerce/orders/${order.id}`)
      .then((r) => r.json())
      .then((data) => {
        setSelectedOrder(data.data || data || order);
      })
      .catch(() => {
        // Fallback to list data
        setSelectedOrder(order);
      })
      .finally(() => setDrawerLoading(false));
  }, []);

  // Status transition
  const handleStatusChange = useCallback(
    (orderId: string, newStatus: string) => {
      fetch(`/api/commerce/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
        .then((r) => {
          if (!r.ok) throw new Error("Failed to update status");
          return r.json();
        })
        .then((data) => {
          setSelectedOrder(data.data || data);
          fetchOrders();
        })
        .catch(() => {});
    },
    [fetchOrders]
  );

  const handleFilterChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ShoppingBag className="w-6 h-6 text-primary" /> Orders
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Manage customer orders and fulfillment
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard
          title="Total Orders"
          value={stats.total}
          icon={<ShoppingBag className="w-4 h-4" />}
        />
        <StatCard
          title="Pending"
          value={stats.pending}
          icon={<Clock className="w-4 h-4" />}
        />
        <StatCard
          title="Processing"
          value={stats.processing}
          icon={<Package className="w-4 h-4" />}
        />
        <StatCard
          title="Delivered"
          value={stats.delivered}
          icon={<Truck className="w-4 h-4" />}
        />
        <StatCard
          title="Revenue"
          value={formatCents(stats.revenue)}
          icon={<DollarSign className="w-4 h-4" />}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <FilterTabs
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={handleFilterChange}
        />
        <div className="relative ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search order # or customer..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9 pr-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 w-72"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Orders Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left text-xs text-slate-400 font-medium p-4 uppercase tracking-wide">
                    Order
                  </th>
                  <th className="text-left text-xs text-slate-400 font-medium p-4 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="text-left text-xs text-slate-400 font-medium p-4 uppercase tracking-wide">
                    Customer
                  </th>
                  <th className="text-center text-xs text-slate-400 font-medium p-4 uppercase tracking-wide">
                    Items
                  </th>
                  <th className="text-right text-xs text-slate-400 font-medium p-4 uppercase tracking-wide">
                    Total
                  </th>
                  <th className="text-left text-xs text-slate-400 font-medium p-4 uppercase tracking-wide">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-800/50">
                      <td className="p-4">
                        <div className="h-4 bg-slate-800 rounded w-24 animate-pulse" />
                      </td>
                      <td className="p-4">
                        <div className="h-4 bg-slate-800 rounded w-20 animate-pulse" />
                      </td>
                      <td className="p-4">
                        <div className="h-4 bg-slate-800 rounded w-32 animate-pulse" />
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
                    </tr>
                  ))
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-16">
                      <ShoppingBag className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                      <p className="text-slate-400 font-medium">No orders found</p>
                      <p className="text-slate-500 text-sm mt-1">
                        {statusFilter !== "all" || search
                          ? "Try adjusting your filters"
                          : "Orders will appear here when customers place them"}
                      </p>
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer transition-colors"
                      onClick={() => openOrderDrawer(order)}
                    >
                      <td className="p-4 text-sm text-white font-mono font-medium">
                        {order.orderNumber}
                      </td>
                      <td className="p-4">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="p-4 text-sm text-slate-300">
                        {order.customerName || order.customerEmail || "Guest"}
                      </td>
                      <td className="p-4 text-sm text-slate-400 text-center">
                        {order.items?.length || 0}
                      </td>
                      <td className="p-4 text-right text-sm text-white font-medium">
                        {formatCents(order.total)}{" "}
                        <span className="text-slate-500 text-xs">
                          {order.currency}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-slate-400">
                        {formatDate(order.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-slate-800">
              <span className="text-xs text-slate-500">
                Showing {(page - 1) * limit + 1}-
                {Math.min(page * limit, total)} of {total}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs text-slate-400">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Drawer */}
      <OrderDetailDrawer
        order={selectedOrder}
        loading={drawerLoading}
        onClose={() => setSelectedOrder(null)}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Order Detail Drawer
// ---------------------------------------------------------------------------

function OrderDetailDrawer({
  order,
  loading,
  onClose,
  onStatusChange,
}: {
  order: Order | null;
  loading: boolean;
  onClose: () => void;
  onStatusChange: (orderId: string, status: string) => void;
}) {
  const [activeTab, setActiveTab] = useState("details");

  const tabs = [
    { id: "details", label: "Details", icon: <FileText className="w-3.5 h-3.5" /> },
    { id: "items", label: "Items", icon: <List className="w-3.5 h-3.5" /> },
    { id: "timeline", label: "Timeline", icon: <History className="w-3.5 h-3.5" /> },
  ];

  const validTransitions = order ? STATUS_TRANSITIONS[order.status] || [] : [];

  return (
    <DetailDrawer
      open={!!order}
      onClose={onClose}
      title={order?.orderNumber || "Loading..."}
      subtitle={order ? `${order.status} - ${formatDate(order.createdAt)}` : undefined}
      width="max-w-2xl"
    >
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
        </div>
      ) : order ? (
        <>
          <DrawerTabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

          <div className="p-6">
            {activeTab === "details" && (
              <DetailsTab
                order={order}
                validTransitions={validTransitions}
                onStatusChange={(status) => onStatusChange(order.id, status)}
              />
            )}
            {activeTab === "items" && <ItemsTab items={order.items || []} />}
            {activeTab === "timeline" && (
              <TimelineTab history={order.statusHistory || []} />
            )}
          </div>
        </>
      ) : null}
    </DetailDrawer>
  );
}

// ---------------------------------------------------------------------------
// Details Tab
// ---------------------------------------------------------------------------

function DetailsTab({
  order,
  validTransitions,
  onStatusChange,
}: {
  order: Order;
  validTransitions: string[];
  onStatusChange: (status: string) => void;
}) {
  const shippingAddr = order.shippingAddress
    ? Object.values(order.shippingAddress).filter(Boolean).join(", ")
    : "N/A";

  return (
    <div className="space-y-6">
      {/* Order Info */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
          Order Information
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <FieldItem label="Order Number" value={order.orderNumber} />
          <FieldItem label="Status">
            <StatusBadge status={order.status} />
          </FieldItem>
          <FieldItem label="Customer" value={order.customerName || order.customerEmail || "Guest"} />
          <FieldItem label="Payment Status">
            <StatusBadge status={order.paymentStatus || "pending"} />
          </FieldItem>
          <FieldItem label="Payment Gateway" value={order.paymentGateway || "N/A"} />
          <FieldItem label="Tracking Number" value={order.trackingNumber || "N/A"} />
        </div>
      </div>

      {/* Addresses */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
          Shipping Address
        </h3>
        <p className="text-sm text-slate-300">{shippingAddr}</p>
      </div>

      {/* Financial Summary */}
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
          Payment Summary
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-slate-400">
            <span>Subtotal</span>
            <span className="text-slate-300">{formatCents(order.subtotal || 0)}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Tax</span>
            <span className="text-slate-300">{formatCents(order.tax || 0)}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Shipping</span>
            <span className="text-slate-300">{formatCents(order.shippingCost || 0)}</span>
          </div>
          {(order.discount || 0) > 0 && (
            <div className="flex justify-between text-green-400">
              <span>Discount</span>
              <span>-{formatCents(order.discount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-white pt-2 border-t border-slate-700">
            <span>Total</span>
            <span>{formatCents(order.total)}</span>
          </div>
          {(order.refundAmount || 0) > 0 && (
            <div className="flex justify-between text-orange-400 pt-1">
              <span>Refunded</span>
              <span>-{formatCents(order.refundAmount!)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Status Transitions */}
      {validTransitions.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Update Status
          </h3>
          <div className="flex gap-2 flex-wrap">
            {validTransitions.map((status) => (
              <Button
                key={status}
                variant={status === "cancelled" ? "destructive" : "outline"}
                size="sm"
                onClick={() => onStatusChange(status)}
                className="capitalize"
              >
                {status === "confirmed" && <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />}
                {status === "processing" && <Package className="w-3.5 h-3.5 mr-1.5" />}
                {status === "shipped" && <Truck className="w-3.5 h-3.5 mr-1.5" />}
                {status === "delivered" && <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />}
                {status}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Field Item
// ---------------------------------------------------------------------------

function FieldItem({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
      {children ? (
        <div className="mt-1">{children}</div>
      ) : (
        <p className="text-sm text-slate-300 mt-1">{value}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Items Tab
// ---------------------------------------------------------------------------

function ItemsTab({ items }: { items: OrderItem[] }) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400">No items in this order</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="text-left px-3 py-2 text-xs font-medium text-slate-400 uppercase tracking-wide">
              Product
            </th>
            <th className="text-left px-3 py-2 text-xs font-medium text-slate-400 uppercase tracking-wide">
              SKU
            </th>
            <th className="text-right px-3 py-2 text-xs font-medium text-slate-400 uppercase tracking-wide">
              Qty
            </th>
            <th className="text-right px-3 py-2 text-xs font-medium text-slate-400 uppercase tracking-wide">
              Unit Price
            </th>
            <th className="text-right px-3 py-2 text-xs font-medium text-slate-400 uppercase tracking-wide">
              Total
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {items.map((item, index) => (
            <tr key={index} className="hover:bg-slate-800/30 transition-colors">
              <td className="px-3 py-2.5 text-white font-medium">
                {item.productName}
              </td>
              <td className="px-3 py-2.5 text-slate-400 font-mono text-xs">
                {item.sku}
              </td>
              <td className="px-3 py-2.5 text-slate-300 text-right">
                {item.quantity}
              </td>
              <td className="px-3 py-2.5 text-slate-300 text-right">
                {formatCents(item.unitPrice)}
              </td>
              <td className="px-3 py-2.5 text-white font-medium text-right">
                {formatCents(item.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Timeline Tab
// ---------------------------------------------------------------------------

function TimelineTab({
  history,
}: {
  history: StatusHistoryEntry[];
}) {
  if (history.length === 0) {
    return (
      <div className="text-center py-12">
        <History className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400">No status history available</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-3 top-3 bottom-3 w-px bg-slate-700" />

      <div className="space-y-4">
        {history.map((entry, index) => (
          <div key={index} className="flex items-start gap-4 relative">
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

            <div className="flex-1 pb-1">
              <div className="flex items-center gap-2">
                <StatusBadge status={entry.status} />
                <span className="text-xs text-slate-500">
                  by {entry.changedBy}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {formatDateTime(entry.timestamp)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
