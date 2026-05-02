import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FallbackApp } from "@/components/FallbackApp";

describe("FallbackApp", () => {
  it("renders fallback actions", () => {
    window.history.replaceState({}, "", "?url=https%3A%2F%2Fexample.com&kind=navigation&browserError=net%3A%3AERR_NAME_NOT_RESOLVED");
    render(<FallbackApp />);

    expect(screen.getByRole("button", { name: /find archived version/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /try original again/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy url/i })).toBeInTheDocument();
  });
});
