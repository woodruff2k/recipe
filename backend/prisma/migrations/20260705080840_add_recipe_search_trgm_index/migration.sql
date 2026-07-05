-- 제목/설명 부분일치 검색(recipe.controller.ts의 `contains` + `insensitive`)은
-- 일반 B-tree 인덱스로는 가속되지 않는다(선행 와일드카드 LIKE '%...%').
-- pg_trgm 확장의 GIN 트라이그램 인덱스로 ILIKE '%keyword%' 검색을 가속한다.
--
-- 주의: CREATE EXTENSION은 데이터베이스에 대한 상위 권한이 필요할 수 있다.
-- 관리형 Postgres(RDS 등)에서는 사전에 확장이 허용되어 있는지 확인할 것.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "Recipe_title_trgm_idx" ON "Recipe" USING GIN ("title" gin_trgm_ops);
CREATE INDEX "Recipe_description_trgm_idx" ON "Recipe" USING GIN ("description" gin_trgm_ops);
