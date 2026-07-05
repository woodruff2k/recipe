import Link from "next/link";
import type { Recipe } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** 레시피 카드 그리드 (반응형: 1 → 2 → 3열). 홈/마이페이지 공용. */
export function RecipeGrid({
  recipes,
  emptyMessage = "결과가 없습니다.",
}: {
  recipes: Recipe[];
  emptyMessage?: string;
}) {
  if (recipes.length === 0) {
    return <p className="text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {recipes.map((recipe) => (
        <Link key={recipe.id} href={`/recipes/${recipe.id}`}>
          <Card className="h-full transition-shadow hover:shadow-md">
            {recipe.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={recipe.imageUrl}
                alt={recipe.title}
                className="h-40 w-full rounded-t-lg object-cover"
              />
            )}
            <CardHeader>
              <CardTitle>{recipe.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="line-clamp-2 text-sm text-muted-foreground">
                {recipe.description}
              </p>
              {recipe.author && (
                <p className="mt-2 text-xs text-muted-foreground">
                  by {recipe.author.name}
                </p>
              )}
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
