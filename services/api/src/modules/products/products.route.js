const express = require("express");

const { authenticate, optionalAuthenticate } = require("../../middlewares/auth.middleware");
const controller = require("./products.controller");

const router = express.Router();

router.get("/", controller.getProducts);
router.get("/filter-options", controller.getProductFilterOptions);
router.get("/compare", controller.getCompareProducts);
router.get("/:idOrSlug/reviews/eligibility", optionalAuthenticate, controller.getReviewEligibility);
router.get("/:idOrSlug/reviews", controller.getProductReviews);
router.post("/:idOrSlug/reviews", authenticate, controller.createProductReview);
router.get("/:idOrSlug", controller.getProductDetail);

module.exports = router;

