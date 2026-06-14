type FlatRecord = {
    _id: string;
    _path: string;
    _body: string;
    [key: string]: unknown;
};
type FilterOperators = {
    $gt?: number | string;
    $gte?: number | string;
    $lt?: number | string;
    $lte?: number | string;
    $ne?: unknown;
    $includes?: unknown;
    $exists?: boolean;
};
type WhereFilter = Record<string, unknown | FilterOperators>;
type OrderByDirection = 'asc' | 'desc';
type ValidationIssue = {
    path: (string | number)[];
    message: string;
};
type CollectionOptions = {
    schema?: {
        parse: (data: unknown) => unknown;
    };
};
type FlatMarkOptions = {
    collections?: Record<string, CollectionOptions>;
};
type LoadOptions = {
    watch?: boolean;
};

declare class QueryBuilder {
    private readonly records;
    private filters;
    private selectedFields;
    private sortField;
    private sortDir;
    private limitN;
    private offsetN;
    constructor(records: FlatRecord[]);
    where(filter: WhereFilter): this;
    select(fields: string[]): this;
    orderBy(field: string, direction?: OrderByDirection): this;
    limit(n: number): this;
    offset(n: number): this;
    private applyFilters;
    get(): FlatRecord[];
    first(): FlatRecord | null;
    count(): number;
}

declare class Collection {
    private readonly dir;
    private readonly name;
    private readonly options;
    private index;
    constructor(dir: string, name: string, options?: CollectionOptions);
    load(): Promise<void>;
    updateRecord(filePath: string, content: string): void;
    removeRecord(filePath: string): void;
    where(filter: WhereFilter): QueryBuilder;
    query(): QueryBuilder;
    private validate;
    insert(record: Partial<FlatRecord> & {
        _id: string;
    }): Promise<FlatRecord>;
    update(_id: string, fields: Partial<FlatRecord>): Promise<FlatRecord>;
    delete(_id: string): Promise<void>;
}

declare class FlatMark {
    private readonly basePath;
    private readonly options;
    private collections;
    private watcher;
    constructor(basePath: string, options?: FlatMarkOptions);
    load(loadOptions?: LoadOptions): Promise<void>;
    collection(name: string): Collection;
    private startWatcher;
    close(): Promise<void>;
}

declare class FlatMarkError extends Error {
    constructor(message: string);
}
declare class FlatMarkNotFoundError extends FlatMarkError {
    constructor(id: string, collection: string);
}
declare class FlatMarkValidationError extends FlatMarkError {
    readonly issues: unknown[];
    constructor(message: string, issues: unknown[]);
}
declare class FlatMarkCollectionError extends FlatMarkError {
    constructor(name: string);
}

export { Collection, type CollectionOptions, type FilterOperators, FlatMark, FlatMarkCollectionError, FlatMarkError, FlatMarkNotFoundError, type FlatMarkOptions, FlatMarkValidationError, type FlatRecord, type LoadOptions, type OrderByDirection, QueryBuilder, type ValidationIssue, type WhereFilter };
