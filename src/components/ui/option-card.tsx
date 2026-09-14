"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface OptionCardProps {
  name: string;
  value: string;
  label: string;
  description?: string;
  type: "radio" | "checkbox";
  checked: boolean;
  onSelect: (value: string) => void;
  className?: string;
}

export function OptionCard({
  name,
  value,
  label,
  description,
  type,
  checked,
  onSelect,
  className,
}: OptionCardProps) {
  return (
    <label
      className={cn(
        "group flex cursor-pointer items-start gap-3 rounded-card border px-4 py-3 transition-colors",
        checked
          ? "border-primary-border bg-primary-soft"
          : "border-border bg-surface hover:border-border-strong hover:bg-surface-muted",
        className,
      )}
    >
      <input
        type={type}
        name={name}
        value={value}
        checked={checked}
        onChange={() => onSelect(value)}
        className="sr-only"
      />
      <span
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center border transition-colors",
          type === "radio" ? "rounded-full" : "rounded-[5px]",
          checked ? "border-primary bg-primary text-white" : "border-border-strong bg-surface",
        )}
      >
        {checked && (type === "radio" ? <span className="size-1.5 rounded-full bg-white" /> : <Check className="size-3" strokeWidth={3} />)}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {description && (
          <span className="mt-0.5 block text-[13px] leading-relaxed text-muted-foreground">
            {description}
          </span>
        )}
      </span>
    </label>
  );
}
