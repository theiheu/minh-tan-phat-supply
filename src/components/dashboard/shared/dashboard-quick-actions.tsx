"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface QuickActionItem {
  label: string;
  href?: string;
  onClick?: () => void;
  icon: LucideIcon;
  variant?: "default" | "outline" | "secondary" | "destructive" | "ghost";
  highlight?: boolean;
  description?: string;
}

interface DashboardQuickActionsProps {
  title?: string;
  actions: QuickActionItem[];
  className?: string;
}

export function DashboardQuickActions({
  title = "Thao tác nhanh",
  actions,
  className,
}: DashboardQuickActionsProps) {
  if (actions.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      {title && (
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-0.5">
          {title}
        </div>
      )}
      <div className="flex flex-wrap gap-2 sm:gap-2.5">
        {actions.map((action, idx) => {
          const Icon = action.icon;
          const isButton = Boolean(action.onClick);

          const content = (
            <div className="flex items-center gap-2">
              <Icon className={cn("size-4 shrink-0", action.highlight ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground")} />
              <span className="font-medium text-xs sm:text-sm whitespace-nowrap">{action.label}</span>
            </div>
          );

          if (isButton) {
            return (
              <Button
                key={idx}
                type="button"
                variant={action.variant || (action.highlight ? "default" : "outline")}
                onClick={action.onClick}
                className={cn(
                  "h-9 sm:h-10 px-3.5 sm:px-4 rounded-xl shadow-2xs group transition-all",
                  action.highlight && "bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs ring-2 ring-primary/20",
                  !action.highlight && "bg-card hover:bg-accent hover:border-primary/40"
                )}
              >
                {content}
              </Button>
            );
          }

          return (
            <Button
              key={idx}
              asChild
              variant={action.variant || (action.highlight ? "default" : "outline")}
              className={cn(
                "h-9 sm:h-10 px-3.5 sm:px-4 rounded-xl shadow-2xs group transition-all",
                action.highlight && "bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs ring-2 ring-primary/20",
                !action.highlight && "bg-card hover:bg-accent hover:border-primary/40"
              )}
            >
              <Link href={action.href || "#"}>
                {content}
              </Link>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
