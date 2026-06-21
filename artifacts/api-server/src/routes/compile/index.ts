import { Router } from "express";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../../lib/logger";
import { requireAuth } from "../../middleware/auth";

const execAsync = promisify(exec);
const router = Router();

const workspaceRoot = process.cwd();
const COMPILE_DIR = path.resolve(workspaceRoot, "artifacts/api-server/compile_tmp");

if (!fs.existsSync(COMPILE_DIR)) {
  fs.mkdirSync(COMPILE_DIR, { recursive: true });
}

type LangConfig = {
  ext: string;
  outExt: string;
  buildCmd: (src: string, out: string) => string;
  mimeType: string;
};

const LANG_CONFIGS: Record<string, LangConfig> = {
  c: {
    ext: "c",
    outExt: "exe",
    buildCmd: (src, out) => `x86_64-w64-mingw32-gcc -O2 -o "${out}" "${src}" -lws2_32 -static 2>&1`,
    mimeType: "application/vnd.microsoft.portable-executable",
  },
  "c-linux": {
    ext: "c",
    outExt: "",
    buildCmd: (src, out) => `gcc -O2 -o "${out}" "${src}" 2>&1`,
    mimeType: "application/octet-stream",
  },
  cpp: {
    ext: "cpp",
    outExt: "exe",
    buildCmd: (src, out) => `x86_64-w64-mingw32-g++ -O2 -o "${out}" "${src}" -lws2_32 -static 2>&1`,
    mimeType: "application/vnd.microsoft.portable-executable",
  },
  "cpp-linux": {
    ext: "cpp",
    outExt: "",
    buildCmd: (src, out) => `g++ -O2 -o "${out}" "${src}" 2>&1`,
    mimeType: "application/octet-stream",
  },
  "c-dll": {
    ext: "c",
    outExt: "dll",
    buildCmd: (src, out) => `x86_64-w64-mingw32-gcc -O2 -shared -fPIC -o "${out}" "${src}" -lws2_32 2>&1`,
    mimeType: "application/vnd.microsoft.portable-executable",
  },
  "cpp-dll": {
    ext: "cpp",
    outExt: "dll",
    buildCmd: (src, out) => `x86_64-w64-mingw32-g++ -O2 -shared -fPIC -o "${out}" "${src}" -lws2_32 2>&1`,
    mimeType: "application/vnd.microsoft.portable-executable",
  },
  asm: {
    ext: "asm",
    outExt: "exe",
    buildCmd: (src, out) => {
      const obj = src.replace(/\.asm$/, ".obj");
      return `nasm -f win64 "${src}" -o "${obj}" && x86_64-w64-mingw32-ld "${obj}" -o "${out}" 2>&1`;
    },
    mimeType: "application/vnd.microsoft.portable-executable",
  },
  python: {
    ext: "py",
    outExt: "py",
    buildCmd: (src, _out) => `python3 -m py_compile "${src}" && echo OK 2>&1`,
    mimeType: "text/x-python",
  },
};

router.post("/compile", requireAuth, async (req, res) => {
  const { source, language, filename } = req.body as {
    source: string;
    language: string;
    filename?: string;
  };

  if (!source || !language) {
    res.status(400).json({ error: "source 와 language 필드가 필요합니다" });
    return;
  }

  const config = LANG_CONFIGS[language];
  if (!config) {
    res.status(400).json({
      error: `지원하지 않는 언어입니다. 지원: ${Object.keys(LANG_CONFIGS).join(", ")}`,
    });
    return;
  }

  const id = uuidv4();
  const srcFile = path.join(COMPILE_DIR, `${id}.${config.ext}`);
  const outName = filename
    ? filename.replace(/\.[^.]+$/, `.${config.outExt}`)
    : `output.${config.outExt}`;
  const outFile = path.join(COMPILE_DIR, `${id}_${outName}`);

  try {
    fs.writeFileSync(srcFile, source, "utf-8");

    const cmd = config.buildCmd(srcFile, outFile);
    logger.info({ cmd, language }, "compiling");

    const { stdout, stderr } = await execAsync(cmd, { timeout: 60_000 }).catch((e) => ({
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? e.message ?? "컴파일 실패",
    }));

    const output = (stdout + stderr).trim();

    if (!fs.existsSync(outFile)) {
      res.status(422).json({ error: "컴파일 실패", details: output });
      return;
    }

    const binary = fs.readFileSync(outFile);

    res.setHeader("Content-Type", config.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(outName)}"`);
    res.setHeader("X-Compile-Log", Buffer.from(output.slice(0, 2000)).toString("base64"));
    res.send(binary);
  } catch (err: any) {
    logger.error({ err }, "compile error");
    res.status(500).json({ error: err?.message ?? "컴파일 오류" });
  } finally {
    try { fs.unlinkSync(srcFile); } catch {}
    try { fs.unlinkSync(outFile); } catch {}
    const objFile = srcFile.replace(/\.[^.]+$/, ".obj");
    try { fs.unlinkSync(objFile); } catch {}
  }
});

export default router;
