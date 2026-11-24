import { Request, Response, NextFunction } from "express";
import { sendSuccess } from "../../utils/api-response";
import { checkDatabaseHealth } from "../../services/test-connection.service";

export async function getApiHealth(_req: Request, res: Response): Promise<Response> {
  return sendSuccess(res, "API is running", {
    service: "api",
    timestamp: new Date().toISOString()
  });
}

export async function getDatabaseHealth(_req: Request, res: Response, next: NextFunction): Promise<any> {
  try {
    const result = await checkDatabaseHealth();
    return sendSuccess(res, "Database connection is healthy", result);
  } catch (error: any) {
    error.statusCode = 500;
    return next(error);
  }
}

export default {
  getApiHealth,
  getDatabaseHealth
};
