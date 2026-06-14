import fs from 'node:fs/promises'
import path from 'node:path'
import matter from 'gray-matter'
import { parseMarkdownFile } from './Parser'
import { QueryBuilder } from './QueryBuilder'
import { FlatMarkError, FlatMarkNotFoundError, FlatMarkValidationError } from './errors'
import type { FlatRecord, WhereFilter, CollectionOptions } from './types'

export class Collection {
  private index: FlatRecord[] = []

  constructor(
    private readonly dir: string,
    private readonly name: string,
    private readonly options: CollectionOptions = {}
  ) {}

  async load(): Promise<void> {
    this.index = []
    const entries = await fs.readdir(this.dir, { withFileTypes: true })
    const mdFiles = entries
      .filter(e => e.isFile() && e.name.endsWith('.md'))
      .map(e => path.join(this.dir, e.name))

    this.index = await Promise.all(
      mdFiles.map(async filePath => {
        const content = await fs.readFile(filePath, 'utf-8')
        return parseMarkdownFile(filePath, content)
      })
    )
  }

  updateRecord(filePath: string, content: string): void {
    const record = parseMarkdownFile(filePath, content)
    const idx = this.index.findIndex(r => r._path === filePath)
    if (idx === -1) {
      this.index.push(record)
    } else {
      this.index[idx] = record
    }
  }

  removeRecord(filePath: string): void {
    this.index = this.index.filter(r => r._path !== filePath)
  }

  where(filter: WhereFilter): QueryBuilder {
    return new QueryBuilder([...this.index]).where(filter)
  }

  query(): QueryBuilder {
    return new QueryBuilder([...this.index])
  }

  private validate(data: unknown): void {
    if (!this.options.schema) return
    try {
      this.options.schema.parse(data)
    } catch (err: unknown) {
      const issues = (err as { errors?: unknown[] }).errors ?? [err]
      throw new FlatMarkValidationError(
        `Validation failed for collection "${this.name}"`,
        issues
      )
    }
  }

  async insert(record: Partial<FlatRecord> & { _id: string }): Promise<FlatRecord> {
    const { _id, _body = '', _path: _ignoredPath, ...frontmatter } = record
    if (this.index.some(r => r._id === _id)) {
      throw new FlatMarkError(`Record "${_id}" already exists in collection "${this.name}"`)
    }
    this.validate(frontmatter)

    const filePath = path.join(this.dir, `${_id}.md`)
    const fileContent = matter.stringify(_body, frontmatter as Record<string, unknown>)
    const parsed = parseMarkdownFile(filePath, fileContent)
    await fs.writeFile(filePath, fileContent, 'utf-8')
    this.index.push(parsed)
    return parsed
  }

  async update(_id: string, fields: Partial<FlatRecord>): Promise<FlatRecord> {
    const existing = this.index.find(r => r._id === _id)
    if (!existing) throw new FlatMarkNotFoundError(_id, this.name)

    const { _body: newBody, _id: _ignId, _path: _ignPath, ...newFrontmatter } = fields
    const { _body: existingBody, _id: __id, _path: __path, ...existingFrontmatter } = existing

    const mergedFrontmatter = { ...existingFrontmatter, ...newFrontmatter }
    this.validate(mergedFrontmatter)

    const updatedBody = newBody ?? existingBody
    const fileContent = matter.stringify(updatedBody, mergedFrontmatter as Record<string, unknown>)
    const parsed = parseMarkdownFile(existing._path, fileContent)
    await fs.writeFile(existing._path, fileContent, 'utf-8')
    const idx = this.index.findIndex(r => r._id === _id)
    this.index[idx] = parsed
    return parsed
  }

  async delete(_id: string): Promise<void> {
    const existing = this.index.find(r => r._id === _id)
    if (!existing) throw new FlatMarkNotFoundError(_id, this.name)

    await fs.unlink(existing._path)
    this.index = this.index.filter(r => r._id !== _id)
  }
}
