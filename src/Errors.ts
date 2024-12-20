export class ArgumentError extends Error {
  constructor(m: string) {
    super(m)
  }
}

export class ApiError extends Error {
  constructor(readonly method: string, readonly url: string, readonly status: number, message: string) {
    super(message)
  }
}

export class AuthError extends Error {
  constructor(readonly code: string, message: string, readonly description: string) {
    super(message)
  }
}

export class CodeDescriptionError extends Error {
  constructor(readonly code: string, message: string, readonly description: string) {
    super(message)
  }
}