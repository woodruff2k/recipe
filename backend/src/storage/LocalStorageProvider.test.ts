import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { LocalStorageProvider } from "./LocalStorageProvider";

describe("LocalStorageProvider", () => {
  let tmpDir: string;
  let provider: LocalStorageProvider;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "recipe-upload-test-"));
    provider = new LocalStorageProvider(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("저장하면 디스크에 파일이 생기고 key/url을 반환한다", async () => {
    const result = await provider.save(Buffer.from("hello"), "photo.png", "image/png");

    expect(result.key).toMatch(/\.png$/);
    expect(result.url).toContain(result.key);

    const written = await fs.readFile(path.join(tmpDir, result.key), "utf-8");
    expect(written).toBe("hello");
  });

  it("MIME 매핑에 없는 타입은 원본 파일의 확장자를 사용한다", async () => {
    const result = await provider.save(
      Buffer.from("data"),
      "note.bin",
      "application/octet-stream",
    );
    expect(result.key).toMatch(/\.bin$/);
  });

  it("delete는 존재하는 파일을 지운다", async () => {
    const saved = await provider.save(Buffer.from("x"), "a.png", "image/png");
    await provider.delete(saved.key);
    await expect(fs.access(path.join(tmpDir, saved.key))).rejects.toThrow();
  });

  it("delete는 존재하지 않는 파일이어도 에러를 던지지 않는다(ENOENT 무시)", async () => {
    await expect(provider.delete("does-not-exist.png")).resolves.toBeUndefined();
  });

  it("delete는 ENOENT가 아닌 에러는 다시 던진다", async () => {
    // 디렉터리를 unlink하면 ENOENT가 아닌 EISDIR/EPERM 계열 에러가 난다.
    await fs.mkdir(path.join(tmpDir, "a-directory"));
    await expect(provider.delete("a-directory")).rejects.toThrow();
  });

  it("MIME 매핑도 없고 원본 파일에 확장자도 없으면 빈 확장자를 사용한다", async () => {
    const result = await provider.save(
      Buffer.from("data"),
      "no-extension",
      "application/octet-stream",
    );
    expect(result.key).not.toContain(".");
  });
});
