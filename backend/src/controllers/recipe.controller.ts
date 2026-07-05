import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { forbidden, notFound } from "../utils/errors";
import type { Recipe } from "@prisma/client";

const recipeBodySchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().min(1),
  ingredients: z.array(z.string().min(1)).default([]),
  steps: z.array(z.string().min(1)).default([]),
  imageUrl: z.string().url().nullish(),
});

function safeParseArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/** Convert a stored Recipe row (JSON strings) into an API-friendly object. */
function serialize(recipe: Recipe & { author?: { id: string; name: string } | null }) {
  return {
    id: recipe.id,
    title: recipe.title,
    description: recipe.description,
    ingredients: safeParseArray(recipe.ingredients),
    steps: safeParseArray(recipe.steps),
    imageUrl: recipe.imageUrl,
    authorId: recipe.authorId,
    author: recipe.author ?? undefined,
    createdAt: recipe.createdAt,
    updatedAt: recipe.updatedAt,
  };
}

const DEFAULT_PAGE_SIZE = 6;

export const list = asyncHandler(async (req, res) => {
  // 검색: ?q= 로 제목/설명을 대소문자 무시 부분일치 (US-3.3)
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const where = q
    ? {
        OR: [
          { title: { contains: q, mode: "insensitive" as const } },
          { description: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  // 페이지네이션: ?page=&pageSize= (US-3.4)
  const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
  const pageSize = Math.min(
    50,
    Math.max(
      1,
      Number.parseInt(String(req.query.pageSize ?? DEFAULT_PAGE_SIZE), 10) ||
        DEFAULT_PAGE_SIZE,
    ),
  );

  const [total, recipes] = await Promise.all([
    prisma.recipe.count({ where }),
    prisma.recipe.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { author: { select: { id: true, name: true } } },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  res.json({
    recipes: recipes.map(serialize),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
});

// 내 레시피 (US-2.4) — 인증 필요
export const listMine = asyncHandler(async (req, res) => {
  const recipes = await prisma.recipe.findMany({
    where: { authorId: req.userId! },
    orderBy: { createdAt: "desc" },
    include: { author: { select: { id: true, name: true } } },
  });
  res.json({ recipes: recipes.map(serialize) });
});

export const getOne = asyncHandler(async (req, res) => {
  const recipe = await prisma.recipe.findUnique({
    where: { id: req.params.id },
    include: { author: { select: { id: true, name: true } } },
  });
  if (!recipe) {
    throw notFound("Recipe not found");
  }
  res.json({ recipe: serialize(recipe) });
});

export const create = asyncHandler(async (req, res) => {
  const data = recipeBodySchema.parse(req.body);
  const recipe = await prisma.recipe.create({
    data: {
      title: data.title,
      description: data.description,
      ingredients: JSON.stringify(data.ingredients),
      steps: JSON.stringify(data.steps),
      imageUrl: data.imageUrl ?? null,
      authorId: req.userId!,
    },
    include: { author: { select: { id: true, name: true } } },
  });
  res.status(201).json({ recipe: serialize(recipe) });
});

export const update = asyncHandler(async (req, res) => {
  // 소유권 확인엔 authorId만 필요 — 본문 전체(ingredients/steps 등)를 불필요하게 가져오지 않는다.
  const existing = await prisma.recipe.findUnique({
    where: { id: req.params.id },
    select: { authorId: true },
  });
  if (!existing) {
    throw notFound("Recipe not found");
  }
  if (existing.authorId !== req.userId) {
    throw forbidden("You can only edit your own recipes");
  }

  const data = recipeBodySchema.parse(req.body);
  const recipe = await prisma.recipe.update({
    where: { id: req.params.id },
    data: {
      title: data.title,
      description: data.description,
      ingredients: JSON.stringify(data.ingredients),
      steps: JSON.stringify(data.steps),
      imageUrl: data.imageUrl ?? null,
    },
    include: { author: { select: { id: true, name: true } } },
  });
  res.json({ recipe: serialize(recipe) });
});

export const remove = asyncHandler(async (req, res) => {
  const existing = await prisma.recipe.findUnique({
    where: { id: req.params.id },
    select: { authorId: true },
  });
  if (!existing) {
    throw notFound("Recipe not found");
  }
  if (existing.authorId !== req.userId) {
    throw forbidden("You can only delete your own recipes");
  }

  await prisma.recipe.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
