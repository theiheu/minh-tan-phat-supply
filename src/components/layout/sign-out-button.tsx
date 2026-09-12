"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/features/auth/actions/sign-out";

export function SignOutButton({ compact = false }: { compact?: boolean }) {
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    try {
      await signOutAction();
    } catch {
      window.location.href = "/login";
    }
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
