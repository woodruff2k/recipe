"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function EditRecipePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [steps, setSteps] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  // 기존 레시피 로드 + 소유권 확인
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { recipe } = await api.getRecipe(params.id);
        if (cancelled) return;
        if (recipe.authorId !== user.id) {
          toast.error("본인 레시피만 수정할 수 있습니다.");
          router.replace(`/recipes/${params.id}`);
          return;
        }
        setTitle(recipe.title);
        setDescription(recipe.description);
        setIngredients(recipe.ingredients.join("\n"));
        setSteps(recipe.steps.join("\n"));
        setImageUrl(recipe.imageUrl);
      } catch (err) {
        toast.error(
          err instanceof ApiError ? err.message : "레시피를 불러오지 못했습니다.",
        );
        router.replace("/");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, params.id, router]);

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await api.uploadImage(file);
      setImageUrl(url);
      toast.success("이미지가 업로드되었습니다.");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "이미지 업로드에 실패했습니다.",
      );
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.updateRecipe(params.id, {
        title,
        description,
        ingredients: ingredients
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        steps: steps
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        imageUrl,
      });
      toast.success("레시피가 수정되었습니다.");
      router.push(`/recipes/${params.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "레시피 수정에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading)
    return <p className="text-muted-foreground">불러오는 중...</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>레시피 수정</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">제목</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">설명</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ingredients">재료 (한 줄에 하나씩)</Label>
            <Textarea
              id="ingredients"
              rows={5}
              value={ingredients}
              onChange={(e) => setIngredients(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="steps">조리 순서 (한 줄에 하나씩)</Label>
            <Textarea
              id="steps"
              rows={5}
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="image">대표 이미지</Label>
            <Input id="image" type="file" accept="image/*" onChange={handleImage} />
            {uploading && <p className="text-sm text-muted-foreground">업로드 중...</p>}
            {imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="미리보기" className="h-40 rounded object-cover" />
            )}
          </div>
          <Button type="submit" disabled={submitting || uploading}>
            {submitting ? "저장 중..." : "수정 완료"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
