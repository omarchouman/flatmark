import type { FlatRecord, WhereFilter, OrderByDirection, FilterOperators } from './types'

function isOperatorObject(value: unknown): value is FilterOperators {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  return Object.keys(value).some(k => k.startsWith('$'))
}

function matchesOperators(value: unknown, ops: FilterOperators): boolean {
  if ('$exists' in ops) {
    const exists = value !== undefined && value !== null
    if (ops.$exists !== exists) return false
  }
  if ('$ne' in ops && value === ops.$ne) return false
  if ('$gt' in ops && !((value as number) > (ops.$gt as number))) return false
  if ('$gte' in ops && !((value as number) >= (ops.$gte as number))) return false
  if ('$lt' in ops && !((value as number) < (ops.$lt as number))) return false
  if ('$lte' in ops && !((value as number) <= (ops.$lte as number))) return false
  if ('$includes' in ops) {
    if (!Array.isArray(value)) return false
    if (!value.includes(ops.$includes)) return false
  }
  return true
}

function matchesFilter(record: FlatRecord, filter: WhereFilter): boolean {
  for (const [field, condition] of Object.entries(filter)) {
    const value = record[field]
    if (isOperatorObject(condition)) {
      if (!matchesOperators(value, condition)) return false
    } else {
      if (value !== condition) return false
    }
  }
  return true
}

export class QueryBuilder {
  private filters: WhereFilter[] = []
  private selectedFields: string[] | null = null
  private sortField: string | null = null
  private sortDir: OrderByDirection = 'asc'
  private limitN: number | null = null
  private offsetN = 0

  constructor(private readonly records: FlatRecord[]) {}

  where(filter: WhereFilter): this {
    this.filters.push(filter)
    return this
  }

  select(fields: string[]): this {
    this.selectedFields = fields
    return this
  }

  orderBy(field: string, direction: OrderByDirection = 'asc'): this {
    this.sortField = field
    this.sortDir = direction
    return this
  }

  limit(n: number): this {
    this.limitN = n
    return this
  }

  offset(n: number): this {
    this.offsetN = n
    return this
  }

  private applyFilters(records: FlatRecord[]): FlatRecord[] {
    return records.filter(r => this.filters.every(f => matchesFilter(r, f)))
  }

  get(): FlatRecord[] {
    let results = this.applyFilters(this.records)

    if (this.sortField) {
      const field = this.sortField
      const dir = this.sortDir
      results = [...results].sort((a, b) => {
        const av = a[field] as number | string | null | undefined
        const bv = b[field] as number | string | null | undefined
        if (av == null && bv == null) return 0
        if (av == null) return dir === 'asc' ? 1 : -1
        if (bv == null) return dir === 'asc' ? -1 : 1
        if (av === bv) return 0
        const lt = av < bv ? -1 : 1
        return dir === 'asc' ? lt : -lt
      })
    }

    results = results.slice(this.offsetN)
    if (this.limitN !== null) results = results.slice(0, this.limitN)

    if (this.selectedFields) {
      const keep = new Set(['_id', '_path', ...this.selectedFields])
      results = results.map(r =>
        Object.fromEntries(Object.entries(r).filter(([k]) => keep.has(k))) as FlatRecord
      )
    }

    return results
  }

  first(): FlatRecord | null {
    return this.get()[0] ?? null
  }

  count(): number {
    return this.applyFilters(this.records).length
  }
}
