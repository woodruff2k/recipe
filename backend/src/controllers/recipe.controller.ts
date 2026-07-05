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

/**
 * 레시피 목록 조회 (검색 + 페이지네이션).
 *
 * `GET /api/recipes`
 *
 * `q` 쿼리로 제목/설명을 대소문자 무시 부분일치 검색한다(`ingredients`는
 * JSON 문자열로 저장되어 있어 검색 대상이 아니다 — docs/adr/0005 참고).
 * `page`/`pageSize`가
 * 숫자로 파싱되지 않으면 각각 기본값(1, `DEFAULT_PAGE_SIZE`=6)으로
 * 폴백하고, `pageSize`는 50을 넘지 않도록 clamp된다.
 *
 * @remarks 인증 불필요.
 *
 * @example `GET /api/recipes?q=파스타&page=2&pageSize=10`
 *
 * @example 응답 200
 * ```json
 * {
 *   "recipes": [{ "id": "cm...", "title": "토마토 파스타", "ingredients": ["파스타"], "...": "..." }],
 *   "total": 42, "page": 2, "pageSize": 10, "totalPages": 5
 * }
 * ```
 */
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

/**
 * 내가 작성한 레시피 목록 (마이페이지, US-2.4).
 *
 * `GET /api/recipes/mine`
 *
 * 페이지네이션 없이 `req.userId` 소유 레시피 전체를 최신순으로 반환한다.
 *
 * @remarks `Authorization: Bearer <token>` 필요.
 *
 * @example 응답 200
 * ```json
 * { "recipes": [{ "id": "cm...", "title": "...", "authorId": "cm..." }] }
 * ```
 */
export const listMine = asyncHandler(async (req, res) => {
  const recipes = await prisma.recipe.findMany({
    where: { authorId: req.userId! },
    orderBy: { createdAt: "desc" },
    include: { author: { select: { id: true, name: true } } },
  });
  res.json({ recipes: recipes.map(serialize) });
});

/**
 * 레시피 상세 조회.
 *
 * `GET /api/recipes/:id`
 *
 * @remarks 인증 불필요 — 누구나 상세를 볼 수 있다.
 *
 * @example 응답 200
 * ```json
 * { "recipe": { "id": "cm...", "title": "...", "author": { "id": "cm...", "name": "홍길동" } } }
 * ```
 *
 * @throws {HttpError} `id`에 해당하는 레시피가 없음 — 404
 */
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

/**
 * 레시피 작성.
 *
 * `POST /api/recipes`
 *
 * `ingredients`/`steps`는 요청·응답에서는 배열이지만, DB엔 `JSON.stringify`로
 * 직렬화되어 저장된다(`serialize()`가 응답 시 역직렬화).
 *
 * @remarks `Authorization: Bearer <token>` 필요. 작성자는 자동으로 `req.userId`가 된다.
 *
 * @example 요청 바디
 * ```json
 * { "title": "토마토 파스타", "description": "간단한 저녁 메뉴", "ingredients": ["파스타", "토마토소스"], "steps": ["면을 삶는다", "소스에 버무린다"] }
 * ```
 *
 * @example 응답 201
 * ```json
 * { "recipe": { "id": "cm...", "title": "토마토 파스타", "authorId": "cm..." } }
 * ```
 *
 * @throws {z.ZodError} title 누락/120자 초과, description 누락 등 — 400으로 변환됨
 */
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

/**
 * 레시피 수정 (작성자 본인만).
 *
 * `PUT /api/recipes/:id`
 *
 * 소유권 확인엔 `authorId`만 필요해 `select: { authorId: true }`로 전체
 * row를 불필요하게 가져오지 않는다(쿼리 최적화 이력 참고).
 *
 * @remarks `Authorization: Bearer <token>` 필요, 작성자 본인만 가능.
 *
 * @example 요청 바디
 * ```json
 * { "title": "수정된 제목", "description": "수정된 설명" }
 * ```
 *
 * @throws {z.ZodError} 검증 실패 — 400
 * @throws {HttpError} 레시피 없음 — 404
 * @throws {HttpError} 본인 레시피가 아님(`You can only edit your own recipes`) — 403
 */
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

/**
 * 레시피 삭제 (작성자 본인만).
 *
 * `DELETE /api/recipes/:id`
 *
 * @remarks `Authorization: Bearer <token>` 필요, 작성자 본인만 가능.
 *   성공 시 본문 없이 204를 반환한다.
 *
 * @throws {HttpError} 레시피 없음 — 404
 * @throws {HttpError} 본인 레시피가 아님(`You can only delete your own recipes`) — 403
 */
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
