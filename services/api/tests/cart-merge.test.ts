import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { prisma } from "../src/config/prisma";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const cartController = require("../src/modules/cart/cart.controller");

describe("Guest Cart Merge Functionality (POST /api/cart/merge)", () => {
  it("merges guest cart items into user cart correctly with stock capping and duplicate SKU consolidation", async () => {
    // 1. Create an isolated test customer user via Prisma
    const uniqueEmail = `test_cart_merge_${Date.now()}@example.com`;
    const user = await prisma.user.create({
      data: {
        email: uniqueEmail,
        full_name: "Cart Merge Tester",
        status: "ACTIVE",
      },
    });
    const userId = user.id;

    // 2. Find 2 active product SKUs with stock
    const skus = await prisma.productSku.findMany({
      where: {
        stock: { gte: 5 },
        Product: { is_active: true },
      },
      take: 2,
    });
    if (skus.length < 2) return;
    const sku1 = skus[0];
    const sku2 = skus[1];

    // 3. Create or clear user's cart
    let cart = await prisma.cart.findFirst({ where: { user_id: userId } });
    if (!cart) {
      cart = await prisma.cart.create({ data: { user_id: userId } });
    }
    await prisma.cartItem.deleteMany({ where: { cart_id: cart.id } });

    // 4. Pre-insert 1 unit of sku1 into DB cart
    await prisma.cartItem.create({
      data: {
        cart_id: cart.id,
        product_variant_id: sku1.id,
        quantity: 1,
      },
    });

    // 5. Simulate merge request: guest had 2 units of sku1 and 3 units of sku2
    const req: any = {
      user: { userId: userId, role: "CUSTOMER" },
      body: {
        items: [
          {
            productVariantId: sku1.id,
            productId: sku1.product_id,
            quantity: 2,
          },
          {
            productVariantId: sku2.id,
            productId: sku2.product_id,
            quantity: 3,
          },
        ],
      },
    };

    let responseStatusCode = 200;
    let responseData: any = null;

    await new Promise<void>((resolve, reject) => {
      const res: any = {
        status(code: number) {
          responseStatusCode = code;
          return this;
        },
        json(data: any) {
          responseData = data;
          resolve();
          return this;
        },
      };

      cartController.mergeMyCart(req, res, (err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Assertions
    assert.equal(responseStatusCode, 200);
    assert.ok(responseData, "Response data should not be null");
    assert.equal(responseData.success, true);
    assert.ok(responseData.data, "Response data.data should exist");

    // Sku1 had 1 in DB + 2 from guest = 3 (stock >= 5)
    const itemsInDb = await prisma.cartItem.findMany({
      where: { cart_id: cart.id },
      orderBy: { product_variant_id: "asc" },
    });

    assert.equal(itemsInDb.length, 2, "Cart should now have 2 distinct items");

    const item1 = itemsInDb.find((i: any) => i.product_variant_id === sku1.id);
    const item2 = itemsInDb.find((i: any) => i.product_variant_id === sku2.id);

    assert.ok(item1, "Item 1 should be in the cart");
    assert.equal(item1.quantity, 3, "Item 1 quantity should be consolidated to 1 + 2 = 3");

    assert.ok(item2, "Item 2 should be in the cart");
    assert.equal(item2.quantity, 3, "Item 2 quantity should be 3");

    // Clean up test data
    await prisma.cartItem.deleteMany({ where: { cart_id: cart.id } });
    await prisma.cart.deleteMany({ where: { user_id: userId } });
    await prisma.user.delete({ where: { id: userId } });
  });

  after(async () => {
    // Database cleanup
  });
});
