import { describe, it, expect } from 'vitest'
import { parseMarkdownFile } from '../src/Parser'

describe('parseMarkdownFile', () => {
  it('extracts frontmatter fields as top-level keys', () => {
    const content = `---
title: Hello World
draft: false
tags:
  - typescript
  - markdown
---

Body content here.`

    const record = parseMarkdownFile('/posts/hello-world.md', content)
    expect(record.title).toBe('Hello World')
    expect(record.draft).toBe(false)
    expect(record.tags).toEqual(['typescript', 'markdown'])
  })

  it('sets _id from filename without extension', () => {
    const record = parseMarkdownFile('/posts/hello-world.md', '---\ntitle: Hi\n---\n')
    expect(record._id).toBe('hello-world')
  })

  it('sets _path to the absolute file path', () => {
    const filePath = '/posts/hello-world.md'
    const record = parseMarkdownFile(filePath, '---\ntitle: Hi\n---\n')
    expect(record._path).toBe(filePath)
  })

  it('sets _body to the trimmed markdown content after frontmatter', () => {
    const content = `---
title: Hi
---

# Hello

World`
    const record = parseMarkdownFile('/x.md', content)
    expect(record._body).toBe('# Hello\n\nWorld')
  })

  it('handles files with no frontmatter', () => {
    const record = parseMarkdownFile('/note.md', 'Just a plain note.')
    expect(record._body).toBe('Just a plain note.')
    expect(record._id).toBe('note')
  })

  it('handles empty body', () => {
    const record = parseMarkdownFile('/x.md', '---\ntitle: No body\n---\n')
    expect(record._body).toBe('')
  })
})
