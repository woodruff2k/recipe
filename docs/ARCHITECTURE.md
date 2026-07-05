# 🍳 RecipeShare — 아키텍처 문서

현재 코드베이스(`backend/`, `frontend/`) 기준의 시스템 아키텍처입니다.
모든 다이어그램은 Mermaid로 작성되어 GitHub·VS Code·Notion 등에서 렌더링됩니다.

## 기술 스택

| 영역     | 기술                                                                               |
| -------- | ---------------------------------------------------------------------------------- |
| Frontend | Next.js 14 (App Router) · React 18 · TypeScript · Tailwind v4 · shadcn/ui(base-ui) |
| Backend  | Express · TypeScript · Zod(검증)                                                   |
| Database | SQLite (개발) · Prisma ORM                                                         |
| 인증     | JWT (Bearer) · bcrypt                                                              |
| 이미지   | 로컬 파일 저장(`/uploads`) · `StorageProvider`로 S3 전환 추상화                    |
| 배포     | Docker · docker-compose                                                            |

---

## 1. 시스템 구성 (High-level)

```mermaid
flowchart LR
    User(("사용자<br/>브라우저"))

    subgraph FE["Frontend · Next.js 14"]
        UI["React UI<br/>shadcn/ui + Tailwind"]
        AUTH["AuthProvider<br/>(contexts/auth-context)"]
        APIC["API Client<br/>(lib/api.ts)"]
        LS[["localStorage<br/>JWT 토큰"]]
    end

    subgraph BE["Backend · Express"]
        EX["Express App<br/>(app.ts)"]
    end

    DB[("SQLite<br/>Prisma ORM")]
    FS[["로컬 저장소<br/>/uploads"]]
    S3[("AWS S3<br/>전환 예정")]

    User --> UI
    UI --> AUTH
    AUTH --> APIC
    APIC <--> LS
    APIC -->|"HTTPS / JSON<br/>Authorization: Bearer"| EX
    EX -->|"Prisma Client"| DB
    EX -->|"StorageProvider"| FS
    EX -.->|"STORAGE_DRIVER=s3"| S3
```

---

## 2. 백엔드 레이어 구조

요청은 **Route → Middleware → Controller → (Prisma / Storage)** 순으로 흐르며,
모든 핸들러는 `asyncHandler`로 감싸 예외를 중앙 `errorHandler`로 전달합니다.

```mermaid
flowchart TD
    Req["HTTP 요청"] --> APP["app.ts<br/>cors · json · static(/uploads)"]

    APP --> ROUTES

    subgraph ROUTES["Routes (라우팅 정의)"]
        RA["auth.ts"]
        RR["recipes.ts"]
        RU["uploads.ts"]
    end

    subgraph MW["Middlewares"]
        MAUTH["requireAuth<br/>(JWT 검증)"]
        MUP["upload<br/>(multer memory)"]
    end

    subgraph CTRL["Controllers"]
        CA["auth.controller"]
        CR["recipe.controller"]
        CU["upload.controller"]
    end

    subgraph INFRA["Infra / Utils"]
        PRISMA["lib/prisma"]
        STORE["storage<br/>(StorageProvider)"]
        JWTU["utils/jwt"]
        ERR["middlewares/error<br/>(errorHandler)"]
    end

    RA --> MAUTH
    RR --> MAUTH
    RU --> MAUTH --> MUP
    RA --> CA
    RR --> CR
    RU --> CU

    CA --> PRISMA
    CA --> JWTU
    CR --> PRISMA
    CU --> STORE

    PRISMA --> DB[("SQLite")]
    STORE --> FS[["/uploads"]]

    CA -.->|throw HttpError / ZodError| ERR
    CR -.-> ERR
    CU -.-> ERR
    ERR --> Res["JSON 오류 응답"]
```

---

## 3. 인증 흐름 (로그인 → JWT)

```mermaid
sequenceDiagram
    actor U as 사용자
    participant FE as Frontend
    participant R as routes/auth
    participant C as auth.controller
    participant DB as Prisma / SQLite

    U->>FE: 이메일 · 비밀번호 입력
    FE->>R: POST /api/auth/login
    R->>C: login()
    C->>DB: user.findUnique(email)
    DB-->>C: User
    C->>C: bcrypt.compare(pw, hash)
    alt 일치
        C->>C: signToken({sub, email})
        C-->>FE: 200 { token, user }
        FE->>FE: localStorage 저장 + AuthProvider 갱신
    else 불일치
        C-->>FE: 401 Invalid email or password
    end
```

이후 보호된 요청은 `Authorization: Bearer <token>` 헤더를 포함하며,
`requireAuth` 미들웨어가 토큰을 검증하고 `req.userId`를 채웁니다.

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant MW as requireAuth
    participant C as Controller

    FE->>MW: 요청 + Bearer 토큰
    MW->>MW: verifyToken()
    alt 유효
        MW->>C: req.userId 설정 후 next()
        C-->>FE: 정상 응답
    else 무효 / 만료
        MW-->>FE: 401 Invalid or expired token
    end
```

---

## 4. 레시피 작성 흐름 (이미지 업로드 포함)

이미지 업로드와 레시피 생성은 **2단계**로 분리되어 있습니다.

```mermaid
sequenceDiagram
    actor U as 작성자
    participant FE as Frontend
    participant RU as routes/uploads
    participant MUP as multer
    participant ST as StorageProvider
    participant RR as routes/recipes
    participant CR as recipe.controller
    participant DB as Prisma / SQLite

    Note over U,ST: 1단계 — 이미지 업로드
    U->>FE: 이미지 선택
    FE->>RU: POST /api/uploads/image (multipart, Bearer)
    RU->>MUP: 형식 · 용량 검증
    MUP->>ST: storage.save(buffer)
    ST-->>FE: 201 { key, url }

    Note over U,DB: 2단계 — 레시피 생성
    U->>FE: 제목 · 재료 · 순서 입력 후 등록
    FE->>RR: POST /api/recipes (imageUrl 포함, Bearer)
    RR->>CR: create()
    CR->>CR: Zod 검증 + ingredients/steps JSON 직렬화
    CR->>DB: recipe.create({ authorId })
    DB-->>FE: 201 { recipe }
    FE->>FE: /recipes/:id 로 이동
```

---

## 5. 데이터 모델 (ERD)

SQLite에는 네이티브 JSON 타입이 없어 `ingredients`·`steps`는 JSON 문자열로 저장합니다.

```mermaid
erDiagram
    USER ||--o{ RECIPE : "작성"
    USER {
        string id PK "cuid"
        string email UK
        string passwordHash
        string name
        datetime createdAt
        datetime updatedAt
    }
    RECIPE {
        string id PK "cuid"
        string title
        string description
        string ingredients "JSON 문자열(string[])"
        string steps "JSON 문자열(string[])"
        string imageUrl "nullable"
        string authorId FK
        datetime createdAt
        datetime updatedAt
    }
```

> `RECIPE.authorId → USER.id` 관계는 `onDelete: Cascade`로, 사용자 삭제 시 레시피도 함께 삭제됩니다.

---

## 6. 스토리지 추상화 (S3 전환 대비)

앱 코드는 `StorageProvider` 인터페이스에만 의존합니다.
S3 전환 시 `S3StorageProvider`를 추가하고 팩토리(`storage/index.ts`)의 분기만 바꾸면 됩니다.

```mermaid
classDiagram
    class StorageProvider {
        <<interface>>
        +save(buffer, originalName, mimeType) Promise~SaveResult~
        +delete(key) Promise~void~
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
        +createStorage() StorageProvider
    }

    StorageProvider <|.. LocalStorageProvider : 구현
    StorageProvider <|.. S3StorageProvider : "구현(예정)"
    StorageFactory --> StorageProvider : "STORAGE_DRIVER로 선택"
```

---

## 7. 배포 구성 (docker-compose)

```mermaid
flowchart TD
    Browser(("브라우저"))

    subgraph Compose["docker compose"]
        subgraph CF["frontend 컨테이너 :3000"]
            FE["Next.js standalone<br/>node server.js"]
        end
        subgraph CB["backend 컨테이너 :4000"]
            BE["Express<br/>node dist/index.js"]
            MIG["시작 시: prisma migrate deploy"]
        end
        V1[("volume<br/>backend_data<br/>(dev.db)")]
        V2[("volume<br/>backend_uploads")]
    end

    Browser -->|":3000"| FE
    Browser -->|":4000 · JSON/JWT"| BE
    FE -.->|"빌드 시 주입<br/>NEXT_PUBLIC_API_URL"| BE
    BE --> V1
    BE --> V2
```

---

## 디렉터리 매핑 (다이어그램 ↔ 코드)

| 다이어그램 요소 | 코드 위치                                |
| --------------- | ---------------------------------------- |
| API Client      | `frontend/src/lib/api.ts`                |
| AuthProvider    | `frontend/src/contexts/auth-context.tsx` |
| Express App     | `backend/src/app.ts`                     |
| Routes          | `backend/src/routes/`                    |
| Middlewares     | `backend/src/middlewares/`               |
| Controllers     | `backend/src/controllers/`               |
| Prisma Client   | `backend/src/lib/prisma.ts`              |
| StorageProvider | `backend/src/storage/`                   |
| JWT 유틸        | `backend/src/utils/jwt.ts`               |
| 데이터 모델     | `backend/prisma/schema.prisma`           |
| 배포            | `docker-compose.yml`, `*/Dockerfile`     |

> 상세 실행법·API 표·S3 전환 가이드는 [`README.md`](../README.md), MVP 범위는 [`MVP-SPEC.md`](./MVP-SPEC.md),
> C4 모델(Context/Container/Component/Code) 관점은 [`C4-ARCHITECTURE.md`](./C4-ARCHITECTURE.md) 참고.
