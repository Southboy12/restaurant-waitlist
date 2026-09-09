import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold tracking-tight",
  {
    variants: {
      tone: {
        waiting: "bg-secondary text-muted-foreground",
        notified: "bg-warning/20 text-warning",
        seated: "bg-success/18 text-success",
        noshow: "bg-destructive/18 text-destructive",
      },
    },
    defaultVariants: { tone: "waiting" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, tone, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ tone }), className)} {...props} />
  );
}

export { Badge, badgeVariants };