import { z } from "zod";
import { userService } from "../services/user.service";
import { signToken } from "../utils/jwt";
import { asyncHandler } from "../utils/asyncHandler";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1).max(60),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const updateMeSchema = z
  .object({
    name: z.string().min(1).max(60).optional(),
    email: z.string().email().optional(),
  })
  .refine((data) => data.name !== undefined || data.email !== undefined, {
    message: "At least one of name or email must be provided",
  });

/**
 * 회원가입.
 *
 * `POST /api/auth/register`
 *
 * 비밀번호를 bcrypt로 해싱해 저장하고, 가입과 동시에 JWT를 발급해 자동
 * 로그인 상태로 만든다. 실제 저장/중복 체크 로직은 {@link userService.register}에 위임한다.
 *
 * @remarks 인증 불필요.
 *
 * @example 요청 바디
 * ```json
 * { "email": "user@example.com", "password": "password123", "name": "홍길동" }
 * ```
 *
 * @example 응답 201
 * ```json
 * { "token": "eyJhbGciOi...", "user": { "id": "cm...", "email": "user@example.com", "name": "홍길동" } }
 * ```
 *
 * @throws {z.ZodError} 이메일 형식 오류, 비밀번호 8자 미만, 이름 누락 등 — 400으로 변환됨
 * @throws {EmailAlreadyRegisteredError} 이미 등록된 이메일 — 409로 변환됨
 */
export const register = asyncHandler(async (req, res) => {
  const { email, password, name } = registerSchema.parse(req.body);
  const user = await userService.register({ email, password, name });

  const token = signToken({ sub: user.id, email: user.email });
  res.status(201).json({ token, user });
});

/**
 * 로그인.
 *
 * `POST /api/auth/login`
 *
 * 이메일로 사용자를 찾아 bcrypt로 비밀번호를 비교한다. 사용자가 없거나
 * 비밀번호가 틀려도 **동일한 에러 메시지**를 반환해 계정 존재 여부를
 * 노출하지 않는다({@link userService.verifyCredentials} 참고).
 *
 * @remarks 인증 불필요.
 *
 * @example 요청 바디
 * ```json
 * { "email": "user@example.com", "password": "password123" }
 * ```
 *
 * @example 응답 200
 * ```json
 * { "token": "eyJhbGciOi...", "user": { "id": "cm...", "email": "user@example.com", "name": "홍길동" } }
 * ```
 *
 * @throws {z.ZodError} 이메일 형식 오류, 비밀번호 누락 — 400으로 변환됨
 * @throws {InvalidCredentialsError} 이메일 없음 또는 비밀번호 불일치 — 401로 변환됨
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const user = await userService.verifyCredentials(email, password);

  const token = signToken({ sub: user.id, email: user.email });
  res.json({ token, user });
});

/**
 * 내 프로필 조회.
 *
 * `GET /api/auth/me`
 *
 * `requireAuth` 미들웨어가 채운 `req.userId`로 현재 사용자를 조회한다.
 *
 * @remarks `Authorization: Bearer <token>` 필요.
 *
 * @example 응답 200
 * ```json
 * { "user": { "id": "cm...", "email": "user@example.com", "name": "홍길동" } }
 * ```
 *
 * @throws {UserNotFoundError} 토큰은 유효하지만 사용자가 더 이상 존재하지 않음 — 401로 변환됨
 */
export const me = asyncHandler(async (req, res) => {
  const user = await userService.getById(req.userId!);
  res.json({ user });
});

/**
 * 내 프로필 수정 (이름/이메일).
 *
 * `PATCH /api/auth/me`
 *
 * `name`, `email` 중 최소 하나는 있어야 한다(`updateMeSchema`의 `refine`
 * 검증). 이메일을 바꾸는 경우 다른 사용자가 이미 쓰는 이메일인지
 * 확인한다.
 *
 * @remarks `Authorization: Bearer <token>` 필요.
 *
 * @example 요청 바디 (이름만 수정)
 * ```json
 * { "name": "새 이름" }
 * ```
 *
 * @example 응답 200
 * ```json
 * { "user": { "id": "cm...", "email": "user@example.com", "name": "새 이름" } }
 * ```
 *
 * @throws {z.ZodError} name/email 둘 다 없음, 형식 오류 등 — 400으로 변환됨
 * @throws {EmailAlreadyRegisteredError} 다른 사용자가 이미 쓰는 이메일 — 409로 변환됨
 */
export const updateMe = asyncHandler(async (req, res) => {
  const data = updateMeSchema.parse(req.body);
  const user = await userService.update(req.userId!, data);
  res.json({ user });
});
