const { notFoundHandler } = require("./not-found.middleware.ts");
module.exports = notFoundHandler;
module.exports.notFoundMiddleware = notFoundHandler;
