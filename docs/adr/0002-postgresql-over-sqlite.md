# ADR-0002: SQLite에서 PostgreSQL로 전환

## 상태

Accepted

> `backend/prisma/schema.prisma`는 이미 `provider = "postgresql"`이지만, 이 전환
> 이전에 작성된 문서(`ARCHITECTURE.md`, `C4-ARCHITECTURE.md` 등) 다수가 여전히
> "SQLite"로 되어 있었다. 이 ADR과 함께 해당 문서들을 실제 상태에 맞게 갱신했다.

## 컨텍스트

초기 개발 단계에서는 별도 DB 서버 없이 파일 하나로 동작하는 **SQLite**를 사용했다.
설치·기동이 간단해 로컬 개발과 최초 프로토타이핑에는 적합했다. 하지만
[`docs/RISK-ANALYSIS.md`](../RISK-ANALYSIS.md)의 위험 D1이 이미 이 선택의 한계를
명시하고 있었다.

> D1: **SQLite 운영 부적합** — 단일 writer, 동시성·다중 인스턴스 한계 (영향 M, 발생 H, 🔴)
> → 완화책: "운영은 PostgreSQL로 전환(provider+URL 변경)"

즉 SQLite는 처음부터 **개발용 임시 선택**으로 문서화되어 있었고, 운영 전환이
예정된 상태였다.

## 결정

DB를 **PostgreSQL 16**으로 전환한다. Prisma의 데이터소스 provider만 바꾸면 되는
구조(`schema.prisma`의 `datasource db { provider = "postgresql" }`)를 활용해
애플리케이션 코드(컨트롤러·서비스)는 거의 손대지 않고 마이그레이션했다. 개발
환경은 `docker-compose.dev.yml`의 `db` 서비스(postgres:16-alpine)로 제공한다.

## 고려했던 대안

| 대안                                 | 기각 사유                                                                                                                                                                                       |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SQLite 유지 + 운영 시 별도 대응**  | RISK-ANALYSIS.md가 이미 지적한 대로, 단일 writer 제약으로 다중 인스턴스/동시 쓰기가 필요한 실서비스에 부적합. "나중에 바꾼다"는 전제 자체가 기술 부채를 예약하는 것이라 조기 전환이 낫다고 판단 |
| **MySQL**                            | Postgres 대비 이점이 이 프로젝트 요구사항(JSON 컬럼, 트라이그램 검색용 `pg_trgm` 확장 등)에서 뚜렷하지 않음. Prisma·생태계 문서화 수준도 Postgres 쪽이 이 학습 목적에 더 적합                   |
| **MongoDB(document DB)**             | `User`-`Recipe`가 명확한 관계형 구조(1:N, FK)이고 Prisma의 관계형 모델링(관계·인덱스·트랜잭션)을 학습 목적으로 다루고자 해서 기각. 스키마 유연성이 이 도메인에 필요하지 않음                    |
| **PlanetScale/Turso 등 서버리스 DB** | 로컬 Docker 개발 환경과의 정합성, 별도 계정/네트워크 설정 없이 바로 실행 가능해야 한다는 학습용 프로젝트 제약상 기각. 인프라 종속성을 최소화하고 싶었음                                         |

## 결과 (Consequences)

**긍정적**

- 동시 쓰기·다중 인스턴스 제약이 사라져 실제 배포 가능한 구조가 됨
- Postgres의 `ILIKE`/GIN 트라이그램 인덱스(`pg_trgm`)를 레시피 검색 성능 개선에 활용 가능(실제로 [쿼리 최적화 작업](../../backend/prisma/migrations/)에서 적용함)
- Prisma provider 변경만으로 마이그레이션이 끝나, 컨트롤러 코드는 거의 수정 없이 유지됨

**트레이드오프**

- 로컬 개발에 Postgres 컨테이너(또는 별도 설치)가 필수가 되어, SQLite 대비 최초 셋업 단계가 하나 늘어남(`docker compose up -d db` 또는 로컬 Postgres 필요)
- `Recipe.ingredients`/`steps`를 JSON 문자열로 저장하는 방식은 SQLite 시절 설계를 그대로 가져온 것이라, Postgres의 네이티브 `Json`/`text[]` 타입을 아직 활용하지 못하고 있음 — 이 잔재는 [ADR-0005](./0005-recipe-arrays-as-json-string.md)에서 별도로 다룸
- 문서(`ARCHITECTURE.md`, `C4-ARCHITECTURE.md`)가 실제 전환 이후에도 한동안 "SQLite"로 남아있었던 것처럼, DB provider 같은 근본적인 변경은 관련 설계 문서 전체를 갱신 대상으로 체크리스트화하지 않으면 누락되기 쉽다는 교훈
