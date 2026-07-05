# 🚀 Getting Started

`package.json`(루트/backend/frontend)과 [`README.md`](../README.md)를 근거로 정리한
설치·실행 가이드. 설정 방식별 개요는 README를, 상세 아키텍처는
[`ARCHITECTURE.md`](./ARCHITECTURE.md)를 참고할 것.

## 1. 시스템 요구사항

| 항목             | 버전/사양                                | 비고                                                                    |
| ---------------- | ---------------------------------------- | ----------------------------------------------------------------------- |
| Node.js          | 22 권장(20도 동작 확인됨)                | Docker 이미지·CI는 22로 고정. `engines` 필드/`.nvmrc`는 아직 없음(TODO) |
| pnpm             | 9.15.9                                   | 전역 설치 불필요 — Node 내장 **corepack**으로 자동 사용                 |
| Docker / Compose | Docker Desktop 또는 Rancher Desktop 최신 | 개발 DB(Postgres) 및 권장 개발 환경에 필요                              |
| PostgreSQL       | 16                                       | Docker로 실행하면 별도 설치 불필요                                      |
| OS               | macOS / Linux / WSL2                     | 특별한 제약 없음                                                        |

> **왜 Node 버전이 애매한가**: 이 프로젝트엔 `engines` 필드나 `.nvmrc`가 없다.
> Docker 이미지와 GitHub Actions CI는 Node 22로 통일되어 있지만, 로컬 개발은
> 강제되지 않는다. 가능하면 22를 쓰되, 안 맞아도 대부분 문제없이 동작한다.

## 2. 설치

```bash
git clone <repo-url> recipe
cd recipe

corepack enable        # pnpm 9를 자동으로 쓰게 해준다 (최초 1회, 전역 설정)
pnpm install            # backend + frontend 워크스페이스 전체 설치
```

`corepack enable`을 건너뛰면 `pnpm: command not found`가 난다 — 아래
[문제 해결](#5-자주-발생하는-문제) 참고.

## 3. 환경 설정

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

`backend/.env`에서 최소한 아래 값을 채운다.

```bash
JWT_SECRET="$(openssl rand -hex 32)"   # 없으면 서버가 즉시 부팅 실패한다(fail-fast)
```

나머지 값(`DATABASE_URL`, `PORT`, `STORAGE_DRIVER` 등)은 `.env.example`의
기본값이 로컬 개발 기준으로 이미 맞춰져 있어 그대로 둬도 된다.

> 이 `.env` 파일들은 각 패키지의 `.gitignore`로 제외되어 커밋되지 않는다.
> 루트에도 `.env`를 만들 수 있는데(예: `PERCY_TOKEN`), 이건 루트 `.gitignore`가
> 따로 관리한다.

## 4. 첫 실행

### 방법 A — Docker (권장)

Postgres + 백엔드(hot reload) + 프론트(Fast Refresh)를 한 번에 띄운다.

```bash
docker compose -f docker-compose.dev.yml up --build
```

기동되면:

| 서비스   | 주소                           |
| -------- | ------------------------------ |
| Frontend | http://localhost:3000          |
| Backend  | http://localhost:4000/health   |
| API 문서 | http://localhost:4000/api-docs |
| DB       | localhost:5433                 |

데모 데이터를 채우려면:

```bash
docker compose -f docker-compose.dev.yml exec backend pnpm --filter ./backend db:seed
# demo@recipe.dev / password123
```

### 방법 B — 비(非)Docker 로컬

DB만 컨테이너로 쓰고 앱은 로컬 Node로 직접 실행한다.

```bash
docker compose -f docker-compose.dev.yml up -d db   # Postgres만
pnpm db:migrate
pnpm db:seed        # 선택
pnpm dev            # backend(:4000) + frontend(:3000) 동시 실행
```

## 5. 기본 사용 예제

앱이 뜬 상태에서 API를 직접 호출해보는 최소 흐름이다(`curl` 기준,
Swagger UI `http://localhost:4000/api-docs`에서 브라우저로도 가능).

```bash
# 1) 회원가입 → 토큰 발급
curl -s -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"me@example.com","password":"password123","name":"Me"}'
# → {"token":"eyJ...", "user": {...}}

TOKEN="<위에서 받은 token 값>"

# 2) 레시피 작성
curl -s -X POST http://localhost:4000/api/recipes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"토마토 파스타","description":"간단한 저녁 메뉴","ingredients":["파스타","토마토소스"],"steps":["면을 삶는다","소스에 버무린다"]}'

# 3) 목록 확인
curl -s http://localhost:4000/api/recipes | python3 -m json.tool
```

브라우저에서는 http://localhost:3000/register 로 가입 → 자동 로그인 →
"레시피 작성" 버튼으로 동일한 흐름을 UI로 체험할 수 있다.

## 6. 자주 발생하는 문제

이 목록은 실제로 이 프로젝트를 개발하면서 마주쳤던 문제들이다(추측이 아님).

### `pnpm: command not found`

`corepack enable`을 안 했을 때 발생한다. Git hook(`pre-commit`) 안에서도
같은 이유로 실패할 수 있다.

```bash
corepack enable
```

### Prisma Client를 import할 수 없다는 에러

`pnpm install` 직후 발생할 수 있다. Prisma 클라이언트는 pnpm 가상
스토어에 별도 생성되며, 스키마를 바꾼 뒤에도 재생성이 필요하다.

```bash
pnpm --filter ./backend exec prisma generate
```

### 서버가 부팅하자마자 죽는다 (`Missing required environment variable: JWT_SECRET`)

의도된 fail-fast 동작이다(`backend/src/config/env.ts`). `.env`에
`JWT_SECRET`이 없거나 빈 값이면 즉시 종료된다. 3번(환경 설정) 참고.

### `prisma migrate dev`가 멈춘 채 끝나지 않는다

이전에 비정상 종료된 마이그레이션 프로세스가 Postgres advisory lock을
쥔 채 남아있을 때 발생한다. 실제로 이런 상황을 겪었다.

```bash
# 1) 남은 프로세스 확인 후 종료
ps aux | grep schema-engine
kill -9 <PID>

# 2) 그래도 안 풀리면 논인터랙티브 명령으로 우회
npx prisma migrate deploy   # migrate dev 대신 — 프롬프트 없이 적용만 한다
```

### Next.js dev 서버에서 새로 만든 페이지가 계속 404

새 라우트 파일이 분명히 있는데도 404가 난다면, **먼저 포트를 다른
프로세스가 점유하고 있는지 의심할 것.** 실제로 이전에 실행해 둔
`kubectl port-forward`가 3000번 포트를 잡고 있어서, 요청이 지금 띄운
개발 서버가 아니라 이전 배포(k8s 등)로 가고 있던 사례가 있었다.

```bash
lsof -i :3000 -i :4000     # 의심 가는 프로세스 확인
kill <PID>                 # 정리 후 재시도
```

이걸로도 안 되면 `.next` 캐시를 지우고 컨테이너를 완전히 재생성한다.

```bash
docker compose -f docker-compose.dev.yml rm -fsv frontend
docker compose -f docker-compose.dev.yml up -d frontend
```

### Docker로 띄웠는데 로그인/DB 관련 요청이 실패한다

로컬(비Docker)과 Docker의 `DATABASE_URL`이 다르다는 걸 놓친 경우가
많다. 로컬은 `localhost:5433`, 컨테이너 안에서는 `db:5432`를 써야 한다
(`docker-compose.dev.yml` 참고). `backend/.env`를 직접 실행 중인 로컬
프로세스와 Docker 컨테이너가 동시에 같은 DB를 다른 주소로 잘못
가리키고 있지 않은지 확인할 것.

### 컨테이너를 내렸다가 다시 켰는데 접속이 안 된다

`docker compose down`으로 내린 뒤 다시 `up`을 안 했으면 당연히 죽어
있다. 상태 확인부터:

```bash
docker compose -f docker-compose.dev.yml ps
lsof -i :3000 -i :4000
docker compose -f docker-compose.dev.yml up -d
```

## 다음 단계

- 전체 API 스펙: http://localhost:4000/api-docs (또는 [`backend/openapi.yaml`](../backend/openapi.yaml))
- 아키텍처 상세: [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md)
- 남은 작업/우선순위: [`docs/MVP-SPEC.md`](./MVP-SPEC.md), [`docs/WBS.md`](./WBS.md)
