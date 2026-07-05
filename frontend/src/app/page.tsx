"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Recipe } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RecipeGrid } from "@/components/recipe-grid";

export default function HomePage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (q: string, p: number) => {
    try {
      const res = await api.listRecipes({ q: q || undefined, page: p });
      setRecipes(res.recipes);
      setTotalPages(res.totalPages ?? 1);
      setPage(res.page ?? p);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "레시피를 불러오지 못했습니다.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await load("", 1);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  if (loading) return <p className="text-muted-foreground">불러오는 중...</p>;
  if (error) return <p className="text-destructive">{error}</p>;

  return (
    <section>
      <h1 className="mb-6 text-2xl font-bold">최신 레시피</h1>

      <form
        className="mb-6 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          const q = query.trim();
          setActiveQuery(q);
          void load(q, 1);
        }}
      >
        <Input
          aria-label="레시피 검색"
          placeholder="제목·설명으로 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button type="submit" className="sm:w-auto">
          검색
        </Button>
      </form>

      <RecipeGrid recipes={recipes} />

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => void load(activeQuery, page - 1)}
          >
            이전
          </Button>
          <span className="text-sm text-muted-foreground">
            페이지 {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => void load(activeQuery, page + 1)}
          >
            다음
          </Button>
        </div>
      )}
    </section>
  );
}
