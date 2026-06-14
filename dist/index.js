// src/FlatMark.ts
import fs2 from "fs/promises";
import path3 from "path";

// src/Collection.ts
import fs from "fs/promises";
import path2 from "path";
import matter2 from "gray-matter";

// src/Parser.ts
import matter from "gray-matter";
import path from "path";
function parseMarkdownFile(filePath, content) {
  const { data, content: body } = matter(content);
  return {
    _id: path.basename(filePath, ".md"),
    _path: filePath,
    _body: body.trim(),
    ...data
  };
}

// src/QueryBuilder.ts
function isOperatorObject(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return Object.keys(value).some((k) => k.startsWith("$"));
}
function matchesOperators(value, ops) {
  if ("$exists" in ops) {
    const exists = value !== void 0 && value !== null;
    if (ops.$exists !== exists) return false;
  }
  if ("$ne" in ops && value === ops.$ne) return false;
  if ("$gt" in ops && !(value > ops.$gt)) return false;
  if ("$gte" in ops && !(value >= ops.$gte)) return false;
  if ("$lt" in ops && !(value < ops.$lt)) return false;
  if ("$lte" in ops && !(value <= ops.$lte)) return false;
  if ("$includes" in ops) {
    if (!Array.isArray(value)) return false;
    if (!value.includes(ops.$includes)) return false;
  }
  return true;
}
function matchesFilter(record, filter) {
  for (const [field, condition] of Object.entries(filter)) {
    const value = record[field];
    if (isOperatorObject(condition)) {
      if (!matchesOperators(value, condition)) return false;
    } else {
      if (value !== condition) return false;
    }
  }
  return true;
}
var QueryBuilder = class {
  constructor(records) {
    this.records = records;
    this.filters = [];
    this.selectedFields = null;
    this.sortField = null;
    this.sortDir = "asc";
    this.limitN = null;
    this.offsetN = 0;
  }
  where(filter) {
    this.filters.push(filter);
    return this;
  }
  select(fields) {
    this.selectedFields = fields;
    return this;
  }
  orderBy(field, direction = "asc") {
    this.sortField = field;
    this.sortDir = direction;
    return this;
  }
  limit(n) {
    this.limitN = n;
    return this;
  }
  offset(n) {
    this.offsetN = n;
    return this;
  }
  applyFilters(records) {
    return records.filter((r) => this.filters.every((f) => matchesFilter(r, f)));
  }
  get() {
    let results = this.applyFilters(this.records);
    if (this.sortField) {
      const field = this.sortField;
      const dir = this.sortDir;
      results = [...results].sort((a, b) => {
        const av = a[field];
        const bv = b[field];
        if (av == null && bv == null) return 0;
        if (av == null) return dir === "asc" ? 1 : -1;
        if (bv == null) return dir === "asc" ? -1 : 1;
        if (av === bv) return 0;
        const lt = av < bv ? -1 : 1;
        return dir === "asc" ? lt : -lt;
      });
    }
    results = results.slice(this.offsetN);
    if (this.limitN !== null) results = results.slice(0, this.limitN);
    if (this.selectedFields) {
      const keep = /* @__PURE__ */ new Set(["_id", "_path", ...this.selectedFields]);
      results = results.map(
        (r) => Object.fromEntries(Object.entries(r).filter(([k]) => keep.has(k)))
      );
    }
    return results;
  }
  first() {
    return this.get()[0] ?? null;
  }
  count() {
    return this.applyFilters(this.records).length;
  }
};

// src/errors.ts
var FlatMarkError = class extends Error {
  constructor(message) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = "FlatMarkError";
  }
};
var FlatMarkNotFoundError = class extends FlatMarkError {
  constructor(id, collection) {
    super(`Record "${id}" not found in collection "${collection}"`);
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = "FlatMarkNotFoundError";
  }
};
var FlatMarkValidationError = class extends FlatMarkError {
  constructor(message, issues) {
    super(message);
    this.issues = issues;
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = "FlatMarkValidationError";
  }
};
var FlatMarkCollectionError = class extends FlatMarkError {
  constructor(name) {
    super(
      `Collection "${name}" does not exist. Make sure a directory with that name exists under your base path.`
    );
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = "FlatMarkCollectionError";
  }
};

// src/Collection.ts
var Collection = class {
  constructor(dir, name, options = {}) {
    this.dir = dir;
    this.name = name;
    this.options = options;
    this.index = [];
  }
  async load() {
    this.index = [];
    const entries = await fs.readdir(this.dir, { withFileTypes: true });
    const mdFiles = entries.filter((e) => e.isFile() && e.name.endsWith(".md")).map((e) => path2.join(this.dir, e.name));
    this.index = await Promise.all(
      mdFiles.map(async (filePath) => {
        const content = await fs.readFile(filePath, "utf-8");
        return parseMarkdownFile(filePath, content);
      })
    );
  }
  updateRecord(filePath, content) {
    const record = parseMarkdownFile(filePath, content);
    const idx = this.index.findIndex((r) => r._path === filePath);
    if (idx === -1) {
      this.index.push(record);
    } else {
      this.index[idx] = record;
    }
  }
  removeRecord(filePath) {
    this.index = this.index.filter((r) => r._path !== filePath);
  }
  where(filter) {
    return new QueryBuilder([...this.index]).where(filter);
  }
  query() {
    return new QueryBuilder([...this.index]);
  }
  validate(data) {
    if (!this.options.schema) return;
    try {
      this.options.schema.parse(data);
    } catch (err) {
      const issues = err.errors ?? [err];
      throw new FlatMarkValidationError(
        `Validation failed for collection "${this.name}"`,
        issues
      );
    }
  }
  async insert(record) {
    const { _id, _body = "", _path: _ignoredPath, ...frontmatter } = record;
    if (this.index.some((r) => r._id === _id)) {
      throw new FlatMarkError(`Record "${_id}" already exists in collection "${this.name}"`);
    }
    this.validate(frontmatter);
    const filePath = path2.join(this.dir, `${_id}.md`);
    const fileContent = matter2.stringify(_body, frontmatter);
    const parsed = parseMarkdownFile(filePath, fileContent);
    await fs.writeFile(filePath, fileContent, "utf-8");
    this.index.push(parsed);
    return parsed;
  }
  async update(_id, fields) {
    const existing = this.index.find((r) => r._id === _id);
    if (!existing) throw new FlatMarkNotFoundError(_id, this.name);
    const { _body: newBody, _id: _ignId, _path: _ignPath, ...newFrontmatter } = fields;
    const { _body: existingBody, _id: __id, _path: __path, ...existingFrontmatter } = existing;
    const mergedFrontmatter = { ...existingFrontmatter, ...newFrontmatter };
    this.validate(mergedFrontmatter);
    const updatedBody = newBody ?? existingBody;
    const fileContent = matter2.stringify(updatedBody, mergedFrontmatter);
    const parsed = parseMarkdownFile(existing._path, fileContent);
    await fs.writeFile(existing._path, fileContent, "utf-8");
    const idx = this.index.findIndex((r) => r._id === _id);
    this.index[idx] = parsed;
    return parsed;
  }
  async delete(_id) {
    const existing = this.index.find((r) => r._id === _id);
    if (!existing) throw new FlatMarkNotFoundError(_id, this.name);
    await fs.unlink(existing._path);
    this.index = this.index.filter((r) => r._id !== _id);
  }
};

// src/FlatMark.ts
var FlatMark = class {
  constructor(basePath, options = {}) {
    this.basePath = basePath;
    this.options = options;
    this.collections = /* @__PURE__ */ new Map();
    this.watcher = null;
  }
  async load(loadOptions = {}) {
    this.collections.clear();
    const entries = await fs2.readdir(this.basePath, { withFileTypes: true });
    const hasMdAtRoot = entries.some((e) => e.isFile() && e.name.endsWith(".md"));
    const subdirs = entries.filter((e) => e.isDirectory());
    const toLoad = subdirs.map((d) => ({
      name: d.name,
      dir: path3.join(this.basePath, d.name)
    }));
    if (hasMdAtRoot) {
      toLoad.push({ name: path3.basename(this.basePath), dir: this.basePath });
    }
    await Promise.all(
      toLoad.map(async ({ name, dir }) => {
        const collOpts = this.options.collections?.[name] ?? {};
        const coll = new Collection(dir, name, collOpts);
        await coll.load();
        this.collections.set(name, coll);
      })
    );
    if (loadOptions.watch) {
      await this.startWatcher();
    }
  }
  collection(name) {
    const coll = this.collections.get(name);
    if (!coll) throw new FlatMarkCollectionError(name);
    return coll;
  }
  async startWatcher() {
    await this.watcher?.close();
    const { default: chokidar } = await import("chokidar");
    this.watcher = chokidar.watch(this.basePath, {
      ignoreInitial: true,
      ignored: /(^|[/\\])\../
    });
    const getCollection = (filePath) => {
      const rel = path3.relative(this.basePath, filePath);
      const parts = rel.split(path3.sep);
      const name = parts.length === 1 ? path3.basename(this.basePath) : parts[0];
      return this.collections.get(name) ?? null;
    };
    this.watcher.on("add", async (filePath) => {
      if (!filePath.endsWith(".md")) return;
      try {
        const content = await fs2.readFile(filePath, "utf-8");
        getCollection(filePath)?.updateRecord(filePath, content);
      } catch {
      }
    }).on("change", async (filePath) => {
      if (!filePath.endsWith(".md")) return;
      try {
        const content = await fs2.readFile(filePath, "utf-8");
        getCollection(filePath)?.updateRecord(filePath, content);
      } catch {
      }
    }).on("unlink", (filePath) => {
      if (!filePath.endsWith(".md")) return;
      getCollection(filePath)?.removeRecord(filePath);
    });
    await new Promise((resolve) => this.watcher.on("ready", resolve));
  }
  async close() {
    await this.watcher?.close();
    this.watcher = null;
  }
};
export {
  Collection,
  FlatMark,
  FlatMarkCollectionError,
  FlatMarkError,
  FlatMarkNotFoundError,
  FlatMarkValidationError,
  QueryBuilder
};
//# sourceMappingURL=index.js.map