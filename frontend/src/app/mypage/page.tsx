"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import type { Recipe } from "@/lib/types";
import { RecipeGrid } from "@/components/recipe-grid";

export default function MyPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { recipes } = await api.listMyRecipes();
        if (!cancelled) setRecipes(recipes);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? err.message : "레시피를 불러오지 못했습니다.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, router]);

  if (authLoading || loading)
    return <p className="text-muted-foreground">불러오는 중...</p>;
  if (error) return <p className="text-destructive">{error}</p>;

  return (
    <section>
      <h1 className="mb-6 text-2xl font-bold">내 레시피</h1>
      <RecipeGrid recipes={recipes} emptyMessage="작성한 레시피가 없습니다." />
    </section>
  );
}
