import { lazy, Suspense } from "react";
import { Navigate, useRoutes } from "react-router-dom";

import { AdminLayout } from "../layouts/AdminLayout";
import { PublicLayout } from "../layouts/PublicLayout";
import { StaffLayout } from "../layouts/StaffLayout";
import { TechLayout } from "../layouts/TechLayout";
import { routeConfig } from "./routeConfig";

const PageLoader = () => (
  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "40vh" }}>
    <div style={{ width: 36, height: 36, border: "3px solid #e2e8f0", borderTopColor: "#2563eb", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
  </div>
);

const load = (importer) => {
  const Component = lazy(importer);
  return function LazyWrapper(props) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Component {...props} />
      </Suspense>
    );
  };
};

// Admin Pages (Code Split)
const AdminAttributesPage = load(() => import("../pages/admin/AdminAttributesPage").then((m) => ({ default: m.AdminAttributesPage })));
const AdminCompatibilityRulesPage = load(() => import("../pages/admin/AdminCompatibilityRulesPage").then((m) => ({ default: m.AdminCompatibilityRulesPage })));
const AdminDashboardPage = load(() => import("../pages/admin/AdminDashboardPage").then((m) => ({ default: m.AdminDashboardPage })));
const AdminProductsPage = load(() => import("../pages/admin/AdminProductsPage").then((m) => ({ default: m.AdminProductsPage })));
const AdminSkusPage = load(() => import("../pages/admin/AdminSkusPage").then((m) => ({ default: m.AdminSkusPage })));
const AdminSystemPage = load(() => import("../pages/admin/AdminSystemPage").then((m) => ({ default: m.AdminSystemPage })));
const AdminUsersPage = load(() => import("../pages/admin/AdminUsersPage").then((m) => ({ default: m.AdminUsersPage })));
const AdminPaymentApprovalPage = load(() => import("../pages/admin/AdminPaymentApprovalPage").then((m) => ({ default: m.AdminPaymentApprovalPage })));

// Public Pages (Code Split)
const AiChatPage = load(() => import("../pages/public/AiChatPage").then((m) => ({ default: m.AiChatPage })));
const CartPage = load(() => import("../pages/public/CartPage").then((m) => ({ default: m.CartPage })));
const CheckoutPage = load(() => import("../pages/public/CheckoutPage").then((m) => ({ default: m.CheckoutPage })));
const CompareProductsPage = load(() => import("../pages/public/CompareProductsPage").then((m) => ({ default: m.CompareProductsPage })));
const HomePage = load(() => import("../pages/public/HomePage").then((m) => ({ default: m.HomePage })));
const LoginPage = load(() => import("../pages/public/LoginPage").then((m) => ({ default: m.LoginPage })));
const NotFoundPage = load(() => import("../pages/public/NotFoundPage").then((m) => ({ default: m.NotFoundPage })));
const OrderDetailPage = load(() => import("../pages/public/OrderDetailPage").then((m) => ({ default: m.OrderDetailPage })));
const OrdersPage = load(() => import("../pages/public/OrdersPage").then((m) => ({ default: m.OrdersPage })));
const PaymentResultPage = load(() => import("../pages/public/PaymentResultPage").then((m) => ({ default: m.PaymentResultPage })));
const MockPaymentPage = load(() => import("../pages/public/MockPaymentPage").then((m) => ({ default: m.MockPaymentPage })));
const PcBuilderPage = load(() => import("../pages/public/PcBuilderPage").then((m) => ({ default: m.PcBuilderPage })));
const SharedBuildPage = load(() => import("../pages/public/SharedBuildPage").then((m) => ({ default: m.SharedBuildPage })));
const ProductDetailPage = load(() => import("../pages/public/ProductDetailPage").then((m) => ({ default: m.ProductDetailPage })));
const ProductListPage = load(() => import("../pages/public/ProductListPage").then((m) => ({ default: m.ProductListPage })));
const ProfilePage = load(() => import("../pages/public/ProfilePage").then((m) => ({ default: m.ProfilePage })));
const RegisterPage = load(() => import("../pages/public/RegisterPage").then((m) => ({ default: m.RegisterPage })));
const TicketCreatePage = load(() => import("../pages/public/TicketCreatePage").then((m) => ({ default: m.TicketCreatePage })));
const TicketDetailPage = load(() => import("../pages/public/TicketDetailPage").then((m) => ({ default: m.TicketDetailPage })));
const TicketListPage = load(() => import("../pages/public/TicketListPage").then((m) => ({ default: m.TicketListPage })));
const WarrantiesPage = load(() => import("../pages/public/WarrantiesPage").then((m) => ({ default: m.WarrantiesPage })));
const InformationPage = load(() => import("../pages/public/InformationPage").then((m) => ({ default: m.InformationPage })));

// Staff Pages (Code Split)
const StaffOrdersPage = load(() => import("../pages/staff/StaffOrdersPage").then((m) => ({ default: m.StaffOrdersPage })));
const StaffChatPage = load(() => import("../pages/staff/StaffChatPage"));

// Tech Pages (Code Split)
const TechTicketsPage = load(() => import("../pages/tech/TechTicketsPage").then((m) => ({ default: m.TechTicketsPage })));
const TechCompatibilityPage = load(() => import("../pages/tech/TechCompatibilityPage").then((m) => ({ default: m.TechCompatibilityPage })));
const TechWarrantiesPage = load(() => import("../pages/tech/TechWarrantiesPage").then((m) => ({ default: m.TechWarrantiesPage })));

export function AppRouter() {
  const routes = [
    {
      path: routeConfig.public.root,
      element: <PublicLayout />,
      children: [
        { index: true, element: <HomePage /> },
        { path: routeConfig.public.catalog.replace(/^\//, ""), element: <ProductListPage /> },
        { path: routeConfig.public.compare.replace(/^\//, ""), element: <CompareProductsPage /> },
        { path: routeConfig.public.profile.replace(/^\//, ""), element: <ProfilePage /> },
        { path: routeConfig.public.warranties.replace(/^\//, ""), element: <WarrantiesPage /> },
        { path: routeConfig.public.productDetail.replace(/^\//, ""), element: <ProductDetailPage /> },
        { path: routeConfig.public.cart.replace(/^\//, ""), element: <CartPage /> },
        { path: routeConfig.public.checkout.replace(/^\//, ""), element: <CheckoutPage /> },
        { path: routeConfig.public.paymentResult.replace(/^\//, ""), element: <PaymentResultPage /> },
        { path: "payment/mock", element: <MockPaymentPage /> },
        { path: routeConfig.public.orders.replace(/^\//, ""), element: <OrdersPage /> },
        { path: routeConfig.public.orderDetail.replace(/^\//, ""), element: <OrderDetailPage /> },
        { path: routeConfig.public.tickets.replace(/^\//, ""), element: <TicketListPage /> },
        { path: routeConfig.public.ticketCreate.replace(/^\//, ""), element: <TicketCreatePage /> },
        { path: routeConfig.public.ticketDetail.replace(/^\//, ""), element: <TicketDetailPage /> },
        { path: routeConfig.public.aiChat.replace(/^\//, ""), element: <AiChatPage /> },
        { path: routeConfig.public.aiAdvisor.replace(/^\//, ""), element: <AiChatPage /> },
        { path: routeConfig.public.pcBuilder.replace(/^\//, ""), element: <PcBuilderPage /> },
        { path: "pc builder", element: <Navigate to="/pc-builder" replace /> },
        { path: "pcbuilder", element: <Navigate to="/pc-builder" replace /> },
        { path: routeConfig.public.sharedPcBuilder.replace(/^\//, ""), element: <SharedBuildPage /> },
        { path: routeConfig.public.login.replace(/^\//, ""), element: <LoginPage /> },
        { path: routeConfig.public.register.replace(/^\//, ""), element: <RegisterPage /> },
        { path: routeConfig.public.help.replace(/^\//, ""), element: <InformationPage /> },
        { path: routeConfig.public.guide.replace(/^\//, ""), element: <InformationPage /> },
        { path: routeConfig.public.warranty.replace(/^\//, ""), element: <InformationPage /> },
        { path: routeConfig.public.returns.replace(/^\//, ""), element: <InformationPage /> },
        { path: routeConfig.public.about.replace(/^\//, ""), element: <InformationPage /> },
        { path: routeConfig.public.jobs.replace(/^\//, ""), element: <InformationPage /> },
        { path: routeConfig.public.privacy.replace(/^\//, ""), element: <InformationPage /> },
        { path: routeConfig.public.terms.replace(/^\//, ""), element: <InformationPage /> },
        { path: routeConfig.public.contact.replace(/^\//, ""), element: <InformationPage /> }
      ]
    },
    {
      path: routeConfig.staff.root,
      element: <StaffLayout />,
      children: [
        { index: true, element: <Navigate to={routeConfig.staff.orders} replace /> },
        { path: routeConfig.staff.orders.replace(/^\/staff\//, ""), element: <StaffOrdersPage /> },
        { path: routeConfig.staff.chat.replace(/^\/staff\//, ""), element: <StaffChatPage /> }
      ]
    },
    {
      path: routeConfig.tech.root,
      element: <TechLayout />,
      children: [
        { index: true, element: <Navigate to={routeConfig.tech.tickets} replace /> },
        { path: routeConfig.tech.tickets.replace(/^\/tech\//, ""), element: <TechTicketsPage /> },
        { path: routeConfig.tech.compatibility.replace(/^\/tech\//, ""), element: <TechCompatibilityPage /> },
        { path: routeConfig.tech.warranties.replace(/^\/tech\//, ""), element: <TechWarrantiesPage /> }
      ]
    },
    {
      path: routeConfig.admin.root,
      element: <AdminLayout />,
      children: [
        { index: true, element: <Navigate to={routeConfig.admin.dashboard} replace /> },
        { path: routeConfig.admin.dashboard.replace(/^\/admin\//, ""), element: <AdminDashboardPage /> },
        { path: routeConfig.admin.system.replace(/^\/admin\//, ""), element: <AdminSystemPage /> },
        { path: routeConfig.admin.products.replace(/^\/admin\//, ""), element: <AdminProductsPage /> },
        { path: routeConfig.admin.attributes.replace(/^\/admin\//, ""), element: <AdminAttributesPage /> },
        { path: routeConfig.admin.skus.replace(/^\/admin\//, ""), element: <AdminSkusPage /> },
        { path: routeConfig.admin.compatibilityRules.replace(/^\/admin\//, ""), element: <AdminCompatibilityRulesPage /> },
        { path: routeConfig.admin.users.replace(/^\/admin\//, ""), element: <AdminUsersPage /> },
        { path: routeConfig.admin.paymentApproval.replace(/^\/admin\//, ""), element: <AdminPaymentApprovalPage /> }
      ]
    },
    { path: "*", element: <NotFoundPage /> }
  ];

  return useRoutes(routes);
}
