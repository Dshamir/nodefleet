"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { DetailDrawer, DrawerTabs } from "@/components/ui/detail-drawer";
import {
  Target,
  LayoutList,
  Columns3,
  ChevronLeft,
  ChevronRight,
  Search,
  Mail,
  Phone,
  User,
  Calendar,
  Star,
  DollarSign,
  FileText,
  StickyNote,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  status: string;
  score: number;
  value?: number;
  source: string;
  assignedTo?: string;
  notes?: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const PIPELINE_STAGES = [
  { key: "new", label: "New", dotColor: "bg-yellow-400" },
  { key: "contacted", label: "Contacted", dotColor: "bg-blue-400" },
  { key: "qualified", label: "Qualified", dotColor: "bg-cyan-400" },
  { key: "proposal", label: "Proposal", dotColor: "bg-purple-400" },
  { key: "negotiation", label: "Negotiation", dotColor: "bg-indigo-400" },
  { key: "won", label: "Won", dotColor: "bg-green-400" },
  { key: "lost", label: "Lost", dotColor: "bg-red-400" },
];

const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "proposal", label: "Proposal" },
  { value: "negotiation", label: "Negotiation" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

/* ------------------------------------------------------------------ */
/*  Pipeline Column                                                    */
/* ------------------------------------------------------------------ */

function PipelineColumn({
  stage,
  leads,
  onSelect,
}: {
  stage: (typeof PIPELINE_STAGES)[number];
  leads: Lead[];
  onSelect: (lead: Lead) => void;
}) {
  return (
    <div className="min-w-[240px] flex flex-col">
      {/* Column Header */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-slate-800/60 rounded-t-lg border border-slate-700/50 border-b-0">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${stage.dotColor}`} />
          <span className="text-sm font-semibold text-white">{stage.label}</span>
        </div>
        <span className="text-xs font-medium text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
          {leads.length}
        </span>
      </div>

      {/* Column Body */}
      <div className="flex-1 p-2 bg-slate-900/30 border border-slate-700/50 border-t-0 rounded-b-lg space-y-2 min-h-[200px]">
        {leads.length === 0 && (
          <p className="text-xs text-slate-600 text-center py-8">No leads</p>
        )}
        {leads.map((lead) => (
          <div
            key={lead.id}
            onClick={() => onSelect(lead)}
            className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 cursor-pointer hover:border-slate-600 hover:bg-slate-800/60 transition-all group"
          >
            <div className="text-sm font-medium text-white truncate group-hover:text-primary transition-colors">
              {lead.name}
            </div>
            <div className="text-xs text-slate-500 truncate mt-0.5">{lead.email}</div>
            <div className="flex items-center justify-between mt-2.5">
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 capitalize">
                {lead.source}
              </span>
              <div className="flex items-center gap-2">
                {lead.value != null && lead.value > 0 && (
                  <span className="text-[10px] text-green-400 font-medium">
                    ${lead.value.toLocaleString()}
                  </span>
                )}
                <span className="text-[10px] text-slate-400 font-medium">
                  {lead.score}pts
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Lead Detail Content                                                */
/* ------------------------------------------------------------------ */

function LeadDetail({ lead }: { lead: Lead }) {
  const [tab, setTab] = useState("details");

  return (
    <>
      <DrawerTabs
        tabs={[
          { id: "details", label: "Details", icon: <FileText className="w-3.5 h-3.5" /> },
          { id: "notes", label: "Notes", icon: <StickyNote className="w-3.5 h-3.5" /> },
        ]}
        active={tab}
        onChange={setTab}
      />

      <div className="p-6">
        {tab === "details" && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <DetailField icon={User} label="Name" value={lead.name} />
              <DetailField icon={Mail} label="Email" value={lead.email} />
              <DetailField icon={Phone} label="Phone" value={lead.phone || "--"} />
              <DetailField label="Source" value={lead.source} capitalize />
              <DetailField icon={Star} label="Score" value={String(lead.score)} />
              <DetailField
                icon={DollarSign}
                label="Value"
                value={lead.value != null ? `$${lead.value.toLocaleString()}` : "--"}
              />
              <DetailField label="Assigned To" value={lead.assignedTo || "--"} />
              <DetailField
                icon={Calendar}
                label="Created"
                value={new Date(lead.createdAt).toLocaleDateString()}
              />
            </div>
            <div>
              <span className="text-xs text-slate-500 uppercase tracking-wider">Stage</span>
              <div className="mt-1">
                <StatusBadge status={lead.status} />
              </div>
            </div>
          </div>
        )}

        {tab === "notes" && (
          <div>
            {lead.notes ? (
              <p className="text-sm text-slate-300 whitespace-pre-wrap">{lead.notes}</p>
            ) : (
              <p className="text-sm text-slate-500">No notes recorded for this lead.</p>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function DetailField({
  icon: Icon,
  label,
  value,
  capitalize: cap,
}: {
  icon?: React.ElementType;
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div>
      <span className="text-xs text-slate-500 uppercase tracking-wider">{label}</span>
      <p className={`text-sm text-slate-200 mt-1 flex items-center gap-1.5 ${cap ? "capitalize" : ""}`}>
        {Icon && <Icon className="w-3.5 h-3.5 text-slate-500" />}
        {value}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Leads Page                                                         */
/* ------------------------------------------------------------------ */

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "pipeline">("table");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const limit = 20;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (search.trim()) params.set("search", search.trim());

    fetch(`/api/crm/leads?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setLeads(data.data || []);
        setTotal(data.pagination?.total || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, statusFilter, search]);

  const totalPages = Math.ceil(total / limit);

  /* Pipeline data: group leads by stage */
  const pipelineData = PIPELINE_STAGES.map((stage) => ({
    stage,
    leads: leads.filter((l) => l.status === stage.key),
  }));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Target className="w-6 h-6 text-primary" /> Leads
          </h1>
          <p className="text-slate-400 text-sm mt-1">{total} total leads</p>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1.5 bg-slate-800/60 p-1 rounded-lg border border-slate-700/50">
          <button
            onClick={() => setViewMode("table")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === "table"
                ? "bg-primary text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <LayoutList className="w-4 h-4" />
            Table
          </button>
          <button
            onClick={() => setViewMode("pipeline")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === "pipeline"
                ? "bg-primary text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Columns3 className="w-4 h-4" />
            Pipeline
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <FilterTabs
          options={FILTER_OPTIONS}
          value={statusFilter}
          onChange={(val) => {
            setStatusFilter(val);
            setPage(1);
          }}
        />
        <div className="relative ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search leads..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9 pr-4 py-2 rounded-lg bg-slate-800/60 border border-slate-700/50 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 w-64"
          />
        </div>
      </div>

      {/* Table View */}
      {viewMode === "table" && (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="text-left text-xs text-slate-400 font-medium p-4">Name</th>
                    <th className="text-left text-xs text-slate-400 font-medium p-4">Email</th>
                    <th className="text-left text-xs text-slate-400 font-medium p-4">Source</th>
                    <th className="text-left text-xs text-slate-400 font-medium p-4">Stage</th>
                    <th className="text-right text-xs text-slate-400 font-medium p-4">Score</th>
                    <th className="text-right text-xs text-slate-400 font-medium p-4">Value</th>
                    <th className="text-left text-xs text-slate-400 font-medium p-4">Assigned To</th>
                    <th className="text-left text-xs text-slate-400 font-medium p-4">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-slate-800/50">
                        {Array.from({ length: 8 }).map((_, j) => (
                          <td key={j} className="p-4">
                            <div className="h-4 bg-slate-800 rounded w-20 animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : leads.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12">
                        <Target className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                        <p className="text-slate-400">No leads found</p>
                        <p className="text-slate-500 text-sm mt-1">
                          Leads will appear here as they are captured.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    leads.map((lead) => (
                      <tr
                        key={lead.id}
                        className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer transition-colors"
                        onClick={() => setSelectedLead(lead)}
                      >
                        <td className="p-4 text-sm text-white font-medium">{lead.name}</td>
                        <td className="p-4 text-sm text-slate-300">{lead.email}</td>
                        <td className="p-4 text-sm text-slate-400 capitalize">{lead.source}</td>
                        <td className="p-4">
                          <StatusBadge status={lead.status} />
                        </td>
                        <td className="p-4 text-right text-sm text-white font-medium">
                          {lead.score}
                        </td>
                        <td className="p-4 text-right text-sm text-green-400">
                          {lead.value != null ? `$${lead.value.toLocaleString()}` : "--"}
                        </td>
                        <td className="p-4 text-sm text-slate-400">
                          {lead.assignedTo || "--"}
                        </td>
                        <td className="p-4 text-sm text-slate-500">
                          {new Date(lead.createdAt).toLocaleDateString()}
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
                  Showing {(page - 1) * limit + 1}--{Math.min(page * limit, total)} of {total}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-xs text-slate-400 flex items-center px-2">
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
      )}

      {/* Pipeline View */}
      {viewMode === "pipeline" && (
        <div className="overflow-x-auto pb-4">
          {loading ? (
            <div className="flex gap-4">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="min-w-[240px] space-y-2">
                  <div className="h-10 bg-slate-800/50 rounded animate-pulse" />
                  <div className="h-40 bg-slate-800/30 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex gap-4">
              {pipelineData.map(({ stage, leads: stageLeads }) => (
                <PipelineColumn
                  key={stage.key}
                  stage={stage}
                  leads={stageLeads}
                  onSelect={setSelectedLead}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Detail Drawer */}
      <DetailDrawer
        open={!!selectedLead}
        onClose={() => setSelectedLead(null)}
        title={selectedLead?.name || ""}
        subtitle={selectedLead?.email}
        width="max-w-lg"
      >
        {selectedLead && <LeadDetail lead={selectedLead} />}
      </DetailDrawer>
    </div>
  );
}
