"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";

export function SiteHeader() {
  const { user, logout, loading } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-bold">
          🍳 RecipeShare
        </Link>
        <nav className="flex items-center gap-2">
          {loading ? null : user ? (
            <>
              <Link
                href="/profile"
                className="hidden text-sm text-muted-foreground hover:underline sm:inline"
              >
                {user.name}
              </Link>
              <Link
                href="/mypage"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                내 레시피
              </Link>
              <Link href="/recipes/new" className={buttonVariants({ size: "sm" })}>
                레시피 작성
              </Link>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                로그아웃
              </Button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                로그인
              </Link>
              <Link href="/register" className={buttonVariants({ size: "sm" })}>
                회원가입
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
