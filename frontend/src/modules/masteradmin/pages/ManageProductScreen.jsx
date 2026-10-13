import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Package,
    List,
    Home,
    ChevronRight,
    Search,
    Filter,
    Plus,
    Pencil,
    Trash2,
    ExternalLink,
    MoreVertical,
    AlertCircle,
    CheckCircle2,
    Eye,
    EyeOff,
    X,
    ChevronDown,
    FileUp,
    Download
} from 'lucide-react';
import { useCatalog } from '../contexts/CatalogContext';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import TablePagination from '../components/tables/TablePagination';

export default function ManageProductScreen() {
    const {
        products,
        isLoading: contextLoading,
        fetchProducts,
        deleteProduct,
        updateProduct,
        importProducts
    } = useCatalog();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const PAGE_SIZE = 25;
    const [page, setPage] = useState(1);
    const navigate = useNavigate();

    useEffect(() => {
        fetchProducts();
    }, []);

    const handleImportExcel = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsImporting(true);
        try {
            const result = await importProducts(file);
            if (result && result.success) {
                toast.success('Products updated from Excel');
                if (result.data?.summary) {
                    const { createdCount, updatedCount, errorCount } = result.data.summary;
                    toast.info(`Created: ${createdCount}, Updated: ${updatedCount}, Errors: ${errorCount}`);
                }
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsImporting(false);
            e.target.value = ''; // Reset input
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to permanently delete this product?')) {
            await deleteProduct(id);
        }
    };

    const handleViewProduct = (product) => {
        setSelectedProduct(product);
        setIsModalOpen(true);
    };

    const toggleVisibility = async (product) => {
        try {
            await updateProduct(product._id, { isVisible: !product.isVisible });
        } catch (error) {
            console.error(error);
        }
    };

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p._id.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
    });

    useEffect(() => { setPage(1); }, [searchTerm, statusFilter]);
    const pagedProducts = filteredProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    if (contextLoading && products.length === 0) {
        return <div className="p-8 animate-pulse text-slate-400 uppercase font-black text-[10px] tracking-widest text-center mt-20">Loading products...</div>;
    }

    return (
        <div className="bg-slate-50 min-h-screen">
            {/* Header Sticky */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-r border-slate-200 pr-4">
                            <Home size={12} />
                            <ChevronRight size={10} />
                            <span>Catalog</span>
                            <ChevronRight size={10} />
                            <span className="text-slate-900 uppercase tracking-widest">Inventory Management</span>
                        </div>
                        <h1 className="text-sm font-black text-slate-900 uppercase tracking-tight">All products</h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => {
                                const headers = ['name', 'skuCode', 'categoryName', 'subcategoryName', 'price', 'comparePrice', 'stock', 'unit', 'description', 'tags', 'dietaryType', 'status'];

                                // Map all existing products to CSV rows
                                const rows = products.map(p => {
                                    return [
                                        `"${(p.name || '').replace(/"/g, '""')}"`,
                                        `"${(p.skuCode || '').replace(/"/g, '""')}"`,
                                        `"${(p.category?.name || '').replace(/"/g, '""')}"`,
                                        `"${(p.subcategory?.name || '').replace(/"/g, '""')}"`,
                                        p.price || 0,
                                        p.comparePrice || '',
                                        p.stock || 0,
                                        `"${(p.unit || 'kg').replace(/"/g, '""')}"`,
                                        `"${(p.description || '').replace(/"/g, '""')}"`,
                                        `"${(Array.isArray(p.tags) ? p.tags.join(',') : '').replace(/"/g, '""')}"`,
                                        `"${(p.dietaryType || 'none').replace(/"/g, '""')}"`,
                                        `"${(p.status || 'active').replace(/"/g, '""')}"`
                                    ].join(",");
                                });

                                // If no products, add one example row at least
                                if (rows.length === 0) {
                                    rows.push("Example Product,SKU001,Vegetables,Leafy Greens,100,120,50,kg,Describe product...,\"organic,fresh\",veg,active");
                                }

                                const csvString = [headers.join(","), ...rows].join("\n");
                                const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
                                const url = URL.createObjectURL(blob);
                                const link = document.createElement("a");
                                link.setAttribute("href", url);
                                link.setAttribute("download", `inventory_ledger_${new Date().toISOString().split('T')[0]}.csv`);
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                            }}
                            title="Download Full Inventory CSV"
                            className="px-4 py-1.5 border border-slate-200 text-slate-500 hover:text-slate-900 rounded-sm text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-sm group/export"
                        >
                            <Download size={12} className="group-hover/export:translate-y-0.5 transition-transform" />
                            Download
                        </button>
                        <label className={cn(
                            "px-6 py-1.5 bg-emerald-600 text-white rounded-sm text-[10px] font-black uppercase tracking-widest flex items-center gap-2 cursor-pointer transition-all hover:bg-emerald-700 shadow-sm",
                            isImporting && "opacity-50 pointer-events-none"
                        )}>
                            {isImporting ? 'Importing...' : <><FileUp size={12} /> Upload from Excel</>}
                            <input
                                type="file"
                                className="hidden"
                                accept=".xlsx, .xls, .csv"
                                onChange={handleImportExcel}
                                disabled={isImporting}
                            />
                        </label>
                        <button
                            onClick={() => navigate('/masteradmin/products/add')}
                            className="px-6 py-1.5 bg-slate-900 text-white rounded-sm text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all hover:bg-indigo-600 shadow-sm"
                        >
                            <Plus size={12} />
                            Add Product
                        </button>
                    </div>
                </div>
            </div>

            <div className="p-8 max-w-[1400px] mx-auto">
                {/* Search & Stats Bar */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-8">
                    <div className="lg:col-span-2">
                        <div className="flex items-center gap-3 px-4 bg-white border border-slate-200 rounded-sm group focus-within:border-slate-400 focus-within:ring-1 focus-within:ring-slate-900/5 transition-all shadow-sm">
                            <Search className="text-slate-400 group-focus-within:text-slate-900 transition-colors" size={16} />
                            <input
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="SEARCH BY PRODUCT NAME OR CODE..."
                                className="w-full bg-transparent py-3 text-[10px] font-bold uppercase tracking-widest focus:outline-none outline-none border-none text-slate-900 placeholder:text-slate-400"
                            />
                        </div>
                    </div>
                    <div className="bg-slate-900 rounded-sm p-3 flex-1 flex items-center justify-between shadow-lg">
                        <div className="space-y-0.5">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Products</p>
                            <p className="text-lg font-black text-white leading-none">{products.length}</p>
                        </div>
                        <Package className="text-emerald-500" size={24} />
                    </div>
                </div>

                {/* Product Table */}
                <div className="bg-white rounded-sm border border-slate-200 shadow-sm overflow-hidden min-h-[500px]">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Product</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Price</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Inventory</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {pagedProducts.length > 0 ? pagedProducts.map((product) => (
                                    <tr key={product._id} className="group hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-slate-100 rounded-sm border border-slate-200 overflow-hidden flex-shrink-0 relative group/img">
                                                    {product.primaryImage ? (
                                                        <img src={product.primaryImage} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                            <Package size={20} />
                                                        </div>
                                                    )}
                                                    {product.dietaryType !== 'none' && (
                                                        <div className={cn(
                                                            "absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full border border-white",
                                                            product.dietaryType === 'veg' ? 'bg-emerald-500' : 'bg-rose-500'
                                                        )} />
                                                    )}
                                                </div>
                                                <div className="space-y-0.5">
                                                    <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-tight line-clamp-1">{product.name}</h4>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">ID: {product._id.slice(-8)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        {product.showOnStorefront !== false && (
                                                            <div className="flex items-center gap-1 bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-[2px] border border-indigo-100/50">
                                                                <span className="text-[10px] font-black uppercase tracking-widest">Storefront</span>
                                                            </div>
                                                        )}
                                                        {product.showOnPOS !== false && (
                                                            <div className="flex items-center gap-1 bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-[2px] border border-amber-100/50">
                                                                <span className="text-[10px] font-black uppercase tracking-widest">POS</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">{product.category?.name || 'No Category'}</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                                    <ChevronRight size={8} />
                                                    {product.subcategory?.name || 'General'}
                                                </p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="space-y-0.5">
                                                <p className="text-[11px] font-black text-slate-900 tracking-tight">₹{product.price}</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">per {product.unitValue > 1 ? product.unitValue : ''}{product.unit}</p>
                                                {product.comparePrice && (
                                                    <p className="text-[10px] font-bold text-slate-400 line-through tracking-tighter">₹{product.comparePrice}</p>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="space-y-1">
                                                    <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                        <div
                                                            className={cn(
                                                                "h-full rounded-full transition-all duration-500",
                                                                product.stock > 10 ? 'bg-emerald-500' : product.stock > 0 ? 'bg-amber-500' : 'bg-rose-500'
                                                            )}
                                                            style={{ width: `${Math.min(100, (product.stock / 50) * 100)}%` }}
                                                        />
                                                    </div>
                                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                                        {product.stock} {product.unit} <span className="text-slate-300 mx-1">|</span> {product.stock > 0 ? 'In Stock' : 'Out of Stock'}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleViewProduct(product)}
                                                    title="Quick View"
                                                    className="p-2 text-slate-400 hover:text-slate-900 hover:bg-white rounded-sm transition-all border border-transparent hover:border-slate-100"
                                                >
                                                    <Eye size={14} />
                                                </button>
                                                <button
                                                    onClick={() => navigate(`/masteradmin/products/edit/${product._id}`)}
                                                    className="p-2 text-slate-400 hover:text-slate-900 hover:bg-white rounded-sm transition-all border border-transparent hover:border-slate-100"
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(product._id)}
                                                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-sm transition-all border border-transparent hover:border-rose-100"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={5}>
                                            <div className="flex flex-col items-center justify-center py-20 space-y-4">
                                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100 italic font-black text-slate-200 text-xl">
                                                    SKU
                                                </div>
                                                <div className="text-center">
                                                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">No Matches Found</h3>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">No products to show. Try a different search.</p>
                                                </div>
                                                <button
                                                    onClick={() => navigate('/masteradmin/products/add')}
                                                    className="mt-4 px-8 py-3 bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-sm hover:bg-emerald-600 transition-all shadow-xl shadow-slate-100"
                                                >
                                                    Add Your First Product
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                        <TablePagination page={page} pageSize={PAGE_SIZE} totalItems={filteredProducts.length} onPageChange={setPage} />
                    </div>
                </div>

                {/* Legend/Helper Bar */}
                <div className="mt-6 flex items-center justify-between px-2">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-amber-500" />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Low Stock Alert</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-rose-500" />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Out of Stock</span>
                        </div>
                    </div>
                </div>
            </div>
            <QuickViewModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                product={selectedProduct}
                onEdit={(id) => navigate(`/masteradmin/products/edit/${id}`)}
            />
        </div>
    );
}

function QuickViewModal({ isOpen, onClose, product, onEdit }) {
    if (!isOpen || !product) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="bg-white rounded-sm shadow-2xl w-full max-w-2xl relative z-10 overflow-hidden"
            >
                <div className="flex flex-col md:flex-row h-full max-h-[80vh] overflow-y-auto">
                    <div className="w-full md:w-2/5 aspect-square bg-slate-100 border-r border-slate-100 relative">
                        {product.primaryImage ? (
                            <img src={product.primaryImage} className="w-full h-full object-cover" alt="" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                                <Package size={64} />
                            </div>
                        )}
                        {/* Status removed */}
                    </div>
                    <div className="flex-1 p-8 space-y-6 relative">
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-900 transition-colors"
                        >
                            <X size={20} />
                        </button>

                        <div className="space-y-1">
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Product Details</p>
                            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none">{product.name}</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Internal ID: {product._id}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Price</p>
                                <p className="text-lg font-black text-slate-900">₹{product.price} <span className="text-xs text-slate-400 font-bold">/ {product.unitValue > 1 ? product.unitValue : ''}{product.unit}</span></p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Live Inventory</p>
                                <p className="text-lg font-black text-slate-900">{product.stock} <span className="text-xs text-slate-400 font-bold">In Stock</span></p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</p>
                            <div className="bg-slate-50 border border-slate-100 p-4 rounded-sm">
                                <p className="text-xs font-medium text-slate-600 leading-relaxed italic">
                                    {product.description || 'No description added for this product.'}
                                </p>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="text-center">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</p>
                                    <p className="text-[10px] font-bold text-slate-900 uppercase tracking-widest">{product.category?.name || 'No Category'}</p>
                                </div>
                                <ChevronRight size={12} className="text-slate-300" />
                                <div className="text-center">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Secondary</p>
                                    <p className="text-[10px] font-bold text-slate-900 uppercase tracking-widest">{product.subcategory?.name || 'General'}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    onClose();
                                    onEdit(product._id);
                                }}
                                className="px-6 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-sm hover:bg-emerald-600 transition-all flex items-center gap-2"
                            >
                                <Pencil size={12} />
                                Edit Product
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

