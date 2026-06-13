import matter from 'gray-matter'
import path from 'node:path'
import type { FlatRecord } from './types'

export function parseMarkdownFile(filePath: string, content: string): FlatRecord {
  const { data, content: body } = matter(content)
  return {
    _id: path.basename(filePath, '.md'),
    _path: filePath,
    _body: body.trim(),
    ...data,
  }
}
