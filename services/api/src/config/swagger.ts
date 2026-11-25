import swaggerJsdoc from "swagger-jsdoc";

const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "CNM Computer E-Commerce & AI System API",
    version: "1.0.0",
    description: "Tài liệu API Hệ thống Thương mại điện tử Máy tính & Linh kiện kèm Module Tư vấn AI và Bảo hành.",
    contact: {
      name: "Đội ngũ Phát triển CNM",
      email: "support@cnm.local"
    }
  },
  servers: [
    {
      url: "http://localhost:4000",
      description: "Development API Server"
    },
    {
      url: "/api",
      description: "Production / Reverse Proxy API"
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Nhập Access Token JWT dạng: Bearer <token>"
      }
    }
  },
  tags: [
    { name: "Auth", description: "API Đăng ký, Đăng nhập, Xử lý Token & Tài khoản" },
    { name: "Products & Catalog", description: "API Tìm kiếm, Lọc danh mục, Thương hiệu & Sản phẩm" },
    { name: "Cart", description: "API Giỏ hàng người dùng" },
    { name: "Orders", description: "API Đặt hàng, Thanh toán VNPay/COD & Quản lý Đơn hàng" },
    { name: "PC Builder", description: "API Xây dựng cấu hình PC & Kiểm tra Tương thích Linh kiện" },
    { name: "Coupons", description: "API Khuyến mãi, Voucher & Mã giảm giá" },
    { name: "Notifications", description: "API Thông báo hệ thống, đơn hàng & bảo hành" },
    { name: "Warranties", description: "API Tra cứu Bảo hành & Yêu cầu Bảo hành Sản phẩm" },
    { name: "Tickets", description: "API Vé hỗ trợ kỹ thuật Khách hàng" },
    { name: "AI Advisor", description: "API Tư vấn cấu hình & Giải đáp thắc mắc bằng AI" },
    { name: "Users & Staff", description: "API Quản lý Người dùng, Nhân viên & Phân quyền" },
    { name: "Health", description: "API Kiểm tra Trạng thái Hệ thống & CSDL" }
  ],
  paths: {
    "/api/health": {
      get: {
        tags: ["Health"],
        summary: "Kiểm tra trạng thái API & kết nối CSDL MySQL 8.0",
        responses: {
          "200": {
            description: "Hệ thống hoạt động bình thường",
            content: {
              "application/json": {
                example: {
                  status: "ok",
                  service: "api",
                  timestamp: "2026-08-04T08:56:43.977Z",
                  database: { connected: true, latencyMs: 15, database: "cnm_mk_hb" }
                }
              }
            }
          }
        }
      }
    },
    "/api/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Đăng ký tài khoản người dùng mới",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                email: "customer@cnm.local",
                password: "Customer@123",
                fullName: "Nguyễn Văn A",
                phone: "0901234567"
              }
            }
          }
        },
        responses: {
          "201": { description: "Đăng ký thành công" },
          "400": { description: "Dữ liệu nhập vào không hợp lệ hoặc Email đã tồn tại" }
        }
      }
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Đăng nhập hệ thống (Lấy JWT Access Token & Refresh Token)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                email: "admin@cnm.local",
                password: "Admin@123"
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Đăng nhập thành công",
            content: {
              "application/json": {
                example: {
                  success: true,
                  accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                  user: { id: 1, email: "admin@cnm.local", fullName: "System Admin", role: "ADMIN" }
                }
              }
            }
          },
          "401": { description: "Sai email hoặc mật khẩu" }
        }
      }
    },
    "/api/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Lấy thông tin tài khoản hiện tại (Yêu cầu Token)",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Thành công" },
          "401": { description: "Chưa đăng nhập hoặc Token hết hạn" }
        }
      }
    },
    "/api/products": {
      get: {
        tags: ["Products & Catalog"],
        summary: "Lấy danh sách sản phẩm (Hỗ trợ phân trang, tìm kiếm & lọc)",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 12 } },
          { name: "search", in: "query", schema: { type: "string" } },
          { name: "category", in: "query", schema: { type: "string" } },
          { name: "brand", in: "query", schema: { type: "string" } }
        ],
        responses: {
          "200": { description: "Danh sách sản phẩm" }
        }
      }
    },
    "/api/products/{id}": {
      get: {
        tags: ["Products & Catalog"],
        summary: "Lấy chi tiết sản phẩm theo ID hoặc Slug",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } }
        ],
        responses: {
          "200": { description: "Chi tiết sản phẩm" },
          "404": { description: "Không tìm thấy sản phẩm" }
        }
      }
    },
    "/api/cart": {
      get: {
        tags: ["Cart"],
        summary: "Lấy giỏ hàng của người dùng",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Thông tin giỏ hàng" }
        }
      },
      post: {
        tags: ["Cart"],
        summary: "Thêm sản phẩm vào giỏ hàng",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: { productVariantId: 1, quantity: 1 }
            }
          }
        },
        responses: {
          "200": { description: "Đã cập nhật giỏ hàng" }
        }
      }
    },
    "/api/orders": {
      get: {
        tags: ["Orders"],
        summary: "Lấy danh sách đơn hàng người dùng / Quản trị",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Danh sách đơn hàng" }
        }
      },
      post: {
        tags: ["Orders"],
        summary: "Tạo đơn hàng mới",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                shippingAddress: "123 Nguyễn Văn Cừ, Q5, TP.HCM",
                paymentMethod: "COD",
                note: "Giao giờ hành chính"
              }
            }
          }
        },
        responses: {
          "201": { description: "Tạo đơn hàng thành công" }
        }
      }
    },
    "/api/pc-builder": {
      get: {
        tags: ["PC Builder"],
        summary: "Lấy linh kiện theo loại cho công cụ Build PC",
        parameters: [
          { name: "type", in: "query", schema: { type: "string" }, description: "Loại linh kiện: CPU, GPU, RAM, Mainboard..." }
        ],
        responses: {
          "200": { description: "Danh sách linh kiện tương thích" }
        }
      }
    },
    "/api/pc-builder/check": {
      post: {
        tags: ["PC Builder"],
        summary: "Kiểm tra độ tương thích giữa các linh kiện đã chọn",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                items: [{ skuId: 1, componentType: "CPU" }, { skuId: 2, componentType: "Mainboard" }]
              }
            }
          }
        },
        responses: {
          "200": { description: "Kết quả kiểm tra tương thích" }
        }
      }
    },
    "/api/warranties": {
      get: {
        tags: ["Warranties"],
        summary: "Lấy danh sách bảo hành của tôi",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Danh sách thẻ bảo hành" }
        }
      }
    },
    "/api/warranties/lookup/{code}": {
      get: {
        tags: ["Warranties"],
        summary: "Tra cứu thông tin bảo hành theo Mã bảo hành / SĐT / Đơn hàng",
        parameters: [
          { name: "code", in: "path", required: true, schema: { type: "string" }, example: "BH-1234" }
        ],
        responses: {
          "200": { description: "Thông tin thẻ bảo hành & tiến trình xử lý" }
        }
      }
    },
    "/api/ai-advisor/recommend": {
      post: {
        tags: ["AI Advisor"],
        summary: "Tư vấn cấu hình PC theo nhu cầu & ngân sách bằng AI",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                budget: 20000000,
                purpose: "Chơi game AAA và làm đồ họa 3D nhẹ"
              }
            }
          }
        },
        responses: {
          "200": { description: "Gợi ý cấu hình từ AI Advisor" }
        }
      }
    },
    "/api/products/filter-options": {
      get: {
        tags: ["Products & Catalog"],
        summary: "Lấy danh sách facet thuộc tính lọc động theo danh mục (Socket, RAM, VRAM, Form Factor...)",
        parameters: [
          { name: "category_id", in: "query", required: false, schema: { type: "integer" }, example: 1 }
        ],
        responses: {
          "200": { description: "Danh sách danh mục, thương hiệu và thuộc tính kỹ thuật có sẵn để lọc" }
        }
      }
    },
    "/api/coupons/available": {
      get: {
        tags: ["Coupons"],
        summary: "Lấy danh sách mã giảm giá/voucher còn hiệu lực cho khách hàng",
        responses: {
          "200": { description: "Danh sách voucher hợp lệ kèm điều kiện tối thiểu và mức giảm" }
        }
      }
    },
    "/api/coupons/validate": {
      post: {
        tags: ["Coupons"],
        summary: "Kiểm tra và tính toán số tiền giảm giá của mã voucher cho giỏ hàng",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                code: "WELCOMEPC",
                subtotal: 1500000,
                items: [{ product_variant_id: 1, quantity: 1, price: 1500000 }]
              }
            }
          }
        },
        responses: {
          "200": { description: "Chi tiết mức giảm giá và số tiền thanh toán cuối cùng" }
        }
      }
    },
    "/api/notifications/my": {
      get: {
        tags: ["Notifications"],
        security: [{ bearerAuth: [] }],
        summary: "Lấy danh sách thông báo của người dùng đăng nhập",
        responses: {
          "200": { description: "Danh sách thông báo đơn hàng, bảo hành và hệ thống" }
        }
      }
    },
    "/api/pc-builder/check-compatibility": {
      post: {
        tags: ["PC Builder"],
        summary: "Kiểm tra tương thích chuyên sâu đa linh kiện dựa trên 44+ quy tắc CSDL",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                components: [
                  { component_type: "cpu", variant_id: 1 },
                  { component_type: "mainboard", variant_id: 3 }
                ]
              }
            }
          }
        },
        responses: {
          "200": { description: "Báo cáo chi tiết độ tương thích, điểm số và các cảnh báo kỹ thuật" }
        }
      }
    }
  }
};

const options = {
  swaggerDefinition,
  apis: []
};

export const swaggerSpec = swaggerJsdoc(options);
