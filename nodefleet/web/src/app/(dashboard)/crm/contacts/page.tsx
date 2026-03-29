"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, ChevronLeft, ChevronRight } from "lucide-react";

interface Contact {
  id: string;
  name: string;
  email: string;
  status: string;
  tags: string[];
  createdAt: string;
}

const statusColors: Record<string, string> = {
  active: "bg-green-500/20 text-green-400",
  inactive: "bg-slate-500/20 text-slate-400",
  prospect: "bg-blue-500/20 text-blue-400",
  customer: "bg-purple-500/20 text-purple-400",
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });

    fetch(`/api/crm/contacts?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setContacts(data.data || []);
        setTotal(data.pagination?.total || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Users className="w-6 h-6 text-primary" /> Contacts
        </h1>
        <p className="text-slate-400 text-sm mt-1">{total} total contacts</p>
      </div>

      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left text-xs text-slate-400 font-medium p-4">Name</th>
                  <th className="text-left text-xs text-slate-400 font-medium p-4">Email</th>
                  <th className="text-left text-xs text-slate-400 font-medium p-4">Status</th>
                  <th className="text-left text-xs text-slate-400 font-medium p-4">Tags</th>
                  <th className="text-left text-xs text-slate-400 font-medium p-4">Created</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-800/50">
                      <td className="p-4"><div className="h-4 bg-slate-800 rounded w-28 animate-pulse" /></td>
                      <td className="p-4"><div className="h-4 bg-slate-800 rounded w-36 animate-pulse" /></td>
                      <td className="p-4"><div className="h-4 bg-slate-800 rounded w-16 animate-pulse" /></td>
                      <td className="p-4"><div className="h-4 bg-slate-800 rounded w-20 animate-pulse" /></td>
                      <td className="p-4"><div className="h-4 bg-slate-800 rounded w-20 animate-pulse" /></td>
                    </tr>
                  ))
                ) : contacts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12">
                      <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                      <p className="text-slate-400">No contacts yet</p>
                      <p className="text-slate-500 text-sm mt-1">Contacts will appear here once added.</p>
                    </td>
                  </tr>
                ) : (
                  contacts.map((contact) => (
                    <tr
                      key={contact.id}
                      className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer"
                      onClick={() => (window.location.href = `/crm/contacts/${contact.id}`)}
                    >
                      <td className="p-4 text-sm text-white font-medium">{contact.name}</td>
                      <td className="p-4 text-sm text-slate-300">{contact.email}</td>
                      <td className="p-4">
                        <Badge className={`capitalize ${statusColors[contact.status] || "bg-slate-500/20 text-slate-400"}`}>
                          {contact.status}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-1 flex-wrap">
                          {(contact.tags || []).slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs border-slate-700 text-slate-300">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="p-4 text-sm text-slate-400">
                        {new Date(contact.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {total > 20 && (
            <div className="flex items-center justify-between p-4 border-t border-slate-800">
              <span className="text-xs text-slate-500">Page {page} of {Math.ceil(total / 20)}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page * 20 >= total} onClick={() => setPage(page + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
