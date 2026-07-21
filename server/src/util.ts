import { customAlphabet } from 'nanoid';
import type { Request, Response, NextFunction, RequestHandler } from 'express';

const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
const nano = customAlphabet(alphabet, 21);

export function id(prefix: string): string {
  return `${prefix}-${nano()}`;
}

export function token(): string {
  return customAlphabet(alphabet, 32)();
}

export function now(): string {
  return new Date().toISOString();
}

export function initialsFrom(name: string, fallback: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
  return initials || fallback.slice(0, 2).toUpperCase();
}

/** Wrap async route handlers so thrown errors reach the error middleware. */
export function ah(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
