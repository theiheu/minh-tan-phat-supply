import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export type { Profile, Role } from "@/lib/types";

export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return data;
});

export const requireProfile = async (): Promise<Profile> => {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return profile;
};

export const requireManager = async (): Promise<Profile> => {
  const profile = await requireProfile();
  if (profile.role !== "manager") redirect("/dashboard");
  return profile;
};
