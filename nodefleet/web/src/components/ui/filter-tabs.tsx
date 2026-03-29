"use client";

import { Button } from "./button";

interface FilterTabsProps {
  options: Array<{ value: string; label: string; count?: number }>;
  value: string;
  onChange: (value: string) => void;
}

export function FilterTabs({ options, value, onChange }: FilterTabsProps) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {options.map((opt) => (
        <Button
          key={opt.value}
          variant={value === opt.value ? "default" : "outline"}
          size="sm"
          onClick={() => onChange(opt.value)}
          className={`text-xs ${
            value === opt.value
              ? "bg-primary text-white"
              : "border-slate-700 text-slate-400 hover:text-white"
          }`}
        >
          {opt.label}
          {opt.count !== undefined && (
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-slate-800 text-xs">
              {opt.count}
            </span>
          )}
        </Button>
      ))}
    </div>
  );
}
