import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const alertVariants = cva("flex gap-3 rounded-card border px-4 py-3 text-sm", {
  variants: {
    tone: {
      info: "border-primary-border bg-primary-soft text-foreground-soft",
      success: "border-success-border bg-success-soft text-foreground-soft",
      warning: "border-warning-border bg-warning-soft text-foreground-soft",
      danger: "border-danger-border bg-danger-soft text-foreground-soft",
    },
  },
  defaultVariants: { tone: "info" },
});

const icons = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
} as const;

const iconTones = {
  info: "text-primary",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
} as const;

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  title?: string;
  hideIcon?: boolean;
  action?: React.ReactNode;
}

export function Alert({
  className,
  tone = "info",
  title,
  hideIcon,
  action,
  children,
  ...props
}: AlertProps) {
  const Icon = icons[tone ?? "info"];
  return (
    <div className={cn(alertVariants({ tone }), className)} {...props}>
      {!hideIcon && <Icon className={cn("mt-0.5 size-4 shrink-0", iconTones[tone ?? "info"])} />}
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium text-foreground">{title}</p>}
        {children && <div className={cn("leading-relaxed", title && "mt-0.5")}>{children}</div>}
      </div>
      {action}
    </div>
  );
}
