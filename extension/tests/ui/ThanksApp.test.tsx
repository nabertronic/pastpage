import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThanksApp } from "@/components/ThanksApp";
import { DEFAULT_SETTINGS } from "@/core/settings";

describe("ThanksApp", () => {
  function mockThanksMeta(searchCount: number) {
    (browser.storage.local.get as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (key?: string | string[] | null) => {
        if (key === "pastPage.settings") {
          return { "pastPage.settings": DEFAULT_SETTINGS };
        }
        if (key === "pastPage.meta") {
          return { "pastPage.meta": { searchCount } };
        }
        return {};
      }
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockThanksMeta(200);
  });

  it("shows the current search count in the thanks copy", async () => {
    render(<ThanksApp />);

    await waitFor(() =>
      expect(screen.getAllByText(/200 searches/i).length).toBeGreaterThan(0)
    );
  });

  it("shows first-time copy without plural milestone text on the first thanks page", async () => {
    mockThanksMeta(1);
    render(<ThanksApp />);

    await waitFor(() =>
      expect(screen.getByText(/helped for the first time/i)).toBeInTheDocument()
    );
    expect(screen.queryByText(/1 searches/i)).not.toBeInTheDocument();
  });
});
