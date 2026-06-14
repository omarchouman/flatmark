import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import path from 'node:path'
import fs from 'node:fs/promises'
import { setTimeout as sleep } from 'node:timers/promises'
import { FlatMark } from '../src/FlatMark'
import { FlatMarkCollectionError } from '../src/errors'
import { createTempDir, writeMarkdown, removeTempDir } from './helpers'

let tmpDir: string

beforeEach(async () => {
  tmpDir = await createTempDir()
})

afterEach(async () => {
  await removeTempDir(tmpDir)
})

describe('FlatMark', () => {
  it('load() discovers subdirectories as collections', async () => {
    await fs.mkdir(path.join(tmpDir, 'posts'))
    await writeMarkdown(path.join(tmpDir, 'posts'), 'post-1.md', `---\ntitle: Post 1\n---\n`)

    const db = new FlatMark(tmpDir)
    await db.load()

    const results = db.collection('posts').query().get()
    expect(results).toHaveLength(1)
    expect(results[0].title).toBe('Post 1')
  })

  it('load() treats .md files at root as a collection named after the base directory', async () => {
    await writeMarkdown(tmpDir, 'note-1.md', `---\ntitle: Note 1\n---\n`)

    const db = new FlatMark(tmpDir)
    await db.load()

    const dirName = path.basename(tmpDir)
    const results = db.collection(dirName).query().get()
    expect(results).toHaveLength(1)
  })

  it('collection() throws FlatMarkCollectionError for unknown name', async () => {
    const db = new FlatMark(tmpDir)
    await db.load()

    expect(() => db.collection('nonexistent')).toThrow(FlatMarkCollectionError)
  })

  it('full cycle: load → query → insert → re-query', async () => {
    await fs.mkdir(path.join(tmpDir, 'posts'))
    await writeMarkdown(path.join(tmpDir, 'posts'), 'post-1.md', `---\ntitle: Post 1\ndraft: false\n---\n`)

    const db = new FlatMark(tmpDir)
    await db.load()

    expect(db.collection('posts').where({ draft: false }).count()).toBe(1)

    await db.collection('posts').insert({ _id: 'post-2', title: 'Post 2', draft: false, _body: '' })

    expect(db.collection('posts').where({ draft: false }).count()).toBe(2)
  })

  it('full cycle: load → query → update → re-query', async () => {
    await fs.mkdir(path.join(tmpDir, 'posts'))
    await writeMarkdown(path.join(tmpDir, 'posts'), 'post-1.md', `---\ntitle: Post 1\ndraft: true\n---\n`)

    const db = new FlatMark(tmpDir)
    await db.load()

    expect(db.collection('posts').where({ draft: true }).count()).toBe(1)

    await db.collection('posts').update('post-1', { draft: false })

    expect(db.collection('posts').where({ draft: false }).count()).toBe(1)
    expect(db.collection('posts').where({ draft: true }).count()).toBe(0)
  })

  it('full cycle: load → insert → delete → re-query', async () => {
    await fs.mkdir(path.join(tmpDir, 'posts'))

    const db = new FlatMark(tmpDir)
    await db.load()

    await db.collection('posts').insert({ _id: 'temp', title: 'Temp', _body: '' })
    expect(db.collection('posts').query().count()).toBe(1)

    await db.collection('posts').delete('temp')
    expect(db.collection('posts').query().count()).toBe(0)
  })
})

describe('FlatMark — file watcher', () => {
  it('watch mode picks up a new .md file added after load()', async () => {
    await fs.mkdir(path.join(tmpDir, 'posts'))

    const db = new FlatMark(tmpDir)
    await db.load({ watch: true })

    expect(db.collection('posts').query().count()).toBe(0)

    await writeMarkdown(
      path.join(tmpDir, 'posts'),
      'live-post.md',
      `---\ntitle: Live Post\n---\n`
    )

    await sleep(300)

    expect(db.collection('posts').query().count()).toBe(1)
    expect(db.collection('posts').where({ title: 'Live Post' }).first()).not.toBeNull()

    await db.close()
  })

  it('watch mode removes a deleted .md file from the index', async () => {
    await fs.mkdir(path.join(tmpDir, 'posts'))
    await writeMarkdown(path.join(tmpDir, 'posts'), 'to-delete.md', `---\ntitle: Delete Me\n---\n`)

    const db = new FlatMark(tmpDir)
    await db.load({ watch: true })

    expect(db.collection('posts').query().count()).toBe(1)

    await fs.unlink(path.join(tmpDir, 'posts', 'to-delete.md'))
    await sleep(300)

    expect(db.collection('posts').query().count()).toBe(0)

    await db.close()
  })
})
