# 🧯 운영 Runbook

`docker-compose*.yml`, `k8s/`, 실제 로그 출력 코드, 그리고 **이 프로젝트를
개발하며 실제로 겪은 장애**를 근거로 작성했다. 가상의 알람/대시보드를
지어내지 않는다 — 이 프로젝트엔 없기 때문이다(§0 참고).

## 0. 전제: 현재 관측성 수준

| 항목                                    | 상태                                                  |
| --------------------------------------- | ----------------------------------------------------- |
| 모니터링(Prometheus/Grafana/Datadog 등) | ❌ 없음                                               |
| 구조화 로깅(winston/pino 등)            | ❌ 없음 — `console.log`/`console.error` 4곳뿐         |
| 알람/알림                               | ❌ 없음                                               |
| 에러 추적(Sentry 등)                    | ❌ 없음                                               |
| 헬스체크 엔드포인트                     | ✅ `GET /health`                                      |
| 로그 확인 수단                          | `docker compose logs`, `kubectl logs` (stdout 그대로) |

이 문서가 다루는 "장애 대응"은 전부 **사람이 직접 `/health`를 찔러보고,
`docker logs`/`kubectl logs`를 읽고, 수동으로 재시작하는** 수준이다.
`docs/RISK-ANALYSIS.md`의 위험 **Q2**(관측성 없음)가 이미 이 상태를
지적하고 있다 — §7에서 개선 방향을 다룬다.

---

## 1. 첫 대응: 상태 확인 (가장 먼저 할 일)

```bash
# Docker Compose 환경
docker compose -f docker-compose.dev.yml ps      # 또는 docker-compose.yml(운영 예시)
curl -f http://localhost:4000/health
curl -f -o /dev/null -w "%{http_code}\n" http://localhost:3000

# Kubernetes(로컬 클러스터) 환경
kubectl -n recipe get pods
kubectl -n recipe get events --sort-by='.lastTimestamp' | tail -20
```

`/health`가 응답하면 프로세스 자체는 살아있는 것이고, 문제는 특정
기능(DB 연결, 특정 엔드포인트)에 국한됐을 가능성이 크다. 응답이 아예
없으면 §2(재시작)부터 시도한다.

---

## 2. 서비스 재시작 방법

### Docker Compose

```bash
# 특정 서비스만 재시작(컨테이너 재생성 아님, 프로세스만 재시작)
docker compose -f docker-compose.dev.yml restart backend

# 완전히 내렸다 다시 올리기(코드 변경 반영 안 될 때, 상태가 꼬였을 때)
docker compose -f docker-compose.dev.yml down      # DB 볼륨은 보존됨
docker compose -f docker-compose.dev.yml up -d --build

# 컨테이너 자체를 지우고 새로 만들기(찌꺼기 캐시 문제 의심될 때)
docker compose -f docker-compose.dev.yml rm -fsv backend
docker compose -f docker-compose.dev.yml up -d backend
```

### Kubernetes

```bash
kubectl -n recipe rollout restart deploy/backend
kubectl -n recipe rollout status deploy/backend
```

### 재시작 전 확인할 것

재시작은 **증상을 숨길 뿐 원인을 없애지 않는다.** 아래 로그 문자열이
보이면 재시작 전에 원인부터 §3에서 찾을 것:

- `Fatal startup error:` — 부팅 자체가 실패하는 중이라 재시작해도 똑같이 죽는다
- `[unhandled error]` 반복 — 특정 요청 패턴이 서버를 계속 죽이고 있을 수 있다

---

## 3. 실제 겪은 장애 유형별 대응 절차

가상의 시나리오가 아니라 **이 프로젝트 개발 중 실제로 발생하고 해결한
장애**다. 순서는 발생 빈도/가능성 순.

### 3.1 서버가 부팅하자마자 죽는다

**증상**: 컨테이너가 계속 재시작되거나(`docker compose ps`에
`Restarting` 표시), 로그에 `Fatal startup error: Error: Missing
required environment variable: JWT_SECRET`.

**원인**: `backend/src/config/env.ts`의 의도된 fail-fast 동작.
`JWT_SECRET`이 비어있음.

**해결**:

```bash
docker compose logs backend | grep "Fatal startup error"
# JWT_SECRET 확인 후 .env 또는 compose environment에 설정
JWT_SECRET="$(openssl rand -hex 32)" docker compose up -d backend
```

### 3.2 `pnpm: command not found`

**증상**: 로컬(비Docker) 빌드/배포 스크립트, 또는 git hook에서 이 에러.

**원인**: `corepack enable`을 실행하지 않음.

**해결**: `corepack enable`

### 3.3 Prisma Client를 import할 수 없다는 에러

**증상**: `Cannot find module '@prisma/client'` 또는 타입 에러.

**원인**: `pnpm install` 후 Prisma 클라이언트가 재생성되지 않음(스키마
변경 후 특히 자주 발생).

**해결**: `pnpm --filter ./backend exec prisma generate`

### 3.4 `prisma migrate deploy`/`migrate dev`가 멈춘다

**증상**: 마이그레이션 명령이 응답 없이 멈춤. 나중에 실행하면
`Timed out trying to acquire a postgres advisory lock` 에러.

**원인**: 이전에 비정상 종료된 마이그레이션 프로세스(`schema-engine`)가
advisory lock을 쥔 채 남아있음. 실제로 겪은 사례.

**진단 및 해결**:

```bash
# 1) 남은 schema-engine 프로세스 확인
ps aux | grep schema-engine

# 2) Postgres 쪽에서도 직접 확인 가능
docker compose exec db psql -U recipe -d recipe \
  -c "SELECT pid, query, state FROM pg_stat_activity WHERE datname='recipe';"

# 3) 찾은 프로세스 종료 후 재시도
kill -9 <PID>
pnpm --filter ./backend exec prisma migrate deploy
```

### 3.5 새 라우트/페이지가 계속 404, 코드를 고쳐도 반영 안 됨

**증상**: 파일은 분명히 있는데 브라우저에서 404. 코드를 바꿔도 결과가
똑같음.

**원인**: **다른 프로세스가 같은 포트를 이미 점유**하고 있어서 요청이
지금 띄운 서버가 아니라 예전 프로세스(이전 배포, 이전 `kubectl
port-forward` 등)로 가고 있는 것. Next.js/Docker 버그가 아니라 포트
충돌인 경우가 실제로 있었다.

**진단 및 해결**:

```bash
lsof -i :3000 -i :4000
kill <의심되는-PID>
# 필요하면 캐시까지 정리
docker compose rm -fsv frontend && docker compose up -d frontend
```

### 3.6 로그인/DB 관련 요청이 전부 실패한다

**증상**: `/health`는 응답하지만 회원가입/로그인 등 DB를 쓰는 요청만 실패.

**원인**: 로컬(비Docker) 프로세스와 Docker 컨테이너가 **서로 다른
`DATABASE_URL`**을 봐야 하는데 섞였을 가능성. 로컬은
`localhost:5433`, 컨테이너 안에서는 `db:5432`.

**진단**:

```bash
docker compose exec backend printenv DATABASE_URL
docker compose logs backend | grep -i "prisma\|database"
```

### 3.7 컨테이너를 내린 뒤 다시 안 올려서 전부 접속 안 됨

**증상**: 모든 요청이 connection refused.

**원인**: `docker compose down`만 하고 `up`을 다시 안 함(가장 흔한 실수).

**해결**:

```bash
docker compose -f docker-compose.dev.yml ps    # 컨테이너 자체가 없는지 확인
docker compose -f docker-compose.dev.yml up -d
```

### 3.8 (참고) CI/문서 파이프라인의 GitHub Pages 배포 충돌

**증상**: GitHub의 `pages build and deployment`가
`Deployment failed, try again later`로 실패.

**원인**: 서로 다른 GitHub Actions 워크플로(`dashboard.yml`,
`docs-pipeline.yml`)가 같은 `gh-pages` 브랜치에 거의 동시에 push해서
Pages 배포 자체가 충돌함. 애플리케이션 장애는 아니지만 실제로 겪은
배포 인시던트라 기록해둔다.

**해결**: `gh run rerun <실패한-run-id>`로 재시도. 근본 수정은 두
워크플로에 같은 `concurrency` 그룹을 부여해 순차 실행되도록 함(이미
적용됨, `.github/workflows/dashboard.yml`/`docs-pipeline.yml` 참고).

---

## 4. 성능 이슈 진단 (APM 없이 할 수 있는 것)

정식 APM은 없지만 아래로 상당 부분 진단 가능하다.

### 리소스 사용량

```bash
docker stats                          # Docker Compose
kubectl -n recipe top pods            # k8s (metrics-server 필요)
```

### DB 쪽 — 실제 쿼리 최적화 작업에서 썼던 방법

```bash
# 현재 실행 중/대기 중인 쿼리 확인
docker compose exec db psql -U recipe -d recipe \
  -c "SELECT pid, now() - query_start AS duration, query, state FROM pg_stat_activity WHERE state != 'idle' ORDER BY duration DESC;"

# 특정 쿼리가 인덱스를 타는지 확인
docker compose exec db psql -U recipe -d recipe \
  -c "EXPLAIN ANALYZE SELECT * FROM \"Recipe\" WHERE title ILIKE '%검색어%';"
```

`Recipe` 테이블엔 `[authorId, createdAt]`, `[createdAt]`, 검색용
`pg_trgm` GIN 인덱스가 이미 있다(쿼리 최적화 PR 참고) — 느린 쿼리가
있다면 이 인덱스들을 타고 있는지부터 `EXPLAIN`으로 확인한다.

### 애플리케이션 쪽 — 수동 응답 시간 측정

```bash
curl -w "\nTotal: %{time_total}s\n" -o /dev/null -s http://localhost:4000/api/recipes
```

---

## 5. 로그 분석 가이드

**구조화 로그가 없으므로, 있는 로그 문자열이 사실상 전부다.** 아래가
`grep`할 수 있는 실질적인 전체 목록이다(`backend/src` 기준).

| 로그 문자열                                     | 위치                   | 의미                                                               |
| ----------------------------------------------- | ---------------------- | ------------------------------------------------------------------ |
| `🍳 Recipe API listening on ...`                | `index.ts`             | 정상 기동                                                          |
| `<SIGINT\|SIGTERM> received — shutting down...` | `index.ts`             | graceful shutdown 시작                                             |
| `Fatal startup error:`                          | `index.ts`             | **부팅 자체가 실패** — 대부분 env 변수 누락(§3.1)                  |
| `[unhandled error]`                             | `middlewares/error.ts` | 요청 처리 중 예상 못한 에러(500) — 바로 뒤에 실제 에러 객체가 찍힘 |

```bash
# Docker
docker compose logs backend --tail=200 | grep -E "Fatal startup error|\[unhandled error\]"

# Kubernetes
kubectl -n recipe logs deploy/backend --tail=200 | grep -E "Fatal startup error|\[unhandled error\]"
```

`[unhandled error]` 다음 줄에 찍히는 실제 에러 스택을 보고 어느
컨트롤러/미들웨어에서 났는지 특정한다 — `middlewares/error.ts`가
`ZodError`/`HttpError`는 이미 400/401/403/404/409로 정상 처리하므로,
`[unhandled error]`로 찍힌다는 것 자체가 **예상 못 한 버그**라는 신호다.

---

## 6. 증상별 대응책

정식 알람이 없으니 "알람명"이 아니라 **직접 관찰한 증상** 기준이다.

| 증상                                                    | 가능한 원인                          | 확인 순서                                 |
| ------------------------------------------------------- | ------------------------------------ | ----------------------------------------- |
| `/health` 무응답(connection refused)                    | 컨테이너/파드가 죽음 또는 안 떠 있음 | §1 상태 확인 → §3.7 또는 §3.1             |
| `/health`는 되는데 API가 전부 500                       | DB 연결 실패                         | §3.6, `DATABASE_URL` 확인                 |
| 특정 엔드포인트만 계속 500                              | 코드 버그                            | §5 로그에서 `[unhandled error]` 스택 확인 |
| 응답이 점점 느려짐                                      | DB 쿼리 성능 또는 리소스 부족        | §4 `EXPLAIN`, `docker stats`              |
| 컨테이너가 계속 재시작(`Restarting`/`CrashLoopBackOff`) | 부팅 실패 반복                       | §3.1, 로그의 `Fatal startup error` 확인   |
| 새로 배포한 코드가 반영 안 됨                           | 포트 점유 또는 캐시                  | §3.5                                      |

---

## 7. 알려진 갭 (관측성 도입 시 필요한 것)

이 Runbook이 "사람이 수동으로 확인"하는 수준에 머무는 이유이자, 개선
방향이다. `docs/RISK-ANALYSIS.md`의 기존 항목과 교차 참조한다.

| 갭                         | 근거                                                                    | 개선 방향                                          |
| -------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------- |
| 관측성(로깅/모니터링) 부재 | `RISK-ANALYSIS.md` Q2 (🟠)                                              | 요청 로깅(pino 등) + 에러 추적(Sentry) + 헬스 알림 |
| 인증 rate limiting 부재    | `RISK-ANALYSIS.md` S3 (🔴) — 무차별 대입 공격이 "장애"로 나타날 수 있음 | `express-rate-limit`                               |
| 토큰 폐기/리프레시 없음    | `RISK-ANALYSIS.md` S2 (🔴)                                              | 짧은 access + refresh 토큰                         |
| DB 정기 백업 없음          | `DEPLOYMENT-GUIDE.md` §6                                                | `pg_dump` cron                                     |

구조화 로깅(예: pino)이 도입되면 이 Runbook의 §5는 "문자열 grep"에서
"로그 레벨/필드 기준 쿼리"로 다시 써야 한다 — 지금은 그 전 단계임을
분명히 해둔다.

## 관련 문서

- 배포 절차/체크리스트: [`DEPLOYMENT-GUIDE.md`](./DEPLOYMENT-GUIDE.md)
- 설치/트러블슈팅: [`GETTING-STARTED.md`](./GETTING-STARTED.md)
- 전체 위험 목록: [`RISK-ANALYSIS.md`](./RISK-ANALYSIS.md)
