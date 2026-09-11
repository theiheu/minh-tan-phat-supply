
const { createClient } = require("@supabase/supabase-js");

async function main() {
  const URL = "http://127.0.0.1:54321";
  const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
  const supabase = createClient(URL, ANON_KEY);

  console.log("Signing in...");
  const { data: { session }, error } = await supabase.auth.signInWithPassword({
    email: "manager@mtp.local",
    password: "password123",
  });

  if (error || !session) {
    console.error("Failed to sign in:", error);
    return;
  }
  console.log("Signed in as:", session.user.email);

  const tokenJson = JSON.stringify(session);
  const base64 = "base64-" + Buffer.from(tokenJson).toString("base64url");
  
  const cookieHeader = [
    `sb-127-0-0-1-auth-token=${base64}`,
    `sb-127-auth-token=${base64}`,
    `sb-localhost-auth-token=${base64}`,
  ].join("; ");

  const pages = [
    "/dashboard",
    "/products",
    "/receipts",
    "/requisitions",
    "/defects",
    "/fuel",
    "/tools",
    "/reports",
    "/admin/products",
    "/admin/vehicles",
  ];

  console.log("=== Benchmarking Authenticated Page Loads (Port 3000) ===");
  for (const page of pages) {
    const t0 = performance.now();
    const res = await fetch("http://127.0.0.1:3000" + page, {
      headers: { Cookie: cookieHeader },
      redirect: "manual",
    });
    const text = await res.text();
    const t1 = performance.now();
    console.log(`${page.padEnd(20)} | Status: ${res.status} | Size: ${(text.length / 1024).toFixed(1)} KB | Time: ${(t1 - t0).toFixed(1)} ms`);
  }
}
main().catch(console.error);
