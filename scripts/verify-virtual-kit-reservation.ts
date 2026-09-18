import { createClient } from "@supabase/supabase-js";

const URL = "http://127.0.0.1:54321";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const api = createClient(URL, ANON);
const client = (token: string) => createClient(URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });

async function main() {
  const manager = await api.auth.signInWithPassword({ email: "manager@mtp.local", password: "password123" });
  const requester = await api.auth.signInWithPassword({ email: "requester@mtp.local", password: "password123" });
  if (manager.error || requester.error) throw manager.error ?? requester.error;
  const mc = client(manager.data.session!.access_token);
  const rc = client(requester.data.session!.access_token);
  const managerId = manager.data.user!.id;
  const requesterId = requester.data.user!.id;
  const { data: zone } = await rc.from("zones").select("id").limit(1).single();
  const { data: header } = await mc.from("bom_headers").select("sku_id,active_version_id").eq("inventory_policy","virtual_kit").not("active_version_id","is",null).limit(1).single();
  if (!zone || !header?.active_version_id) throw new Error("Không có virtual kit BOM để test");
  const { data: items } = await mc.from("bom_items").select("component_sku_id,base_quantity,wastage_percent").eq("bom_version_id",header.active_version_id);
  const { data: mainLoc } = await mc.from("stock_locations").select("id").eq("code","KHO_CHINH").single();
  for (const item of items ?? []) {
    await mc.from("stock_balances").upsert({ sku_id:item.component_sku_id,location_id:mainLoc!.id,quantity:100,reserved_quantity:0 },{onConflict:"sku_id,location_id"});
  }
  const created=await rc.rpc("create_requisition",{p_items:[{sku_id:header.sku_id,entered_quantity:2}],p_zone_id:zone.id,p_purpose:"Verify virtual kit reservation",p_type:"new_supply",p_linked_defect_id:null,p_requester_id:requesterId});
  if(created.error) throw created.error; const rid=created.data as string;
  const sub=await rc.rpc("submit_requisition",{p_id:rid}); if(sub.error) throw sub.error;
  const approved=await mc.rpc("approve_requisition",{p_id:rid,p_by:managerId}); if(approved.error) throw approved.error;
  const {data:reservations,error}=await mc.from("stock_reservations").select("sku_id,reserved_quantity,bom_version_id,status").eq("source_document_id",rid);
  if(error) throw error;
  if(reservations?.length !== items?.length) throw new Error(`Expected ${items?.length} component reservations, got ${reservations?.length}`);
  if(reservations?.some(r=>r.bom_version_id!==header.active_version_id)) throw new Error("BOM version snapshot mismatch");
  const rejected=await mc.rpc("reject_requisition",{p_id:rid,p_by:managerId,p_reason:"verify release"}); if(rejected.error) throw rejected.error;
  const {data:released}=await mc.from("stock_reservations").select("status").eq("source_document_id",rid);
  if(released?.some(r=>r.status!=="released")) throw new Error("Reservation was not released atomically");
  console.log("PASS virtual-kit reservation + BOM snapshot + reject release");
}
main().catch(e=>{console.error("FAIL:",e.message);process.exit(1)});
