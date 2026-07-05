# 로컬 Kubernetes 매니페스트

로컬 클러스터(Rancher Desktop · Docker Desktop · kind · minikube)에서 RecipeShare를
테스트하기 위한 매니페스트입니다.

## 구성

| 리소스               | 내용                                                                        |
| -------------------- | --------------------------------------------------------------------------- |
| `namespace.yaml`     | `recipe` 네임스페이스                                                       |
| `postgres.yaml`      | Secret + PVC(1Gi) + Deployment + Service (postgres:16-alpine)               |
| `backend.yaml`       | ConfigMap + Secret + uploads PVC + Deployment(+ wait-for-db init) + Service |
| `frontend.yaml`      | Deployment + Service (Next.js standalone)                                   |
| `ingress.yaml`       | (선택) recipe.local 단일 호스트 라우팅                                      |
| `kustomization.yaml` | 위 4개를 묶음 (ingress 제외)                                                |

## 1) 이미지 빌드 (모노레포 루트에서)

```bash
cd recipe
docker build -t recipe-backend:local  -f backend/Dockerfile  .
docker build -t recipe-frontend:local -f frontend/Dockerfile .
# 프론트는 NEXT_PUBLIC_API_URL 기본값(http://localhost:4000)으로 빌드됨 → port-forward 접근용
```

## 2) 이미지를 클러스터로 제공

- **Rancher Desktop(dockerd) / Docker Desktop**: 같은 도커 데몬을 공유하므로 추가 작업 불필요
  (매니페스트의 `imagePullPolicy: IfNotPresent` 가 로컬 이미지를 사용).
- **kind**: `kind load docker-image recipe-backend:local recipe-frontend:local`
- **minikube**: `minikube image load recipe-backend:local && minikube image load recipe-frontend:local`

## 3) 배포

```bash
kubectl apply -k k8s/
kubectl -n recipe rollout status deploy/postgres
kubectl -n recipe rollout status deploy/backend
kubectl -n recipe rollout status deploy/frontend
```

## 4) 접근 (port-forward)

```bash
kubectl -n recipe port-forward svc/frontend 3000:3000 &
kubectl -n recipe port-forward svc/backend  4000:4000 &
# 브라우저: http://localhost:3000   ·   API: http://localhost:4000/health
```

> 프론트 이미지에 `http://localhost:4000` 이 인라인되어 있으므로, **backend도 4000으로
> port-forward** 해야 브라우저의 API 호출이 동작합니다.

## 5) (선택) 데모 데이터 시드

```bash
kubectl -n recipe exec deploy/backend -- pnpm --filter ./backend db:seed
# demo@recipe.dev / password123
```

## 6) 정리

```bash
kubectl delete -k k8s/          # 리소스 삭제
kubectl -n recipe delete pvc --all   # 데이터 볼륨까지 삭제(선택)
```

## 비고

- 마이그레이션은 backend 컨테이너 시작 시 이미지 CMD(`prisma migrate deploy`)로 적용됩니다.
  `wait-for-db` initContainer 가 DB 준비를 기다립니다.
- **replicas는 1** 기준입니다. 다중 복제 시 ① 마이그레이션은 Job/initContainer로 분리,
  ② 업로드 PVC(RWO)는 RWX 스토리지나 S3(`STORAGE_DRIVER=s3`)로 전환해야 합니다.
- 시크릿(JWT_SECRET, DB 비밀번호)은 **로컬 테스트용 기본값**입니다. 운영에 사용하지 마세요.
