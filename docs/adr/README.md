# Architecture Decision Records (ADR)

RecipeShare의 주요 아키텍처 결정을 기록한다. [Michael Nygard 템플릿](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
(Context → Decision → Alternatives → Consequences)을 따른다.

> **이 ADR들에 대한 중요한 전제**: 이 프로젝트는 책의 학습용 예제이며, 결정 당시의
> 실제 논의 기록(회의록, 이슈 트래커 등)이 남아있지 않다. 아래 문서들은 **현재
> 코드베이스·커밋 이력·주석을 근거로 사후에 재구성한 ADR**이다(retroactive ADR).
> "그때 이렇게 논의했다"가 아니라 "코드가 이렇게 되어 있고, 그 이유로 타당한
> 근거는 이것이다"로 읽어야 한다. 실제 프로젝트라면 신규 ADR은 결정 시점에
> 작성해 이런 재구성이 필요 없도록 하는 것이 원칙이다.

## 목록

| #                                              | 제목                                                     | 상태                               |
| ---------------------------------------------- | -------------------------------------------------------- | ---------------------------------- |
| [0001](./0001-monorepo-pnpm-workspace.md)      | pnpm workspace 모노레포 구조                             | Accepted                           |
| [0002](./0002-postgresql-over-sqlite.md)       | SQLite에서 PostgreSQL로 전환                             | Accepted                           |
| [0003](./0003-jwt-stateless-auth.md)           | JWT 기반 무상태 인증                                     | Accepted                           |
| [0004](./0004-storage-provider-abstraction.md) | StorageProvider 추상화 (S3 전환 대비)                    | Accepted                           |
| [0005](./0005-recipe-arrays-as-json-string.md) | Recipe 배열 필드를 JSON 문자열로 저장                    | Accepted (기술 부채로 재검토 예정) |
| [0006](./0006-client-side-data-fetching.md)    | 클라이언트 사이드 데이터 페칭 (Server Components 미사용) | Accepted                           |

## 새 ADR을 추가할 때

1. `NNNN-짧은-제목.md` 형식으로 번호를 이어서 만든다.
2. 기존 ADR을 뒤집는 결정이면 그 ADR의 상태를 `Superseded by 000X`로 바꾸고,
   새 ADR의 Context에 이전 ADR을 링크한다. 파일을 삭제하지 않는다.
3. 이 `README.md` 목록도 함께 갱신한다.
