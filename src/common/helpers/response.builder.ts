export class ResponseBuilder {
  static success<T>(message: string, data: T, meta: Record<string, any> = {}) {
    return {
      status: 'success',
      message,
      data,
      meta,
      timestamp: new Date().toISOString(),
    };
  }

  static error(
    message: string,
    errors: any = null,
    meta: Record<string, any> = {},
  ) {
    return {
      status: 'error',
      message,
      errors,
      meta,
      timestamp: new Date().toISOString(),
    };
  }
}
