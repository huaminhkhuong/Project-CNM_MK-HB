import { z } from "zod";

const checkoutItemSchema = z.object({
  productId: z.coerce.number().int().positive().optional(),
  productVariantId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive().default(1)
});

export const checkoutSchema = z.object({
  paymentMethod: z.enum(["COD", "VNPAY", "BANK_TRANSFER"]).default("COD"),
  shippingAddress: z.string().trim().min(10).max(1000),
  addressId: z.coerce.number().int().positive().optional(),
  shippingFee: z.coerce.number().min(0).default(0),
  couponCode: z.string().trim().max(50).optional(),
  note: z.string().trim().max(1000).optional(),
  items: z.array(checkoutItemSchema).min(1).optional()
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(["PENDING", "PAID", "PROCESSING", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELED"])
});
