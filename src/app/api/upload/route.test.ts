// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";

const mockUpload = vi.fn();
const mockGetPublicUrl = vi.fn();
const mockGetUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
    },
    storage: {
      from: vi.fn(() => ({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      })),
    },
  })),
}));

vi.mock("heic-convert", () => ({
  default: vi.fn(async () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0])),
}));

describe("POST /api/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
    mockUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: "https://example.com/storage/v1/object/public/receipt-images/img.jpg" },
    });
  });

  it("returns 401 if user is not authenticated", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const formData = new FormData();
    formData.append("bucket", "receipt-images");
    formData.append("file", new File(["test"], "test.png", { type: "image/png" }));

    const req = new NextRequest("http://localhost/api/upload", {
      method: "POST",
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Chưa đăng nhập");
  });

  it("returns 400 if bucket is invalid", async () => {
    const formData = new FormData();
    formData.append("bucket", "secret-bucket");
    formData.append("file", new File(["test"], "test.png", { type: "image/png" }));

    const req = new NextRequest("http://localhost/api/upload", {
      method: "POST",
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Bucket không hợp lệ");
  });

  it("allows receipt-images and converts HEIC file to JPG in storage", async () => {
    const formData = new FormData();
    formData.append("bucket", "receipt-images");
    formData.append("file", new File(["dummy heic content"], "invoice.heic", { type: "image/heic" }));

    const req = new NextRequest("http://localhost/api/upload", {
      method: "POST",
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.url).toBe("https://example.com/storage/v1/object/public/receipt-images/img.jpg");
    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^user-123\/.*\.jpg$/),
      new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
      { contentType: "image/jpeg" },
    );
  });

  it("allows issue-images bucket", async () => {
    const formData = new FormData();
    formData.append("bucket", "issue-images");
    formData.append("file", new File(["png content"], "slip.png", { type: "image/png" }));

    const req = new NextRequest("http://localhost/api/upload", {
      method: "POST",
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});
