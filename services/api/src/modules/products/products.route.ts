import * as express from "express";

import * as controller from "./products.controller";

const router = express.Router();

router.get("/", controller.getProducts);
router.get("/filter-options", controller.getProductFilterOptions);
router.get("/compare", controller.getCompareProducts);
router.get("/:idOrSlug", controller.getProductDetail);

export default router;
