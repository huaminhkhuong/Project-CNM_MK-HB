import { Request, Response, NextFunction } from "express";
import { createError, toPositiveInteger } from "../../utils/service-helpers";

export const TICKET_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export const TICKET_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;

export function validateCreateTicket(req: Request, _res: Response, next: NextFunction): void {
  try {
    const title = String(req.body?.title || "").trim();
    const description = String(req.body?.description || "").trim();
    const priority = String(req.body?.priority || "MEDIUM").trim().toUpperCase();

    if (!title) {
      throw createError("title is required", 400);
    }

    if (!description) {
      throw createError("description is required", 400);
    }

    if (!TICKET_PRIORITIES.includes(priority as any)) {
      throw createError(`priority must be one of: ${TICKET_PRIORITIES.join(", ")}`, 400);
    }

    (req as any).validatedTicketPayload = {
      title,
      description,
      priority
    };

    return next();
  } catch (error: any) {
    return next(error);
  }
}

export function validateUpdateTicket(req: Request, _res: Response, next: NextFunction): void {
  try {
    const payload: any = {};

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "status")) {
      const status = String(req.body.status || "").trim().toUpperCase();

      if (!TICKET_STATUSES.includes(status as any)) {
        throw createError(`status must be one of: ${TICKET_STATUSES.join(", ")}`, 400);
      }

      payload.status = status;
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "priority")) {
      const priority = String(req.body.priority || "").trim().toUpperCase();

      if (!TICKET_PRIORITIES.includes(priority as any)) {
        throw createError(`priority must be one of: ${TICKET_PRIORITIES.join(", ")}`, 400);
      }

      payload.priority = priority;
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "assignedToId")) {
      payload.assignedToId = req.body.assignedToId === null ? null : toPositiveInteger(req.body.assignedToId, "assignedToId");
    }

    if (Object.keys(payload).length === 0) {
      throw createError("At least one ticket field is required for update", 400);
    }

    (req as any).validatedTicketPayload = payload;
    return next();
  } catch (error: any) {
    return next(error);
  }
}

export function validateAddTicketMessage(req: Request, _res: Response, next: NextFunction): void {
  try {
    const message = String(req.body?.message || "").trim();

    if (!message) {
      throw createError("message is required", 400);
    }

    (req as any).validatedTicketMessagePayload = { message };
    return next();
  } catch (error: any) {
    return next(error);
  }
}

export default {
  validateCreateTicket,
  validateUpdateTicket,
  validateAddTicketMessage,
  TICKET_PRIORITIES,
  TICKET_STATUSES
};
