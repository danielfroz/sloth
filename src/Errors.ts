export class InitError extends Error {
  constructor(m: string) {
    super(m)
  }
}

export class ArgumentError extends Error {
  constructor(m: string) {
    super(m)
  }
}

export class ApiError extends Error {
  constructor(
    readonly method: string,
    readonly url: string,
    readonly status: number,
    /** 
     * error code returned from the Api;
     * this applies if the API returns 500 with error ErrorResult:
     * { error: { code: string, message: string }}
     */
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

export class AuthError extends Error {
  constructor(readonly code: string, message: string, readonly description = undefined) {
    super(message)
  }
}

export class CodeError extends Error {
  constructor(readonly code: string, m: string) {
    super(m)
  }
}