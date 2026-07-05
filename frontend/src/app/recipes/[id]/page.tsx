"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import type { Recipe } from "@/lib/types";
import { Button, buttonVariants } from "@/components/ui/button";

export default function RecipeDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { recipe } = await api.getRecipe(params.id);
        if (!cancelled) setRecipe(recipe);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? err.message : "레시피를 불러오지 못했습니다.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const handleDelete = async () => {
    if (!recipe || !window.confirm("이 레시피를 삭제할까요?")) return;
    try {
      await api.deleteRecipe(recipe.id);
      toast.success("레시피가 삭제되었습니다.");
      router.push("/");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "삭제에 실패했습니다.");
    }
  };

  if (loading) return <p className="text-muted-foreground">불러오는 중...</p>;
  if (error) return <p className="text-destructive">{error}</p>;
  if (!recipe) return null;

  const isOwner = user?.id === recipe.authorId;

  return (
    <article className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{recipe.title}</h1>
          {recipe.author && (
            <p className="text-sm text-muted-foreground">by {recipe.author.name}</p>
          )}
        </div>
        {isOwner && (
          <div className="flex shrink-0 gap-2">
            <Link
              href={`/recipes/${recipe.id}/edit`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              수정
            </Link>
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              삭제
            </Button>
          </div>
        )}
      </div>

      {recipe.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={recipe.imageUrl}
          alt={recipe.title}
          className="max-h-96 w-full rounded-lg object-cover"
        />
      )}

      <p className="whitespace-pre-wrap">{recipe.description}</p>

      {recipe.ingredients.length > 0 && (
        <section>
          <h2 className="mb-2 text-xl font-semibold">재료</h2>
          <ul className="list-inside list-disc space-y-1">
            {recipe.ingredients.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      {recipe.steps.length > 0 && (
        <section>
          <h2 className="mb-2 text-xl font-semibold">조리 순서</h2>
          <ol className="list-inside list-decimal space-y-1">
            {recipe.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </section>
      )}
    </article>
  );
}
