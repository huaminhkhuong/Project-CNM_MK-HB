import { sendSuccess  } from "../../utils/api-response";
import { asyncHandler } from "../../utils/async-handler";
import * as productsService from "./products.service";

const getProducts = asyncHandler(async (req, res) => {
  const result = await productsService.getProducts(req.query || {});
  return sendSuccess(res, "Products fetched successfully", result);
});

const getProductFilterOptions = asyncHandler(async (_req, res) => {
  const result = await productsService.getFilterOptions();
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

export {
  getProducts,
  getProductFilterOptions,
  getCompareProducts,
  getProductDetail
};
export default {
  getProducts,
  getProductFilterOptions,
  getCompareProducts,
  getProductDetail
};
