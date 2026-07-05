import { HttpError } from "../utils/errors";

/** 이미 가입/사용 중인 이메일로 등록·변경을 시도했을 때. */
export class EmailAlreadyRegisteredError extends HttpError {
  constructor(email: string) {
    super(409, `Email already registered: ${email}`);
    this.name = "EmailAlreadyRegisteredError";
  }
}

/** 로그인 시 이메일/비밀번호가 일치하지 않을 때. */
export class InvalidCredentialsError extends HttpError {
  constructor() {
    super(401, "Invalid email or password");
    this.name = "InvalidCredentialsError";
  }
}

/** 유효한 토큰이지만 대상 사용자가 더 이상 존재하지 않을 때(탈퇴 등). */
export class UserNotFoundError extends HttpError {
  constructor(id: string) {
    super(401, `User no longer exists: ${id}`);
    this.name = "UserNotFoundError";
  }
}
