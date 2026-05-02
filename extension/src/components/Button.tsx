import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "quiet";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-md border font-semibold transition-all duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 active:translate-y-px whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary:
    "border-yellow-300 bg-yellow-400 text-stone-950 shadow-[0_8px_24px_rgba(255,212,0,0.22)] hover:-translate-y-0.5 hover:bg-yellow-300 hover:shadow-[0_12px_30px_rgba(255,212,0,0.34)] focus-visible:outline-yellow-400",
  secondary:
    "border-stone-300 bg-white text-stone-950 hover:-translate-y-0.5 hover:border-yellow-400 hover:bg-yellow-50 hover:shadow-sm focus-visible:outline-yellow-400 dark:border-stone-700 dark:bg-stone-950 dark:text-yellow-50 dark:hover:border-yellow-300 dark:hover:bg-stone-900",
  ghost:
    "border-transparent bg-transparent text-stone-700 hover:bg-yellow-100 hover:text-stone-950 focus-visible:outline-yellow-400 dark:text-yellow-50 dark:hover:bg-yellow-300/15",
  quiet:
    "border-stone-200 bg-stone-50 text-stone-700 hover:border-stone-300 hover:bg-stone-100 hover:text-stone-950 focus-visible:outline-yellow-400 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-200 dark:hover:border-stone-700 dark:hover:bg-stone-800 dark:hover:text-yellow-50"
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-2.5 text-xs",
  md: "h-10 px-3 text-sm",
  lg: "h-11 px-4 text-sm"
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}

export function LinkButton({
  className,
  variant = "secondary",
  size = "md",
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}) {
  return (
    <a className={cn(base, variants[variant], sizes[size], "no-underline", className)} {...props}>
      {children}
    </a>
  );
}
