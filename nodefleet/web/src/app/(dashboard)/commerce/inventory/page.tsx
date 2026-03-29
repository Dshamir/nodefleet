"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { SearchInput } from "@/components/ui/search-input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Package,
  AlertTriangle,
  XCircle,
  BarChart3,
  PackagePlus,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";

/* ---------- Types ---------- */

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  stockQuantity: number;
  lowStockThreshold: number;
  trackInventory: boolean;
  updatedAt?: string;
}

/* ---------- Helpers ---------- */

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type FilterTab = "all" | "low-stock" | "out-of-stock";

/* ---------- StatCard ---------- */

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-500/15 text-blue-400",
    amber: "bg-amber-500/15 text-amber-400",
    red: "bg-red-500/15 text-red-400",
    green: "bg-green-500/15 text-green-400",
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-400">{title}</span>
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              colorMap[color] || colorMap.blue
            }`}
          >
            {icon}
          </div>
        </div>
        <div className="text-xl font-bold text-white">
          {value.toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Page ---------- */

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [restockItem, setRestockItem] = useState<InventoryItem | null>(null);

  const fetchInventory = useCallback(() => {
    setLoading(true);
    setError(false);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (activeFilter === "low-stock") params.set("lowStock", "true");
    if (activeFilter === "out-of-stock") params.set("outOfStock", "true");

    fetch(`/api/commerce/inventory?${params}`)
      .then((r) => r.json())
      .then((res) => setItems(res.data || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [search, activeFilter]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  /* Stats */
  const stats = useMemo(() => {
    const totalProducts = items.length;
    const lowStock = items.filter(
      (i) =>
        i.trackInventory &&
        i.stockQuantity > 0 &&
        i.stockQuantity <= i.lowStockThreshold
    ).length;
    const outOfStock = items.filter(
      (i) => i.trackInventory && i.stockQuantity <= 0
    ).length;
    const tracked = items.filter((i) => i.trackInventory).length;
    return { totalProducts, lowStock, outOfStock, tracked };
  }, [items]);

  /* Toggle tracking */
  const handleToggleTracking = async (item: InventoryItem) => {
    try {
      await fetch(`/api/commerce/inventory/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackInventory: !item.trackInventory }),
      });
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, trackInventory: !i.trackInventory }
            : i
        )
      );
    } catch {
      // silent
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Package className="w-6 h-6 text-primary" /> Inventory
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Track product stock levels and manage inventory
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Products"
          value={stats.totalProducts}
          icon={<Package className="w-4 h-4" />}
          color="blue"
        />
        <StatCard
          title="Low Stock"
          value={stats.lowStock}
          icon={<AlertTriangle className="w-4 h-4" />}
          color="amber"
        />
        <StatCard
          title="Out of Stock"
          value={stats.outOfStock}
          icon={<XCircle className="w-4 h-4" />}
          color="red"
        />
        <StatCard
          title="Tracked"
          value={stats.tracked}
          icon={<BarChart3 className="w-4 h-4" />}
          color="green"
        />
      </div>

      {/* Filter Tabs + Search */}
      <div className="flex flex-wrap items-center gap-3">
        <FilterTabs
          options={[
            { value: "all", label: "All" },
            { value: "low-stock", label: "Low Stock", count: stats.lowStock },
            {
              value: "out-of-stock",
              label: "Out of Stock",
              count: stats.outOfStock,
            },
          ]}
          value={activeFilter}
          onChange={(v) => setActiveFilter(v as FilterTab)}
        />
        <div className="flex-1 min-w-[200px] max-w-xs ml-auto">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by name or SKU..."
          />
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-12 text-slate-400">
          <Loader2 className="w-6 h-6 mx-auto animate-spin" />
          <p className="mt-2 text-sm">Loading inventory...</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <Card className="border-red-500/30">
          <CardContent className="p-4 text-red-400 text-sm">
            Failed to load inventory. Is the API running?
          </CardContent>
        </Card>
      )}

      {/* Table */}
      {!loading && !error && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-800">
                <tr>
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase px-4 py-3">
                    Product
                  </th>
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase px-4 py-3">
                    SKU
                  </th>
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase px-4 py-3">
                    Stock Qty
                  </th>
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase px-4 py-3">
                    Track
                  </th>
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase px-4 py-3">
                    Updated
                  </th>
                  <th className="text-right text-xs font-semibold text-slate-400 uppercase px-4 py-3">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="text-center py-12 text-slate-500"
                    >
                      <Package className="w-10 h-10 mx-auto mb-2 text-slate-700" />
                      No inventory items found.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const isLow =
                      item.trackInventory &&
                      item.stockQuantity > 0 &&
                      item.stockQuantity <= item.lowStockThreshold;
                    const isOut =
                      item.trackInventory && item.stockQuantity <= 0;

                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <span className="font-medium text-white text-sm">
                            {item.name}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-slate-400">
                          {item.sku || "-"}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              isOut
                                ? "destructive"
                                : isLow
                                ? "warning"
                                : "success"
                            }
                          >
                            {item.stockQuantity}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleToggleTracking(item)}
                            className="text-slate-400 hover:text-white transition-colors"
                            title={
                              item.trackInventory
                                ? "Tracking enabled"
                                : "Tracking disabled"
                            }
                          >
                            {item.trackInventory ? (
                              <Eye className="w-4 h-4 text-green-400" />
                            ) : (
                              <EyeOff className="w-4 h-4 text-slate-600" />
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {item.updatedAt ? formatDate(item.updatedAt) : "-"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setRestockItem(item)}
                            title="Restock / Adjust"
                          >
                            <PackagePlus className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Restock Dialog */}
      {restockItem && (
        <RestockDialog
          item={restockItem}
          onClose={() => setRestockItem(null)}
          onSuccess={() => {
            setRestockItem(null);
            fetchInventory();
          }}
        />
      )}
    </div>
  );
}

/* ---------- Restock Dialog ---------- */

function RestockDialog({
  item,
  onClose,
  onSuccess,
}: {
  item: InventoryItem;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [quantity, setQuantity] = useState(item.stockQuantity);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/commerce/inventory/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stockQuantity: quantity, reason: reason.trim() }),
      });
      if (res.ok) {
        onSuccess();
      }
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust Stock</DialogTitle>
          <DialogDescription>
            Update stock quantity for{" "}
            <span className="font-medium text-white">{item.name}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Current Stock</span>
            <Badge
              variant={
                item.stockQuantity <= 0
                  ? "destructive"
                  : item.stockQuantity <= item.lowStockThreshold
                  ? "warning"
                  : "success"
              }
            >
              {item.stockQuantity}
            </Badge>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              New Quantity
            </label>
            <Input
              type="number"
              min={0}
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Reason *
            </label>
            <Input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Restocked from supplier"
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !reason.trim()}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Stock"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
