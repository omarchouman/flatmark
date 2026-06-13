import { describe, it, expect } from 'vitest'
import { QueryBuilder } from '../src/QueryBuilder'
import type { FlatRecord } from '../src/types'

const records: FlatRecord[] = [
  {
    _id: 'post-1',
    _path: '/posts/post-1.md',
    _body: 'Hello',
    title: 'Post 1',
    draft: false,
    author: 'jane',
  },
  {
    _id: 'post-2',
    _path: '/posts/post-2.md',
    _body: 'World',
    title: 'Post 2',
    draft: true,
    author: 'john',
  },
  {
    _id: 'post-3',
    _path: '/posts/post-3.md',
    _body: 'Foo',
    title: 'Post 3',
    draft: false,
    author: 'jane',
  },
]

describe('QueryBuilder — exact match', () => {
  it('get() returns all records when no filters applied', () => {
    const result = new QueryBuilder(records).get()
    expect(result).toHaveLength(3)
  })

  it('where() filters by single exact-match field', () => {
    const result = new QueryBuilder(records).where({ draft: false }).get()
    expect(result).toHaveLength(2)
    expect(result.map(r => r._id)).toEqual(['post-1', 'post-3'])
  })

  it('where() with multiple fields ANDs conditions', () => {
    const result = new QueryBuilder(records)
      .where({ draft: false, author: 'jane' })
      .get()
    expect(result).toHaveLength(2)
  })

  it('chained where() calls AND together', () => {
    const result = new QueryBuilder(records)
      .where({ draft: false })
      .where({ author: 'john' })
      .get()
    expect(result).toHaveLength(0)
  })

  it('first() returns the first matching record', () => {
    const result = new QueryBuilder(records).where({ draft: false }).first()
    expect(result?._id).toBe('post-1')
  })

  it('first() returns null when no match', () => {
    const result = new QueryBuilder(records).where({ draft: 'maybe' }).first()
    expect(result).toBeNull()
  })

  it('count() returns number of matching records', () => {
    const result = new QueryBuilder(records).where({ draft: false }).count()
    expect(result).toBe(2)
  })

  it('count() is not affected by limit()', () => {
    const result = new QueryBuilder(records).where({ draft: false }).limit(1).count()
    expect(result).toBe(2)
  })
})
