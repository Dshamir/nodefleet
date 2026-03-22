"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Image,
  Video,
  Music,
  FileText,
  Upload,
  Download,
  Trash2,
  Grid,
  List,
  Loader2,
} from "lucide-react";

interface ContentItem {
  id: string;
  type: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  s3Key: string;
  deviceId: string | null;
  uploadedAt: string;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffSeconds < 60) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffWeeks < 5) return `${diffWeeks}w ago`;
  return `${diffMonths}mo ago`;
}

function deriveType(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "document";
}

export default function ContentLibraryPage() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchContent() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/content");
        if (!res.ok) throw new Error("Failed to fetch content");
        const data = await res.json();
        setContentItems(data.data || data);
      } catch (err: any) {
        setError(err.message || "Failed to load content");
      } finally {
        setLoading(false);
      }
    }
    fetchContent();
  }, []);

  const typeIcons: Record<string, React.ReactNode> = {
    image: <Image className="w-4 h-4" />,
    video: <Video className="w-4 h-4" />,
    audio: <Music className="w-4 h-4" />,
    document: <FileText className="w-4 h-4" />,
  };

  const typeLabels: Record<string, string> = {
    image: "Image",
    video: "Video",
    audio: "Audio",
    document: "Document",
  };

  const filteredItems = contentItems.filter((item) => {
    const itemType = deriveType(item.mimeType);
    const matchesType = typeFilter === "all" || itemType === typeFilter;
    const matchesSearch =
      search === "" ||
      item.filename.toLowerCase().includes(search.toLowerCase()) ||
      item.originalFilename.toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });

  const toggleSelection = (id: string) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Content Library</h1>
          <p className="text-slate-400">Manage your device media and files</p>
        </div>
        <Button className="bg-primary hover:bg-primary-dark gap-2">
          <Upload className="w-5 h-5" />
          Upload Files
        </Button>
      </div>

      {/* Upload Area */}
      <Card className="bg-slate-900/50 border-slate-800 border-2 border-dashed hover:border-primary/50 transition-colors cursor-pointer">
        <CardContent className="pt-12 pb-12 text-center">
          <Upload className="w-12 h-12 mx-auto mb-4 text-slate-400" />
          <h3 className="text-lg font-medium text-white mb-2">
            Drag and drop files here
          </h3>
          <p className="text-slate-400 text-sm mb-4">
            or click to browse from your computer
          </p>
          <p className="text-xs text-slate-500">
            Supported: Images (JPG, PNG), Videos (MP4, MOV), Audio (WAV, MP3), Documents (PDF)
          </p>
        </CardContent>
      </Card>

      {/* Filters and Actions */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between flex-col md:flex-row gap-4">
            <div className="flex items-center gap-4 flex-1">
              <Input
                placeholder="Search files..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64 bg-slate-800 border-slate-700"
              />
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-48 bg-slate-800 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="image">Images</SelectItem>
                  <SelectItem value="video">Videos</SelectItem>
                  <SelectItem value="audio">Audio</SelectItem>
                  <SelectItem value="document">Documents</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              {selectedItems.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Selected
                </Button>
              )}
              <div className="flex gap-1 border border-slate-700 rounded-lg p-1">
                <Button
                  size="sm"
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  onClick={() => setViewMode("grid")}
                  className="gap-2"
                >
                  <Grid className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === "list" ? "default" : "ghost"}
                  onClick={() => setViewMode("list")}
                  className="gap-2"
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-3 text-slate-400">Loading content...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card className="bg-red-900/20 border-red-800">
          <CardContent className="pt-6 text-center">
            <p className="text-red-400">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && !error && filteredItems.length === 0 && (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="pt-12 pb-12 text-center">
            <FileText className="w-12 h-12 mx-auto mb-4 text-slate-600" />
            <p className="text-slate-400 text-lg">No content found</p>
            <p className="text-slate-500 text-sm mt-1">
              Upload files or adjust your filters
            </p>
          </CardContent>
        </Card>
      )}

      {/* Content Grid */}
      {!loading && !error && filteredItems.length > 0 && (
        <>
          {viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map((item) => {
                const itemType = deriveType(item.mimeType);
                return (
                  <Card
                    key={item.id}
                    className={`bg-slate-900/50 border-slate-800 cursor-pointer transition-all hover:border-primary/50 ${
                      selectedItems.includes(item.id)
                        ? "ring-2 ring-primary"
                        : ""
                    }`}
                    onClick={() => toggleSelection(item.id)}
                  >
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-slate-800 rounded-lg flex items-center justify-center text-primary">
                          {typeIcons[itemType]}
                        </div>
                        {selectedItems.includes(item.id) && (
                          <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                            <span className="text-white text-sm">✓</span>
                          </div>
                        )}
                      </div>
                      <h3 className="font-medium text-white mb-2 truncate">
                        {item.originalFilename || item.filename}
                      </h3>
                      <div className="space-y-2 text-sm">
                        <Badge variant="secondary" className="text-xs">
                          {typeLabels[itemType]}
                        </Badge>
                        <p className="text-slate-400">{formatFileSize(item.size)}</p>
                        <p className="text-slate-500">
                          {item.deviceId || "Unknown"}
                        </p>
                        <p className="text-slate-500 text-xs">
                          {formatRelativeTime(item.uploadedAt)}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-4 gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="bg-slate-900/50 border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/30">
                      <th className="px-6 py-3 text-left">
                        <input
                          type="checkbox"
                          className="rounded cursor-pointer"
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedItems(filteredItems.map((i) => i.id));
                            } else {
                              setSelectedItems([]);
                            }
                          }}
                          checked={
                            filteredItems.length > 0 &&
                            selectedItems.length === filteredItems.length
                          }
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-medium text-slate-300">
                        Filename
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-medium text-slate-300">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-medium text-slate-300">
                        Size
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-medium text-slate-300">
                        Device
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-medium text-slate-300">
                        Date
                      </th>
                      <th className="px-6 py-3 text-right text-sm font-medium text-slate-300">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredItems.map((item) => {
                      const itemType = deriveType(item.mimeType);
                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-slate-900/30 transition-colors"
                        >
                          <td className="px-6 py-3">
                            <input
                              type="checkbox"
                              className="rounded cursor-pointer"
                              checked={selectedItems.includes(item.id)}
                              onChange={() => toggleSelection(item.id)}
                            />
                          </td>
                          <td className="px-6 py-3 text-white">
                            {item.originalFilename || item.filename}
                          </td>
                          <td className="px-6 py-3">
                            <Badge variant="secondary" className="text-xs gap-1">
                              {typeIcons[itemType]}
                              {typeLabels[itemType]}
                            </Badge>
                          </td>
                          <td className="px-6 py-3 text-slate-400 text-sm">
                            {formatFileSize(item.size)}
                          </td>
                          <td className="px-6 py-3 text-slate-400 text-sm">
                            {item.deviceId || "Unknown"}
                          </td>
                          <td className="px-6 py-3 text-slate-400 text-sm">
                            {formatRelativeTime(item.uploadedAt)}
                          </td>
                          <td className="px-6 py-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-2 text-primary hover:text-primary-light"
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Item Count */}
      {!loading && !error && (
        <p className="text-sm text-slate-400">
          Showing {filteredItems.length} of {contentItems.length} files
          {selectedItems.length > 0 && ` • ${selectedItems.length} selected`}
        </p>
      )}
    </div>
  );
}
