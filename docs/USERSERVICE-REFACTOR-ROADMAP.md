# 🔧 UserService 리팩토링 로드맵

> `backend/src/services/user.service.ts`의 의존성 분석·영향 범위 평가·단계별
> 개선 계획. 실제 코드 조사(의존 관계, 파일 크기, ESLint `complexity` 측정,
> 테스트 커버리지)를 근거로 작성했으며, 실질적 부채가 없는 항목은 로드맵에
> 넣지 않았다.

## 요약

`UserService`는 이미 리팩토링이 끝난 상태에 가깝다(DI/리포지토리 패턴,
도메인 전용 에러, 과다조회 최적화, 100% 테스트 커버리지 — 모두 완료됨).
그래서 이 문서는 3개월짜리 대규모 로드맵이 아니라, **실제로 발견된 갭
2건만 다루는 2주 로드맵**이다.

---

## 의존성 분석

```
auth.controller.ts (유일한 소비자)
        │
        ▼
  UserService ──depends on──▶ UserRepository (interface)
        │                            │
        │                     PrismaUserRepository (구현체)
        ▼
  user.errors.ts (도메인 에러)
```

| 항목                       | 값                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------ |
| 하류(consumer) 영향 범위   | `auth.controller.ts` 1곳. 프론트엔드는 `lib/api.ts`(register/login/me/updateMe)를 거쳐 간접 의존 |
| 상류(dependency) 영향 범위 | `bcryptjs`, Prisma(리포지토리 계층으로 격리되어 있어 직접 노출 없음)                             |
| 전체 크기                  | `user.service.ts`(87줄) + `user.errors.ts`(25줄) + `user.repository.ts`(59줄) = 171줄            |
| 최고 순환 복잡도           | 4 (`update` 메서드) — ESLint `complexity` 규칙 실측, 위험 임계값(15)의 1/4 이하                  |
| 테스트 커버리지            | 100% (`user.service.test.ts` 유닛 + `auth.controller.test.ts` HTTP 계약)                         |

## 영향 범위 평가 — 발견한 실제 갭 2건

지어낸 부채가 아니라 코드/문서를 직접 대조해 확인한 항목만 담았다.

1. **문서 불일치**: `docs/MVP-SPEC.md`, `docs/WBS.md`가 US-1.6을 여전히
   "🟡 조회만"으로 표기 중이나, 실제로는 `PATCH /api/auth/me` + 프로필
   페이지(`frontend/src/app/profile/page.tsx`)로 수정 기능까지 구현 완료됨.
2. **인증 엔드포인트에 rate limiting 없음**: `express-rate-limit` 등
   브루트포스 방어 패키지가 설치되어 있지 않음. `POST /api/auth/login`이
   무제한 시도 가능한 상태.

---

## Sprint 1 (1주차) — 문서 정합성 + 보안 하드닝

| 작업                                                                     | 파일                                              | 근거                         |
| ------------------------------------------------------------------------ | ------------------------------------------------- | ---------------------------- |
| MVP-SPEC/WBS의 US-1.6 상태를 ✅로 갱신                                   | `docs/MVP-SPEC.md`, `docs/WBS.md`                 | 실제 구현과 문서 불일치 해소 |
| `express-rate-limit`으로 `/api/auth/login`, `/register`에 요청 제한 추가 | `backend/src/routes/auth.ts`                      | 브루트포스 방어 공백         |
| 위 두 항목에 대한 테스트 추가                                            | `backend/src/controllers/auth.controller.test.ts` | 회귀 방지                    |

## Sprint 2 (2주차) — US-6.3 잔여 항목과 연계한 DB 통합 테스트

| 작업                                                                                  | 파일                                                          | 근거                                                                                     |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 실제 Postgres 대상 `UserService` 통합 테스트 1세트 추가(현재는 fake repo/mock만 존재) | `backend/src/services/user.service.integration.test.ts`(신규) | CLAUDE.md가 원래 권장한 "일회용 Postgres 통합 테스트" 방향, US-6.3 잔여 항목과 동일한 갭 |
| CI(`ci.yml`)에 이 통합 테스트 실행 스텝 추가 여부 검토                                | `.github/workflows/ci.yml`                                    | `dashboard.yml`에 이미 있는 postgres 서비스 컨테이너 패턴 재사용 가능                    |

---

## 로드맵에 의도적으로 넣지 않은 것

- **US-1.7 비밀번호 재설정**(이메일 인증 메일, 10h, P2): 이메일 발송
  인프라가 전혀 없는 상태라 "UserService 리팩토링" 범위를 넘어서는 별도
  기능 개발 항목 — 로드맵이 아니라 백로그로 분리하는 게 맞다고 판단.
- **캐싱 / 이벤트 발행 / 감사 로그**: 참조하는 곳이 1곳뿐인 87줄짜리
  서비스에 도입할 실익이 없음.

## 비고

- 우선순위·상태는 [`MVP-SPEC.md`](./MVP-SPEC.md), [`WBS.md`](./WBS.md)와
  동기화 대상이다. Sprint 1 작업 완료 시 두 문서의 US-1.6 항목을 반드시
  함께 갱신할 것.
- 이 문서는 "지금 시점 기준" 스냅샷이다. `UserService`에 새 기능(예:
  비밀번호 재설정)이 실제로 추가되면 의존성 분석부터 다시 해야 한다.
