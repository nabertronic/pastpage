import { forwardRef, type ButtonHTMLAttributes, type AnchorHTMLAttributes, type ReactNode } from "react";
import { cn } from "../lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "quiet" | "action";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex appearance-none items-center justify-center gap-2 rounded-md border font-semibold transition-all duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 active:translate-y-px whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary:
    "border-yellow-300 bg-yellow-400 text-stone-950 shadow-[0_8px_24px_rgba(255,212,0,0.22)] hover:-translate-y-0.5 hover:bg-yellow-300 hover:shadow-[0_12px_30px_rgba(255,212,0,0.34)] focus-visible:outline-yellow-400",
  secondary:
    "border-[var(--wf-border-strong)] bg-[var(--wf-surface)] text-stone-950 shadow-[0_1px_0_rgba(17,17,17,0.04),0_6px_18px_rgba(17,17,17,0.06)] hover:-translate-y-0.5 hover:border-yellow-400 hover:bg-yellow-50 hover:shadow-[0_10px_22px_rgba(17,17,17,0.08)] focus-visible:outline-yellow-400 dark:border-stone-700 dark:bg-stone-950 dark:text-yellow-50 dark:hover:border-yellow-300 dark:hover:bg-stone-900",
  ghost:
    "border-transparent bg-transparent text-stone-700 hover:bg-yellow-100 hover:text-stone-950 focus-visible:outline-yellow-400 dark:text-yellow-50 dark:hover:bg-yellow-300/15",
  quiet:
    "border-[var(--wf-border)] bg-[var(--wf-surface-muted)] text-stone-700 hover:border-[var(--wf-border-strong)] hover:bg-[var(--wf-surface-raised)] hover:text-stone-950 focus-visible:outline-yellow-400 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-200 dark:hover:border-stone-700 dark:hover:bg-stone-800 dark:hover:text-yellow-50",
  action:
    "border-[var(--wf-border)] bg-[var(--wf-surface)] text-[var(--wf-accent-strong)] shadow-[0_1px_0_rgba(17,17,17,0.04),0_6px_18px_rgba(17,17,17,0.06)] hover:-translate-y-0.5 hover:border-yellow-400/70 hover:bg-yellow-50 hover:text-[var(--wf-accent-strong)] hover:shadow-[0_10px_22px_rgba(17,17,17,0.08)] focus-visible:outline-yellow-400 dark:border-stone-700 dark:bg-stone-950 dark:text-[var(--wf-accent)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.03)] dark:hover:border-[var(--wf-accent)] dark:hover:bg-stone-900 dark:hover:text-[var(--wf-accent)]"
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-2.5 text-xs",
  md: "h-10 px-3 text-sm",
  lg: "h-11 px-4 text-sm"
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }
>(function Button({ className, variant = "primary", size = "md", ...props }, ref) {
  return <button ref={ref} className={cn(base, variants[variant], sizes[size], className)} {...props} />;
});

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
