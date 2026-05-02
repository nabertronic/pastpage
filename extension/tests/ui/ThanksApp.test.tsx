import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThanksApp } from "@/components/ThanksApp";
import { DEFAULT_SETTINGS } from "@/core/settings";

describe("ThanksApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (browser.storage.local.get as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (key?: string | string[] | null) => {
        if (key === "pastPage.settings") {
          return { "pastPage.settings": DEFAULT_SETTINGS };
        }
        if (key === "pastPage.meta") {
          return { "pastPage.meta": { searchCount: 200 } };
        }
        return {};
      }
    );
  });

  it("shows the current search count in the thanks copy", async () => {
    render(<ThanksApp />);

    await waitFor(() =>
      expect(screen.getAllByText(/200 searches/i).length).toBeGreaterThan(0)
    );
  });
});
