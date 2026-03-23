"use client";

import * as React from "react";
import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from "lucide-react";

type ToastType = "default" | "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

const toastConfig = {
  default: {
    bg: "bg-slate-900 border-slate-800",
    text: "text-slate-100",
    icon: Info,
  },
  success: {
    bg: "bg-success/20 border-success/30",
    text: "text-success",
    icon: CheckCircle,
  },
  error: {
    bg: "bg-error/20 border-error/30",
    text: "text-error",
    icon: AlertCircle,
  },
  warning: {
    bg: "bg-warning/20 border-warning/30",
    text: "text-warning",
    icon: AlertTriangle,
  },
  info: {
    bg: "bg-primary/20 border-primary/30",
    text: "text-primary",
    icon: Info,
  },
};

export function useToast() {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const showToast = (message: string, type: ToastType = "default", duration = 4000) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast: Toast = { id, message, type, duration };

    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }

    return id;
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return { toasts, showToast, removeToast };
}

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 pointer-events-none">
      {toasts.map((toast) => {
        const config = toastConfig[toast.type];
        const Icon = config.icon;

        return (
          <div
            key={toast.id}
            className={`flex items-start gap-3 p-4 rounded-lg border ${config.bg} backdrop-blur-sm pointer-events-auto animate-slide-in-up max-w-sm`}
          >
            <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${config.text}`} />
            <p className={`text-sm font-medium flex-1 ${config.text}`}>
              {toast.message}
            </p>
            <button
              onClick={() => onRemove(toast.id)}
              className="text-slate-400 hover:text-white transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// Provider component for global toast support
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { toasts, removeToast } = useToast();

  return (
    <>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}
