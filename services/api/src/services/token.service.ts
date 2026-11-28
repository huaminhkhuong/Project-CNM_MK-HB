import crypto from "crypto";
import jwt, { type SignOptions } from "jsonwebtoken";

import { env } from "../config/env";
import { AppError } from "../errors/app-error";
import type { AuthTokenPayload } from "../types/auth";

export function signAccessToken(payload: AuthTokenPayload) {
  const options: SignOptions = {
    expiresIn: env.jwtAccessExpiresIn as SignOptions["expiresIn"],
    jwtid: crypto.randomUUID()
  };

  return jwt.sign(payload, env.jwtAccessSecret, options);
}

export function signRefreshToken(payload: AuthTokenPayload) {
  const options: SignOptions = {
    expiresIn: env.jwtRefreshExpiresIn as SignOptions["expiresIn"],
    jwtid: crypto.randomUUID()
  };

  return jwt.sign(payload, env.jwtRefreshSecret, options);
}

export function verifyRefreshToken(token: string): AuthTokenPayload {
  try {
    return jwt.verify(token, env.jwtRefreshSecret) as AuthTokenPayload;
  } catch (_error) {
    throw new AppError("Invalid or expired refresh token", 401);
  }
}
