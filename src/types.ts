export type FlatRecord = {
  _id: string
  _path: string
  _body: string
  [key: string]: unknown
}

export type FilterOperators = {
  $gt?: unknown
  $gte?: unknown
  $lt?: unknown
  $lte?: unknown
  $ne?: unknown
  $includes?: unknown
  $exists?: boolean
}

export type WhereFilter = Record<string, unknown>

export type OrderByDirection = 'asc' | 'desc'

export type CollectionOptions = {
  schema?: { parse: (data: unknown) => unknown }
}

export type FlatMarkOptions = {
  collections?: Record<string, CollectionOptions>
}

export type LoadOptions = {
  watch?: boolean
}
