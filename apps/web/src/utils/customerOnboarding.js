import { createBuild, addBuildItem, saveBuild } from "../services/pc-builder.service";
import { getProductDetail } from "../services/catalog.service";
import { getGuestPcBuildStore, setGuestPcBuildStore } from "./guestStorage";

/**
 * Đồng bộ cấu hình PC khách (localStorage) lên tài khoản sau đăng nhập/đăng ký.
 */
export async function migrateGuestBuildsToAccount() {
  const store = getGuestPcBuildStore();
  const builds = Object.values(store.builds || {});
  let migrated = 0;
  let lastMigratedBuildId = null;

  for (const guestBuild of builds) {
    const components = guestBuild?.components || {};
    const entries = Object.entries(components);
    if (entries.length === 0) continue;

    try {
      const created = await createBuild({ name: guestBuild.name || "Cấu hình đã nhập" });
      const build = created?.data?.data || created?.data || created;
      if (!build?.id) continue;
      lastMigratedBuildId = build.id;

      for (const [componentType, item] of entries) {
        let variantId =
          item?.variant?.variant_id ||
          item?.variant?.id ||
          item?.variant?.skuId ||
          item?.variantId ||
          item?.productVariantId;

        // Failsafe: Nếu chưa có variantId, thử lấy từ product.variants hoặc fetch chi tiết sản phẩm
        if (!variantId && item?.product) {
          const prodVariants = item.product.variants || item.product.skus;
          if (Array.isArray(prodVariants) && prodVariants.length > 0) {
            variantId = prodVariants[0].id || prodVariants[0].variant_id;
          } else if (item.product.id) {
            try {
              const detailRes = await getProductDetail(item.product.id);
              const detail = detailRes?.data || detailRes;
              const dVariants = detail?.variants || detail?.skus;
              if (Array.isArray(dVariants) && dVariants.length > 0) {
                variantId = dVariants[0].id || dVariants[0].variant_id;
              }
            } catch {
              // silent
            }
          }
        }

        if (!variantId) continue;
        await addBuildItem(build.id, {
          componentType,
          productVariantId: Number(variantId),
          quantity: Math.max(1, Number(item?.quantity || 1))
        });
      }

      await saveBuild(build.id, { name: guestBuild.name || "Cấu hình của tôi" });
      migrated += 1;
    } catch (error) {
      console.warn("[migrateGuestBuilds]", guestBuild?.name, error);
    }
  }

  if (migrated > 0) {
    const activeId = store.activeBuildId || "default";
    setGuestPcBuildStore({
      activeBuildId: activeId,
      builds: {
        [activeId]: {
          id: activeId,
          name: "Cấu hình của tôi",
          components: {},
          totalPrice: 0,
          updatedAt: new Date().toISOString()
        }
      }
    });
  }

  return { migrated, lastMigratedBuildId };
}

export async function runCustomerOnboarding() {
  const buildResult = await migrateGuestBuildsToAccount();
  return {
    buildsMigrated: buildResult.migrated,
    lastMigratedBuildId: buildResult.lastMigratedBuildId
  };
}
