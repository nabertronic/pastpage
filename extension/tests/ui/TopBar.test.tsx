import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TopBar } from "@/components/TopBar";
import { explainHttpStatus } from "@/core/errors";
import { DEFAULT_SETTINGS } from "@/core/settings";

describe("TopBar", () => {
  const error = {
    kind: "http" as const,
    originalUrl: "https://example.com/missing",
    statusCode: 404,
    explanation: explainHttpStatus(404),
    detectedAt: 1
  };

  it("renders the primary archive action", async () => {
    const onFind = vi.fn();
    render(<TopBar error={error} settings={DEFAULT_SETTINGS} onFind={onFind} onDismiss={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /find archived version/i }));
    expect(onFind).toHaveBeenCalledOnce();
  });

  it("supports dismiss", async () => {
    const onDismiss = vi.fn();
    render(<TopBar error={error} settings={DEFAULT_SETTINGS} onFind={vi.fn()} onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("renders German UI when the language is set to German", () => {
    render(
      <TopBar
        error={error}
        settings={{ ...DEFAULT_SETTINGS, language: "de" }}
        onFind={vi.fn()}
        onDismiss={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Archivierte Version finden" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "PastPage ausblenden" })).toBeInTheDocument();
  });

  it("applies the configured custom action color", () => {
    render(
      <TopBar
        error={error}
        settings={{
          ...DEFAULT_SETTINGS,
          bannerTheme: "custom",
          bannerColor: "#111111",
          actionColor: "#22cc88"
        }}
        onFind={vi.fn()}
        onDismiss={vi.fn()}
      />
    );

    expect(screen.getByRole("region", { name: "PastPage" })).toHaveAttribute(
      "style",
      expect.stringContaining("--wf-accent: #22cc88")
    );
  });
});
