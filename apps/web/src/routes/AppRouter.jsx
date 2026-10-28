import { Navigate, useRoutes } from "react-router-dom";

import { AdminLayout } from "../layouts/AdminLayout";
import { PublicLayout } from "../layouts/PublicLayout";
import { StaffLayout } from "../layouts/StaffLayout";
import { TechLayout } from "../layouts/TechLayout";
import { AdminAttributesPage } from "../pages/admin/AdminAttributesPage";
import { AdminCompatibilityRulesPage } from "../pages/admin/AdminCompatibilityRulesPage";
import { AdminDashboardPage } from "../pages/admin/AdminDashboardPage";
import { AdminProductsPage } from "../pages/admin/AdminProductsPage";
import { AdminSkusPage } from "../pages/admin/AdminSkusPage";
import { AdminSystemPage } from "../pages/admin/AdminSystemPage";
import { AdminUsersPage } from "../pages/admin/AdminUsersPage";
import { AdminPaymentApprovalPage } from "../pages/admin/AdminPaymentApprovalPage";
import { AiChatPage } from "../pages/public/AiChatPage";
import { CartPage } from "../pages/public/CartPage";
import { CheckoutPage } from "../pages/public/CheckoutPage";
import { CompareProductsPage } from "../pages/public/CompareProductsPage";
import { HomePage } from "../pages/public/HomePage";
import { LoginPage } from "../pages/public/LoginPage";
import { NotFoundPage } from "../pages/public/NotFoundPage";
import { OrderDetailPage } from "../pages/public/OrderDetailPage";
import { OrdersPage } from "../pages/public/OrdersPage";
import { PaymentResultPage } from "../pages/public/PaymentResultPage";
import { MockPaymentPage } from "../pages/public/MockPaymentPage";
import { PcBuilderPage } from "../pages/public/PcBuilderPage";
import { SharedBuildPage } from "../pages/public/SharedBuildPage";
import { ProductDetailPage } from "../pages/public/ProductDetailPage";
import { ProductListPage } from "../pages/public/ProductListPage";
import { ProfilePage } from "../pages/public/ProfilePage";
import { RegisterPage } from "../pages/public/RegisterPage";
import { TicketCreatePage } from "../pages/public/TicketCreatePage";
import { TicketDetailPage } from "../pages/public/TicketDetailPage";
import { TicketListPage } from "../pages/public/TicketListPage";
import { WarrantiesPage } from "../pages/public/WarrantiesPage";
import { InformationPage } from "../pages/public/InformationPage";
import { StaffOrdersPage } from "../pages/staff/StaffOrdersPage";
import StaffChatPage from "../pages/staff/StaffChatPage";
import { TechTicketsPage } from "../pages/tech/TechTicketsPage";
import { TechCompatibilityPage } from "../pages/tech/TechCompatibilityPage";
import { TechWarrantiesPage } from "../pages/tech/TechWarrantiesPage";
import { routeConfig } from "./routeConfig";

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
        { path: "gio-hang", element: <CartPage /> },
        { path: "giohang", element: <Navigate to="/cart" replace /> },
        { path: routeConfig.public.checkout.replace(/^\//, ""), element: <CheckoutPage /> },
        { path: "thanh-toan", element: <CheckoutPage /> },
        { path: "thanhtoan", element: <Navigate to="/checkout" replace /> },
        { path: routeConfig.public.paymentResult.replace(/^\//, ""), element: <PaymentResultPage /> },
        { path: "payment/mock", element: <MockPaymentPage /> },
        { path: routeConfig.public.orders.replace(/^\//, ""), element: <OrdersPage /> },
        { path: routeConfig.public.orderDetail.replace(/^\//, ""), element: <OrderDetailPage /> },
        { path: routeConfig.public.tickets.replace(/^\//, ""), element: <TicketListPage /> },
        { path: routeConfig.public.ticketCreate.replace(/^\//, ""), element: <TicketCreatePage /> },
        { path: routeConfig.public.ticketDetail.replace(/^\//, ""), element: <TicketDetailPage /> },
        { path: routeConfig.public.aiChat.replace(/^\//, ""), element: <AiChatPage /> },
        { path: routeConfig.public.aiAdvisor.replace(/^\//, ""), element: <Navigate to={routeConfig.public.aiChat} replace /> },
        { path: routeConfig.public.pcBuilder.replace(/^\//, ""), element: <PcBuilderPage /> },
        { path: "pc builder", element: <Navigate to="/pc-builder" replace /> },
        { path: "pc%20builder", element: <Navigate to="/pc-builder" replace /> },
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
