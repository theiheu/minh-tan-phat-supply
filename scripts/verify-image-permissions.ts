import { createClient } from "@supabase/supabase-js";
import { strict as assert } from "node:assert";

const URL = "http://127.0.0.1:54321";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

function userClient(token: string) {
  return createClient(URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
}

async function run() {
  console.log("== Testing Image Delete Permissions ==");

  const admin = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } });
  const authApi = createClient(URL, ANON);

  // 1. Log in as manager A (manager@mtp.local) and dev (admin@mtp.local)
  const mgrALogin = await authApi.auth.signInWithPassword({ email: "manager@mtp.local", password: "password123" });
  const devLogin = await authApi.auth.signInWithPassword({ email: "admin@mtp.local", password: "password123" });
  assert(!mgrALogin.error && mgrALogin.data.session, "Manager A login failed");
  assert(!devLogin.error && devLogin.data.session, "Dev login failed");

  const managerAId = mgrALogin.data.user.id;
  const devId = devLogin.data.user.id;
  const clientA = userClient(mgrALogin.data.session.access_token);
  const clientDev = userClient(devLogin.data.session.access_token);

  // 2. Create temporary Manager B
  const emailB = `manager-b-${Date.now()}@mtp.local`;
  const mgrBCreate = await admin.auth.admin.createUser({
    email: emailB,
    password: "password123",
    email_confirm: true,
    user_metadata: { name: "Manager B Test", role: "manager" },
  });
  assert(mgrBCreate.data.user, "Create manager B user failed");
  const managerBId = mgrBCreate.data.user.id;
  await admin.from("profiles").upsert({ id: managerBId, role: "manager", name: "Manager B Test" });

  const mgrBLogin = await authApi.auth.signInWithPassword({ email: emailB, password: "password123" });
  assert(!mgrBLogin.error && mgrBLogin.data.session, "Manager B login failed");
  const clientB = userClient(mgrBLogin.data.session.access_token);

  try {
    const imageA = `http://127.0.0.1:54321/storage/v1/object/public/receipt-images/${managerAId}/test-image-a.jpg`;
    const imageB = `http://127.0.0.1:54321/storage/v1/object/public/receipt-images/${managerBId}/test-image-b.jpg`;

    const { data: variant } = await clientA.from("variants").select("id").limit(1).single();
    assert(variant, "Variant needed");

    // 3. Manager A creates a receipt with imageA
    const createRes = await clientA.rpc("create_receipt", {
      p_items: [{ variant_id: variant.id, quantity: 1, unit_cost: 1000 }],
      p_supplier_id: null,
      p_by: managerAId,
      p_notes: "Test image delete permissions",
      p_invoice_images: [imageA],
    });
    if (createRes.error) throw createRes.error;
    const receiptId = createRes.data as string;
    console.log("Manager A created receipt with image A:", receiptId);

    // 4. Manager B adds imageB
    const addRes = await clientB.rpc("update_receipt_invoice_images", {
      p_id: receiptId,
      p_invoice_images: [imageA, imageB],
      p_by: managerBId,
    });
    if (addRes.error) throw addRes.error;
    console.log("Manager B added image B successfully");

    // 5. Manager B tries to delete image A (which was uploaded by Manager A) -> MUST FAIL
    const delFailRes = await clientB.rpc("update_receipt_invoice_images", {
      p_id: receiptId,
      p_invoice_images: [imageB], // tried to delete imageA!
      p_by: managerBId,
    });
    assert(delFailRes.error, "Manager B deleting Manager A's image must fail");
    assert(
      delFailRes.error.message.includes("chỉ được quyền xoá ảnh do chính mình tải lên") ||
        delFailRes.error.message.includes("Không được xoá ảnh"),
      `Unexpected error message: ${delFailRes.error.message}`,
    );
    console.log("Manager B deletion blocked correctly:", delFailRes.error.message);

    // 6. Manager B deletes their OWN image B -> SUCCEEDS
    const delOwnRes = await clientB.rpc("update_receipt_invoice_images", {
      p_id: receiptId,
      p_invoice_images: [imageA], // deleted imageB
      p_by: managerBId,
    });
    if (delOwnRes.error) throw delOwnRes.error;
    console.log("Manager B successfully deleted own image B");

    // 7. Dev (superuser) deletes image A (uploaded by Manager A) -> SUCCEEDS
    const devDelRes = await clientDev.rpc("update_receipt_invoice_images", {
      p_id: receiptId,
      p_invoice_images: [], // dev deletes imageA
      p_by: devId,
    });
    if (devDelRes.error) throw devDelRes.error;
    console.log("Dev user successfully deleted image A (superuser override)");

    // Clean up receipt
    await clientDev.rpc("delete_receipt", { p_id: receiptId, p_by: devId });
    console.log("All image delete permission verification checks PASSED! 🎉");
  } finally {
    await admin.from("profiles").delete().eq("id", managerBId);
    await admin.auth.admin.deleteUser(managerBId);
  }
}

run().catch((e) => {
  console.error("Verification failed:", e);
  process.exit(1);
});
