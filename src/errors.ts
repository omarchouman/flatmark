export class FlatMarkError extends Error {
  constructor(message: string) {
    super(message)
    Object.setPrototypeOf(this, new.target.prototype)
    this.name = 'FlatMarkError'
  }
}

export class FlatMarkNotFoundError extends FlatMarkError {
  constructor(id: string, collection: string) {
    super(`Record "${id}" not found in collection "${collection}"`)
    Object.setPrototypeOf(this, new.target.prototype)
    this.name = 'FlatMarkNotFoundError'
  }
}

export class FlatMarkValidationError extends FlatMarkError {
  constructor(message: string, public readonly issues: unknown[]) {
    super(message)
    Object.setPrototypeOf(this, new.target.prototype)
    this.name = 'FlatMarkValidationError'
  }
}

export class FlatMarkCollectionError extends FlatMarkError {
  constructor(name: string) {
    super(
      `Collection "${name}" does not exist. Make sure a directory with that name exists under your base path.`
    )
    Object.setPrototypeOf(this, new.target.prototype)
    this.name = 'FlatMarkCollectionError'
  }
}
