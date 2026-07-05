"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ProfilePage() {
  const { user, loading: authLoading, updateProfile } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    setName(user.name);
    setEmail(user.email);
  }, [authLoading, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await updateProfile({ name, email });
      toast.success("프로필이 수정되었습니다.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "프로필 수정에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || !user)
    return <p className="text-muted-foreground">불러오는 중...</p>;

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>내 프로필</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">이름</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">이메일</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "저장 중..." : "저장"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
