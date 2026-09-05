"use client";

import { createClient } from "@/lib/supabase/client";

// Upload ảnh hỏng lên bucket defect-images, trả về public URL.
export async function uploadDefectImage(file: File): Promise<string> {
  const supabase = createClient();
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("defect-images").upload(path, file);
  if (error) throw new Error(error.message);
  return supabase.storage.from("defect-images").getPublicUrl(path).data.publicUrl;
}
