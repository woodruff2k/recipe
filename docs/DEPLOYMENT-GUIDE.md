# 🚀 배포 가이드

`package.json`(루트/backend/frontend), `docker-compose*.yml`, `k8s/`를 근거로
작성한 배포 가이드. **이 프로젝트에 실제로 존재하는 것만** 다룬다 — 존재하지
않는 절차를 지어내지 않는다.

## ⚠️ 먼저 알아야 할 것: 이 프로젝트의 배포 성숙도

| 항목                   | 상태                                                                                                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 개발(dev) 환경         | ✅ 실제로 존재, 매일 사용(`docker-compose.dev.yml`)                                                                                                                                  |
| 스테이징 환경          | ❌ **존재하지 않음** — 코드베이스 전체에 "staging" 언급 0건                                                                                                                          |
| 프로덕션 환경          | 🟡 `docker-compose.yml`이 있지만 파일 자체에 "**프로덕션(예시)**"로 명시된 참고 구성. 실제 클라우드/서버 배포 대상은 없음                                                            |
| 로컬 Kubernetes        | 🟡 `k8s/README.md`에 "**로컬 클러스터** 테스트용"으로 명시 — 프로덕션 k8s 아님                                                                                                       |
| 자동 배포(CD)          | ❌ **없음** — GitHub Actions의 "deploy"는 전부 GitHub Pages(문서/대시보드) 배포이거나 `prisma migrate deploy`(DB 마이그레이션 명령)이지, 앱을 실제 서버에 배포하는 파이프라인이 아님 |
| 이미지 레지스트리/태깅 | ❌ 없음 — 이미지는 매번 로컬에서 `--build`로 즉석 빌드, 버전 태그도 git 태그도 없음                                                                                                  |
| 자동 롤백              | ❌ 없음(위 항목이 없으니 당연히 없음) — 아래 [롤백](#6-롤백-방법-수동) 섹션은 수동 절차만 다룸                                                                                       |

이 문서는 **있는 그대로**(dev + 프로덕션 예시)를 정직하게 문서화한다. 실제
운영 배포가 필요해지면 [§7 알려진 갭](#7-알려진-갭-실제-프로덕션-전환-시-필요한-것)부터 먼저 메워야 한다.

---

## 1. 사전 체크리스트 (모든 배포 공통)

배포(또는 `docker compose up --build` 재실행)를 하기 전에 확인할 것.
아래 항목은 실제로 `.github/workflows/ci.yml`이 PR마다 강제하는 체크와 동일하다.

- [ ] `pnpm lint` 통과 (`ci.yml`의 `Lint` job)
- [ ] `pnpm typecheck` 통과 (`Typecheck` job)
- [ ] `pnpm test` 통과 — backend 84개 (`Backend tests` job)
- [ ] `pnpm test:e2e` 통과 (`E2E tests` job)
- [ ] 새 Prisma 마이그레이션이 있다면 `backend/prisma/migrations/`에 커밋되어 있는지 확인
      (컨테이너 시작 시 `prisma migrate deploy`가 자동 적용함 — §4 "이 구성의 한계" 참고)
- [ ] `JWT_SECRET`을 새로 생성했는지 확인 — `.env.example`의 기본값을 그대로 쓰지 않을 것
      (`docs/RISK-ANALYSIS.md`의 위험 S4가 이미 이 항목을 "🔴 High"로 지적하고 있음)
- [ ] `frontend`를 빌드하기 전에 `NEXT_PUBLIC_API_URL`이 실제 접근 가능한 백엔드 주소로
      설정되어 있는지 확인 — Next.js가 **빌드 타임에 값을 인라인**하므로 빌드 후 바꿔도 반영 안 됨

---

## 2. 환경 변수 설정

### Backend (`backend/.env` 또는 compose `environment:`)

| 변수               | 필수 | dev 기본값                                      | 프로덕션에서 반드시 바꿀 것                                                              |
| ------------------ | :--: | ----------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `JWT_SECRET`       |  ✅  | `change-me-to-a-long-random-secret`             | **반드시 교체**: `openssl rand -hex 32`                                                  |
| `DATABASE_URL`     |  ✅  | `postgresql://recipe:recipe@localhost:5433/...` | 실제 DB 자격증명으로 교체                                                                |
| `CORS_ORIGIN`      |  -   | `http://localhost:3000`                         | 실제 프론트엔드 도메인                                                                   |
| `PUBLIC_BASE_URL`  |  -   | `http://localhost:4000`                         | 실제 백엔드 도메인(업로드 이미지 URL 생성에 사용)                                        |
| `STORAGE_DRIVER`   |  -   | `local`                                         | S3로 전환 시 `s3` (미구현 — [ADR-0004](./adr/0004-storage-provider-abstraction.md) 참고) |
| `JWT_EXPIRES_IN`   |  -   | `7d`                                            | 그대로 사용 가능                                                                         |
| `MAX_UPLOAD_BYTES` |  -   | `5242880`(5MB)                                  | 필요에 따라 조정                                                                         |

### Frontend (`frontend/.env.local` 또는 Docker build arg)

| 변수                  | 필수 | 비고                                                                             |
| --------------------- | :--: | -------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL` |  ✅  | **빌드 타임 인라인** — `docker build --build-arg NEXT_PUBLIC_API_URL=...`로 전달 |

### 프로덕션(예시) compose 실행 시 한 줄로

```bash
JWT_SECRET="$(openssl rand -hex 32)" \
POSTGRES_PASSWORD="$(openssl rand -hex 16)" \
docker compose up --build
```

---

## 3. 개발 환경 배포

이미 [`docs/GETTING-STARTED.md`](./GETTING-STARTED.md)에 상세히 있다 — 요약만.

```bash
docker compose -f docker-compose.dev.yml up --build
```

Postgres + 백엔드(hot reload) + 프론트(Fast Refresh)를 한 번에 띄운다.
`db:5433`, `backend:4000`, `frontend:3000`.

---

## 4. "프로덕션(예시)" 배포 절차

`docker-compose.yml`은 파일 상단에 "프로덕션(예시) 구성"이라고 명시되어 있다.
실제 클라우드 배포가 아니라 **단일 서버에 docker compose로 직접 띄우는
가장 단순한 형태**의 예시다.

### 절차

```bash
# 1) 사전 체크리스트(§1) 확인

# 2) 환경변수 준비(§2) — JWT_SECRET은 반드시 새로 생성
export JWT_SECRET="$(openssl rand -hex 32)"
export POSTGRES_PASSWORD="$(openssl rand -hex 16)"

# 3) 빌드 + 기동
docker compose up --build -d

# 4) 헬스체크로 정상 기동 확인
curl -f http://localhost:4000/health
curl -f -o /dev/null -w "%{http_code}\n" http://localhost:3000

# 5) 마이그레이션 적용 확인 (backend 컨테이너 시작 시 자동 실행됨)
docker compose logs backend | grep -i "migrate\|listening"
```

### 이 구성의 동작 방식

- `backend` 컨테이너는 시작 시 `prisma migrate deploy`를 **자동 실행**한 뒤
  서버를 띄운다(`backend/Dockerfile`의 `CMD`).
- `frontend`는 Next.js `standalone` 출력을 그대로 실행한다(`node server.js`).
- DB 데이터는 `pgdata` named volume에, 업로드 이미지는 `backend_uploads`
  named volume에 보존된다 — **컨테이너를 지워도 볼륨은 남지만, 볼륨까지
  지우면(`down -v`) 데이터가 사라진다.**

### 이 구성의 한계 (알고 배포할 것)

- **다운타임 발생**: `docker compose up --build`는 기존 컨테이너를 내리고
  새로 올리는 방식이라 짧은 다운타임이 생긴다. 블루/그린이나 롤링 배포가
  아니다.
- **다중 인스턴스 마이그레이션 경쟁**: `backend`를 여러 개 띄우면(`--scale
backend=2`) 컨테이너마다 `prisma migrate deploy`가 동시에 실행되어 경쟁
  상태가 될 수 있다(`docs/RISK-ANALYSIS.md` 위험 I3). 지금은 단일
  인스턴스 전제다.
- **업로드 이미지가 로컬 볼륨에만 있음**: 서버를 재배포/이전하면 볼륨을
  함께 옮기지 않는 한 업로드 이미지가 유실된다(`docs/RISK-ANALYSIS.md`
  위험 I1). S3 전환 전까지는 볼륨 백업이 곧 이미지 백업이다.

---

## 5. 로컬 Kubernetes (참고용)

프로덕션 k8s가 아니라 **로컬 클러스터 테스트용**이다. 상세 절차는
[`k8s/README.md`](../k8s/README.md) 참고. 요약:

```bash
docker build -t recipe-backend:local  -f backend/Dockerfile  .
docker build -t recipe-frontend:local -f frontend/Dockerfile .
kubectl apply -k k8s/
kubectl -n recipe port-forward svc/frontend 3000:3000 &
kubectl -n recipe port-forward svc/backend  4000:4000 &
```

---

## 6. 롤백 방법 (수동)

**자동 롤백은 없다.** 이미지 레지스트리도, 버전 태그도, CD 파이프라인도
없기 때문이다. 문제가 생기면 아래를 수동으로 수행한다.

### 애플리케이션 코드 롤백

```bash
# 1) 문제가 생기기 전 마지막 정상 커밋 확인
git log --oneline -10

# 2) 그 커밋으로 되돌아가서 재빌드
git checkout <정상이었던-커밋-SHA>
docker compose up --build -d
```

`main`에 직접 push하지 않고 PR + `ci.yml` 통과를 거쳐왔다면, 이 시점에
"정상이었던 커밋"은 곧 **마지막으로 CI가 통과한 병합 커밋**과 같다.

### DB 마이그레이션 롤백

Prisma의 `migrate deploy`는 **전진(forward-only)만 지원**한다 — 이
프로젝트엔 down-migration 스크립트가 구성되어 있지 않다. 마이그레이션이
문제를 일으켰다면:

1. 그 마이그레이션을 되돌리는 새 마이그레이션을 **직접 작성**해서
   전진 적용하거나,
2. `pgdata` 볼륨의 **백업에서 복원**한다.

> ⚠️ **현재 자동 DB 백업이 구성되어 있지 않다.** 프로덕션으로 전환한다면
> 정기 백업(`pg_dump` cron 등)을 §7 알려진 갭에 포함해 가장 먼저 갖춰야
> 한다.

### 이미지 롤백

레지스트리에 올려둔 이전 이미지가 없으므로, "이미지 롤백"은 사실상
"코드 롤백 후 재빌드"와 같다(위 참고).

---

## 7. 알려진 갭 (실제 프로덕션 전환 시 필요한 것)

이 섹션은 지어낸 로드맵이 아니라, `docs/RISK-ANALYSIS.md`에 이미
기록되어 있는 항목을 배포 관점에서 모은 것이다.

| 갭                               | 근거                                                                                              | 우선순위 |
| -------------------------------- | ------------------------------------------------------------------------------------------------- | :------: |
| 스테이징 환경 부재               | 이 문서 §0에서 확인                                                                               |    —     |
| CD 파이프라인 부재               | 이 문서 §0에서 확인                                                                               |    —     |
| 이미지 레지스트리/버전 태깅 부재 | 이 문서 §6(롤백)에서 확인                                                                         |    —     |
| DB 정기 백업 부재                | 이 문서 §6(롤백)에서 확인                                                                         |    —     |
| JWT_SECRET 기본값 위험           | `RISK-ANALYSIS.md` S4 (🔴 High)                                                                   |   높음   |
| 로컬 파일 저장(이미지) 유실 위험 | `RISK-ANALYSIS.md` I1 (🔴 High) — S3 전환([ADR-0004](./adr/0004-storage-provider-abstraction.md)) |   높음   |
| 다중 인스턴스 마이그레이션 경쟁  | `RISK-ANALYSIS.md` I3 (🟠 Medium)                                                                 |   중간   |

---

## 관련 문서

- 설치/첫 실행: [`GETTING-STARTED.md`](./GETTING-STARTED.md)
- 아키텍처/배포 다이어그램: [`ARCHITECTURE.md`](./ARCHITECTURE.md) §7
- 왜 이렇게 구성했는지: [`adr/`](./adr/README.md)
- 전체 위험 목록: [`RISK-ANALYSIS.md`](./RISK-ANALYSIS.md)
