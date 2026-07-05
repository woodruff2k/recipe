# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**RecipeShare** — 레시피 작성·공유·탐색 풀스택 예제. `backend/`(Express API)와
`frontend/`(Next.js)를 **pnpm workspace로 묶은 모노레포**다. `pnpm-workspace.yaml`이 워크스페이스
멤버를 정의하고, 공유 버전(`typescript`, `@types/node`)은 **pnpm catalog**(`catalog:`)로 단일화한다.
`packageManager`는 `pnpm@9.15.9`(corepack)다 — **npm/yarn으로 설치하지 말 것**. 루트에서 `pnpm -r`로
전체를, `--filter`로 개별 패키지를 실행한다.

> recipe는 **자체 git 저장소**다(`git init` 완료, 상위 책 저장소와 분리됨). Git hooks는
> `core.hooksPath = recipe/.husky`로 활성화되어 recipe 커밋/푸시에만 적용된다(pre-commit:
> lint+format, commit-msg: Conventional Commits, pre-push: test+typecheck). 비활성화는
> `pnpm hooks:uninstall`.

## 자주 쓰는 명령

```bash
# 루트 (recipe/) — corepack이 pnpm 9를 자동 사용
pnpm install              # 워크스페이스 전체 설치
pnpm dev                  # backend + frontend 동시(parallel)
pnpm build                # 전체 빌드 (pnpm -r build)
pnpm lint                 # 전체 lint
pnpm typecheck            # 전체 tsc --noEmit
pnpm db:migrate           # backend Prisma 마이그레이션(dev)
pnpm db:seed              # 데모 데이터: demo@recipe.dev / password123
pnpm format               # prettier --write . (코드 스타일: double quote)

# 개별 패키지 — --filter (경로 또는 패키지명)
pnpm --filter ./backend dev     # ts-node-dev, http://localhost:4000
pnpm --filter ./backend exec prisma generate
pnpm --filter ./frontend dev    # next dev, http://localhost:3000
pnpm --filter ./frontend build  # standalone 출력 — Docker가 의존

# Docker — 개발(권장): Postgres + hot reload + 볼륨 + 네트워크
docker compose -f docker-compose.dev.yml up --build   # db:5433, be:4000, fe:3000
# Docker — 프로덕션(예시)
JWT_SECRET="$(openssl rand -hex 32)" docker compose up --build
```

> Prisma 클라이언트는 pnpm 가상 스토어(`node_modules/.pnpm/...`)에 생성된다. install 후 import 에러가
> 나면 `pnpm --filter ./backend exec prisma generate`를 먼저 실행할 것. 새 의존성 추가는
> `pnpm --filter ./backend add <pkg>`처럼 워크스페이스 대상에 붙인다.

**테스트:** Jest(단위) + Playwright(E2E)가 구성되어 있습니다(US-6.3 부분 구현). 백엔드는
`backend/src/**/*.test.ts`(예: `app.test.ts`, `utils/jwt.test.ts`), 프론트엔드는
`frontend/src/**/*.test.tsx`(예: `app/page.test.tsx`, `components/ui/button.test.tsx`)에
Jest 단위 테스트가 있습니다. 루트 `e2e/`(`home.spec.ts`, `mvp.spec.ts`, `p1-features.spec.ts`)에는
Playwright로 회원가입→작성→검색→수정→삭제→가드 등 핵심 흐름을 검증하는 E2E 테스트가 있습니다.
현재 백엔드 단위 테스트는 DB를 거치지 않는 얕은 범위(health/404/401, jwt round-trip)이며,
CLAUDE.md가 권장하는 통합 테스트(Express 앱 + 일회용 Postgres, 예: testcontainers 또는 dev `db`)는
아직 추가되지 않았습니다. 실행: `pnpm test`(Jest, 루트에서 `-r`), `pnpm test:e2e`(Playwright).

## 아키텍처 — 큰 그림

### 백엔드 요청 흐름 (여러 파일에 걸침)

`Route → Middleware → Controller → (Prisma / Storage)`. 핵심 규약:

- **모든 컨트롤러 핸들러는 `utils/asyncHandler.ts`로 감싼다.** 그래야 reject가 Express의 중앙
  에러 핸들러로 전달된다. 라우트(`routes/*.ts`)는 미들웨어 연결과 위임만 하고 로직은
  `controllers/*.controller.ts`에 둔다.
- **에러는 throw로 처리한다.** `utils/errors.ts`의 `badRequest/unauthorized/forbidden/notFound/
conflict`를 throw하면 `middlewares/error.ts`가 JSON으로 변환한다. ZodError도 여기서 400으로
  매핑되므로, 컨트롤러는 `schema.parse(req.body)`만 호출하면 된다. `res.status().json()`을 직접
  쓰며 분기하지 말 것.
- **인증:** `middlewares/auth.ts`의 `requireAuth`가 `Authorization: Bearer` 토큰을 검증하고
  `req.userId`를 채운다. 보호 라우트는 이 미들웨어를 라우트에 붙인다. 토큰 발급/검증 로직은
  `utils/jwt.ts`.
- **환경변수는 `config/env.ts` 한 곳에서만 읽는다.** 부팅 시 `JWT_SECRET` 누락이면 즉시 실패
  (fail-fast). `process.env`를 다른 파일에서 직접 읽지 말 것.
- **API 문서:** `backend/openapi.yaml`이 단일 출처다. 라우트/스키마를 바꾸면 이 파일도 함께
  갱신할 것. `GET /api-docs`(Swagger UI), `GET /openapi.yaml`(원본)로 확인 가능.

### 이미지 저장 추상화 (S3 전환 대비)

앱은 `storage/StorageProvider` 인터페이스에만 의존한다. 구현체 선택은 `storage/index.ts`의
팩토리가 `STORAGE_DRIVER`로 한다. 현재 `local`만 구현(`LocalStorageProvider`), `s3`는 throw.
S3 전환 = `S3StorageProvider` 추가 + 팩토리 분기 한 줄. **다른 코드는 건드리지 말 것.**

### 데이터 모델 (PostgreSQL)

DB는 **PostgreSQL**(`schema.prisma` provider=postgresql). `Recipe.ingredients`/`steps`는
**JSON 문자열로 저장**되고 `recipe.controller.ts`가 쓸 때 `JSON.stringify`, 읽을 때
`serialize()`/`safeParseArray()`로 배열 변환한다(과거 SQLite 잔재이나 PG에서도 동작 —
새 코드에서 이 컬럼을 다룰 때 직렬화/역직렬화를 반드시 거칠 것. PG의 `Json`/`text[]`로
바꾸려면 컨트롤러도 함께 수정). 마이그레이션은 `backend/prisma/migrations/`에 있고 컨테이너/배포
시작 시 `prisma migrate deploy`로 적용된다. 개발 DB는 `docker-compose.dev.yml`의 `db` 서비스.

### 프론트엔드

- App Router. 페이지는 대부분 `"use client"` + `useEffect`로 API를 직접 호출한다.
- **모든 API 호출은 `lib/api.ts`의 `api` 객체를 거친다.** 이 클라이언트가 토큰
  주입(`tokenStore`, localStorage)·`ApiError` 변환·FormData 처리(업로드)를 담당한다. 컴포넌트에서
  `fetch`를 직접 부르지 말 것.
- 인증 상태는 `contexts/auth-context.tsx`의 `AuthProvider`/`useAuth`. 백엔드 주소는
  `NEXT_PUBLIC_API_URL`(빌드 타임에 인라인됨 — Docker는 build arg로 주입).

## ⚠️ Tailwind / shadcn 버전 주의 (이 프로젝트의 핵심 함정)

이 프론트엔드는 **Tailwind v4 + base-ui 기반 shadcn**을 쓴다(`create-next-app@14`의 v3가 아님).
실수하기 쉬운 지점:

- `globals.css`는 v4 문법(`@import "tailwindcss"`, `@theme inline`, oklch 토큰)을 쓴다.
  `@tailwind base/components/utilities`나 v3용 `tailwind.config.ts`를 다시 들이지 말 것 — 빌드가
  깨진다.
- PostCSS 플러그인은 `@tailwindcss/postcss`다.
- shadcn Button은 base-ui 기반이라 **`asChild`가 없다.** 링크형 버튼은
  `<Link className={buttonVariants({...})}>` 패턴을 쓴다(`components/site-header.tsx` 참고).

## 설계 문서 (단일 출처)

`docs/`에 설치/실행 가이드(`GETTING-STARTED.md`), 배포 가이드(`DEPLOYMENT-GUIDE.md`),
운영 Runbook(`RUNBOOK.md`), MVP 명세(`MVP-SPEC.md`), 아키텍처(`ARCHITECTURE.md`),
C4(`C4-ARCHITECTURE.md`), 아키텍처 결정 기록(`adr/`), WBS(`WBS.md`),
리스크(`RISK-ANALYSIS.md`), 모듈별 리팩토링 로드맵(`USERSERVICE-REFACTOR-ROADMAP.md`)이
있다. 우선순위·추정 시간·구현 상태는 이 문서들이
서로 동기화되어 있으니, 범위/일정을 바꿀 때는 **MVP-SPEC와 WBS를 함께 갱신**할 것. DB
provider처럼 근본적인 변경을 할 때는 `adr/`에도 새 ADR을 추가할 것(선례:
`adr/0002-postgresql-over-sqlite.md`).
