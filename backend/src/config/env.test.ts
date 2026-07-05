// dotenv.config()가 실제 .env를 다시 읽어 삭제한 값을 되살리지 않도록 no-op으로 대체한다.
jest.mock("dotenv", () => ({ config: jest.fn() }));

describe("env", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("JWT_SECRET이 없으면 부팅 시 즉시 실패한다", () => {
    delete process.env.JWT_SECRET;
    // jest.resetModules()로 재로드된 모듈을 즉시 다시 가져오려면 동적 import 대신
    // 동기 require가 필요하다(테스트 파일 한정 예외).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    expect(() => require("./env")).toThrow(
      "Missing required environment variable: JWT_SECRET",
    );
  });

  it("선택 값이 비어 있으면 기본값을 사용한다", () => {
    process.env.JWT_SECRET = "test-secret";
    delete process.env.PORT;
    delete process.env.CORS_ORIGIN;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { env } = require("./env");

    expect(env.port).toBe(4000);
    expect(env.corsOrigin).toBe("http://localhost:3000");
  });

  it("설정된 값이 있으면 그 값을 사용한다", () => {
    process.env.JWT_SECRET = "test-secret";
    process.env.PORT = "5000";
    process.env.STORAGE_DRIVER = "s3";

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { env } = require("./env");

    expect(env.port).toBe(5000);
    expect(env.storageDriver).toBe("s3");
  });
});
