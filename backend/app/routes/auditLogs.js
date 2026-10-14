import express from "express";
import { protectMasterAdmin, requirePermission } from "../middlewares/masteradmin.auth.js";
import { getAuditLogs, getAuditSummary, exportAuditLogs } from "../controllers/auditLog.controller.js";

const router = express.Router();

router.get("/", protectMasterAdmin, requirePermission("audit-logs"), getAuditLogs);
router.get("/summary", protectMasterAdmin, requirePermission("audit-logs"), getAuditSummary);
router.get("/export", protectMasterAdmin, requirePermission("audit-logs"), exportAuditLogs);

export default router;
