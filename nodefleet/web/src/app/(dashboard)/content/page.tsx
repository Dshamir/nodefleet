"use client";

import { useState } from "react";
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
} from "lucide-react";

export default function ContentLibraryPage() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedItems, setSelectedItems] = useState<number[]>([]);

  const contentItems = [
    {
      id: 1,
      filename: "photo_001.jpg",
      type: "image",
      size: "2.4 MB",
      date: "2024-01-15 14:32",
      device: "GPS Camera 01",
    },
    {
      id: 2,
      filename: "photo_002.jpg",
      type: "image",
      size: "2.1 MB",
      date: "2024-01-15 14:28",
      device: "GPS Camera 01",
    },
    {
      id: 3,
      filename: "video_001.mp4",
      type: "video",
      size: "45.2 MB",
      date: "2024-01-15 14:20",
      device: "Sensor Unit 15",
    },
    {
      id: 4,
      filename: "audio_001.wav",
      type: "audio",
      size: "1.8 MB",
      date: "2024-01-15 14:15",
      device: "Audio Logger 08",
    },
    {
      id: 5,
      filename: "audio_002.wav",
      type: "audio",
      size: "2.3 MB",
      date: "2024-01-15 14:10",
      device: "Audio Logger 08",
    },
    {
      id: 6,
      filename: "report_jan.pdf",
      type: "document",
      size: "1.2 MB",
      date: "2024-01-15 12:00",
      device: "Fleet Monitor 03",
    },
  ];

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

  const filteredItems =
    typeFilter === "all"
      ? contentItems
      : contentItems.filter((item) => item.type === typeFilter);

  const toggleSelection = (id: number) => {
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

      {/* Content Grid */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
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
                    {typeIcons[item.type]}
                  </div>
                  {selectedItems.includes(item.id) && (
                    <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                      <span className="text-white text-sm">✓</span>
                    </div>
                  )}
                </div>
                <h3 className="font-medium text-white mb-2 truncate">
                  {item.filename}
                </h3>
                <div className="space-y-2 text-sm">
                  <Badge variant="secondary" className="text-xs">
                    {typeLabels[item.type]}
                  </Badge>
                  <p className="text-slate-400">{item.size}</p>
                  <p className="text-slate-500">{item.device}</p>
                  <p className="text-slate-500 text-xs">{item.date}</p>
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
          ))}
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
                      checked={selectedItems.length === filteredItems.length}
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
                {filteredItems.map((item) => (
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
                    <td className="px-6 py-3 text-white">{item.filename}</td>
                    <td className="px-6 py-3">
                      <Badge variant="secondary" className="text-xs gap-1">
                        {typeIcons[item.type]}
                        {typeLabels[item.type]}
                      </Badge>
                    </td>
                    <td className="px-6 py-3 text-slate-400 text-sm">{item.size}</td>
                    <td className="px-6 py-3 text-slate-400 text-sm">
                      {item.device}
                    </td>
                    <td className="px-6 py-3 text-slate-400 text-sm">{item.date}</td>
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
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Item Count */}
      <p className="text-sm text-slate-400">
        Showing {filteredItems.length} of {contentItems.length} files
        {selectedItems.length > 0 && ` • ${selectedItems.length} selected`}
      </p>
    </div>
  );
}
