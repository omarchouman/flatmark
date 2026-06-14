import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import path from 'node:path'
import fs from 'node:fs/promises'
import { z } from 'zod'
import { Collection } from '../src/Collection'
import { FlatMarkNotFoundError, FlatMarkValidationError } from '../src/errors'
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

describe('Collection — insert', () => {
  it('insert() creates a new .md file on disk', async () => {
    const coll = new Collection(tmpDir, 'posts')
    await coll.load()

    await coll.insert({ _id: 'new-post', title: 'New Post', draft: false, _body: '# Hello' })

    const filePath = path.join(tmpDir, 'new-post.md')
    const content = await fs.readFile(filePath, 'utf-8')
    expect(content).toContain('title: New Post')
    expect(content).toContain('# Hello')
  })

  it('insert() adds the record to the in-memory index', async () => {
    const coll = new Collection(tmpDir, 'posts')
    await coll.load()

    await coll.insert({ _id: 'new-post', title: 'New Post', _body: '' })

    expect(coll.query().count()).toBe(1)
    expect(coll.where({ _id: 'new-post' }).first()?._id).toBe('new-post')
  })

  it('insert() returns the parsed FlatRecord', async () => {
    const coll = new Collection(tmpDir, 'posts')
    await coll.load()

    const record = await coll.insert({ _id: 'my-post', title: 'My Post', _body: 'Content' })
    expect(record._id).toBe('my-post')
    expect(record.title).toBe('My Post')
    expect(record._body).toBe('Content')
  })

  it('insert() throws FlatMarkError when _id already exists', async () => {
    await writeMarkdown(tmpDir, 'post-1.md', `---\ntitle: Existing\n---\n`)
    const coll = new Collection(tmpDir, 'posts')
    await coll.load()

    await expect(
      coll.insert({ _id: 'post-1', title: 'Duplicate', _body: '' })
    ).rejects.toThrow('already exists')
  })
})

describe('Collection — update', () => {
  it('update() modifies frontmatter fields in the file', async () => {
    await writeMarkdown(tmpDir, 'post-1.md', `---\ntitle: Original\ndraft: true\n---\n`)
    const coll = new Collection(tmpDir, 'posts')
    await coll.load()

    await coll.update('post-1', { draft: false })

    const content = await fs.readFile(path.join(tmpDir, 'post-1.md'), 'utf-8')
    expect(content).toContain('draft: false')
    expect(content).toContain('title: Original')
  })

  it('update() reflects changes in the in-memory index', async () => {
    await writeMarkdown(tmpDir, 'post-1.md', `---\ntitle: Original\ndraft: true\n---\n`)
    const coll = new Collection(tmpDir, 'posts')
    await coll.load()

    await coll.update('post-1', { draft: false })

    const record = coll.where({ _id: 'post-1' }).first()
    expect(record?.draft).toBe(false)
  })

  it('update() throws FlatMarkNotFoundError for unknown _id', async () => {
    const coll = new Collection(tmpDir, 'posts')
    await coll.load()

    await expect(coll.update('ghost', { draft: false })).rejects.toThrow(FlatMarkNotFoundError)
  })
})

describe('Collection — delete', () => {
  it('delete() removes the file from disk', async () => {
    await writeMarkdown(tmpDir, 'post-1.md', `---\ntitle: Post 1\n---\n`)
    const coll = new Collection(tmpDir, 'posts')
    await coll.load()

    await coll.delete('post-1')

    await expect(fs.access(path.join(tmpDir, 'post-1.md'))).rejects.toThrow()
  })

  it('delete() removes the record from the in-memory index', async () => {
    await writeMarkdown(tmpDir, 'post-1.md', `---\ntitle: Post 1\n---\n`)
    const coll = new Collection(tmpDir, 'posts')
    await coll.load()

    await coll.delete('post-1')

    expect(coll.query().count()).toBe(0)
  })

  it('delete() throws FlatMarkNotFoundError for unknown _id', async () => {
    const coll = new Collection(tmpDir, 'posts')
    await coll.load()

    await expect(coll.delete('ghost')).rejects.toThrow(FlatMarkNotFoundError)
  })
})

describe('Collection — schema validation', () => {
  const PostSchema = z.object({
    title: z.string(),
    date: z.string(),
    draft: z.boolean(),
  })

  it('insert() throws FlatMarkValidationError when frontmatter fails schema', async () => {
    const coll = new Collection(tmpDir, 'posts', { schema: PostSchema })
    await coll.load()

    await expect(
      coll.insert({ _id: 'bad-post', title: 'Missing date and draft', _body: '' })
    ).rejects.toThrow(FlatMarkValidationError)
  })

  it('insert() succeeds when frontmatter passes schema', async () => {
    const coll = new Collection(tmpDir, 'posts', { schema: PostSchema })
    await coll.load()

    const record = await coll.insert({
      _id: 'good-post',
      title: 'Good Post',
      date: '2024-01-01',
      draft: false,
      _body: '',
    })
    expect(record._id).toBe('good-post')
  })

  it('update() throws FlatMarkValidationError when merged data fails schema', async () => {
    await writeMarkdown(
      tmpDir,
      'post-1.md',
      `---\ntitle: Post 1\ndate: '2024-01-01'\ndraft: false\n---\n`
    )
    const coll = new Collection(tmpDir, 'posts', { schema: PostSchema })
    await coll.load()

    await expect(
      coll.update('post-1', { date: 123 as unknown as string })
    ).rejects.toThrow(FlatMarkValidationError)
  })

  it('no schema = no validation on insert', async () => {
    const coll = new Collection(tmpDir, 'posts')
    await coll.load()

    await expect(
      coll.insert({ _id: 'any-post', _body: '' })
    ).resolves.toBeTruthy()
  })
})
