import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import pcBuilderService from "../src/modules/pc-builder/pc-builder.service";
const { pool } = require("../src/config/database");

after(async () => {
  setTimeout(() => {
    try {
      if (pool && typeof pool.end === "function") pool.end();
    } catch (_) {}
  }, 100);
});

describe("PC Builder Budget Variance & Boundary Tests", () => {
  // Test 1: Exception Handling
  describe("1. Exceptions & Invalid Inputs", () => {
    it("should throw error for null or undefined budget", async () => {
      await assert.rejects(
        async () => {
          await pcBuilderService.suggestBuild({ budget: null });
        },
        (err: any) => {
          assert.match(err.message, /Vui lòng nhập ngân sách hợp lệ/);
          return true;
        }
      );

      await assert.rejects(
        async () => {
          await pcBuilderService.suggestBuild({});
        },
        (err: any) => {
          assert.match(err.message, /Vui lòng nhập ngân sách hợp lệ/);
          return true;
        }
      );
    });

    it("should throw error for non-numeric or NaN budget", async () => {
      await assert.rejects(
        async () => {
          await pcBuilderService.suggestBuild({ budget: "abc" });
        },
        (err: any) => {
          assert.match(err.message, /Vui lòng nhập ngân sách hợp lệ/);
          return true;
        }
      );

      await assert.rejects(
        async () => {
          await pcBuilderService.suggestBuild({ budget: NaN });
        },
        (err: any) => {
          assert.match(err.message, /Vui lòng nhập ngân sách hợp lệ/);
          return true;
        }
      );
    });

    it("should throw error for zero or negative budget", async () => {
      await assert.rejects(
        async () => {
          await pcBuilderService.suggestBuild({ budget: 0 });
        },
        (err: any) => {
          assert.match(err.message, /Ngân sách phải lớn hơn 0đ/);
          return true;
        }
      );

      await assert.rejects(
        async () => {
          await pcBuilderService.suggestBuild({ budget: -5000000 });
        },
        (err: any) => {
          assert.match(err.message, /Ngân sách phải lớn hơn 0đ/);
          return true;
        }
      );
    });
  });

  // Test 2: Boundary Tests (Min 6M, Max 250M)
  describe("2. Budget Boundaries", () => {
    it("should reject budgets below 6,000,000đ", async () => {
      await assert.rejects(
        async () => {
          await pcBuilderService.suggestBuild({ budget: 5999999 });
        },
        (err: any) => {
          assert.match(err.message, /Ngân sách tối thiểu để xây dựng cấu hình máy tính hoàn chỉnh là 6.000.000đ/);
          return true;
        }
      );
    });

    it("should reject budgets above 250,000,000đ", async () => {
      await assert.rejects(
        async () => {
          await pcBuilderService.suggestBuild({ budget: 250000001 });
        },
        (err: any) => {
          assert.match(err.message, /Ngân sách tối đa hỗ trợ tư vấn tự động là 250.000.000đ/);
          return true;
        }
      );
    });

    it("should accept minimum boundary budget of 6,000,000đ", async () => {
      const res = await pcBuilderService.suggestBuild({ budget: 6000000, useCase: "office" });
      assert.ok(res);
      assert.ok(res.candidates?.bestValue);
      const best = res.candidates.bestValue;
      assert.ok(best.totalPrice <= 6000000 * 1.05, `Expected ${best.totalPrice} <= 6.300.000`);
    });
  });

  // Test 3: Standard Budgets (10M, 15M, 20M, 25M, 30M) - Deviation <= 5%
  describe("3. Target Budgets <= 5% Deviation Guarantee", () => {
    const testCases = [
      { budget: 10000000, useCase: "gaming" },
      { budget: 15000000, useCase: "gaming" },
      { budget: 20000000, useCase: "gaming" },
      { budget: 25000000, useCase: "gaming" },
      { budget: 30000000, useCase: "gaming" }
    ];

    for (const tc of testCases) {
      it(`should keep total price within <= 5% for ${tc.budget.toLocaleString("vi-VN")}đ (${tc.useCase})`, async () => {
        const res = await pcBuilderService.suggestBuild({ budget: tc.budget, useCase: tc.useCase });
        assert.ok(res);
        assert.ok(res.candidates?.bestValue);

        const best = res.candidates.bestValue;
        const maxAllowed = tc.budget * 1.05;

        assert.ok(
          best.totalPrice <= maxAllowed,
          `bestValue.totalPrice (${best.totalPrice}) exceeds maxAllowed ${maxAllowed} for target ${tc.budget}`
        );
        assert.ok(
          res.totalPrice <= maxAllowed,
          `res.totalPrice (${res.totalPrice}) exceeds maxAllowed ${maxAllowed} for target ${tc.budget}`
        );

        // Verify all essential components exist
        const comps = best.components;
        assert.ok(comps.cpu, "CPU must be present");
        assert.ok(comps.mainboard, "Mainboard must be present");
        assert.ok(comps.ram, "RAM must be present");
        assert.ok(comps.storage, "Storage must be present");
        assert.ok(comps.psu, "PSU must be present");
      });
    }
  });
});
