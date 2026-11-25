import { z } from "zod";

export const addCartItemSchema = z.object({
  productId: z.coerce.string().min(1).optional(),
  productVariantId: z.coerce.string().min(1).optional(),
  variantId: z.coerce.string().min(1).optional(),
  quantity: z.coerce.number().int().min(1).max(99).default(1)
}).refine(
  (data) => Boolean(data.productId || data.productVariantId || data.variantId),
  { message: "productId or productVariantId is required" }
);

export const updateCartItemSchema = z.object({
  quantity: z.coerce.number().int().min(1).max(99)
});

export const mergeCartSchema = z.object({
  items: z.array(
    z.object({
      productId: z.union([z.string(), z.number()]).optional(),
      productVariantId: z.union([z.string(), z.number()]).optional(),
      variantId: z.union([z.string(), z.number()]).optional(),
      quantity: z.coerce.number().int().min(1).max(99).default(1)
    }).refine(
      (data) => Boolean(data.productId || data.productVariantId || data.variantId),
      { message: "productId or productVariantId is required" }
    )
  )
});
