// storage/index.ts는 모듈 로드 시점에 STORAGE_DRIVER로 구현체를 즉시 생성하므로,
// 드라이버별 분기를 검증하려면 매번 모듈 레지스트리를 리셋하고 env를 바꿔가며 다시 require해야 한다.
jest.mock("dotenv", () => ({ config: jest.fn() }));

describe("storage factory", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV, JWT_SECRET: "test-secret" };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("STORAGE_DRIVER=local(기본값)이면 LocalStorageProvider를 사용한다", () => {
    process.env.STORAGE_DRIVER = "local";
    // jest.resetModules()로 재로드된 모듈을 즉시 다시 가져오려면 동기 require가 필요하다
    // (테스트 파일 한정 예외).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { storage } = require("./index");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { LocalStorageProvider } = require("./LocalStorageProvider");
    expect(storage).toBeInstanceOf(LocalStorageProvider);
  });

  it("STORAGE_DRIVER=s3이면 모듈 로드 시 미구현 에러를 던진다", () => {
    process.env.STORAGE_DRIVER = "s3";
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    expect(() => require("./index")).toThrow(/not implemented yet/);
  });
});
