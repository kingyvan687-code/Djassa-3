import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Writes text/JSON/binary content atomically using an exclusive temporary file
 * with strict 0o600 permissions, fsync durability, atomic rename, and guaranteed cleanup.
 */
export function atomicWriteBufferFile(
  filePath: string,
  content: Buffer,
  options: { mode?: number; context?: string } = {}
): boolean {
  const mode = options.mode ?? 0o600;
  const dir = path.dirname(filePath);
  const tmpFile = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  let fd: number | null = null;
  try {
    fs.mkdirSync(dir, { recursive: true });
    fd = fs.openSync(tmpFile, 'wx', mode);
    fs.writeFileSync(fd, content);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = null;
    fs.renameSync(tmpFile, filePath);
    fs.chmodSync(filePath, mode);
    return true;
  } catch (err) {
    console.error(`[${options.context || 'AtomicFileStore'}] Failed to persist ${path.basename(filePath)}:`, err);
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {
        // Ignore close error on cleanup
      }
    }
    try {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    } catch {
      // Ignore temp cleanup error
    }
    return false;
  }
}

export function atomicWriteTextFile(
  filePath: string,
  content: string,
  options: { mode?: number; context?: string } = {}
): boolean {
  return atomicWriteBufferFile(filePath, Buffer.from(content, 'utf8'), options);
}

export function atomicWriteJsonFile(
  filePath: string,
  value: unknown,
  options: { mode?: number; context?: string } = {}
): boolean {
  const serialized = JSON.stringify(value, null, 2);
  return atomicWriteBufferFile(filePath, Buffer.from(serialized, 'utf8'), options);
}
