import { Route, Outlet, Navigate } from 'react-router-dom';
import VendorLayout from '../components/layout/VendorLayout';
import { OrderProvider } from '../../user/contexts/OrderContext';
import DashboardScreen from '../pages/DashboardScreen';
import LoginScreen from '../pages/LoginScreen';
import ForgotPasswordScreen from '../pages/ForgotPasswordScreen';
import InventoryScreen from '../pages/InventoryScreen';
import MarketplacePreviewScreen from '../pages/MarketplacePreviewScreen';
import OrdersScreen from '../pages/OrdersScreen';
import OrderDetailScreen from '../pages/OrderDetailScreen';
import PackingScreen from '../pages/PackingScreen';
import StockAlertsScreen from '../pages/StockAlertsScreen';
import HistoryScreen from '../pages/HistoryScreen';
import DispatchHistoryScreen from '../pages/DispatchHistoryScreen';
import ProfileScreen from '../pages/ProfileScreen';
import ReceivablesReportScreen from '../pages/ReceivablesReportScreen';
import RejectionReportsScreen from '../pages/RejectionReportsScreen';
import QuotationHistoryScreen from '../pages/QuotationHistoryScreen';
import SignupScreen from '../pages/SignupScreen';
import TermsScreen from '../pages/TermsScreen'
import HelpSupportScreen from '../pages/HelpSupportScreen'
import PrivacyPolicyScreen from '../pages/PrivacyPolicyScreen';
import { VendorInventoryProvider } from '../contexts/VendorInventoryContext';
import { VendorAuthProvider } from '../contexts/VendorAuthContext';
import VendorAuthGuard from '../components/auth/VendorAuthGuard';

// For now using placeholders, will replace with real components as built
export const vendorRoutes = (
    <Route path="/vendor" element={
        <VendorAuthProvider>
            <VendorInventoryProvider>
                <OrderProvider>
                    <VendorLayout />
                </OrderProvider>
            </VendorInventoryProvider>
        </VendorAuthProvider>
    }>
        <Route path="login" element={<LoginScreen />} />
        <Route path="forgot-password" element={<ForgotPasswordScreen />} />
        <Route path="signup" element={<SignupScreen />} />
        <Route path="terms" element={<TermsScreen />} />
        <Route path="terms-support" element={<TermsScreen />} />
        <Route path="terms/support" element={<TermsScreen />} />
        <Route path="privacy" element={<PrivacyPolicyScreen />} />

        <Route path="help-support" element={<HelpSupportScreen />} />
        {/* Protected Routes */}
        <Route element={<VendorAuthGuard />}>
            <Route index element={<DashboardScreen />} />
            <Route path="dashboard" element={<DashboardScreen />} />
            <Route path="inventory" element={<InventoryScreen />} />
            <Route path="preview" element={<MarketplacePreviewScreen />} />
            <Route path="orders" element={<OrdersScreen />} />
            <Route path="orders/:id" element={<OrderDetailScreen />} />
            <Route path="quotations" element={<QuotationHistoryScreen />} />
            <Route path="dispatch" element={<PackingScreen />} />
            <Route path="dispatch-history" element={<DispatchHistoryScreen />} />
            <Route path="alerts" element={<StockAlertsScreen />} />
            <Route path="history" element={<HistoryScreen />} />
            <Route path="reports" element={<ReceivablesReportScreen />} />
            <Route path="rejected-stock" element={<RejectionReportsScreen />} />
            <Route path="payments" element={<Navigate to="/vendor/reports" replace />} />
            <Route path="profile" element={<ProfileScreen />} />
        </Route>
    </Route>
);
