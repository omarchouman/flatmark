export class FlatMarkError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FlatMarkError'
  }
}

export class FlatMarkNotFoundError extends FlatMarkError {
  constructor(id: string, collection: string) {
    super(`Record "${id}" not found in collection "${collection}"`)
    this.name = 'FlatMarkNotFoundError'
  }
}

export class FlatMarkValidationError extends FlatMarkError {
  constructor(message: string, public readonly issues: unknown[]) {
    super(message)
    this.name = 'FlatMarkValidationError'
  }
}

export class FlatMarkCollectionError extends FlatMarkError {
  constructor(name: string) {
    super(
      `Collection "${name}" does not exist. Make sure a directory with that name exists under your base path.`
    )
    this.name = 'FlatMarkCollectionError'
  }
}
