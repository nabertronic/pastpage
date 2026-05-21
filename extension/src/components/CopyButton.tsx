import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { Button, LinkButton } from "./Button";

export function CopyButton({
  value,
  label = "Copy link",
  copiedLabel = "Copied",
  variant = "action"
}: {
  value: string;
  label?: string;
  copiedLabel?: string;
  variant?: "primary" | "secondary" | "ghost" | "quiet" | "action";
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      onClick={() => void copy()}
      aria-live="polite"
      className={variant === "action" ? "text-[var(--wf-accent-strong)] hover:text-[var(--wf-accent-strong)]" : undefined}
    >
      <span className="relative inline-flex h-3.5 w-3.5 items-center justify-center overflow-hidden">
        <Copy
          aria-hidden="true"
          size={14}
          className={`absolute transition-all duration-200 ${copied ? "scale-75 opacity-0" : "scale-100 opacity-100"}`}
        />
        <Check
          aria-hidden="true"
          size={14}
          className={`absolute transition-all duration-200 ${copied ? "scale-100 opacity-100" : "scale-75 opacity-0"}`}
        />
      </span>
      {copied ? copiedLabel : label}
    </Button>
  );
}

export function OpenLinkButton({ href, label = "Open" }: { href: string; label?: string }) {
  return (
    <LinkButton href={href} target="_blank" rel="noreferrer" variant="action" size="sm">
      <ExternalLink aria-hidden="true" size={14} />
      {label}
    </LinkButton>
  );
}
