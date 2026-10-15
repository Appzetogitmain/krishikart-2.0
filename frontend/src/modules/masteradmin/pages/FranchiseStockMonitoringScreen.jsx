import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Download,
  Filter,
  Store,
  AlertTriangle,
  Package,
  ArrowRight,
  ShoppingCart,
  ChevronDown,
  Activity,
  RefreshCw,
  ChevronLeft,
  Users,
  MapPin,
  ArrowUpRight,
  Home,
  ChevronRight,
  Target,
  Settings,
  FileSpreadsheet,
  UploadCloud,
  Edit3,
  ExternalLink,
  X,
} from "lucide-react";
import api from "@/lib/axios";
import StockAlertBadge from "../components/badges/StockAlertBadge";
import MetricRow from "../components/cards/MetricRow";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function FranchiseStockMonitoringScreen() {
  const [viewMode, setViewMode] = useState("network"); // 'network', 'categories', or 'detail'
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFranchiseId, setSelectedFranchiseId] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [selectedCategoryName, setSelectedCategoryName] = useState("");
  const [networkData, setNetworkData] = useState([]);
  const [franchiseDetail, setFranchiseDetail] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [commissionModal, setCommissionModal] = useState({
    isOpen: false,
    category: null,
    value: "",
  });
  const [priceModal, setPriceModal] = useState({
    isOpen: false,
    item: null,
    value: "",
  });
  const [stockModal, setStockModal] = useState({
    isOpen: false,
    item: null,
    value: "",
  });
  const [bulkModal, setBulkModal] = useState({
    isOpen: false,
    file: null,
    isUploading: false,
  });
  const [editModal, setEditModal] = useState({
    isOpen: false,
    item: null,
    currentStock: "",
    mbq: "",
    franchisePrice: "",
  });

  const fetchNetworkOverview = async () => {
    setIsLoading(true);
    try {
      const response = await api.get("/masteradmin/inventory/monitoring");
      if (response.data.success) {
        setNetworkData(response.data.results || []);
      }
    } catch (error) {
      console.error("Fetch network overview error:", error);
      toast.error("Failed to fetch network stock levels");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFranchiseDetails = async (id) => {
    setIsLoading(true);
    try {
      const response = await api.get(`/masteradmin/inventory/franchise/${id}`);
      if (response.data.success) {
        setFranchiseDetail(response.data.result);
      }
    } catch (error) {
      console.error("Fetch franchise details error:", error);
      toast.error("Failed to fetch franchise stock details");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (viewMode === "network") {
      fetchNetworkOverview();
    }
  }, [viewMode]);

  const handleRefresh = () => {
    if (isLoading) return;

    if (viewMode === "network") {
      fetchNetworkOverview();
      return;
    }

    if (selectedFranchiseId) {
      fetchFranchiseDetails(selectedFranchiseId);
    }
  };

  const handleFranchiseClick = (id) => {
    setSelectedFranchiseId(id);
    setViewMode("categories");
    fetchFranchiseDetails(id);
  };

  const handleCategoryClick = (category) => {
    setSelectedCategoryId(category.id);
    setSelectedCategoryName(category.name);
    setViewMode("detail");
  };

  const handleBack = () => {
    if (viewMode === "detail") {
      setViewMode("categories");
      setSelectedCategoryId(null);
      setSelectedCategoryName("");
    } else if (viewMode === "categories") {
      setViewMode("network");
      setSelectedFranchiseId(null);
    }
  };

  const handleOpenCommissionModal = (e, cat) => {
    e.stopPropagation();
    setCommissionModal({
      isOpen: true,
      category: cat,
      value: cat.commissionPercentage || "0",
    });
  };

  const handleSaveCommission = async () => {
    if (!selectedFranchiseId || !commissionModal.category?.id) return;

    try {
      const response = await api.post("/masteradmin/commissions/update", {
        franchiseId: selectedFranchiseId,
        categoryId: commissionModal.category.id,
        commissionPercentage: parseFloat(commissionModal.value),
      });

      if (response.data.success) {
        toast.success(
          `Commission for ${commissionModal.category.name} updated successfully`,
        );
        setCommissionModal({ isOpen: false, category: null, value: "" });
        // Refresh data
        fetchFranchiseDetails(selectedFranchiseId);
      }
    } catch (error) {
      console.error("Update commission error:", error);
      toast.error("Failed to update commission");
    }
  };

  const handleOpenPriceModal = (e, item) => {
    e.stopPropagation();
    setPriceModal({
      isOpen: true,
      item: item,
      value: item.franchisePrice || "",
    });
  };

  const handleSavePrice = async () => {
    if (!selectedFranchiseId || !priceModal.item?.productId) return;

    try {
      const response = await api.put(
        `/masteradmin/inventory/franchise/${selectedFranchiseId}/item`,
        {
          productId: priceModal.item.productId,
          franchisePrice:
            priceModal.value === "" ? null : parseFloat(priceModal.value),
        },
      );

      if (response.data.success) {
        toast.success(
          `Price for ${priceModal.item.productName} updated successfully`,
        );
        setPriceModal({ isOpen: false, item: null, value: "" });
        // Refresh data
        fetchFranchiseDetails(selectedFranchiseId);
      }
    } catch (error) {
      console.error("Update price error:", error);
      toast.error("Failed to update product price");
    }
  };

  const handleOpenStockModal = (e, item) => {
    e.stopPropagation();
    setStockModal({
      isOpen: true,
      item,
      value: String(item.currentStock ?? 0),
    });
  };

  const handleSaveStock = async () => {
    if (!selectedFranchiseId || !stockModal.item?.productId) return;

    try {
      const response = await api.put(
        `/masteradmin/inventory/franchise/${selectedFranchiseId}/item`,
        {
          productId: stockModal.item.productId,
          currentStock: Math.max(0, Number(stockModal.value) || 0),
        },
      );

      if (response.data.success) {
        toast.success(
          `Stock for ${stockModal.item.productName} updated successfully`,
        );
        setStockModal({ isOpen: false, item: null, value: "" });
        fetchFranchiseDetails(selectedFranchiseId);
      }
    } catch (error) {
      console.error("Update stock error:", error);
      toast.error("Failed to update stock quantity");
    }
  };

  const handleOpenEditModal = (e, item) => {
    e.stopPropagation();
    setEditModal({
      isOpen: true,
      item,
      currentStock: String(item.currentStock ?? 0),
      mbq: String(item.mbq ?? 0),
      franchisePrice: String(item.franchisePrice || ""),
    });
  };

  const handleSaveEditModal = async () => {
    if (!selectedFranchiseId || !editModal.item?.productId) return;

    try {
      const response = await api.put(
        `/masteradmin/inventory/franchise/${selectedFranchiseId}/item`,
        {
          productId: editModal.item.productId,
          currentStock: Number(editModal.currentStock) || 0,
          mbq: Number(editModal.mbq) || 0,
          franchisePrice:
            editModal.franchisePrice === ""
              ? null
              : Number(editModal.franchisePrice),
        },
      );

      if (response.data.success) {
        toast.success(`Updated ${editModal.item.productName} successfully`);
        setEditModal({ ...editModal, isOpen: false });
        fetchFranchiseDetails(selectedFranchiseId);
      }
    } catch (error) {
      console.error("Update item error:", error);
      toast.error("Failed to update the product");
    }
  };

  const handleDownloadTemplate = () => {
    const headers = [
      "SKU",
      "ProductID",
      "ProductName",
      "CurrentStock",
      "Threshold_MBQ",
      "FranchisePrice",
    ];
    const rows = franchiseDetail.items.map((item) => [
      item.skuCode || "",
      item.productId,
      item.productName,
      item.currentStock,
      item.mbq,
      item.franchisePrice ?? "",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      headers.join(",") +
      "\n" +
      rows.map((e) => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `stock_template_${franchiseDetail?.franchise?.franchiseName}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBulkUpdate = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setBulkModal((prev) => ({ ...prev, isUploading: true }));

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const lines = text.split("\n");
        const data = lines
          .slice(1)
          .filter((line) => line.trim())
          .map((line) => {
            const values = line.split(",").map((v) => v.trim());
            return {
              sku: values[0],
              productId: values[1],
              currentStock: Number(values[3]) || 0,
              mbq: Number(values[4]) || 0,
              franchisePrice:
                values[5] === "" || values[5] === undefined
                  ? null
                  : Number(values[5]),
            };
          });

        const response = await api.post(
          `/masteradmin/inventory/franchise/${selectedFranchiseId}/bulk-update`,
          {
            items: data,
          },
        );

        if (response.data.success) {
          toast.success("Bulk update completed successfully");
          setBulkModal({ isOpen: false, file: null, isUploading: false });
          fetchFranchiseDetails(selectedFranchiseId);
        }
      } catch (error) {
        console.error("Bulk update error:", error);
        toast.error("Failed to process bulk update file");
      } finally {
        setBulkModal((prev) => ({ ...prev, isUploading: false }));
      }
    };
    reader.readAsText(file);
  };

  const franchises = useMemo(
    () =>
      networkData.map((f) => ({
        ...f,
        id: f.franchiseId, // Backend returns franchiseId
        name: f.franchiseName,
        location: f.location,
        stock: f.stock || [],
      })),
    [networkData],
  );

  const categoryStats = useMemo(() => {
    if (!franchiseDetail) return [];
    const cats = {};

    (franchiseDetail?.franchise?.servedCategories || []).forEach((category) => {
      const categoryId = category?._id || category?.id;
      const categoryName = category?.name || "Uncategorized";
      if (!cats[categoryName]) {
        cats[categoryName] = {
          id: categoryId,
          name: categoryName,
          totalItems: 0,
          lowStockItems: 0,
          criticalItems: 0,
          commissionPercentage:
            (categoryId &&
              franchiseDetail?.commissions?.[categoryId?.toString?.()]) ||
            0,
        };
      }
    });

    franchiseDetail.items.forEach((item) => {
      const catName = item.categoryName || "Uncategorized";
      if (!cats[catName]) {
        cats[catName] = {
          id: item.categoryId,
          name: catName,
          totalItems: 0,
          lowStockItems: 0,
          criticalItems: 0,
          commissionPercentage: item.commissionPercentage || 0,
        };
      }
      cats[catName].totalItems++;
      if (item.alertStatus !== "ok") cats[catName].lowStockItems++;
      if (item.alertStatus === "critical") cats[catName].criticalItems++;
    });
    return Object.values(cats);
  }, [franchiseDetail]);

  const groupedStock = useMemo(() => {
    if (!franchiseDetail || !selectedCategoryId) return {};
    const filtered = franchiseDetail.items.filter(
      (item) =>
        item.categoryId === selectedCategoryId &&
        item.productName.toLowerCase().includes(searchTerm.toLowerCase()),
    );

    const groups = {};
    filtered.forEach((item) => {
      const sub = item.subcategoryName || "General";
      if (!groups[sub]) groups[sub] = [];
      groups[sub].push(item);
    });
    return groups;
  }, [franchiseDetail, selectedCategoryId, searchTerm]);

  const globalStats = useMemo(
    () => ({
      totalFranchises: franchises.length,
      criticalAlerts: franchises.reduce(
        (acc, f) =>
          acc + f.stock.filter((s) => s.alertStatus === "critical").length,
        0,
      ),
      lowStockAlerts: franchises.reduce(
        (acc, f) =>
          acc +
          f.stock.filter((s) => ["low", "critical"].includes(s.alertStatus))
            .length,
        0,
      ),
      healthyFranchises: franchises.filter(
        (f) =>
          f.stock.length > 0 && f.stock.every((s) => s.alertStatus === "ok"),
      ).length,
    }),
    [franchises],
  );

  const activeFranchiseMetrics = useMemo(() => {
    if (!franchiseDetail) return null;
    return {
      totalItems: franchiseDetail.items.length,
      lowStockItems: franchiseDetail.items.filter((s) => s.alertStatus !== "ok")
        .length,
      criticalItems: franchiseDetail.items.filter(
        (s) => s.alertStatus === "critical",
      ).length,
    };
  }, [franchiseDetail]);

  if (isLoading && viewMode === "network" && networkData.length === 0) {
    return (
      <div className="p-4 space-y-4 animate-pulse">
        <div className="h-4 w-48 bg-slate-100 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-px bg-slate-200 border border-slate-200">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-white" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-64 bg-slate-50 border border-slate-200 rounded-sm"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 w-full">
      {/* Enterprise Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 px-6">
        <div className="px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-r border-slate-200 pr-4">
              <Home size={12} />
              <ChevronRight size={10} />
              <span>Inventory</span>
              <ChevronRight size={10} />
              <span className="text-slate-900 uppercase tracking-widest">
                All Franchises
              </span>
            </div>
            <h1 className="text-sm font-bold text-slate-900">
              {viewMode === "network"
                ? "Franchise Stock Levels"
                : viewMode === "categories"
                  ? `${franchiseDetail?.franchise?.franchiseName} Dashboard`
                  : `${selectedCategoryName} Stock`}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {viewMode !== "network" && (
              <button
                onClick={handleBack}
                className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-sm text-[11px] font-bold text-slate-400 hover:text-slate-900 transition-colors">
                <ChevronLeft size={14} />
                {viewMode === "categories" ? "All Franchises" : "All Categories"}
              </button>
            )}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isLoading}
              aria-label={
                viewMode === "network"
                  ? "Refresh stock monitoring overview"
                  : "Refresh franchise stock details"
              }
              title={
                viewMode === "network"
                  ? "Refresh stock monitoring overview"
                  : "Refresh franchise stock details"
              }
              className="p-1.5 border border-slate-200 rounded-sm hover:bg-slate-50 text-slate-400 transition-colors disabled:cursor-not-allowed disabled:opacity-60">
              <RefreshCw
                size={14}
                className={isLoading ? "animate-spin" : ""}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Global Stats Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 bg-white border-b border-slate-200">
        {viewMode === "network" ? (
          <>
            <MetricRow
              label="Active Franchises"
              value={globalStats.totalFranchises.toString()}
              icon={Store}
              change={0}
              trend="up"
            />
            <MetricRow
              label="Critical Alerts"
              value={globalStats.criticalAlerts.toString()}
              icon={AlertTriangle}
              change={0}
              trend="up"
            />
            <MetricRow
              label="Low Stock"
              value={globalStats.lowStockAlerts.toString()}
              icon={Activity}
              change={0}
              trend="down"
            />
            <MetricRow
              label="Stock Health"
              value={
                globalStats.totalFranchises > 0
                  ? `${Math.round((globalStats.healthyFranchises / globalStats.totalFranchises) * 100)}%`
                  : "0%"
              }
              icon={Target}
              change={0}
              trend="up"
            />
          </>
        ) : (
          activeFranchiseMetrics && (
            <>
              <MetricRow
                label="Products Tracked"
                value={activeFranchiseMetrics.totalItems.toString()}
                icon={Package}
                change={0}
                trend="up"
              />
              <MetricRow
                label="Alert Levels"
                value={activeFranchiseMetrics.lowStockItems.toString()}
                icon={AlertTriangle}
                change={0}
                trend="up"
              />
              <MetricRow
                label="Risk"
                value={activeFranchiseMetrics.criticalItems.toString()}
                icon={Activity}
                change={0}
                trend="down"
              />
              <div className="px-6 py-4 flex items-center justify-center bg-slate-50/50">
                <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-sm text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-sm">
                  <ShoppingCart size={14} />
                  Auto Stock Requests
                </button>
              </div>
            </>
          )
        )}
      </div>

      <div className="p-6 space-y-4 pb-24">
        <AnimatePresence mode="wait">
          {viewMode === "network" ? (
            <motion.div
              key="network-grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {franchises.map((franchise) => {
                const criticalCount = franchise.stock.filter(
                  (s) => s.alertStatus === "critical",
                ).length;
                const healthyCount = franchise.stock.filter(
                  (s) => s.alertStatus === "ok",
                ).length;
                const healthScore =
                  franchise.stock.length > 0
                    ? Math.round((healthyCount / franchise.stock.length) * 100)
                    : 0;

                return (
                  <motion.div
                    key={franchise.franchiseId}
                    onClick={() => handleFranchiseClick(franchise.franchiseId)}
                    className="bg-white border border-slate-200 rounded-sm p-5 hover:border-slate-400 transition-all cursor-pointer group">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-sm flex items-center justify-center text-slate-400 group-hover:text-slate-900 transition-colors">
                        <Store size={20} />
                      </div>
                      <div
                        className={cn(
                          "px-2 py-0.5 rounded-sm text-[10px] font-black uppercase tracking-widest border",
                          criticalCount > 0
                            ? "bg-red-50 text-red-500 border-red-100"
                            : "bg-emerald-50 text-emerald-500 border-emerald-100",
                        )}>
                        {criticalCount > 0
                          ? `${criticalCount} ERRORS`
                          : "STABLE"}
                      </div>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 tracking-tight mb-1">
                      {franchise.name}
                    </h3>
                    <div className="flex items-center gap-3 text-slate-400 mb-6">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest">
                        <MapPin size={12} />
                        {franchise.location}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-end mb-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-sans">
                          Stock Health
                        </span>
                        <span className="text-xs font-black text-slate-900 tabular-nums">
                          {healthScore}%
                        </span>
                      </div>
                      <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full transition-all",
                            healthScore > 80
                              ? "bg-emerald-500"
                              : healthScore > 50
                                ? "bg-amber-500"
                                : "bg-red-500",
                          )}
                          style={{ width: `${healthScore}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-6 flex items-center justify-between pt-4 border-t border-slate-50">
                      <div className="flex gap-4">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                            Alerts
                          </p>
                          <p className="font-bold text-slate-900 text-xs tabular-nums">
                            {
                              franchise.stock.filter(
                                (s) => s.alertStatus !== "ok",
                              ).length
                            }
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                            Products
                          </p>
                          <p className="font-bold text-slate-900 text-xs tabular-nums">
                            {franchise.stock.length}
                          </p>
                        </div>
                      </div>
                      <div className="text-slate-200 group-hover:text-slate-900 transition-colors">
                        <ArrowUpRight size={16} />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          ) : viewMode === "categories" ? (
            <motion.div
              key="categories-grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {categoryStats.map((cat) => (
                <motion.div
                  key={cat.id || cat.name}
                  onClick={() => handleCategoryClick(cat)}
                  className="bg-white border border-slate-200 rounded-sm p-5 hover:border-slate-400 transition-all cursor-pointer group">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-sm flex items-center justify-center text-slate-400 group-hover:text-slate-900 transition-colors">
                      <Package size={20} />
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div
                        className={cn(
                          "px-2 py-0.5 rounded-sm text-[10px] font-black uppercase tracking-widest border",
                          cat.criticalItems > 0
                            ? "bg-red-50 text-red-500 border-red-100"
                            : cat.lowStockItems > 0
                              ? "bg-amber-50 text-amber-500 border-amber-100"
                              : "bg-emerald-50 text-emerald-500 border-emerald-100",
                        )}>
                        {cat.criticalItems > 0
                          ? `${cat.criticalItems} CRITICAL`
                          : cat.lowStockItems > 0
                            ? "LOW STOCK"
                            : "STABLE"}
                      </div>
                      <button
                        onClick={(e) => handleOpenCommissionModal(e, cat)}
                        className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-sm transition-all"
                        title="Set Commission">
                        <Settings size={14} />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 tracking-tight mb-2">
                    {cat.name}
                  </h3>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="px-1.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-sm text-[10px] font-black uppercase tracking-widest">
                      {cat.commissionPercentage}% Commission
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                    <div className="flex gap-4">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                          Alerts
                        </p>
                        <p className="font-bold text-slate-900 text-xs tabular-nums">
                          {cat.lowStockItems}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                          SKUs
                        </p>
                        <p className="font-bold text-slate-900 text-xs tabular-nums">
                          {cat.totalItems}
                        </p>
                      </div>
                    </div>
                    <div className="text-slate-200 group-hover:text-slate-900 transition-colors">
                      <ArrowRight size={16} />
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="detail-view"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4">
              <div className="flex items-center gap-4 bg-white border border-slate-200 rounded-sm p-2 shadow-sm">
                <div className="relative flex-1 group w-full">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors"
                    size={14}
                  />
                  <input
                    type="text"
                    placeholder={`Search items in ${selectedCategoryName}...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value.trim())}
                    className="w-full border-none outline-none text-[11px] font-bold py-2 pl-9 pr-4 placeholder:text-slate-400 bg-transparent"
                  />
                </div>
                <div className="flex items-center gap-2 border-l border-slate-100 pl-4">
                  <button
                    onClick={handleDownloadTemplate}
                    className="flex items-center gap-2 px-3 py-2 border border-slate-200 text-slate-400 hover:text-slate-900 hover:border-slate-900 rounded-sm text-[10px] font-black uppercase tracking-widest transition-all"
                    title="Download Current View as Template">
                    <FileSpreadsheet size={14} />
                    Template
                  </button>
                  <label className="flex items-center gap-2 px-3 py-2 bg-slate-900 text-white hover:bg-emerald-600 rounded-sm text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer shadow-lg shadow-slate-200">
                    <UploadCloud size={14} />
                    Bulk Update
                    <input
                      type="file"
                      className="hidden"
                      accept=".csv"
                      onChange={handleBulkUpdate}
                    />
                  </label>
                </div>
              </div>

              <div className="space-y-8">
                {Object.entries(groupedStock).map(([subcategory, items]) => (
                  <div key={subcategory} className="space-y-3">
                    <div className="flex items-center gap-3 px-1">
                      <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.3em]">
                        {subcategory}
                      </h4>
                      <div className="h-px flex-1 bg-slate-100" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        {items.length} SKUs
                      </span>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-sm overflow-hidden shadow-sm">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 w-1/4">
                              Product
                            </th>
                            <th className="px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center">
                              Stock
                            </th>
                            <th className="px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center">
                              Price Control
                            </th>
                            <th className="px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center">
                              Minimum Stock
                            </th>
                            <th className="px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                              Status
                            </th>
                            <th className="px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {items.map((item) => (
                            <tr
                              key={item.productId}
                              className="hover:bg-slate-50/50 transition-all">
                              <td className="px-6 py-4">
                                <div className="flex flex-col">
                                  <span className="font-bold text-slate-900 text-sm">
                                    {item.productName}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                                    CODE: {item.productId?.slice(-8)}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <div
                                  onClick={(e) => handleOpenStockModal(e, item)}
                                  className="inline-flex cursor-pointer flex-col items-center rounded-sm border border-transparent p-2 transition-all hover:border-slate-200 hover:bg-slate-50"
                                >
                                  <span
                                    className={cn(
                                      "text-sm font-black tabular-nums",
                                      item.currentStock < item.mbq
                                        ? "text-red-600"
                                        : "text-slate-900",
                                    )}>
                                    {item.currentStock}{" "}
                                    <span className="text-[10px] uppercase font-bold text-slate-400">
                                      {item.unit}
                                    </span>
                                  </span>
                                  <div className="w-12 h-0.5 mt-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                      className={cn(
                                        "h-full transition-all",
                                        item.currentStock < item.mbq
                                          ? "bg-red-500"
                                          : "bg-emerald-500",
                                      )}
                                      style={{
                                        width: `${Math.min((item.currentStock / item.mbq) * 100, 100)}%`,
                                      }}
                                    />
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <div
                                  onClick={(e) => handleOpenPriceModal(e, item)}
                                  className={cn(
                                    "inline-flex flex-col items-center cursor-pointer p-2 rounded-sm transition-all border",
                                    item.franchisePrice
                                      ? "bg-amber-50 border-amber-100 hover:border-amber-300"
                                      : "hover:bg-slate-50 border-transparent hover:border-slate-200",
                                  )}>
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className={cn(
                                        "text-xs font-black tabular-nums",
                                        item.franchisePrice
                                          ? "text-amber-700"
                                          : "text-slate-900",
                                      )}>
                                      ₹{item.franchisePrice || item.globalPrice}
                                    </span>
                                    {item.franchisePrice && (
                                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                    )}
                                  </div>
                                  <span className="text-[10px] uppercase font-black text-slate-400 mt-0.5 tracking-tighter">
                                    {item.franchisePrice
                                      ? "Franchise Rate"
                                      : "Global Rate"}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className="text-xs font-bold text-slate-400 tabular-nums">
                                  {item.mbq} {item.unit}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <StockAlertBadge status={item.alertStatus} />
                              </td>
                              <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                                <button
                                  onClick={(e) => handleOpenEditModal(e, item)}
                                  className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-sm transition-all"
                                  title="Edit">
                                  <Edit3 size={14} />
                                </button>
                                {item.alertStatus !== "ok" ? (
                                  <button className="bg-slate-900 text-white px-3 py-1.5 rounded-sm font-bold text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-sm">
                                    Stock Mangwayein
                                  </button>
                                ) : (
                                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest px-2 py-1 bg-slate-50 border border-slate-100 rounded-sm">
                                    Enough Stock
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>

              {Object.keys(groupedStock).length === 0 && (
                <div className="py-20 flex flex-col items-center justify-center text-center opacity-30">
                  <Package size={32} className="text-slate-300 mb-2" />
                  <p className="text-[10px] font-black uppercase tracking-widest">
                    No products found
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Commission Modal */}
      <AnimatePresence>
        {commissionModal.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white border border-slate-200 rounded-sm shadow-2xl w-full max-w-md overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Financial Control
                  </span>
                  <h2 className="text-sm font-bold text-slate-900">
                    Commission
                  </h2>
                </div>
                <button
                  onClick={() =>
                    setCommissionModal({
                      isOpen: false,
                      category: null,
                      value: "",
                    })
                  }
                  className="text-slate-400 hover:text-slate-900">
                  <ChevronDown size={20} className="rotate-90" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-100 rounded-sm">
                  <div className="w-10 h-10 bg-white border border-slate-100 rounded-sm flex items-center justify-center text-slate-900">
                    <Package size={20} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-900">
                      {commissionModal.category?.name}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                      Target Franchise:{" "}
                      {franchiseDetail?.franchise?.franchiseName}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Commission Percentage (%)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={commissionModal.value}
                      onChange={(e) =>
                        setCommissionModal({
                          ...commissionModal,
                          value: e.target.value,
                        })
                      }
                      className="w-full bg-white border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:border-slate-900 focus:ring-1 focus:ring-slate-900/5 outline-none transition-all pr-12"
                      placeholder="e.g. 5.0"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                      %
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 italic">
                    This commission will be applied to all products within this
                    category for this specific franchise.
                  </p>
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                <button
                  onClick={() =>
                    setCommissionModal({
                      isOpen: false,
                      category: null,
                      value: "",
                    })
                  }
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-sm text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 hover:border-slate-400 transition-all">
                  Cancel
                </button>
                <button
                  onClick={handleSaveCommission}
                  className="flex-1 px-4 py-2.5 bg-slate-900 text-white rounded-sm text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-md shadow-slate-200">
                  Save
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Price Override Modal */}
      <AnimatePresence>
        {priceModal.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white border border-slate-200 rounded-sm shadow-2xl w-full max-w-md overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Pricing Control
                  </span>
                  <h2 className="text-sm font-bold text-slate-900">
                    Special Price for this Franchise
                  </h2>
                </div>
                <button
                  onClick={() =>
                    setPriceModal({ isOpen: false, item: null, value: "" })
                  }
                  className="text-slate-400 hover:text-slate-900">
                  <ChevronDown size={20} className="rotate-90" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-100 rounded-sm">
                  <div className="w-10 h-10 bg-white border border-slate-100 rounded-sm flex items-center justify-center text-slate-900 overflow-hidden">
                    {priceModal.item?.image ? (
                      <img
                        src={priceModal.item.image}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package size={20} />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-900">
                      {priceModal.item?.productName}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                      Global Rate: ₹{priceModal.item?.globalPrice}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Custom Franchise Price (₹)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={priceModal.value}
                      onChange={(e) =>
                        setPriceModal({ ...priceModal, value: e.target.value })
                      }
                      className="w-full bg-white border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:border-slate-900 focus:ring-1 focus:ring-slate-900/5 outline-none transition-all pr-12"
                      placeholder="Leave empty to use Global Rate"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                      ₹
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 italic">
                    Enter a special price for this
                    franchise. Leave it empty to use the normal price.
                  </p>
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                <button
                  onClick={() =>
                    setPriceModal({ isOpen: false, item: null, value: "" })
                  }
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-sm text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 hover:border-slate-400 transition-all">
                  Cancel
                </button>
                <button
                  onClick={handleSavePrice}
                  className="flex-1 px-4 py-2.5 bg-slate-900 text-white rounded-sm text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-md shadow-slate-200">
                  Save Price
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Stock Modal */}
      <AnimatePresence>
        {stockModal.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white border border-slate-200 rounded-sm shadow-2xl w-full max-w-md overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Stock Control
                  </span>
                  <h2 className="text-sm font-bold text-slate-900">
                    Update Quantity
                  </h2>
                </div>
                <button
                  onClick={() =>
                    setStockModal({ isOpen: false, item: null, value: "" })
                  }
                  className="text-slate-400 hover:text-slate-900">
                  <ChevronDown size={20} className="rotate-90" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-100 rounded-sm">
                  <div className="w-10 h-10 bg-white border border-slate-100 rounded-sm flex items-center justify-center text-slate-900 overflow-hidden">
                    {stockModal.item?.image ? (
                      <img
                        src={stockModal.item.image}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package size={20} />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-900">
                      {stockModal.item?.productName}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                      Current: {stockModal.item?.currentStock} {stockModal.item?.unit}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Stock Quantity
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={stockModal.value}
                    onChange={(e) =>
                      setStockModal({ ...stockModal, value: e.target.value })
                    }
                    className="w-full bg-white border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:border-slate-900 focus:ring-1 focus:ring-slate-900/5 outline-none transition-all"
                    placeholder="Enter stock quantity"
                  />
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                <button
                  onClick={() =>
                    setStockModal({ isOpen: false, item: null, value: "" })
                  }
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-sm text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 hover:border-slate-400 transition-all">
                  Cancel
                </button>
                <button
                  onClick={handleSaveStock}
                  className="flex-1 px-4 py-2.5 bg-slate-900 text-white rounded-sm text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-md shadow-slate-200">
                  Save Stock
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editModal.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white border border-slate-200 rounded-sm shadow-2xl w-full max-w-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Edit Product
                  </span>
                  <h2 className="text-sm font-bold text-slate-900">
                    Price and stock for this franchise
                  </h2>
                </div>
                <button
                  onClick={() => setEditModal({ ...editModal, isOpen: false })}
                  className="text-slate-400 hover:text-slate-900">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-100 rounded-sm">
                  <div className="w-12 h-12 bg-white border border-slate-100 rounded-sm flex items-center justify-center text-slate-900 overflow-hidden">
                    {editModal.item?.image ? (
                      <img
                        src={editModal.item.image}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package size={24} />
                    )}
                  </div>
                  <div className="flex-1 flex flex-col">
                    <span className="text-sm font-bold text-slate-900">
                      {editModal.item?.productName}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                      CODE: {editModal.item?.productId?.slice(-8)}
                    </span>
                  </div>
                  <a
                    href={`/masteradmin/products/edit/${editModal.item?.productId}`}
                    target="_blank"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-sm text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 transition-all shadow-sm">
                    <ExternalLink size={12} />
                    Edit
                  </a>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      Current Stock
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        value={editModal.currentStock}
                        onChange={(e) =>
                          setEditModal({
                            ...editModal,
                            currentStock: e.target.value,
                          })
                        }
                        className="w-full bg-white border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:border-slate-900 focus:ring-1 focus:ring-slate-900/5 outline-none transition-all"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300 uppercase">
                        {editModal.item?.unit}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      Minimum Stock
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        value={editModal.mbq}
                        onChange={(e) =>
                          setEditModal({ ...editModal, mbq: e.target.value })
                        }
                        className="w-full bg-white border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:border-slate-900 focus:ring-1 focus:ring-slate-900/5 outline-none transition-all"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300 uppercase">
                        {editModal.item?.unit}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Franchise Price Control (₹)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={editModal.franchisePrice}
                      onChange={(e) =>
                        setEditModal({
                          ...editModal,
                          franchisePrice: e.target.value,
                        })
                      }
                      className="w-full bg-white border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:border-slate-900 focus:ring-1 focus:ring-slate-900/5 outline-none transition-all"
                      placeholder={`Global Rate: ₹${editModal.item?.globalPrice}`}
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                      ₹
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 italic">
                    Special price for this franchise. Leave blank to use the normal price.
                  </p>
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                <button
                  onClick={() => setEditModal({ ...editModal, isOpen: false })}
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-sm text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 hover:border-slate-400 transition-all">
                  Cancel
                </button>
                <button
                  onClick={handleSaveEditModal}
                  className="flex-1 px-4 py-2.5 bg-slate-900 text-white rounded-sm text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-md">
                  Save
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Diagnostics Strip */}
      <div className="px-4 py-1.5 bg-slate-900 text-white/40 flex items-center justify-between border-t border-slate-800">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest">
            <div className="w-1 h-1 rounded-full bg-emerald-400" />
            Up to date
          </div>
          <div className="h-3 w-px bg-slate-700" />
          <div className="text-[10px] font-bold tabular-nums">
            Kisaankart
          </div>
        </div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-white/60">
          Stock Levels
        </div>
      </div>
    </div>
  );
}
