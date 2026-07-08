import { Suspense, lazy } from 'react'
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { motion } from 'framer-motion'
import AppLayout from './modules/user/layouts/AppLayout'
import LandingPage from './modules/landing/LandingPage'
import SplashScreen from './modules/user/pages/SplashScreen'
import LoginScreen from './modules/user/pages/LoginScreen'
import HomeScreen from './modules/user/pages/HomeScreen'
import CategoriesScreen from './modules/user/pages/CategoriesScreen'
import ProductListScreen from './modules/user/pages/ProductListScreen'
import ProductDetailScreen from './modules/user/pages/ProductDetailScreen'
import CartScreen from './modules/user/pages/CartScreen'
import ProfileScreen from './modules/user/pages/ProfileScreen'
import OrdersScreen from './modules/user/pages/OrdersScreen'
import CheckoutScreen from './modules/user/pages/CheckoutScreen'
import EditProfileScreen from './modules/user/pages/EditProfileScreen'
import AddressBookScreen from './modules/user/pages/AddressBookScreen'
import OrderTrackingScreen from './modules/user/pages/OrderTrackingScreen'
import OrderSummaryScreen from './modules/user/pages/OrderSummaryScreen'
import OrderDetailScreen from './modules/user/pages/OrderDetailScreen'
import SplitOrderTrackingScreen from './modules/user/pages/SplitOrderTrackingScreen'
import WalletScreen from './modules/user/pages/WalletScreen'
import NotificationsScreen from './modules/user/pages/NotificationsScreen'
import FavoritesScreen from './modules/user/pages/FavoritesScreen'
import VerificationScreen from './modules/user/pages/VerificationScreen'
import HelpSupportScreen from './modules/user/pages/HelpSupportScreen'
import AboutScreen from './modules/user/pages/AboutScreen'
import WishlistScreen from './modules/user/pages/WishlistScreen'
import CreditInfoScreen from './modules/user/pages/CreditInfoScreen'
import LocationMapPicker from './modules/user/pages/LocationMapPicker'
import TermsScreen from './modules/user/pages/TermsScreen'
import PrivacyPolicyScreen from './modules/user/pages/PrivacyPolicyScreen'
import { WishlistProvider } from './modules/user/contexts/WishlistContext'
import { FilterProvider } from './modules/user/contexts/FilterContext'
import { LocationProvider } from './modules/user/contexts/LocationContext'
import { UserAuthProvider } from './modules/user/contexts/UserAuthContext'
import { UserNotificationsProvider } from './modules/user/contexts/UserNotificationsContext'
import UserAuthGuard from './modules/user/components/auth/UserAuthGuard'
import FranchiseAuthGuard from './modules/franchise/components/auth/FranchiseAuthGuard'
import FranchiseVerificationGuard from './modules/franchise/components/auth/FranchiseVerificationGuard'

import { FranchiseAuthProvider } from './modules/franchise/contexts/FranchiseAuthContext'
import { FranchiseOrdersProvider } from './modules/franchise/contexts/FranchiseOrdersContext'
import { InventoryProvider } from './modules/franchise/contexts/InventoryContext'
import { GRNProvider } from './modules/franchise/contexts/GRNContext'
import { CODProvider } from './modules/franchise/contexts/CODContext'
import { ProcurementProvider } from './modules/franchise/contexts/ProcurementContext'

// Franchise Module Lazy Imports
const FranchiseLayout = lazy(() => import('./modules/franchise/components/layout/FranchiseLayout'));
const FranchiseDashboard = lazy(() => import('./modules/franchise/pages/DashboardScreen'));
const FranchiseOrders = lazy(() => import('./modules/franchise/pages/OrdersScreen'));
const OrderDetail = lazy(() => import('./modules/franchise/pages/OrderDetailScreen'));
const FranchiseInventory = lazy(() => import('./modules/franchise/pages/InventoryScreen'));
const ReceivingScreen = lazy(() => import('./modules/franchise/pages/ReceivingScreen'));
const FranchiseDelivery = lazy(() => import('./modules/franchise/pages/DeliveryScreen'));
const CODCashScreen = lazy(() => import('./modules/franchise/pages/CashManagementScreen'));
const POSWeighingScreen = lazy(() => import('./modules/franchise/pages/POSScreen'));
const ProcurementScreen = lazy(() => import('./modules/franchise/pages/ProcurementScreen'));
const FranchiseReturns = lazy(() => import('./modules/franchise/pages/ReturnsScreen'));
const FranchiseProfile = lazy(() => import('./modules/franchise/pages/ProfileScreen'));
const DocumentationScreen = lazy(() => import('./modules/franchise/pages/DocumentationScreen'));
const FranchiseLogin = lazy(() => import('./modules/franchise/pages/LoginScreen'));
const FranchiseSignup = lazy(() => import('./modules/franchise/pages/SignupScreen'));
const FranchisePaymentSettings = lazy(() => import('./modules/franchise/pages/PaymentSettingsScreen'));
const FranchiseReports = lazy(() => import('./modules/franchise/pages/ReportsScreen'));
const FranchiseTerms = lazy(() => import('./modules/franchise/pages/TermsScreen'));
const FranchiseHelpSupport = lazy(() => import('./modules/franchise/pages/HelpSupportScreen'));
const FranchisePrivacyPolicy = lazy(() => import('./modules/franchise/pages/PrivacyPolicyScreen'));
const FranchiseForgotPassword = lazy(() => import('./modules/franchise/pages/ForgotPasswordScreen'));

// Master Admin Module Imports
import { MasterAdminAuthProvider } from './modules/masteradmin/contexts/MasterAdminAuthContext';
import { masterAdminRoutes } from './modules/masteradmin/routes/masterAdminRoutes';
import { vendorRoutes } from './modules/vendor/routes/vendorRoutes';
import { deliveryRoutes } from './modules/delivery/routes/deliveryRoutes';

import { CartProvider } from './modules/user/contexts/CartContext'
import { OrderProvider } from '@/modules/user/contexts/OrderContext'
import { WalletProvider } from './modules/user/contexts/WalletContext'
import { DeliveryAuthProvider } from './modules/delivery/contexts/DeliveryAuthContext'
import { DeliveryOrderProvider } from './modules/delivery/contexts/DeliveryOrderContext'
import { Toaster } from 'sonner'

const UserProviders = ({ children }) => (
  <UserAuthProvider>
    <UserNotificationsProvider>
      <LocationProvider>
        <OrderProvider>
          <CartProvider>
            <WishlistProvider>
              <WalletProvider>
                <FilterProvider>
                  {children}
                </FilterProvider>
              </WalletProvider>
            </WishlistProvider>
          </CartProvider>
        </OrderProvider>
      </LocationProvider>
    </UserNotificationsProvider>
  </UserAuthProvider>
);

const FranchiseProviders = ({ children }) => (
  <FranchiseAuthProvider>
    <InventoryProvider>
      <GRNProvider>
        <CODProvider>
          <ProcurementProvider>
            <FranchiseOrdersProvider>
              {children}
            </FranchiseOrdersProvider>
          </ProcurementProvider>
        </CODProvider>
      </GRNProvider>
    </InventoryProvider>
  </FranchiseAuthProvider>
);

const DeliveryProviders = () => (
  <DeliveryAuthProvider>
    <DeliveryOrderProvider>
      <Outlet />
    </DeliveryOrderProvider>
  </DeliveryAuthProvider>
);


function App() {
  const isIOS = typeof window !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
  return (
    <motion.div
      initial={isIOS ? { opacity: 1 } : { opacity: 0 }} // iOS par direct dikhao
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <HashRouter>
        <Toaster position="top-center" richColors />
        <Suspense fallback={
          <div className="user-app-theme h-screen w-full flex items-center justify-center bg-slate-50">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        }>
          <Routes>
            <Route path="/" element={<LandingPage />} />
              <Route path="/splash" element={<SplashScreen />} />
              <Route path="/terms" element={<TermsScreen />} />
              <Route path="/privacy" element={<PrivacyPolicyScreen />} />
            <Route path="/login" element={<UserProviders><LoginScreen /></UserProviders>} />

            {/* User Module */}
            <Route element={<UserProviders><Outlet /></UserProviders>}>
              <Route element={<AppLayout />}>
                <Route path="/home" element={<HomeScreen />} />
                <Route path="/offers" element={<HomeScreen />} />
                <Route path="/categories" element={<CategoriesScreen />} />
                <Route path="/products/:category" element={<ProductListScreen />} />
                <Route path="/search" element={<ProductListScreen />} />
                <Route path="/product/:id" element={<ProductDetailScreen />} />
                <Route path="/help-support" element={<HelpSupportScreen />} />
                <Route path="/about" element={<AboutScreen />} />
                
                {/* Protected User Routes */}
                <Route element={<UserAuthGuard />}>
                  <Route path="/cart" element={<CartScreen />} />
                  <Route path="/checkout" element={<CheckoutScreen />} />
                  <Route path="/profile" element={<ProfileScreen />} />
                  <Route path="/orders" element={<OrdersScreen />} />
                  <Route path="/edit-profile" element={<EditProfileScreen />} />
                  <Route path="/address-book" element={<AddressBookScreen />} />
                  <Route path="/track-order/:id" element={<OrderTrackingScreen />} />
                  <Route path="/order-summary/:id" element={<OrderSummaryScreen />} />
                  <Route path="/order-detail/:id" element={<OrderDetailScreen />} />
                  <Route path="/split-order/:orderGroupId" element={<SplitOrderTrackingScreen />} />
                  <Route path="/wallet" element={<WalletScreen />} />
                  <Route path="/credit-info" element={<CreditInfoScreen />} />
                  <Route path="/notifications" element={<NotificationsScreen />} />
                  <Route path="/favorites" element={<FavoritesScreen />} />
                  <Route path="/wishlist" element={<WishlistScreen />} />
                  <Route path="/location-picker" element={<LocationMapPicker />} />
                  <Route path="/verification" element={<VerificationScreen />} />
                </Route>
              </Route>
            </Route>

            {/* Franchise Module */}
            <Route path="/franchise" element={<FranchiseProviders><Outlet /></FranchiseProviders>}>
              <Route index element={<Navigate to="login" replace />} />
              <Route path="login" element={<FranchiseLogin />} />
              <Route path="signup" element={<FranchiseSignup />} />
              <Route path="forgot-password" element={<FranchiseForgotPassword />} />
              <Route path="terms" element={<FranchiseTerms />} />
              <Route path="privacy" element={<FranchisePrivacyPolicy />} />
              <Route path="help-support" element={<FranchiseHelpSupport />} />
              <Route element={<FranchiseAuthGuard />}>
                <Route element={<FranchiseVerificationGuard />}>
                <Route element={<FranchiseLayout />}>
                  <Route path="dashboard" element={<FranchiseDashboard />} />
                  <Route path="orders" element={<FranchiseOrders />} />
                  <Route path="orders/:id" element={<OrderDetail />} />
                  <Route path="reports" element={<FranchiseReports />} />
                  <Route path="inventory" element={<FranchiseInventory />} />
                  <Route path="receiving" element={<ReceivingScreen />} />
                  <Route path="dispatch" element={<FranchiseDelivery />} />
                  <Route path="cash" element={<CODCashScreen />} />
                  <Route path="pos" element={<POSWeighingScreen />} />
                  <Route path="procurement" element={<ProcurementScreen />} />
                  <Route path="returns" element={<FranchiseReturns />} />
                  <Route path="profile" element={<FranchiseProfile />} />
                  <Route path="payment-settings" element={<FranchisePaymentSettings />} />
                  <Route path="documentation" element={<DocumentationScreen />} />
                </Route>
                </Route>
              </Route>
            </Route>

            {masterAdminRoutes}
            {vendorRoutes}
            <Route element={<DeliveryProviders />}>
              {deliveryRoutes}
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </HashRouter>
    </motion.div>
  )
}

export default App
