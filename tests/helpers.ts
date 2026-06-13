import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

export async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'flatmark-test-'))
}

export async function writeMarkdown(dir: string, filename: string, content: string): Promise<void> {
  await fs.writeFile(path.join(dir, filename), content, 'utf-8')
}

export async function removeTempDir(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true })
}
