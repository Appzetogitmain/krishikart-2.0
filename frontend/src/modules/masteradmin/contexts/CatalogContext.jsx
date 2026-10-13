import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '@/lib/axios';
import { toast } from 'sonner';

const CatalogContext = createContext();

export const useCatalog = () => {
    const context = useContext(CatalogContext);
    if (!context) {
        throw new Error('useCatalog must be used within a CatalogProvider');
    }
    return context;
};

export const CatalogProvider = ({ children }) => {
    const [categories, setCategories] = useState([]);
    const [subcategories, setSubcategories] = useState([]);
    const [products, setProducts] = useState([]);
    const [recommendations, setRecommendations] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    // Fetch initial data
    const fetchCatalog = async () => {
        setIsLoading(true);
        try {
            const [catRes, subRes] = await Promise.all([
                api.get('/catalog/categories'),
                api.get('/catalog/subcategories')
            ]);
            setCategories(catRes.data.results || []);
            setSubcategories(subRes.data.results || []);
        } catch (error) {
            console.error('Fetch Catalog Error:', error);
            toast.error('Failed to load catalog data');
            setCategories([]);
            setSubcategories([]);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchProducts = async (filters = {}) => {
        setIsLoading(true);
        try {
            const queryParams = new URLSearchParams(filters).toString();
            const response = await api.get(`/products?${queryParams}`);
            setProducts(response.data.results || []);
        } catch (error) {
            console.error('Fetch Products Error:', error);
            toast.error('Failed to load products');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCatalog();
        fetchProducts();
    }, []);

    const addCategory = async (categoryData) => {
        try {
            const formData = new FormData();
            formData.append('name', categoryData.name);
            formData.append('description', categoryData.description);
            if (categoryData.adminCommission !== undefined) formData.append('adminCommission', categoryData.adminCommission);
            if (categoryData.file) {
                formData.append('image', categoryData.file);
            }

            const response = await api.post('/catalog/categories', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (response.data.success) {
                const newCat = response.data.result;
                setCategories(prev => [newCat, ...prev]);
                toast.success('Category created successfully');
                return newCat;
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to create category');
            throw error;
        }
    };

    const addSubcategory = async (subcategoryData) => {
        try {
            const formData = new FormData();
            formData.append('name', subcategoryData.name);
            formData.append('category', subcategoryData.categoryId);
            if (subcategoryData.file) {
                formData.append('image', subcategoryData.file);
            }

            const response = await api.post('/catalog/subcategories', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (response.data.success) {
                const newSub = response.data.result;
                setSubcategories(prev => [newSub, ...prev]);
                toast.success('Subcategory created successfully');
                return newSub;
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to create subcategory');
            throw error;
        }
    };

    const getSubcategoriesByCategory = (categoryId) => {
        if (!subcategories) return [];
        return subcategories.filter(s => {
            const parentId = typeof s.category === 'object' ? s.category._id : s.category;
            return parentId === categoryId;
        });
    };

    const deleteCategory = async (id) => {
        try {
            await api.delete(`/catalog/categories/${id}`);
            setCategories(prev => prev.filter(c => c._id !== id));
            toast.success('Category deleted');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Delete failed');
        }
    };

    const deleteSubcategory = async (id) => {
        try {
            await api.delete(`/catalog/subcategories/${id}`);
            setSubcategories(prev => prev.filter(s => s._id !== id));
            toast.success('Subcategory deleted');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Delete failed');
        }
    };

    const updateCategory = async (id, updateData) => {
        try {
            const formData = new FormData();
            if (updateData.name) formData.append('name', updateData.name);
            if (updateData.description) formData.append('description', updateData.description);
            if (updateData.adminCommission !== undefined) formData.append('adminCommission', updateData.adminCommission);
            if (updateData.isVisible !== undefined) formData.append('isVisible', updateData.isVisible);
            if (updateData.file) formData.append('image', updateData.file);

            const response = await api.put(`/catalog/categories/${id}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (response.data.success) {
                const updatedCat = response.data.result;
                setCategories(prev => prev.map(c => c._id === id ? updatedCat : c));
                toast.success('Category updated successfully');
                return updatedCat;
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Update failed');
            throw error;
        }
    };

    const updateSubcategory = async (id, updateData) => {
        try {
            const formData = new FormData();
            if (updateData.name) formData.append('name', updateData.name);
            if (updateData.categoryId) formData.append('category', updateData.categoryId);
            if (updateData.isVisible !== undefined) formData.append('isVisible', updateData.isVisible);
            if (updateData.file) formData.append('image', updateData.file);

            const response = await api.put(`/catalog/subcategories/${id}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (response.data.success) {
                const updatedSub = response.data.result;
                setSubcategories(prev => prev.map(s => s._id === id ? updatedSub : s));
                toast.success('Subcategory updated successfully');
                return updatedSub;
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Update failed');
            throw error;
        }
    };

    const addProduct = async (productData) => {
        try {
            const formData = new FormData();
            Object.keys(productData).forEach(key => {
                if (key === 'bulkPricing') {
                    const validTiers = (productData[key] || []).filter(tier =>
                        tier.minQty !== '' && tier.price !== '' &&
                        tier.minQty !== null && tier.price !== null
                    );
                    formData.append(key, JSON.stringify(validTiers));
                } else if (key === 'tags') {
                    const normalizedTags = Array.isArray(productData[key])
                        ? productData[key]
                        : String(productData[key] || '').split(',');
                    formData.append(key, JSON.stringify(
                        normalizedTags.map(t => String(t).trim()).filter(Boolean)
                    ));
                } else if (key === 'primaryFile') {
                    if (productData[key]) formData.append('primaryImage', productData[key]);
                } else if (key === 'galleryFiles') {
                    if (productData[key]) {
                        productData[key].forEach(file => formData.append('images', file));
                    }
                } else if (key === 'homeSections') {
                    formData.append(key, JSON.stringify(productData[key] || []));
                } else if (productData[key] !== null && productData[key] !== undefined && productData[key] !== "") {
                    formData.append(key, productData[key]);
                }
            });

            const response = await api.post('/products', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (response.data.success) {
                const newProd = response.data.result;
                setProducts(prev => [newProd, ...prev]);
                toast.success('Product added');
                return newProd;
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to initialize product');
            throw error;
        }
    };

    const deleteProduct = async (id) => {
        try {
            await api.delete(`/products/${id}`);
            setProducts(prev => prev.filter(p => p._id !== id));
            toast.success('Product deleted');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Delete failed');
        }
    };

    const updateProduct = async (id, updateData) => {
        try {
            const formData = new FormData();
            Object.keys(updateData).forEach(key => {
                if (key === 'bulkPricing') {
                    const validTiers = (updateData[key] || []).filter(tier =>
                        tier.minQty !== '' && tier.price !== '' &&
                        tier.minQty !== null && tier.price !== null
                    );
                    formData.append(key, JSON.stringify(validTiers));
                } else if (key === 'tags') {
                    const normalizedTags = Array.isArray(updateData[key])
                        ? updateData[key]
                        : String(updateData[key] || '').split(',');
                    formData.append(key, JSON.stringify(
                        normalizedTags.map(t => String(t).trim()).filter(Boolean)
                    ));
                } else if (key === 'primaryFile' && updateData[key]) {
                    formData.append('primaryImage', updateData[key]);
                } else if (key === 'galleryFiles' && updateData[key]) {
                    updateData[key].forEach(file => formData.append('images', file));
                } else if (key === 'homeSections') {
                    formData.append(key, JSON.stringify(updateData[key] || []));
                } else if (key !== 'primaryImage' && key !== 'images' && key !== '_id') {
                    // Only append if value is valid to avoid "null"/"undefined" strings in multipart/form-data
                    if (updateData[key] !== null && updateData[key] !== undefined && updateData[key] !== "") {
                        formData.append(key, updateData[key]);
                    }
                }
            });

            const response = await api.put(`/products/${id}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (response.data.success) {
                const updated = response.data.result;
                setProducts(prev => prev.map(p => p._id === id ? updated : p));
                toast.success('Product updated');
                return updated;
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Update failed');
            throw error;
        }
    };

    const importProducts = async (file) => {
        setIsLoading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const response = await api.post('/products/import', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (response.data.success) {
                toast.success(response.data.message);
                await fetchProducts();
                return response.data;
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Bulk import failed');
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    // 💡 Recommendation Engine Methods
    const fetchRecommendations = async () => {
        setIsLoading(true);
        try {
            const response = await api.get('/masteradmin/recommendations');
            setRecommendations(response.data.results || []);
        } catch (error) {
            console.error('Fetch Recommendations Error:', error);
            toast.error('Failed to load product pairings');
        } finally {
            setIsLoading(false);
        }
    };

    const createRecommendationMapping = async (data) => {
        try {
            const response = await api.post('/masteradmin/recommendations', data);
            if (response.data.success) {
                toast.success('Recommendation saved');
                await fetchRecommendations();
                return response.data.result;
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to create pairing');
            throw error;
        }
    };

    const updateRecommendationMapping = async (id, data) => {
        try {
            const response = await api.put(`/masteradmin/recommendations/${id}`, data);
            if (response.data.success) {
                setRecommendations(prev => prev.map(r => r._id === id ? response.data.result : r));
                toast.success('Pairing updated');
                return response.data.result;
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Update failed');
            throw error;
        }
    };

    const deleteRecommendationMapping = async (id) => {
        try {
            await api.delete(`/masteradmin/recommendations/${id}`);
            setRecommendations(prev => prev.filter(r => r._id !== id));
            toast.success('Pairing removed');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Delete failed');
        }
    };

    const toggleRecommendationStatus = async (id) => {
        try {
            const response = await api.patch(`/masteradmin/recommendations/${id}/toggle`);
            if (response.data.success) {
                setRecommendations(prev => prev.map(r => r._id === id ? response.data.result : r));
                toast.success(response.data.message);
            }
        } catch (error) {
            toast.error('Failed to toggle status');
        }
    };

    return (
        <CatalogContext.Provider value={{
            categories,
            subcategories,
            products,
            isLoading,
            addCategory,
            addSubcategory,
            updateCategory,
            updateSubcategory,
            deleteCategory,
            deleteSubcategory,
            addProduct,
            updateProduct,
            deleteProduct,
            importProducts,
            fetchProducts,
            recommendations,
            fetchRecommendations,
            createRecommendationMapping,
            updateRecommendationMapping,
            deleteRecommendationMapping,
            toggleRecommendationStatus,
            getSubcategoriesByCategory,
            refreshCatalog: fetchCatalog
        }}>
            {children}
        </CatalogContext.Provider>
    );
};
