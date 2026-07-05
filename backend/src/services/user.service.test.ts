import bcrypt from "bcryptjs";
import { UserService } from "./user.service";
import type {
  UserRecord,
  UserRepository,
  CreateUserInput,
  UpdateUserData,
} from "../repositories/user.repository";
import {
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  UserNotFoundError,
} from "./user.errors";

/** 의존성 주입 덕분에 jest.mock 없이 순수 유닛 테스트가 가능한 페이크 구현체. */
class InMemoryUserRepository implements UserRepository {
  private users: UserRecord[] = [];
  private seq = 0;

  async findByEmail(email: string): Promise<UserRecord | null> {
    return this.users.find((u) => u.email === email) ?? null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.users.find((u) => u.id === id) ?? null;
  }

  async create(input: CreateUserInput): Promise<UserRecord> {
    const user: UserRecord = { id: `user-${++this.seq}`, ...input };
    this.users.push(user);
    return user;
  }

  async update(id: string, data: UpdateUserData): Promise<UserRecord> {
    const user = this.users.find((u) => u.id === id);
    if (!user) throw new Error(`fixture error: no user with id ${id}`);
    Object.assign(user, data);
    return user;
  }

  seed(user: UserRecord): void {
    this.users.push(user);
  }
}

describe("UserService", () => {
  let repo: InMemoryUserRepository;
  let service: UserService;

  beforeEach(() => {
    repo = new InMemoryUserRepository();
    service = new UserService(repo);
  });

  describe("register", () => {
    it("비밀번호를 해시로 저장하고 공개 사용자 정보를 반환한다", async () => {
      const result = await service.register({
        email: "new@example.com",
        password: "password123",
        name: "New User",
      });

      expect(result).toEqual({
        id: expect.any(String),
        email: "new@example.com",
        name: "New User",
      });

      const stored = await repo.findByEmail("new@example.com");
      expect(stored?.passwordHash).not.toBe("password123");
      expect(await bcrypt.compare("password123", stored!.passwordHash)).toBe(true);
    });

    it("이미 등록된 이메일이면 EmailAlreadyRegisteredError", async () => {
      repo.seed({
        id: "existing",
        email: "dup@example.com",
        name: "Existing",
        passwordHash: "x",
      });

      await expect(
        service.register({
          email: "dup@example.com",
          password: "password123",
          name: "New",
        }),
      ).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
    });
  });

  describe("verifyCredentials", () => {
    it("이메일/비밀번호가 맞으면 공개 사용자 정보를 반환한다", async () => {
      const passwordHash = await bcrypt.hash("password123", 10);
      repo.seed({ id: "user-1", email: "a@b.com", name: "A", passwordHash });

      const result = await service.verifyCredentials("a@b.com", "password123");
      expect(result).toEqual({ id: "user-1", email: "a@b.com", name: "A" });
    });

    it("존재하지 않는 이메일이면 InvalidCredentialsError", async () => {
      await expect(
        service.verifyCredentials("nobody@example.com", "x"),
      ).rejects.toBeInstanceOf(InvalidCredentialsError);
    });

    it("비밀번호가 틀리면 InvalidCredentialsError", async () => {
      const passwordHash = await bcrypt.hash("password123", 10);
      repo.seed({ id: "user-1", email: "a@b.com", name: "A", passwordHash });

      await expect(
        service.verifyCredentials("a@b.com", "wrong-password"),
      ).rejects.toBeInstanceOf(InvalidCredentialsError);
    });
  });

  describe("getById", () => {
    it("존재하는 사용자면 공개 정보를 반환한다", async () => {
      repo.seed({ id: "user-1", email: "a@b.com", name: "A", passwordHash: "x" });
      const result = await service.getById("user-1");
      expect(result).toEqual({ id: "user-1", email: "a@b.com", name: "A" });
    });

    it("존재하지 않는 id면 UserNotFoundError", async () => {
      await expect(service.getById("missing")).rejects.toBeInstanceOf(UserNotFoundError);
    });
  });

  describe("update", () => {
    it("이름을 수정한다", async () => {
      repo.seed({ id: "user-1", email: "a@b.com", name: "A", passwordHash: "x" });
      const result = await service.update("user-1", { name: "New Name" });
      expect(result).toEqual({ id: "user-1", email: "a@b.com", name: "New Name" });
    });

    it("다른 사용자가 이미 쓰는 이메일이면 EmailAlreadyRegisteredError", async () => {
      repo.seed({ id: "user-1", email: "a@b.com", name: "A", passwordHash: "x" });
      repo.seed({
        id: "user-2",
        email: "taken@example.com",
        name: "B",
        passwordHash: "y",
      });

      await expect(
        service.update("user-1", { email: "taken@example.com" }),
      ).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
    });

    it("자기 자신의 기존 이메일로 값을 유지하는 건 허용한다", async () => {
      repo.seed({ id: "user-1", email: "a@b.com", name: "A", passwordHash: "x" });
      const result = await service.update("user-1", {
        email: "a@b.com",
        name: "New Name",
      });
      expect(result).toEqual({ id: "user-1", email: "a@b.com", name: "New Name" });
    });
  });
});
