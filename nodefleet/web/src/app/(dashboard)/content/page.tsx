"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Image,
  Film,
  Music,
  File,
  Upload,
  Trash2,
  X,
  Search,
  Loader2,
  Eye,
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

interface PresignedUrls {
  [id: string]: string;
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

const typeIcons: Record<string, React.ReactNode> = {
  image: <Image className="w-5 h-5" />,
  video: <Film className="w-5 h-5" />,
  audio: <Music className="w-5 h-5" />,
  document: <File className="w-5 h-5" />,
};

const typeLabels: Record<string, string> = {
  image: "Image",
  video: "Video",
  audio: "Audio",
  document: "Document",
};

export default function ContentLibraryPage() {
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [presignedUrls, setPresignedUrls] = useState<PresignedUrls>({});
  const [previewItem, setPreviewItem] = useState<ContentItem | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchContent = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/content");
      if (!res.ok) throw new Error("Failed to fetch content");
      const data = await res.json();
      const items: ContentItem[] = data.data || data;
      setContentItems(items);
      // Batch fetch presigned URLs for media items
      await fetchPresignedUrls(items);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load content";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  async function fetchPresignedUrls(items: ContentItem[]) {
    const mediaItems = items.filter((item) => {
      const t = deriveType(item.mimeType);
      return t === "image" || t === "video" || t === "audio";
    });
    const urls: PresignedUrls = {};
    await Promise.allSettled(
      mediaItems.map(async (item) => {
        try {
          const res = await fetch(`/api/content/${item.id}`);
          if (res.ok) {
            const data = await res.json();
            if (data.downloadUrl) {
              urls[item.id] = data.downloadUrl;
            }
          }
        } catch {
          // skip failed URLs
        }
      })
    );
    setPresignedUrls(urls);
  }

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  const handleUpload = async (file: globalThis.File) => {
    try {
      setUploading(true);
      setError(null);

      // Step 1: Get presigned upload URL
      const uploadRes = await fetch("/api/content/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          size: file.size,
        }),
      });
      if (!uploadRes.ok) throw new Error("Failed to get upload URL");
      const { uploadUrl, key } = await uploadRes.json();

      // Step 2: Upload file directly to MinIO via presigned URL
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error("Failed to upload file to storage");

      // Step 3: Create the content record
      const createRes = await fetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          originalFilename: file.name,
          mimeType: file.type,
          size: file.size,
          s3Key: key,
          type: deriveType(file.type),
        }),
      });
      if (!createRes.ok) throw new Error("Failed to create content record");

      // Refresh content list
      await fetchContent();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeleting(id);
      const res = await fetch(`/api/content/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete content");
      setContentItems((prev) => prev.filter((item) => item.id !== id));
      setPresignedUrls((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      if (previewItem?.id === id) setPreviewItem(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Delete failed";
      setError(message);
    } finally {
      setDeleting(null);
    }
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

  const renderThumbnail = (item: ContentItem) => {
    const itemType = deriveType(item.mimeType);
    const url = presignedUrls[item.id];

    if (itemType === "image" && url) {
      return (
        <img
          src={url}
          alt={item.originalFilename}
          className="w-full h-40 object-cover rounded-t-lg"
        />
      );
    }
    if (itemType === "video" && url) {
      return (
        <video
          src={url}
          className="w-full h-40 object-cover rounded-t-lg"
          muted
          preload="metadata"
        />
      );
    }
    if (itemType === "audio") {
      return (
        <div className="w-full h-40 bg-slate-800 rounded-t-lg flex items-center justify-center">
          <Music className="w-12 h-12 text-slate-500" />
        </div>
      );
    }
    return (
      <div className="w-full h-40 bg-slate-800 rounded-t-lg flex items-center justify-center">
        <File className="w-12 h-12 text-slate-500" />
      </div>
    );
  };

  const renderPreviewContent = (item: ContentItem) => {
    const itemType = deriveType(item.mimeType);
    const url = presignedUrls[item.id];

    if (itemType === "image" && url) {
      return (
        <img
          src={url}
          alt={item.originalFilename}
          className="max-w-full max-h-[70vh] object-contain mx-auto rounded"
        />
      );
    }
    if (itemType === "video" && url) {
      return (
        <video
          src={url}
          controls
          autoPlay
          className="max-w-full max-h-[70vh] mx-auto rounded"
        />
      );
    }
    if (itemType === "audio" && url) {
      return (
        <div className="flex flex-col items-center gap-6 py-8">
          <Music className="w-20 h-20 text-slate-400" />
          <audio src={url} controls autoPlay className="w-full max-w-md" />
        </div>
      );
    }
    // Document - download link
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <File className="w-20 h-20 text-slate-400" />
        <p className="text-slate-400">Preview not available for this file type.</p>
        {url && (
          <a href={url} download={item.originalFilename}>
            <Button className="gap-2">
              <File className="w-4 h-4" />
              Download File
            </Button>
          </a>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
          e.target.value = "";
        }}
      />

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Content Library</h1>
          <p className="text-slate-400">Manage your device media and files</p>
        </div>
        <Button
          className="bg-primary hover:bg-primary-dark gap-2"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Upload className="w-5 h-5" />
          )}
          {uploading ? "Uploading..." : "Upload Files"}
        </Button>
      </div>

      {/* Search and Filter Bar */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 flex-col sm:flex-row">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search files..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-slate-800 border-slate-700"
              />
            </div>
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
        </CardContent>
      </Card>

      {/* Error State */}
      {error && (
        <Card className="bg-red-900/20 border-red-800">
          <CardContent className="pt-6 flex items-center justify-between">
            <p className="text-red-400">{error}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setError(null)}
            >
              <X className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-3 text-slate-400">Loading content...</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredItems.length === 0 && (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="pt-12 pb-12 text-center">
            <File className="w-12 h-12 mx-auto mb-4 text-slate-600" />
            <p className="text-slate-400 text-lg">No content found</p>
            <p className="text-slate-500 text-sm mt-1">
              {contentItems.length === 0
                ? "Upload your first file to get started"
                : "Try adjusting your search or filters"}
            </p>
            {contentItems.length === 0 && (
              <Button
                className="mt-4 gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-4 h-4" />
                Upload Files
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Content Grid */}
      {!loading && filteredItems.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredItems.map((item) => {
            const itemType = deriveType(item.mimeType);
            return (
              <Card
                key={item.id}
                className="bg-slate-900/50 border-slate-800 overflow-hidden hover:border-primary/50 transition-all group"
              >
                {/* Thumbnail / Preview area */}
                <div className="relative cursor-pointer" onClick={() => setPreviewItem(item)}>
                  {renderThumbnail(item)}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <Eye className="w-8 h-8 text-white" />
                  </div>
                </div>

                {/* Info */}
                <CardContent className="pt-4 pb-4">
                  <h3 className="font-medium text-white text-sm truncate mb-2">
                    {item.originalFilename || item.filename}
                  </h3>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="text-xs gap-1">
                      {typeIcons[itemType]}
                      {typeLabels[itemType]}
                    </Badge>
                    <span className="text-xs text-slate-400">
                      {formatFileSize(item.size)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-3">
                    {formatRelativeTime(item.uploadedAt)}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1 text-xs"
                      onClick={() => setPreviewItem(item)}
                    >
                      <Eye className="w-3 h-3" />
                      View
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="gap-1 text-xs"
                      disabled={deleting === item.id}
                      onClick={() => handleDelete(item.id)}
                    >
                      {deleting === item.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Item Count */}
      {!loading && !error && contentItems.length > 0 && (
        <p className="text-sm text-slate-400">
          Showing {filteredItems.length} of {contentItems.length} files
        </p>
      )}

      {/* Preview Modal */}
      <Dialog open={!!previewItem} onOpenChange={(open) => !open && setPreviewItem(null)}>
        <DialogContent className="max-w-4xl">
          {previewItem && (
            <>
              <DialogHeader>
                <DialogTitle className="truncate pr-8">
                  {previewItem.originalFilename || previewItem.filename}
                </DialogTitle>
                <DialogDescription>
                  {typeLabels[deriveType(previewItem.mimeType)]} - {formatFileSize(previewItem.size)} - Uploaded {formatRelativeTime(previewItem.uploadedAt)}
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4">
                {renderPreviewContent(previewItem)}
              </div>
              <div className="flex items-center justify-end gap-2 mt-4">
                {presignedUrls[previewItem.id] && (
                  <a
                    href={presignedUrls[previewItem.id]}
                    download={previewItem.originalFilename}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" size="sm" className="gap-2">
                      <File className="w-4 h-4" />
                      Download
                    </Button>
                  </a>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-2"
                  disabled={deleting === previewItem.id}
                  onClick={() => handleDelete(previewItem.id)}
                >
                  {deleting === previewItem.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Delete
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
