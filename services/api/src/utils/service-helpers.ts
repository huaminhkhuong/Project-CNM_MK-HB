export interface CustomAppError extends Error {
  statusCode?: number;
}

export function createError(message: string, statusCode: number = 500): CustomAppError {
  const error: CustomAppError = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function toPositiveInteger(value: any, fieldName: string = "Value"): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw createError(`${fieldName} must be a positive integer`, 400);
  }

  return parsed;
}

export function toPositiveNumber(value: any, fallback: number = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function toNonNegativeNumber(value: any, fieldName: string = "Value"): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw createError(`${fieldName} must be a non-negative number`, 400);
  }

  return parsed;
}

export default {
  createError,
  toPositiveInteger,
  toPositiveNumber,
  toNonNegativeNumber
};
