import type { PrismaClient } from "@prisma/client";
import { prisma } from "../lib/prisma";

/** UserService가 다루는 최소 사용자 레코드 shape — Prisma 생성 타입에 결합되지 않는다. */
export interface UserRecord {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
}

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  name: string;
}

export interface UpdateUserData {
  name?: string;
  email?: string;
}

/** UserService의 영속성 의존성. 테스트에서는 이 인터페이스만 만족하는 페이크로 대체한다. */
export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  create(input: CreateUserInput): Promise<UserRecord>;
  update(id: string, data: UpdateUserData): Promise<UserRecord>;
}

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  findByEmail(email: string): Promise<UserRecord | null> {
    return this.client.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<UserRecord | null> {
    return this.client.user.findUnique({ where: { id } });
  }

  create(input: CreateUserInput): Promise<UserRecord> {
    return this.client.user.create({ data: input });
  }

  update(id: string, data: UpdateUserData): Promise<UserRecord> {
    return this.client.user.update({ where: { id }, data });
  }
}
