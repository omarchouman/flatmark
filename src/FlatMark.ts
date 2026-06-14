import fs from 'node:fs/promises'
import path from 'node:path'
import { Collection } from './Collection'
import { FlatMarkCollectionError } from './errors'
import type { FlatMarkOptions, LoadOptions } from './types'

export class FlatMark {
  private collections: Map<string, Collection> = new Map()
  private watcher: import('chokidar').FSWatcher | null = null

  constructor(
    private readonly basePath: string,
    private readonly options: FlatMarkOptions = {}
  ) {}

  async load(loadOptions: LoadOptions = {}): Promise<void> {
    this.collections.clear()
    const entries = await fs.readdir(this.basePath, { withFileTypes: true })

    const hasMdAtRoot = entries.some(e => e.isFile() && e.name.endsWith('.md'))
    const subdirs = entries.filter(e => e.isDirectory())

    const toLoad: { name: string; dir: string }[] = subdirs.map(d => ({
      name: d.name,
      dir: path.join(this.basePath, d.name),
    }))

    if (hasMdAtRoot) {
      toLoad.push({ name: path.basename(this.basePath), dir: this.basePath })
    }

    await Promise.all(
      toLoad.map(async ({ name, dir }) => {
        const collOpts = this.options.collections?.[name] ?? {}
        const coll = new Collection(dir, name, collOpts)
        await coll.load()
        this.collections.set(name, coll)
      })
    )

    if (loadOptions.watch) {
      await this.startWatcher()
    }
  }

  collection(name: string): Collection {
    const coll = this.collections.get(name)
    if (!coll) throw new FlatMarkCollectionError(name)
    return coll
  }

  private async startWatcher(): Promise<void> {
    await this.watcher?.close()
    const { default: chokidar } = await import('chokidar')

    this.watcher = chokidar.watch(this.basePath, {
      ignoreInitial: true,
      ignored: /(^|[/\\])\../,
    })

    const getCollection = (filePath: string): Collection | null => {
      const rel = path.relative(this.basePath, filePath)
      const parts = rel.split(path.sep)
      const name = parts.length === 1 ? path.basename(this.basePath) : parts[0]
      return this.collections.get(name) ?? null
    }

    this.watcher
      .on('add', async (filePath: string) => {
        if (!filePath.endsWith('.md')) return
        try {
          const content = await fs.readFile(filePath, 'utf-8')
          getCollection(filePath)?.updateRecord(filePath, content)
        } catch {
          // file disappeared between event and read
        }
      })
      .on('change', async (filePath: string) => {
        if (!filePath.endsWith('.md')) return
        try {
          const content = await fs.readFile(filePath, 'utf-8')
          getCollection(filePath)?.updateRecord(filePath, content)
        } catch {
          // file disappeared between event and read
        }
      })
      .on('unlink', (filePath: string) => {
        if (!filePath.endsWith('.md')) return
        getCollection(filePath)?.removeRecord(filePath)
      })

    await new Promise<void>(resolve => this.watcher!.on('ready', resolve))
  }

  async close(): Promise<void> {
    await this.watcher?.close()
    this.watcher = null
  }
}
