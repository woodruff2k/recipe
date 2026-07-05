"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewRecipePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [steps, setSteps] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Redirect unauthenticated users once auth state is resolved.
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

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
      const { recipe } = await api.createRecipe({
        title,
        description,
        // Split textarea lines into arrays, trimming empties.
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
      toast.success("레시피가 등록되었습니다.");
      router.push(`/recipes/${recipe.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "레시피 등록에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !user) return <p className="text-muted-foreground">확인 중...</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>레시피 작성</CardTitle>
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
              placeholder={"스파게티 200g\n토마토 소스 1컵"}
              value={ingredients}
              onChange={(e) => setIngredients(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="steps">조리 순서 (한 줄에 하나씩)</Label>
            <Textarea
              id="steps"
              rows={5}
              placeholder={"물을 끓인다\n면을 삶는다"}
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
            {submitting ? "등록 중..." : "레시피 등록"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
