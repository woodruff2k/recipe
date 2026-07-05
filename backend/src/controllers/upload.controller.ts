import { asyncHandler } from "../utils/asyncHandler";
import { badRequest } from "../utils/errors";
import { storage } from "../storage";

/**
 * 이미지 업로드.
 *
 * `POST /api/uploads/image`
 *
 * `multipart/form-data`, 필드명 `image`. 실제 파일 검증(형식/용량)은
 * 라우트에 연결된 `middlewares/upload.ts`의 multer 인스턴스가 이 핸들러보다
 * 먼저 수행한다 — 여기 도달했다는 건 이미 형식·용량 검증을 통과했다는 뜻이다.
 * 저장은 `STORAGE_DRIVER`로 선택된 `storage`(`StorageProvider` 구현체)에 위임한다.
 *
 * @remarks `Authorization: Bearer <token>` 필요.
 *   허용 형식: image/jpeg, image/png, image/webp, image/gif.
 *   `MAX_UPLOAD_BYTES` 환경변수로 크기 제한(기본 5MB) — 초과 시 현재
 *   구현은 500으로 응답한다(멀터 에러가 HttpError로 매핑되어 있지
 *   않음, 알려진 이슈).
 *
 * @example 응답 201
 * ```json
 * { "key": "3f9c1e2a-....png", "url": "http://localhost:4000/uploads/3f9c1e2a-....png" }
 * ```
 *
 * @throws {HttpError} 파일이 없음(`No file provided ...`) — 400
 * @throws {HttpError} 지원하지 않는 형식(`Unsupported file type: ...`, multer fileFilter에서 발생) — 400
 */
export const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw badRequest('No file provided (expected multipart field "image")');
  }

  const { key, url } = await storage.save(
    req.file.buffer,
    req.file.originalname,
    req.file.mimetype,
  );

  res.status(201).json({ key, url });
});
