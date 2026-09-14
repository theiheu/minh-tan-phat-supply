import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "./login-form";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (key: string) => (key === "next" ? "/inventory" : null),
  }),
}));

// Mock next/image
vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => {
    const { priority, ...rest } = props;
    void priority;
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...rest} alt={props.alt ?? ""} />;
  },
}));

// Mock loginAction
let mockActionState = { error: null as string | null };
let mockPending = false;

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useActionState: () => {
      return [mockActionState, vi.fn(), mockPending];
    },
  };
});

describe("LoginForm component", () => {
  beforeEach(() => {
    mockActionState = { error: null };
    mockPending = false;
  });

  it("renders brand logo, title, username and password fields", () => {
    render(<LoginForm />);

    expect(screen.getByAltText("Logo Trại gà Minh Tân Phát")).toBeInTheDocument();
    expect(screen.getByText("Đăng nhập hệ thống")).toBeInTheDocument();
    expect(screen.getByLabelText("Tên đăng nhập")).toBeInTheDocument();
    expect(screen.getByLabelText("Mật khẩu")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Đăng nhập$/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue("/inventory")).toBeInTheDocument();
  });

  it("toggles password visibility when clicking eye button", () => {
    render(<LoginForm />);

    const passwordInput = screen.getByLabelText("Mật khẩu") as HTMLInputElement;
    const toggleButton = screen.getByRole("button", { name: "Hiện mật khẩu" });

    // Initial state: password type is "password"
    expect(passwordInput.type).toBe("password");
    expect(toggleButton).toHaveAttribute("aria-label", "Hiện mật khẩu");

    // Click toggle: should change to "text"
    fireEvent.click(toggleButton);
    expect(passwordInput.type).toBe("text");
    expect(toggleButton).toHaveAttribute("aria-label", "Ẩn mật khẩu");

    // Click again: should change back to "password"
    fireEvent.click(toggleButton);
    expect(passwordInput.type).toBe("password");
    expect(toggleButton).toHaveAttribute("aria-label", "Hiện mật khẩu");
  });

  it("displays error message when authentication fails", () => {
    mockActionState = { error: "Sai tên đăng nhập hoặc mật khẩu" };
    render(<LoginForm />);

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent("Sai tên đăng nhập hoặc mật khẩu");
  });

  it("shows loading state and disables submit button when pending", () => {
    mockPending = true;
    render(<LoginForm />);

    const submitBtn = screen.getByRole("button", { name: /Đang đăng nhập…/i });
    expect(submitBtn).toBeDisabled();
    expect(screen.getByText("Đang đăng nhập…")).toBeInTheDocument();
  });
});
