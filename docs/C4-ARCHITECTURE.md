# 🍳 RecipeShare — C4 모델 아키텍처

[C4 모델](https://c4model.com/)의 4단계(Context → Container → Component → Code)로
시스템을 점진적으로 확대하며 설명합니다. 현재 코드베이스 기준입니다.

> 줌 레벨 개념
>
> - **L1 Context** — 누가 쓰고, 무엇과 연결되는가 (가장 큰 그림)
> - **L2 Container** — 어떤 실행 단위(앱/DB/저장소)로 나뉘는가
> - **L3 Component** — 한 컨테이너 내부의 주요 구성요소
> - **L4 Code** — 한 컴포넌트의 실제 코드 구조(클래스/인터페이스)

---

## L1. System Context

RecipeShare를 하나의 블랙박스로 보고, **사용자**와 **외부 시스템**과의 관계만 표현합니다.

```mermaid
C4Context
    title System Context — RecipeShare

    Person(user, "사용자", "레시피를 작성하고 탐색하는 방문자/회원")
    System(recipe, "RecipeShare", "레시피 작성·공유·탐색 웹 서비스")
    System_Ext(s3, "AWS S3", "이미지 객체 저장소 (전환 예정)")

    Rel(user, recipe, "레시피 작성/조회, 로그인", "HTTPS")
    Rel(recipe, s3, "이미지 저장/조회", "S3 API (예정)")

    UpdateRelStyle(user, recipe, $offsetY="-20")
```

**핵심**: 외부 의존성은 (향후의) 이미지 저장소 S3뿐이며, 그 외에는 자체 완결적입니다.
이메일 발송·소셜 로그인 등 외부 시스템은 MVP 범위 밖입니다.

---

## L2. Container

RecipeShare 내부를 **배포·실행 단위(컨테이너)**로 분해합니다.
각 컨테이너는 별도 프로세스로 실행됩니다(docker-compose 기준).

```mermaid
C4Container
    title Container — RecipeShare

    Person(user, "사용자", "웹 브라우저")

    System_Boundary(sys, "RecipeShare") {
        Container(spa, "Frontend", "Next.js 14 / React 18 / TypeScript", "App Router 웹 UI, shadcn/ui. JWT를 localStorage에 보관")
        Container(api, "Backend API", "Express / TypeScript", "REST API, JWT 인증, 입력 검증(Zod), 이미지 업로드")
        ContainerDb(db, "Database", "PostgreSQL + Prisma ORM", "사용자/레시피 데이터")
        Container(fs, "File Storage", "로컬 파일시스템", "업로드 이미지 (/uploads)")
    }

    System_Ext(s3, "AWS S3", "이미지 저장 (전환 예정)")

    Rel(user, spa, "사용", "HTTPS :3000")
    Rel(spa, api, "API 호출", "JSON/HTTPS :4000, Bearer")
    Rel(api, db, "조회/쓰기", "Prisma Client")
    Rel(api, fs, "이미지 저장/서빙", "StorageProvider")
    Rel(api, s3, "이미지 저장", "S3 API (예정)")
```

| 컨테이너     | 기술              | 책임                         | 코드               |
| ------------ | ----------------- | ---------------------------- | ------------------ |
| Frontend     | Next.js 14        | UI 렌더링, 라우팅, 토큰 보관 | `frontend/`        |
| Backend API  | Express           | 인증·CRUD·업로드 REST API    | `backend/`         |
| Database     | PostgreSQL/Prisma | 영속 데이터                  | `backend/prisma/`  |
| File Storage | 로컬 FS           | 이미지 바이너리              | `backend/uploads/` |

---

## L3. Component — Backend API

**Backend API 컨테이너** 내부를 확대합니다.
요청은 `Routes → Middlewares → Controllers → (Prisma / Storage)` 순으로 흐릅니다.

```mermaid
C4Component
    title Component — Backend API (Express)

    Container(spa, "Frontend", "Next.js", "웹 UI")

    Container_Boundary(api, "Backend API") {
        Component(routes, "Routes", "Express Router", "auth · recipes · uploads 엔드포인트 정의")
        Component(mw, "Middlewares", "Express Middleware", "requireAuth(JWT), upload(multer), errorHandler")
        Component(ctrl, "Controllers", "TS 모듈", "auth · recipe · upload 비즈니스 로직")
        Component(jwtutil, "JWT Util", "jsonwebtoken", "토큰 발급/검증")
        Component(storage, "Storage", "StorageProvider", "Local/S3 저장 추상화")
        Component(prisma, "Prisma Client", "Prisma", "DB 접근 계층")
    }

    ContainerDb(db, "Database", "PostgreSQL", "사용자/레시피")
    Container(fs, "File Storage", "로컬 FS", "이미지")

    Rel(spa, routes, "HTTP 요청", "JSON, Bearer")
    Rel(routes, mw, "통과")
    Rel(routes, ctrl, "위임")
    Rel(mw, jwtutil, "토큰 검증")
    Rel(ctrl, prisma, "쿼리")
    Rel(ctrl, storage, "파일 저장")
    Rel(prisma, db, "SQL")
    Rel(storage, fs, "쓰기/읽기")
```

| 컴포넌트      | 코드 위치                                        |
| ------------- | ------------------------------------------------ |
| Routes        | `backend/src/routes/{auth,recipes,uploads}.ts`   |
| Middlewares   | `backend/src/middlewares/{auth,upload,error}.ts` |
| Controllers   | `backend/src/controllers/*.controller.ts`        |
| JWT Util      | `backend/src/utils/jwt.ts`                       |
| Storage       | `backend/src/storage/`                           |
| Prisma Client | `backend/src/lib/prisma.ts`                      |

---

## L3. Component — Frontend

**Frontend 컨테이너** 내부를 확대합니다. App Router 페이지는 대부분 `"use client"` +
`useEffect`로 데이터를 가져오며([ADR-0006](./adr/0006-client-side-data-fetching.md)
참고), 인증 상태와 API 호출이 각각 하나의 컴포넌트로 집중되어 있습니다.

```mermaid
C4Component
    title Component — Frontend (Next.js)

    Container(api, "Backend API", "Express", "REST API")

    Container_Boundary(spa, "Frontend") {
        Component(pages, "Pages", "App Router", "홈·로그인·회원가입·프로필·레시피 CRUD 페이지")
        Component(header, "SiteHeader", "React", "전역 내비게이션, 로그인 상태 표시")
        Component(ui, "UI Primitives", "shadcn/ui (base-ui)", "Button·Card·Input 등 재사용 컴포넌트")
        Component(auth, "AuthProvider", "React Context", "로그인 상태 보관, 세션 복원")
        Component(apic, "API Client", "fetch wrapper", "토큰 주입, ApiError 변환, FormData 처리")
        Component(store, "tokenStore", "localStorage", "JWT 토큰 저장/조회/삭제")
    }

    Rel(pages, auth, "useAuth()")
    Rel(pages, apic, "api.* 호출")
    Rel(pages, ui, "렌더링")
    Rel(header, auth, "useAuth() — 사용자명/로그아웃")
    Rel(auth, apic, "login/register/me 호출")
    Rel(apic, store, "토큰 읽기/쓰기")
    Rel(apic, api, "JSON/HTTPS, Bearer")
```

| 컴포넌트      | 역할                                                                 | 코드 위치                                 |
| ------------- | -------------------------------------------------------------------- | ----------------------------------------- |
| Pages         | 라우팅별 화면, 로딩/에러 상태 관리                                   | `frontend/src/app/**/page.tsx`            |
| SiteHeader    | 전역 내비게이션, 로그인 여부에 따른 메뉴 분기                        | `frontend/src/components/site-header.tsx` |
| UI Primitives | 버튼·카드·입력 등 디자인 시스템 컴포넌트                             | `frontend/src/components/ui/`             |
| AuthProvider  | 로그인 상태를 Context로 전역 공유, 최초 마운트 시 토큰으로 세션 복원 | `frontend/src/contexts/auth-context.tsx`  |
| API Client    | 모든 백엔드 호출의 단일 진입점(토큰 주입·에러 변환)                  | `frontend/src/lib/api.ts`                 |
| tokenStore    | JWT를 `localStorage`에 저장/조회/삭제                                | `frontend/src/lib/api.ts` (동일 파일 내)  |

> **컴포넌트 경계 규칙**([`CLAUDE.md`](../CLAUDE.md)): 페이지는 절대 `fetch`를 직접
> 호출하지 않고 반드시 API Client를 거친다. 이 규칙 덕분에 다이어그램의 `Pages → apic`
> 화살표가 예외 없이 성립한다.

---

## L4. Code — Storage 컴포넌트

가장 깊은 단계로, **Storage 컴포넌트**의 실제 코드 구조(클래스/인터페이스)를 봅니다.
S3 전환이 다른 코드에 영향을 주지 않도록 인터페이스로 분리한 부분입니다.

```mermaid
classDiagram
    class StorageProvider {
        <<interface>>
        +save(buffer, originalName, mimeType) Promise~SaveResult~
        +delete(key) Promise~void~
    }
    class SaveResult {
        +key string
        +url string
    }
    class LocalStorageProvider {
        -dir string
        +save(...) Promise~SaveResult~
        +delete(key) Promise~void~
    }
    class S3StorageProvider {
        +save(...) Promise~SaveResult~
        +delete(key) Promise~void~
    }
    class StorageFactory {
        <<factory>>
        +createStorage() StorageProvider
    }

    StorageProvider ..> SaveResult : returns
    StorageProvider <|.. LocalStorageProvider : 구현
    StorageProvider <|.. S3StorageProvider : "구현(예정)"
    StorageFactory ..> StorageProvider : "STORAGE_DRIVER로 생성"
    StorageFactory ..> LocalStorageProvider
```

**코드 레벨 설계 의도**

- 컨트롤러는 구체 클래스가 아닌 `StorageProvider` 인터페이스에만 의존(의존성 역전).
- `createStorage()` 팩토리(`storage/index.ts`)가 `STORAGE_DRIVER` 환경변수로 구현체 선택.
- S3 전환 = `S3StorageProvider` 추가 + 팩토리 분기 1줄. 그 외 코드 무변경.

---

## 요약: 줌 레벨별 매핑

| C4 레벨      | 다이어그램 타입 | 답하는 질문           | 대응 코드                                                     |
| ------------ | --------------- | --------------------- | ------------------------------------------------------------- |
| L1 Context   | `C4Context`     | 누가/무엇과 연결?     | 시스템 전체                                                   |
| L2 Container | `C4Container`   | 어떤 실행 단위?       | `frontend/`, `backend/`, `prisma/`, `uploads/`                |
| L3 Component | `C4Component`   | 백엔드 내부 구성?     | `routes/`, `middlewares/`, `controllers/`, `storage/`, `lib/` |
| L3 Component | `C4Component`   | 프론트엔드 내부 구성? | `app/`, `components/`, `contexts/`, `lib/api.ts`              |
| L4 Code      | `classDiagram`  | 실제 클래스 구조?     | `backend/src/storage/*.ts`                                    |

> 시퀀스 다이어그램·ERD·배포도는 [`ARCHITECTURE.md`](./ARCHITECTURE.md), MVP 범위는 [`MVP-SPEC.md`](./MVP-SPEC.md) 참고.
