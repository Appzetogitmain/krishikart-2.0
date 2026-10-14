import express from "express";
import userRoute from "../../app/routes/user.js";
import deliveryRoutes from "../../app/routes/delivery.js";
import masteradminRoutes from "../../app/routes/masteradmin.js";
import vendorRoutes from "../../app/routes/vendor.js";
import franchiseRoutes from "../../app/routes/franchise.js";
import catalogRoutes from "../../app/routes/catalog.js";
import productRoutes from "../../app/routes/product.js";
import orderRoutes from "../../app/routes/order.js";
import paymentRoutes from "../../app/routes/payment.js";
import procurementRoutes from "../../app/routes/procurement.routes.js";
import geoRoute from "../../app/routes/geo.js";
import couponRoutes from "../../app/routes/coupon.js";
import reportRoutes from "../../app/routes/reports.js";
import auditLogRoutes from "../../app/routes/auditLogs.js";
import auditTrail from "../utils/auditTrail.js";

const setupRoutes = (app) => {
    const apiRouter = express.Router();

    // Records who changed what (staff and partners only); must run before the routes
    apiRouter.use(auditTrail);

    apiRouter.use("/masteradmin/audit-logs", auditLogRoutes);
    apiRouter.use("/user", userRoute);
    apiRouter.use("/delivery", deliveryRoutes);
    apiRouter.use("/masteradmin", masteradminRoutes);
    apiRouter.use("/vendor", vendorRoutes);
    apiRouter.use("/franchise", franchiseRoutes);
    apiRouter.use("/catalog", catalogRoutes);
    apiRouter.use("/products", productRoutes);
    apiRouter.use("/orders", orderRoutes);
    apiRouter.use("/payment", paymentRoutes);
    apiRouter.use("/procurement", procurementRoutes);
    apiRouter.use("/geo", geoRoute);
    apiRouter.use("/coupons", couponRoutes);
    apiRouter.use("/reports", reportRoutes);

    // Apply all routes under /api
    app.use("/api", apiRouter);
}
export default setupRoutes;
