export const routeConfig = {
  public: {
    root: "/",
    catalog: "/products",
    compare: "/compare",
    profile: "/profile",
    warranties: "/warranties",
    productDetail: "/products/:idOrSlug",
    cart: "/cart",
    gioHang: "/gio-hang",
    checkout: "/checkout",
    thanhToan: "/thanh-toan",
    paymentResult: "/payment/result",
    orders: "/orders",
    orderDetail: "/orders/:orderId",
    tickets: "/tickets",
    ticketCreate: "/tickets/new",
    ticketDetail: "/tickets/:ticketId",
    aiChat: "/ai-chat",
    aiAdvisor: "/ai-advisor",
    pcBuilder: "/pc-builder",
    sharedPcBuilder: "/pc-builder/shared/:shareToken",
    login: "/login",
    register: "/register",
    help: "/help",
    guide: "/guide",
    warranty: "/warranty",
    returns: "/returns",
    about: "/about",
    jobs: "/jobs",
    privacy: "/privacy",
    terms: "/terms",
    contact: "/contact"
  },
  staff: {
    root: "/staff",
    orders: "/staff/orders",
    chat: "/staff/chat"
  },
  tech: {
    root: "/tech",
    tickets: "/tech/tickets",
    compatibility: "/tech/compatibility",
    warranties: "/tech/warranties"
  },
  admin: {
    root: "/admin",
    dashboard: "/admin/dashboard",
    system: "/admin/system",
    products: "/admin/products",
    attributes: "/admin/attributes",
    skus: "/admin/skus",
    compatibilityRules: "/admin/compatibility-rules",
    users: "/admin/users",
    paymentApproval: "/admin/payment-approval"
  }
};
