"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button
      variant="ghost"
      size={compact ? "icon" : "sm"}
      onClick={handleSignOut}
      disabled={loading}
      aria-label="Đăng xuất"
    >
      <LogOut className="size-4" />
      {!compact && <span>Đăng xuất</span>}
    </Button>
  );
}
