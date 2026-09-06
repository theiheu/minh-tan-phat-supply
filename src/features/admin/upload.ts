"use client";

import { createClient } from "@/lib/supabase/client";

// Upload ảnh icon danh mục lên bucket category-icons, trả về public URL.
export async function uploadCategoryIcon(file: File): Promise<string> {
  const supabase = createClient();
  const ext = file.name.split(".").pop() || "png";
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("category-icons").upload(path, file);
  if (error) throw new Error(error.message);
  return supabase.storage.from("category-icons").getPublicUrl(path).data.publicUrl;
}
