import React, { lazy } from "react";
import { Route, Navigate, Outlet } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import MasterAdminLayout from "../components/layout/MasterAdminLayout";
import {
  useMasterAdminAuth,
  MasterAdminAuthProvider,
} from "../contexts/MasterAdminAuthContext";
import { AdminProvider } from "../contexts/AdminContext";
import { CatalogProvider } from "../contexts/CatalogContext";

// Public Screens
import LoginScreen from "../pages/LoginScreen";
import ForgotPasswordScreen from "../pages/ForgotPasswordScreen";
import TermsScreen from "../pages/TermsScreen";

// Lazy loaded screens
const Dashboard = lazy(() => import("../pages/DashboardScreen"));
const TeamManagement = lazy(() => import("../pages/TeamManagementScreen"));
const Orders = lazy(() => import("../pages/OrdersScreen"));
const VendorAssignment = lazy(() => import("../pages/VendorAssignmentScreen"));
const FranchiseManagement = lazy(
  () => import("../pages/FranchiseManagementScreen"),
);
const VendorManagement = lazy(() => import("../pages/VendorManagementScreen"));
const DeliveryMonitoring = lazy(
  () => import("../pages/DeliveryMonitoringScreen"),
);
const TakeawayMonitoring = lazy(
  () => import("../pages/TakeawayMonitoringScreen"),
); // Not used in new routes, but keeping for now
const AdminSettings = lazy(() => import("../pages/SettingsScreen"));
const DeliveryConstraints = lazy(
  () => import("../pages/DeliveryConstraintsScreen"),
);
const VendorReports = lazy(() => import("../pages/VendorReportsScreen"));
const CreditManagement = lazy(() => import("../pages/CreditManagementScreen"));
const LedgerSystem = lazy(() => import("../pages/LedgerSystemScreen")); // Not used in new routes, but keeping for now
const CommissionControl = lazy(
  () => import("../pages/CommissionControlScreen"),
); // Not used in new routes, but keeping for now
const FranchiseStockMonitoring = lazy(
  () => import("../pages/FranchiseStockMonitoringScreen"),
);
const PurchaseManager = lazy(() => import("../pages/PurchaseManagerScreen")); // Not used in new routes, but keeping for now
const OnboardingApproval = lazy(
  () => import("../pages/OnboardingApprovalScreen"),
);
const CategoryApproval = lazy(
  () => import("../pages/CategoryApprovalScreen"),
);
const VendorTurnover = lazy(() => import("../pages/VendorTurnoverScreen"));
const AddProduct = lazy(() => import("../pages/AddProductScreen"));
const EditProduct = lazy(() => import("../pages/EditProductScreen"));
const ManageProducts = lazy(() => import("../pages/ManageProductScreen"));
const Recommendations = lazy(() => import("../pages/RecommendationScreen"));
const CategoryManagement = lazy(
  () => import("../pages/CategoryManagementScreen"),
);
const SubcategoryManagement = lazy(
  () => import("../pages/SubcategoryManagementScreen"),
);
const CouponManagement = lazy(() => import("../pages/CouponManagementScreen"));
const LoyaltyControl = lazy(() => import("../pages/LoyaltyControlScreen"));
const VendorQuotation = lazy(() => import("../pages/VendorQuotationScreen"));
const Returns = lazy(() => import("../pages/ReturnsScreen"));
const FranchisePayouts = lazy(() => import("../pages/FranchisePayoutsScreen"));
const CodRemittance = lazy(() => import("../pages/CodRemittanceScreen"));
const FAQManagement = lazy(() => import("../pages/FAQManagementScreen"));
const LegalPagesManagement = lazy(() => import("../pages/LegalPagesManagementScreen"));
const GlobalServiceMap = lazy(() => import("../pages/GlobalServiceMap"));
const CustomerManagement = lazy(() => import("../pages/CustomerManagementScreen"));
const RejectionsReport = lazy(() => import("../pages/RejectionReportsScreen"));
const GlobalReports = lazy(() => import("../pages/GlobalReportsScreen"));

const AdminRootRedirect = () => {
  const { isAuthenticated, loading } = useMasterAdminAuth();
  if (loading)
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  return isAuthenticated ? (
    <Navigate to="dashboard" replace />
  ) : (
    <Navigate to="login" replace />
  );
};

const ProtectedAdminRoute = ({ children }) => {
  const { isAuthenticated, loading } = useMasterAdminAuth();

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/masteradmin/login" replace />;
  }

  return children ? children : <Outlet />;
};

const AccessDenied = () => (
  <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
    <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mb-6 border border-red-100 shadow-sm">
      <ShieldCheck className="text-red-500 w-12 h-12" />
    </div>
    <h2 className="text-2xl font-black text-slate-900 mb-2">
      Access Restricted
    </h2>
    <p className="max-w-md text-slate-500 font-medium mb-8">
      Your identity has been verified, but your clearance level does not grant
      access to this terminal. Contact the system administrator to update your
      credentials.
    </p>
    <button
      onClick={() => (window.location.href = "/#/masteradmin/login")}
      className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-sm hover:bg-slate-800 transition-all active:scale-95">
      Return to Login
    </button>
  </div>
);

const PermissionRoute = ({ permissionKey }) => {
  const { hasPermission, loading, isAuthenticated } = useMasterAdminAuth();

  if (loading)
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );

  if (!isAuthenticated) {
    return <Navigate to="/masteradmin/login" replace />;
  }

  if (!hasPermission(permissionKey)) {
    return <AccessDenied />;
  }

  return <Outlet />;
};

const MasterAdminWrapper = () => (
  <MasterAdminAuthProvider>
    <AdminProvider>
      <CatalogProvider>
        <Outlet />
      </CatalogProvider>
    </AdminProvider>
  </MasterAdminAuthProvider>
);

export const masterAdminRoutes = (
  <Route path="/masteradmin" element={<MasterAdminWrapper />}>
    {/* Root Redirect to Dashboard or Login */}
    <Route index element={<AdminRootRedirect />} />

    {/* Public Routes - No Auth Required */}
    <Route path="login" element={<LoginScreen />} />
    <Route path="forgot-password" element={<ForgotPasswordScreen />} />
    <Route path="terms" element={<TermsScreen />} />

    {/* Protected System Environment */}
    <Route element={<ProtectedAdminRoute />}>
      <Route element={<MasterAdminLayout />}>
        {/* Default Landing inside the system */}
        <Route
          path="dashboard"
          element={<PermissionRoute permissionKey="dashboard" />}>
          <Route index element={<Dashboard />} />
        </Route>

        <Route
          path="team"
          element={<PermissionRoute permissionKey="superadmin" />}>
          <Route index element={<TeamManagement />} />
        </Route>

        {/* Operations & Logistics */}
        <Route
          path="orders"
          element={<PermissionRoute permissionKey="orders" />}>
          <Route index element={<Orders />} />
        </Route>
        <Route
          path="assignment"
          element={<PermissionRoute permissionKey="assignment" />}>
          <Route index element={<VendorAssignment />} />
        </Route>
        <Route
          path="delivery"
          element={<PermissionRoute permissionKey="delivery" />}>
          <Route index element={<DeliveryMonitoring />} />
        </Route>
        <Route
          path="returns"
          element={<PermissionRoute permissionKey="returns" />}>
          <Route index element={<Returns />} />
        </Route>
        <Route path="kiosk" element={<PermissionRoute permissionKey="kiosk" />}>
          <Route index element={<TakeawayMonitoring />} />
        </Route>

        {/* Economic Matrix */}
        <Route
          path="credit"
          element={<PermissionRoute permissionKey="credit" />}>
          <Route index element={<CreditManagement />} />
        </Route>
        <Route
          path="customers"
          element={<PermissionRoute permissionKey="credit" />}>
          <Route index element={<CustomerManagement />} />
        </Route>
        <Route
          path="ledger"
          element={<PermissionRoute permissionKey="ledger" />}>
          <Route index element={<LedgerSystem />} />
        </Route>
        <Route
          path="commission"
          element={<PermissionRoute permissionKey="commission" />}>
          <Route index element={<CommissionControl />} />
        </Route>
        <Route
          path="franchise-payouts"
          element={<PermissionRoute permissionKey="franchise-payouts" />}>
          <Route index element={<FranchisePayouts />} />
        </Route>
        <Route
          path="cod-remittance"
          element={<PermissionRoute permissionKey="cod-remittance" />}>
          <Route index element={<CodRemittance />} />
        </Route>
        <Route
          path="loyalty"
          element={<PermissionRoute permissionKey="loyalty" />}>
          <Route index element={<LoyaltyControl />} />
        </Route>
        <Route
          path="coupons"
          element={<PermissionRoute permissionKey="coupons" />}>
          <Route index element={<CouponManagement />} />
        </Route>
        <Route
          path="delivery-constraints"
          element={<PermissionRoute permissionKey="delivery-constraints" />}>
          <Route index element={<DeliveryConstraints />} />
        </Route>

        {/* Inventory Spectrum */}
        <Route
          path="stock-monitoring"
          element={<PermissionRoute permissionKey="stock-monitoring" />}>
          <Route index element={<FranchiseStockMonitoring />} />
        </Route>
        <Route
          path="purchase"
          element={<PermissionRoute permissionKey="purchase" />}>
          <Route index element={<PurchaseManager />} />
        </Route>

        {/* Clearance & Lifecycle */}
        <Route
          path="approvals"
          element={<PermissionRoute permissionKey="approvals" />}>
          <Route index element={<OnboardingApproval />} />
        </Route>
        <Route
          path="category-approvals"
          element={<PermissionRoute permissionKey="approvals" />}>
          <Route index element={<CategoryApproval />} />
        </Route>
        <Route
          path="quotations"
          element={<PermissionRoute permissionKey="quotations" />}>
          <Route index element={<VendorQuotation />} />
        </Route>
        <Route
          path="vendor-reports"
          element={<PermissionRoute permissionKey="vendor-reports" />}>
          <Route index element={<VendorReports />} />
        </Route>
        <Route
          path="rejections"
          element={<PermissionRoute permissionKey="vendor-reports" />}>
          <Route index element={<RejectionsReport />} />
        </Route>
        <Route
          path="global-reports"
          element={<PermissionRoute permissionKey="dashboard" />}>
          <Route index element={<GlobalReports />} />
        </Route>
        <Route
          path="vendor-economics"
          element={<PermissionRoute permissionKey="vendor-economics" />}>
          <Route index element={<VendorTurnover />} />
        </Route>

        {/* Node Management */}
        <Route
          path="franchises"
          element={<PermissionRoute permissionKey="franchises" />}>
          <Route index element={<FranchiseManagement />} />
        </Route>
        <Route
          path="service-map"
          element={<PermissionRoute permissionKey="franchises" />}>
          <Route index element={<GlobalServiceMap />} />
        </Route>
        <Route
          path="vendors"
          element={<PermissionRoute permissionKey="vendors" />}>
          <Route index element={<VendorManagement />} />
        </Route>

        {/* Product Catalog Ledger */}
        <Route
          path="products"
          element={<PermissionRoute permissionKey="products" />}>
          <Route index element={<Navigate to="manage" replace />} />
          <Route path="add" element={<AddProduct />} />
          <Route path="edit/:id" element={<EditProduct />} />
          <Route path="manage" element={<ManageProducts />} />
          <Route path="recommendations" element={<Recommendations />} />
        </Route>

        <Route
          path="categories"
          element={<PermissionRoute permissionKey="categories" />}>
          <Route index element={<Navigate to="manage" replace />} />
          <Route path="manage" element={<CategoryManagement />} />
        </Route>

        <Route
          path="subcategories/manage"
          element={<PermissionRoute permissionKey="categories" />}>
          <Route index element={<SubcategoryManagement />} />
        </Route>

        {/* Configuration */}
        <Route
          path="settings"
          element={<PermissionRoute permissionKey="settings" />}>
          <Route index element={<AdminSettings />} />
          <Route path="faqs" element={<FAQManagement />} />
          <Route path="legal-pages" element={<LegalPagesManagement />} />
        </Route>
      </Route>
    </Route>
  </Route>
);
