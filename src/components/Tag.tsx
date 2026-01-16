import { ReactNode } from "react";
import { cn } from "@/lib/utils";

const variantStyles = {
  medium: "rounded-lg px-1.5 ring-1 ring-inset",
  small: "",
};

const colorStyles = {
  emerald: {
    small: "text-emerald-500 dark:text-emerald-400",
    medium:
      "ring-emerald-300 dark:ring-emerald-400/30 bg-emerald-400/10 text-emerald-500 dark:text-emerald-400",
  },
  sky: {
    small: "text-sky-500",
    medium:
      "ring-sky-300 bg-sky-400/10 text-sky-500 dark:ring-sky-400/30 dark:bg-sky-400/10 dark:text-sky-400",
  },
  amber: {
    small: "text-amber-500",
    medium:
      "ring-amber-300 bg-amber-400/10 text-amber-500 dark:ring-amber-400/30 dark:bg-amber-400/10 dark:text-amber-400",
  },
  rose: {
    small: "text-red-500 dark:text-rose-500",
    medium:
      "ring-rose-200 bg-rose-50 text-red-500 dark:ring-rose-500/20 dark:bg-rose-400/10 dark:text-rose-400",
  },
  zinc: {
    small: "text-zinc-400 dark:text-zinc-500",
    medium:
      "ring-zinc-200 bg-zinc-50 text-zinc-500 dark:ring-zinc-500/20 dark:bg-zinc-400/10 dark:text-zinc-400",
  },
};

type TagVariant = keyof typeof variantStyles;
type TagColor = keyof typeof colorStyles;

const valueColorMap: Record<string, TagColor> = {
  get: "emerald",
  post: "sky",
  put: "amber",
  delete: "rose",
};

interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  variant?: TagVariant;
  color?: TagColor;
  type?: "span" | "div";
}

export function Tag({
  children,
  variant = "medium",
  color = typeof children === "string"
    ? valueColorMap[children.toLowerCase()] ?? "emerald"
    : "emerald",
  type = "span",
  className = "",
  ...props
}: TagProps) {
  const Component = type;

  return (
    <Component
      className={cn(
        "font-mono text-[0.625rem] font-semibold leading-6",
        variantStyles[variant],
        colorStyles[color][variant],
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
