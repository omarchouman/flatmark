import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import path from 'node:path'
import { Collection } from '../src/Collection'
import { FlatMarkNotFoundError } from '../src/errors'
import { createTempDir, writeMarkdown, removeTempDir } from './helpers'

let tmpDir: string

beforeEach(async () => {
  tmpDir = await createTempDir()
})

afterEach(async () => {
  await removeTempDir(tmpDir)
})

describe('Collection — load and read', () => {
  it('load() parses all .md files in the directory', async () => {
    await writeMarkdown(tmpDir, 'post-1.md', `---\ntitle: Post 1\ndraft: false\n---\n\nHello`)
    await writeMarkdown(tmpDir, 'post-2.md', `---\ntitle: Post 2\ndraft: true\n---\n\nWorld`)

    const coll = new Collection(tmpDir, 'posts')
    await coll.load()

    const results = coll.query().get()
    expect(results).toHaveLength(2)
  })

  it('load() ignores non-.md files', async () => {
    await writeMarkdown(tmpDir, 'post-1.md', `---\ntitle: Post 1\n---\n`)
    const fs = await import('node:fs/promises')
    await fs.writeFile(path.join(tmpDir, 'readme.txt'), 'ignore me')

    const coll = new Collection(tmpDir, 'posts')
    await coll.load()

    expect(coll.query().get()).toHaveLength(1)
  })

  it('where() returns a QueryBuilder filtered against the index', async () => {
    await writeMarkdown(tmpDir, 'post-1.md', `---\ntitle: Post 1\ndraft: false\n---\n`)
    await writeMarkdown(tmpDir, 'post-2.md', `---\ntitle: Post 2\ndraft: true\n---\n`)

    const coll = new Collection(tmpDir, 'posts')
    await coll.load()

    const results = coll.where({ draft: false }).get()
    expect(results).toHaveLength(1)
    expect(results[0].title).toBe('Post 1')
  })

  it('query() returns a QueryBuilder with all records', async () => {
    await writeMarkdown(tmpDir, 'post-1.md', `---\ntitle: Post 1\n---\n`)
    await writeMarkdown(tmpDir, 'post-2.md', `---\ntitle: Post 2\n---\n`)

    const coll = new Collection(tmpDir, 'posts')
    await coll.load()

    expect(coll.query().count()).toBe(2)
  })

  it('records have correct _id and _path', async () => {
    await writeMarkdown(tmpDir, 'hello-world.md', `---\ntitle: Hello\n---\n`)

    const coll = new Collection(tmpDir, 'posts')
    await coll.load()

    const record = coll.query().first()
    expect(record?._id).toBe('hello-world')
    expect(record?._path).toBe(path.join(tmpDir, 'hello-world.md'))
  })
})
