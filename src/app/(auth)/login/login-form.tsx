"use client";

import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  AlertCircle,
  Eye,
  EyeOff,
  Info,
  Loader2,
  Lock,
  LogIn,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction, type LoginState } from "@/features/auth/actions/login";

const initialState: LoginState = { error: null };

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <Card className="w-full max-w-sm sm:max-w-md border-border/80 bg-card/95 shadow-2xl shadow-primary/5 backdrop-blur-md transition-all gap-4 py-5">
      <CardHeader className="space-y-2 pb-2 text-center border-b-0">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-white p-2 shadow-md shadow-primary/10 ring-1 ring-border/80 dark:bg-card">
          <Image
            src="/brand/logo.png"
            alt="Logo Trại gà Minh Tân Phát"
            width={52}
            height={52}
            className="size-full object-contain"
            priority
          />
        </div>
        <div className="space-y-0.5">
          <div className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">
            TRẠI GÀ MINH TÂN PHÁT
          </div>
          <CardTitle className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Đăng nhập hệ thống
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Hệ thống Quản lý Vật tư & Kho nội bộ
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="pt-0 pb-2">
        <form action={formAction} className="space-y-3.5">
          <input type="hidden" name="next" value={next ?? "/dashboard"} />

          {state.error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-2.5 text-xs sm:text-sm text-destructive animate-in fade-in slide-in-from-top-1"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <div className="flex-1 font-medium">{state.error}</div>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="username" className="text-xs font-semibold text-foreground">
              Tên đăng nhập
            </Label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                <User className="size-4" />
              </div>
              <Input
                id="username"
                name="username"
                required
                autoComplete="username"
                placeholder="VD: nguyen.van.a"
                autoCapitalize="none"
                autoCorrect="off"
                className="h-9 sm:h-10 bg-background/60 pl-9 text-sm transition-colors focus:bg-background"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="password" className="text-xs font-semibold text-foreground">
              Mật khẩu
            </Label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                <Lock className="size-4" />
              </div>
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="h-9 sm:h-10 bg-background/60 pl-9 pr-10 text-sm transition-colors focus:bg-background"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground transition-colors hover:text-foreground focus:outline-hidden"
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPassword ? (
                  <EyeOff className="size-4" aria-hidden="true" />
                ) : (
                  <Eye className="size-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="h-9 sm:h-10 w-full font-medium shadow-md shadow-primary/20 transition-all hover:shadow-lg hover:shadow-primary/30 active:scale-[0.99]"
            disabled={pending}
          >
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Đang đăng nhập…</span>
              </>
            ) : (
              <>
                <LogIn className="size-4" />
                <span>Đăng nhập</span>
              </>
            )}
          </Button>

          <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/40 p-2 text-[11px] sm:text-xs text-muted-foreground">
            <Info className="size-3.5 shrink-0 text-primary" />
            <span>Quên mật khẩu? Vui lòng liên hệ Quản trị viên để được cấp lại.</span>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
