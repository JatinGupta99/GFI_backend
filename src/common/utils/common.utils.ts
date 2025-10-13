import { Logger } from '@nestjs/common';

/**
 * Sleep / delay function for retries, throttling, etc.
 * @param ms milliseconds to wait
 */
export const sleep = (ms: number): Promise<void> =>
  new Promise((res) => setTimeout(res, ms));

/**
 * Safe JSON parse with fallback
 * @param str string to parse
 * @param fallback value to return if parsing fails
 */
export const safeJsonParse = <T>(str: string, fallback: T): T => {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
};

/**
 * Validate a string matches allowed Daily room name pattern
 * Only allows letters, numbers, dash, underscore, max 128 chars
 */
export const validateRoomName = (name: string): boolean => {
  const regex = /^[A-Za-z0-9_-]{1,128}$/;
  return regex.test(name);
};

/**
 * Generate a random Daily room name if not provided
 */
export const generateRoomName = (length = 10): string => {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Logger wrapper to avoid repeating `new Logger(...)`
 */
export const log = (context: string, message: string, data?: any) => {
  const logger = new Logger(context);
  if (data) {
    logger.log(`${message} - ${JSON.stringify(data)}`);
  } else {
    logger.log(message);
  }
};

/**
 * Retry function with exponential backoff
 * Usage: await retry(() => someAsyncFn(), 3, 500);
 */
export async function retry<T>(
  fn: () => Promise<T>,
  retries = 3,
  backoff = 500,
): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    if (retries <= 0) throw err;
    await sleep(backoff);
    return retry(fn, retries - 1, backoff * 2);
  }
}

/**
 * Convert seconds to Unix timestamp
 */
export const toUnixTimestamp = (seconds: number): number =>
  Math.floor(Date.now() / 1000) + seconds;

/**
 * Pick only allowed keys from an object
 * @param obj source object
 * @param keys array of allowed keys
 */
export const pick = <T, K extends keyof T>(obj: T, keys: K[]): Partial<T> => {
  return keys.reduce((acc, key) => {
    if (obj[key] !== undefined) acc[key] = obj[key];
    return acc;
  }, {} as Partial<T>);
};
