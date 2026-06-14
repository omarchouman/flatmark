# flatmark

A query engine that treats markdown files as a database.

Drop it into any project. No server. No migrations. Just files.

```ts
const db = new FlatMark('./content')
await db.load()

const posts = db.collection('posts')
  .where({ draft: false })
  .orderBy('date', 'desc')
  .limit(10)
  .get()
```

---

## Why

Markdown files are already how most developers store content — blog posts, docs, notes, changelogs. But querying them means either hand-rolling file reads and frontmatter parsing, or pulling in a full CMS.

Flatmark gives you a query API over a folder of `.md` files. It parses YAML frontmatter, builds an in-memory index on startup, and lets you filter, sort, paginate, and write — all synchronously after the initial load.

Think SQLite but for markdown.

---

## Install

```bash
npm install flatmark
```

---

## How it works

One folder = one collection. Flatmark reads every `.md` file in a directory, parses its YAML frontmatter, and stores the result in memory. Queries run against that index — no disk I/O after load.

```
content/
  posts/        → db.collection('posts')
    hello.md
    world.md
  authors/      → db.collection('authors')
    jane.md
```

Each file becomes a **record**:

```ts
{
  _id: 'hello-world',           // filename without .md
  _path: '/content/posts/hello-world.md',
  _body: '# Hello\n\nContent…', // markdown body after frontmatter
  title: 'Hello World',         // all frontmatter fields at top level
  date: '2024-01-15',
  draft: false,
  tags: ['typescript', 'markdown']
}
```

Frontmatter uses YAML — compatible with Obsidian, Hugo, Astro, Jekyll, and most markdown tooling.

---

## Usage

### Init

```ts
import { FlatMark } from 'flatmark'

const db = new FlatMark('./content')
await db.load()
```

### Query

```ts
// All published posts, newest first
const posts = db.collection('posts')
  .where({ draft: false })
  .orderBy('date', 'desc')
  .get()

// First post matching a slug
const post = db.collection('posts')
  .where({ slug: 'hello-world' })
  .first()  // → FlatRecord | null

// Count drafts
const drafts = db.collection('posts')
  .where({ draft: true })
  .count()

// Paginate
const page2 = db.collection('posts')
  .where({ draft: false })
  .orderBy('date', 'desc')
  .limit(10)
  .offset(10)
  .get()

// Select specific fields (always includes _id and _path)
const titles = db.collection('posts')
  .where({ draft: false })
  .select(['title', 'date'])
  .get()
```

### Filter operators

```ts
// Comparison
.where({ views: { $gt: 100 } })
.where({ views: { $gte: 100, $lt: 1000 } })
.where({ date: { $lte: '2024-12-31' } })

// Equality / inequality
.where({ status: { $ne: 'archived' } })

// Arrays
.where({ tags: { $includes: 'typescript' } })

// Field presence
.where({ hero: { $exists: true } })
.where({ hero: { $exists: false } })
```

Multiple `.where()` calls are ANDed together:

```ts
.where({ draft: false })
.where({ tags: { $includes: 'typescript' } })
// → draft === false AND tags includes 'typescript'
```

### Write

```ts
// Create a new file
await db.collection('posts').insert({
  _id: 'my-new-post',
  title: 'My New Post',
  date: '2024-06-01',
  draft: true,
  _body: '# My New Post\n\nContent here.'
})
// → writes content/posts/my-new-post.md

// Update frontmatter fields (partial — only provided fields change)
await db.collection('posts').update('my-new-post', {
  draft: false
})

// Delete
await db.collection('posts').delete('my-new-post')
// → removes content/posts/my-new-post.md
```

All write operations are async (disk I/O). Read queries are synchronous (in-memory).

---

## Schema validation

Pass a [Zod](https://zod.dev) schema to validate frontmatter on writes. The core library works without Zod — validation is opt-in.

```bash
npm install zod
```

```ts
import { z } from 'zod'

const PostSchema = z.object({
  title: z.string(),
  date: z.string(),
  draft: z.boolean().default(false),
  tags: z.array(z.string()).optional()
})

const db = new FlatMark('./content', {
  collections: {
    posts: { schema: PostSchema }
  }
})
await db.load()

// Throws FlatMarkValidationError if frontmatter doesn't match
await db.collection('posts').insert({
  _id: 'bad-post',
  title: 'Missing date'  // ← date is required
})
```

---

## Live file watching

For dev servers and live-reloading environments:

```ts
const db = new FlatMark('./content')
await db.load({ watch: true })

// Index updates automatically when files change on disk

// Clean up when done
await db.close()
```

---

## Error handling

All errors throw. No result objects.

| Class | When |
|---|---|
| `FlatMarkError` | Base class |
| `FlatMarkNotFoundError` | `.update()` or `.delete()` on a missing `_id` |
| `FlatMarkValidationError` | Schema validation failure on write |
| `FlatMarkCollectionError` | `.collection()` called with a name that has no matching directory |

```ts
import { FlatMarkNotFoundError } from 'flatmark'

try {
  await db.collection('posts').update('ghost', { draft: false })
} catch (err) {
  if (err instanceof FlatMarkNotFoundError) {
    console.log('Post not found')
  }
}
```

---

## API reference

### `new FlatMark(basePath, options?)`

| Option | Type | Description |
|---|---|---|
| `basePath` | `string` | Directory to use as the database root |
| `options.collections` | `Record<string, CollectionOptions>` | Per-collection options (e.g. schema) |

### `db.load(options?)`

Reads all `.md` files and builds the in-memory index. Must be called before any queries or writes.

| Option | Type | Default | Description |
|---|---|---|---|
| `watch` | `boolean` | `false` | Start a file watcher for live updates |

### `db.collection(name)`

Returns the `Collection` for the given directory name. Throws `FlatMarkCollectionError` if no matching directory was found during `load()`.

### `db.close()`

Stops the file watcher. No-op if watch mode was not enabled.

### `Collection` — read

| Method | Returns | Description |
|---|---|---|
| `.where(filter)` | `QueryBuilder` | Start a query with a filter |
| `.query()` | `QueryBuilder` | Start a query with no filter (all records) |

### `QueryBuilder` — chain

| Method | Description |
|---|---|
| `.where(filter)` | Add another filter (ANDed with previous) |
| `.select(fields)` | Return only these fields (plus `_id`, `_path`) |
| `.orderBy(field, dir?)` | Sort by field, `'asc'` (default) or `'desc'` |
| `.limit(n)` | Return at most n records |
| `.offset(n)` | Skip the first n records |

### `QueryBuilder` — terminal

| Method | Returns | Description |
|---|---|---|
| `.get()` | `FlatRecord[]` | Execute query, return all matches |
| `.first()` | `FlatRecord \| null` | Execute query, return first match or null |
| `.count()` | `number` | Count matches (ignores limit/offset) |

### `Collection` — write

| Method | Returns | Description |
|---|---|---|
| `.insert(record)` | `Promise<FlatRecord>` | Create a new `.md` file. `_id` required. |
| `.update(id, fields)` | `Promise<FlatRecord>` | Partial update of frontmatter and/or body |
| `.delete(id)` | `Promise<void>` | Delete the file and remove from index |

---

## Requirements

- Node.js 18+
- TypeScript 5+ (if using types)

---

## License

MIT
