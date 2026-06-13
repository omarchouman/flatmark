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

const numericRecords: FlatRecord[] = [
  { _id: 'a', _path: '/a.md', _body: '', views: 50, date: '2024-01-01', status: 'published', tags: ['ts', 'js'] },
  { _id: 'b', _path: '/b.md', _body: '', views: 200, date: '2024-06-01', status: 'draft', tags: ['ts'] },
  { _id: 'c', _path: '/c.md', _body: '', views: 1000, date: '2023-12-01', status: 'published', tags: ['rust'] },
]

describe('QueryBuilder — operators', () => {
  it('$gt filters records where field > value', () => {
    const result = new QueryBuilder(numericRecords).where({ views: { $gt: 100 } }).get()
    expect(result.map(r => r._id)).toEqual(['b', 'c'])
  })

  it('$gte filters records where field >= value', () => {
    const result = new QueryBuilder(numericRecords).where({ views: { $gte: 200 } }).get()
    expect(result.map(r => r._id)).toEqual(['b', 'c'])
  })

  it('$lt filters records where field < value', () => {
    const result = new QueryBuilder(numericRecords).where({ views: { $lt: 200 } }).get()
    expect(result.map(r => r._id)).toEqual(['a'])
  })

  it('$lte filters records where field <= value', () => {
    const result = new QueryBuilder(numericRecords).where({ views: { $lte: 200 } }).get()
    expect(result.map(r => r._id)).toEqual(['a', 'b'])
  })

  it('$ne filters records where field !== value', () => {
    const result = new QueryBuilder(numericRecords).where({ status: { $ne: 'draft' } }).get()
    expect(result.map(r => r._id)).toEqual(['a', 'c'])
  })

  it('$includes filters records where array field contains value', () => {
    const result = new QueryBuilder(numericRecords).where({ tags: { $includes: 'ts' } }).get()
    expect(result.map(r => r._id)).toEqual(['a', 'b'])
  })

  it('$includes returns empty when field is not an array', () => {
    const result = new QueryBuilder(numericRecords).where({ status: { $includes: 'pub' } }).get()
    expect(result).toHaveLength(0)
  })

  it('$exists: true filters records where field is present', () => {
    const mixed: FlatRecord[] = [
      { _id: 'x', _path: '/x.md', _body: '', hero: 'img.jpg' },
      { _id: 'y', _path: '/y.md', _body: '' },
    ]
    const result = new QueryBuilder(mixed).where({ hero: { $exists: true } }).get()
    expect(result.map(r => r._id)).toEqual(['x'])
  })

  it('$exists: false filters records where field is absent', () => {
    const mixed: FlatRecord[] = [
      { _id: 'x', _path: '/x.md', _body: '', hero: 'img.jpg' },
      { _id: 'y', _path: '/y.md', _body: '' },
    ]
    const result = new QueryBuilder(mixed).where({ hero: { $exists: false } }).get()
    expect(result.map(r => r._id)).toEqual(['y'])
  })

  it('multiple operators on same field are ANDed', () => {
    const result = new QueryBuilder(numericRecords)
      .where({ views: { $gte: 100, $lt: 500 } })
      .get()
    expect(result.map(r => r._id)).toEqual(['b'])
  })
})

const pagedRecords: FlatRecord[] = [
  { _id: 'a', _path: '/a.md', _body: '', title: 'Zebra', views: 10 },
  { _id: 'b', _path: '/b.md', _body: '', title: 'Apple', views: 30 },
  { _id: 'c', _path: '/c.md', _body: '', title: 'Mango', views: 20 },
  { _id: 'd', _path: '/d.md', _body: '', title: 'Berry', views: 40 },
]

describe('QueryBuilder — select, orderBy, limit, offset', () => {
  it('select() returns only the specified fields plus _id and _path', () => {
    const result = new QueryBuilder(pagedRecords).select(['title']).get()
    expect(Object.keys(result[0])).toEqual(['_id', '_path', 'title'])
  })

  it('select() strips _body when not requested', () => {
    const result = new QueryBuilder(pagedRecords).select(['views']).get()
    result.forEach(r => {
      expect(r).toHaveProperty('_id')
      expect(r).toHaveProperty('_path')
      expect(r).not.toHaveProperty('_body')
    })
  })

  it('orderBy() sorts ascending by default', () => {
    const result = new QueryBuilder(pagedRecords).orderBy('title').get()
    expect(result.map(r => r.title)).toEqual(['Apple', 'Berry', 'Mango', 'Zebra'])
  })

  it('orderBy() sorts descending', () => {
    const result = new QueryBuilder(pagedRecords).orderBy('views', 'desc').get()
    expect(result.map(r => r.views)).toEqual([40, 30, 20, 10])
  })

  it('orderBy() places records with missing sort field last (ascending)', () => {
    const withMissing: FlatRecord[] = [
      { _id: 'x', _path: '/x.md', _body: '', title: 'Bravo' },
      { _id: 'y', _path: '/y.md', _body: '' },
      { _id: 'z', _path: '/z.md', _body: '', title: 'Alpha' },
    ]
    const result = new QueryBuilder(withMissing).orderBy('title').get()
    expect(result.map(r => r._id)).toEqual(['z', 'x', 'y'])
  })

  it('limit() returns at most n records', () => {
    const result = new QueryBuilder(pagedRecords).limit(2).get()
    expect(result).toHaveLength(2)
  })

  it('offset() skips the first n records', () => {
    const result = new QueryBuilder(pagedRecords).offset(2).get()
    expect(result).toHaveLength(2)
    expect(result[0]._id).toBe('c')
  })

  it('limit() + offset() pages correctly', () => {
    const page2 = new QueryBuilder(pagedRecords).limit(2).offset(2).get()
    expect(page2.map(r => r._id)).toEqual(['c', 'd'])
  })

  it('orderBy + limit together', () => {
    const result = new QueryBuilder(pagedRecords).orderBy('views', 'desc').limit(2).get()
    expect(result.map(r => r._id)).toEqual(['d', 'b'])
  })
})
