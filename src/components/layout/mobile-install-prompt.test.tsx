import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MobileInstallPrompt } from "./mobile-install-prompt";

describe("MobileInstallPrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("does not render when running in standalone display mode", () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === "(display-mode: standalone)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(<MobileInstallPrompt />);
    expect(screen.queryByText(/Cài đặt ứng dụng/i)).toBeNull();
  });

  it("renders prompt when beforeinstallprompt event is fired", () => {
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    render(<MobileInstallPrompt />);

    const promptEvent = new Event("beforeinstallprompt");
    Object.assign(promptEvent, { prompt: vi.fn(), userChoice: Promise.resolve({ outcome: "accepted" }) });
    act(() => {
      window.dispatchEvent(promptEvent);
    });

    expect(screen.getByText(/Cài đặt ứng dụng/i)).toBeInTheDocument();
  });

  it("does not render if dismissed within the last 7 days", () => {
    localStorage.setItem("mtp-pwa-dismissed", (Date.now() - 2 * 24 * 60 * 60 * 1000).toString());
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    render(<MobileInstallPrompt />);

    const promptEvent = new Event("beforeinstallprompt");
    Object.assign(promptEvent, { prompt: vi.fn(), userChoice: Promise.resolve({ outcome: "accepted" }) });
    act(() => {
      window.dispatchEvent(promptEvent);
    });

    expect(screen.queryByText(/Cài đặt ứng dụng/i)).toBeNull();
  });

  it("dismisses prompt and records timestamp to localStorage when dismiss button is clicked", () => {
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    render(<MobileInstallPrompt />);

    const promptEvent = new Event("beforeinstallprompt");
    Object.assign(promptEvent, { prompt: vi.fn(), userChoice: Promise.resolve({ outcome: "accepted" }) });
    act(() => {
      window.dispatchEvent(promptEvent);
    });

    expect(screen.getByText(/Cài đặt ứng dụng/i)).toBeInTheDocument();

    const buttons = screen.getAllByRole("button");
    const closeBtn = buttons[1]; // X button
    fireEvent.click(closeBtn);

    expect(screen.queryByText(/Cài đặt ứng dụng/i)).toBeNull();
    expect(localStorage.getItem("mtp-pwa-dismissed")).toBeTruthy();
  });

  it("handles install prompt trigger when install button clicked", async () => {
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    render(<MobileInstallPrompt />);

    const mockPrompt = vi.fn().mockResolvedValue(undefined);
    const promptEvent = new Event("beforeinstallprompt");
    Object.assign(promptEvent, { prompt: mockPrompt, userChoice: Promise.resolve({ outcome: "accepted" }) });
    act(() => {
      window.dispatchEvent(promptEvent);
    });

    const installBtn = screen.getByRole("button", { name: /^cài đặt$/i });
    await act(async () => {
      fireEvent.click(installBtn);
    });

    expect(mockPrompt).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Cài đặt ứng dụng/i)).toBeNull();
  });

  it("shows iOS guide on iOS device when install button clicked", async () => {
    const originalUA = window.navigator.userAgent;
    Object.defineProperty(window.navigator, "userAgent", {
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
      configurable: true,
    });

    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    render(<MobileInstallPrompt />);

    expect(screen.getByText(/Cài đặt ứng dụng/i)).toBeInTheDocument();

    const installBtn = screen.getByRole("button", { name: /^cài đặt$/i });
    act(() => {
      fireEvent.click(installBtn);
    });

    expect(screen.getByText(/Cách cài đặt trên iPhone \/ iPad:/i)).toBeInTheDocument();

    Object.defineProperty(window.navigator, "userAgent", {
      value: originalUA,
      configurable: true,
    });
  });
});
