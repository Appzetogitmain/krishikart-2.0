import express from "express";
import { protectMasterAdmin, requireAnyPermission, requireSuperAdmin } from "../middlewares/masteradmin.auth.js";
import {
    listZones,
    createZone,
    updateZone,
    deleteZone,
    getZoneRates,
    saveZoneRates,
} from "../controllers/cityRates.controller.js";

const router = express.Router();

// City codes: everyone with "City Rates" access sees their own codes; only the main admin manages them
router.get("/zones", protectMasterAdmin, requireAnyPermission("city-rates"), listZones);
router.post("/zones", protectMasterAdmin, requireSuperAdmin, createZone);
router.put("/zones/:code", protectMasterAdmin, requireSuperAdmin, updateZone);
router.delete("/zones/:code", protectMasterAdmin, requireSuperAdmin, deleteZone);

// A code's rate sheet (access to the specific code is checked in the controller)
router.get("/zones/:code/rates", protectMasterAdmin, requireAnyPermission("city-rates"), getZoneRates);
router.put("/zones/:code/rates", protectMasterAdmin, requireAnyPermission("city-rates"), saveZoneRates);

export default router;
