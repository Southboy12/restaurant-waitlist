import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium tracking-tight transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:brightness-110",
        seat: "bg-success text-success-foreground hover:brightness-110",
        ghost: "bg-secondary text-secondary-foreground hover:bg-surface-2",
        outline: "border border-border text-foreground hover:bg-surface-2",
        danger: "bg-destructive/15 text-destructive hover:bg-destructive/25",
      },
      size: {
        md: "h-11 px-4 text-sm",
        lg: "h-12 px-6 text-base",
        sm: "h-9 px-3 text-sm",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export function Button({
  className,
  variant,
  size,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export function Field({
  label,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <input
        className={cn(
          "h-12 w-full rounded-lg border border-input bg-background/60 px-3.5 text-base text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/40",
          className,
        )}
        {...props}
      />
    </label>
  );
}

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

export function Badge({
  children,
  tone,
}: { children: React.ReactNode } & VariantProps<typeof badgeVariants>) {
  return <span className={badgeVariants({ tone })}>{children}</span>;
}
