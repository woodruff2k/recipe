import bcrypt from "bcryptjs";
import type { UserRecord, UserRepository } from "../repositories/user.repository";
import { PrismaUserRepository } from "../repositories/user.repository";
import {
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  UserNotFoundError,
} from "./user.errors";

export interface PublicUser {
  id: string;
  email: string;
  name: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
}

function toPublicUser(user: UserRecord): PublicUser {
  return { id: user.id, email: user.email, name: user.name };
}

/**
 * 사용자 계정 관리(가입/인증/조회/수정)를 담당하는 서비스.
 * 영속성은 UserRepository로 주입받아 Prisma에 직접 결합되지 않는다(테스트는 페이크 구현체로 대체).
 */
export class UserService {
  constructor(private readonly users: UserRepository = new PrismaUserRepository()) {}

  async register(input: RegisterInput): Promise<PublicUser> {
    const existing = await this.users.findByEmail(input.email);
    if (existing) {
      throw new EmailAlreadyRegisteredError(input.email);
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await this.users.create({
      email: input.email,
      passwordHash,
      name: input.name,
    });
    return toPublicUser(user);
  }

  async verifyCredentials(email: string, password: string): Promise<PublicUser> {
    const user = await this.users.findByEmail(email);
    if (!user) {
      throw new InvalidCredentialsError();
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new InvalidCredentialsError();
    }
    return toPublicUser(user);
  }

  async getById(id: string): Promise<PublicUser> {
    const user = await this.users.findById(id);
    if (!user) {
      throw new UserNotFoundError(id);
    }
    return toPublicUser(user);
  }

  async update(id: string, data: UpdateUserInput): Promise<PublicUser> {
    if (data.email) {
      const existing = await this.users.findByEmail(data.email);
      if (existing && existing.id !== id) {
        throw new EmailAlreadyRegisteredError(data.email);
      }
    }

    const user = await this.users.update(id, data);
    return toPublicUser(user);
  }
}

export const userService = new UserService();
