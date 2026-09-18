import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import * as React from "react";
import { AIFloatingTrigger } from "./ai-floating-trigger";

// Mock @ai-sdk/react useChat
vi.mock("@ai-sdk/react", () => ({
  useChat: () => ({
    messages: [],
    input: "",
    handleInputChange: vi.fn(),
    handleSubmit: vi.fn(),
    isLoading: false,
    stop: vi.fn(),
    setMessages: vi.fn(),
    setInput: vi.fn(),
  }),
}));

// Mock fetch for quick prompts
global.fetch = vi.fn().mockImplementation(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ prompts: [] }),
  })
);

describe("AIFloatingTrigger", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("renders floating button on mount", async () => {
    render(<AIFloatingTrigger />);
    const button = await screen.findByRole("button", { name: /Mở trợ lý AI Copilot/i });
    expect(button).toBeInTheDocument();
  });

  it("opens AI copilot drawer when button is clicked", async () => {
    render(<AIFloatingTrigger />);
    const button = await screen.findByRole("button", { name: /Mở trợ lý AI Copilot/i });
    
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("MTP Farm Copilot")).toBeInTheDocument();
    });
  });

  it("does not open drawer when dragging the button", async () => {
    render(<AIFloatingTrigger />);
    const button = await screen.findByRole("button", { name: /Mở trợ lý AI Copilot/i });
    const container = button.parentElement!;

    // Simulate pointer drag > 6px
    fireEvent.pointerDown(container, { clientX: 100, clientY: 100, button: 0, pointerId: 1 });
    fireEvent.pointerMove(container, { clientX: 150, clientY: 150, pointerId: 1 });
    fireEvent.pointerUp(container, { clientX: 150, clientY: 150, pointerId: 1 });

    // Native click fired right after drag
    fireEvent.click(button);

    // Drawer should not be opened
    expect(screen.queryByText("Tôi có thể giúp gì cho bạn?")).not.toBeInTheDocument();
  });
});
