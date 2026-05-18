import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { Button, LinkButton } from "./Button";

export function CopyButton({
  value,
  label = "Copy link",
  copiedLabel = "Copied",
  variant = "secondary"
}: {
  value: string;
  label?: string;
  copiedLabel?: string;
  variant?: "primary" | "secondary" | "ghost" | "quiet";
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <Button type="button" variant={variant} size="sm" onClick={() => void copy()} aria-live="polite">
      {copied ? <Check aria-hidden="true" size={14} /> : <Copy aria-hidden="true" size={14} />}
      {copied ? copiedLabel : label}
    </Button>
  );
}

export function OpenLinkButton({ href, label = "Open" }: { href: string; label?: string }) {
  return (
    <LinkButton href={href} target="_blank" rel="noreferrer" variant="secondary" size="sm">
      <ExternalLink aria-hidden="true" size={14} />
      {label}
    </LinkButton>
  );
}
