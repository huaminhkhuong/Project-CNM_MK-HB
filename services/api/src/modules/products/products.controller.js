const { sendSuccess } = require("../../utils/api-response");
const asyncHandler = require("../../utils/async-handler");
const productsService = require("./products.service");

const getProducts = asyncHandler(async (req, res) => {
  const result = await productsService.getProducts(req.query || {});
  return sendSuccess(res, "Products fetched successfully", result);
});

const getProductFilterOptions = asyncHandler(async (req, res) => {
  const result = await productsService.getFilterOptions(req.query || {});
  return sendSuccess(res, "Product filter options fetched successfully", result);
});

const getCompareProducts = asyncHandler(async (req, res) => {
  const result = await productsService.compareProducts(req.query?.ids || req.body?.ids || "");
  return sendSuccess(res, "Products compared successfully", result);
});

const getProductDetail = asyncHandler(async (req, res) => {
  const result = await productsService.getProductDetail(req.params.idOrSlug);
  return sendSuccess(res, "Product detail fetched successfully", result);
});

const productReviewsService = require("./product-reviews.service");

const getProductReviews = asyncHandler(async (req, res) => {
  const result = await productReviewsService.getProductReviews(req.params.idOrSlug, req.query || {});
  return sendSuccess(res, "Product reviews fetched successfully", result);
});

const getReviewEligibility = asyncHandler(async (req, res) => {
  const userId = req.user?.userId || req.user?.id || null;
  const result = await productReviewsService.checkReviewEligibility(userId, req.params.idOrSlug);
  return sendSuccess(res, "Review eligibility checked successfully", result);
});

const createProductReview = asyncHandler(async (req, res) => {
  const userId = req.user?.userId || req.user?.id;
  const result = await productReviewsService.createProductReview(userId, req.params.idOrSlug, req.body || {});
  return sendSuccess(res, "Đánh giá sản phẩm thành công", result, 201);
});

module.exports = {
  getProducts,
  getProductFilterOptions,
  getCompareProducts,
  getProductDetail,
  getProductReviews,
  getReviewEligibility,
  createProductReview
};

