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

// Kernel stub header injected when compiling as SYS (no WDK available, uses mingw stub)
const KERNEL_STUB_HEADER = `/* MinGW kernel stub — provides minimal DDK definitions for WDM-style drivers */
#ifndef _KERNEL_STUB_H_
#define _KERNEL_STUB_H_
#include <stdint.h>
#define NTSTATUS long
#define NTAPI __stdcall
#define STATUS_SUCCESS 0
#define STATUS_UNSUCCESSFUL ((NTSTATUS)0xC0000001L)
#define IN
#define OUT
#define OPTIONAL
typedef void* PVOID;
typedef uint16_t USHORT;
typedef uint32_t ULONG;
typedef uint64_t ULONG64;
typedef struct _UNICODE_STRING { USHORT Length; USHORT MaximumLength; uint16_t* Buffer; } UNICODE_STRING, *PUNICODE_STRING;
typedef struct _DRIVER_OBJECT { void* DriverStart; ULONG DriverSize; void* DriverSection; void* DriverExtension; UNICODE_STRING DriverName; void* HardwareDatabase; void* FastIoDispatch; void* DriverInit; void* DriverStartIo; void* DriverUnload; void* MajorFunction[28]; } DRIVER_OBJECT, *PDRIVER_OBJECT;
typedef struct _DEVICE_OBJECT { ULONG Type; USHORT Size; LONG ReferenceCount; PDRIVER_OBJECT DriverObject; struct _DEVICE_OBJECT* NextDevice; struct _DEVICE_OBJECT* AttachedDevice; struct _IRP* CurrentIrp; void* Timer; ULONG Flags; ULONG Characteristics; void* Vpb; PVOID DeviceExtension; ULONG DeviceType; CHAR StackSize; void* Queue; ULONG AlignmentRequirement; void* DeviceQueue; void* Dpc; ULONG ActiveThreadCount; PVOID SecurityDescriptor; void* DeviceLock; USHORT SectorSize; USHORT Spare1; void* DeviceObjectExtension; PVOID Reserved; } DEVICE_OBJECT, *PDEVICE_OBJECT;
#define DbgPrint(fmt, ...) ((void)0)
#endif
`;

const LANG_CONFIGS: Record<string, LangConfig> = {
  // ── Windows EXE ──────────────────────────────────────────────
  c: {
    ext: "c", outExt: "exe",
    buildCmd: (src, out) =>
      `x86_64-w64-mingw32-gcc -O2 -o "${out}" "${src}" -lws2_32 -lntdll -static 2>&1`,
    mimeType: "application/vnd.microsoft.portable-executable",
  },
  cpp: {
    ext: "cpp", outExt: "exe",
    buildCmd: (src, out) =>
      `x86_64-w64-mingw32-g++ -O2 -o "${out}" "${src}" -lws2_32 -lntdll -static 2>&1`,
    mimeType: "application/vnd.microsoft.portable-executable",
  },
  // ── Windows DLL ──────────────────────────────────────────────
  "c-dll": {
    ext: "c", outExt: "dll",
    buildCmd: (src, out) =>
      `x86_64-w64-mingw32-gcc -O2 -shared -o "${out}" "${src}" -lws2_32 -lntdll 2>&1`,
    mimeType: "application/vnd.microsoft.portable-executable",
  },
  "cpp-dll": {
    ext: "cpp", outExt: "dll",
    buildCmd: (src, out) =>
      `x86_64-w64-mingw32-g++ -O2 -shared -o "${out}" "${src}" -lws2_32 -lntdll 2>&1`,
    mimeType: "application/vnd.microsoft.portable-executable",
  },
  // ── Windows SYS (kernel driver stub — no WDK) ────────────────
  "c-sys": {
    ext: "c", outExt: "sys",
    buildCmd: (src, out) => {
      // Prepend kernel stub header, then compile as DLL with .sys extension
      const stubSrc = src.replace(/.c$/, "_sys_stub.c");
      return (
        `printf '%s\n' '${KERNEL_STUB_HEADER.replace(/'/g, "'\''")}' > "${stubSrc}" && ` +
        `cat "${src}" >> "${stubSrc}" && ` +
        `x86_64-w64-mingw32-gcc -O2 -shared -nostdlib -e DriverEntry -o "${out}" "${stubSrc}" -lntdll 2>&1`
      );
    },
    mimeType: "application/vnd.microsoft.portable-executable",
  },
  "cpp-sys": {
    ext: "cpp", outExt: "sys",
    buildCmd: (src, out) => {
      const stubSrc = src.replace(/.cpp$/, "_sys_stub.cpp");
      return (
        `printf '%s\n' '${KERNEL_STUB_HEADER.replace(/'/g, "'\''")}' > "${stubSrc}" && ` +
        `cat "${src}" >> "${stubSrc}" && ` +
        `x86_64-w64-mingw32-g++ -O2 -shared -nostdlib -e DriverEntry -o "${out}" "${stubSrc}" -lntdll 2>&1`
      );
    },
    mimeType: "application/vnd.microsoft.portable-executable",
  },
  // ── Linux ELF ────────────────────────────────────────────────
  "c-linux": {
    ext: "c", outExt: "",
    buildCmd: (src, out) => `gcc -O2 -o "${out}" "${src}" 2>&1`,
    mimeType: "application/octet-stream",
  },
  "cpp-linux": {
    ext: "cpp", outExt: "",
    buildCmd: (src, out) => `g++ -O2 -o "${out}" "${src}" 2>&1`,
    mimeType: "application/octet-stream",
  },
  // ── Assembly (NASM win64) ──────────────────────────────────
  asm: {
    ext: "asm", outExt: "exe",
    buildCmd: (src, out) => {
      const obj = src.replace(/.asm$/, ".obj");
      return `nasm -f win64 "${src}" -o "${obj}" && x86_64-w64-mingw32-ld "${obj}" -o "${out}" 2>&1`;
    },
    mimeType: "application/vnd.microsoft.portable-executable",
  },
  "asm-dll": {
    ext: "asm", outExt: "dll",
    buildCmd: (src, out) => {
      const obj = src.replace(/.asm$/, ".obj");
      return `nasm -f win64 "${src}" -o "${obj}" && x86_64-w64-mingw32-ld -shared "${obj}" -o "${out}" 2>&1`;
    },
    mimeType: "application/vnd.microsoft.portable-executable",
  },
  // ── Python (syntax check only, return source) ─────────────
  python: {
    ext: "py", outExt: "py",
    buildCmd: (src, out) => `cp "${src}" "${out}" && python3 -m py_compile "${src}" 2>&1`,
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
  const outExt = config.outExt;
  const outName = filename
    ? filename.replace(/\.[^.]+$/, outExt ? `.${outExt}` : "")
    : `output${outExt ? `.${outExt}` : ""}`;
  const outFile = path.join(COMPILE_DIR, `${id}_${outName}`);

  const tempFiles: string[] = [srcFile, outFile];

  try {
    fs.writeFileSync(srcFile, source, "utf-8");

    const cmd = config.buildCmd(srcFile, outFile);
    logger.info({ cmd, language }, "compiling");

    const { stdout, stderr } = await execAsync(cmd, { timeout: 90_000 }).catch((e) => ({
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
    for (const f of tempFiles) try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {}
    // clean stub files
    try { const s = srcFile.replace(/\.[^.]+$/, "_sys_stub" + (config.ext === "c" ? ".c" : ".cpp")); if (fs.existsSync(s)) fs.unlinkSync(s); } catch {}
    try { const obj = srcFile.replace(/\.[^.]+$/, ".obj"); if (fs.existsSync(obj)) fs.unlinkSync(obj); } catch {}
  }
});

export default router;
