import Cart from "../models/cart.js"
import Wishlist from "../models/wishlist.js"
import Product from "../models/product.js"
import handleResponse from "../utils/helper.js"
import { getStorefrontOffersByProduct } from "../utils/storefrontAvailability.js"

// --- CART OPERATIONS ---

export const getCart = async (req, res) => {
    try {
        const userId = req.user.id
        let cart = await Cart.findOne({ userId }).populate('items.productId')

        if (!cart) {
            cart = await Cart.create({ userId, items: [] })
        }

        // With the customer's location, show the local rate (city rate / store price) so the
        // cart matches what checkout will charge
        const lat = parseFloat(req.query.lat)
        const lng = parseFloat(req.query.lng)
        if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && cart.items?.length) {
            try {
                const offers = await getStorefrontOffersByProduct(lat, lng, req.query.city || null)
                const plain = cart.toObject()
                plain.items = plain.items.map((item) => {
                    const offer = item.productId && offers.get(String(item.productId._id))
                    if (!offer) return item
                    return {
                        ...item,
                        productId: {
                            ...item.productId,
                            effectiveStorefrontPrice: offer.effectivePrice,
                            storefrontListPrice: offer.listPrice,
                            comparePrice: offer.comparePrice ?? item.productId.comparePrice,
                            bulkPricing: offer.bulkPricing ?? item.productId.bulkPricing,
                        },
                    }
                })
                return handleResponse(res, 200, "Cart fetched successfully", plain)
            } catch (priceError) {
                console.error("Cart local prices failed:", priceError)
            }
        }

        return handleResponse(res, 200, "Cart fetched successfully", cart)
    } catch (error) {
        console.error("Get cart error:", error)
        return handleResponse(res, 500, "Internal server error")
    }
}

// Upper limit per product line, so typos like 100000000 can't create absurd orders
const MAX_CART_ITEM_QTY = Number(process.env.MAX_CART_ITEM_QTY) || 10000
const isValidQty = (q) => typeof q === "number" && Number.isFinite(q) && q > 0 && q <= MAX_CART_ITEM_QTY
const qtyError = `Please enter a quantity between 1 and ${MAX_CART_ITEM_QTY.toLocaleString("en-IN")}.`

export const addToCart = async (req, res) => {
    try {
        const userId = req.user.id
        const { productId } = req.body
        const quantity = Number(req.body.quantity ?? 1)

        if (!productId) {
            return handleResponse(res, 400, "Product ID is required")
        }
        if (!isValidQty(quantity)) {
            return handleResponse(res, 400, qtyError)
        }

        let cart = await Cart.findOne({ userId })
        if (!cart) {
            cart = new Cart({ userId, items: [] })
        }

        const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId)

        if (itemIndex > -1) {
            const combined = cart.items[itemIndex].quantity + quantity
            if (!isValidQty(combined)) {
                return handleResponse(res, 400, qtyError)
            }
            cart.items[itemIndex].quantity = combined
        } else {
            cart.items.push({ productId, quantity })
        }

        await cart.save()
        await cart.populate('items.productId')

        return handleResponse(res, 200, "Product added to cart", cart)
    } catch (error) {
        console.error("Add to cart error:", error)
        return handleResponse(res, 500, "Internal server error")
    }
}

export const updateCartQuantity = async (req, res) => {
    try {
        const userId = req.user.id
        const { productId } = req.body
        const quantity = Number(req.body.quantity)

        if (!productId || req.body.quantity === undefined || !Number.isFinite(quantity)) {
            return handleResponse(res, 400, "Product ID and quantity are required")
        }
        if (quantity > MAX_CART_ITEM_QTY) {
            return handleResponse(res, 400, qtyError)
        }

        const cart = await Cart.findOne({ userId })
        if (!cart) {
            return handleResponse(res, 404, "Cart not found")
        }

        const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId)
        if (itemIndex === -1) {
            return handleResponse(res, 404, "Product not in cart")
        }

        if (quantity <= 0) {
            cart.items.splice(itemIndex, 1)
        } else {
            cart.items[itemIndex].quantity = quantity
        }

        await cart.save()
        await cart.populate('items.productId')

        return handleResponse(res, 200, "Cart updated", cart)
    } catch (error) {
        console.error("Update cart error:", error)
        return handleResponse(res, 500, "Internal server error")
    }
}

export const removeFromCart = async (req, res) => {
    try {
        const userId = req.user.id
        const { productId } = req.params

        const cart = await Cart.findOne({ userId })
        if (!cart) {
            return handleResponse(res, 404, "Cart not found")
        }

        cart.items = cart.items.filter(item => item.productId.toString() !== productId)

        await cart.save()
        await cart.populate('items.productId')

        return handleResponse(res, 200, "Product removed from cart", cart)
    } catch (error) {
        console.error("Remove from cart error:", error)
        return handleResponse(res, 500, "Internal server error")
    }
}

// --- WISHLIST OPERATIONS ---

export const getWishlist = async (req, res) => {
    try {
        const userId = req.user.id
        let wishlist = await Wishlist.findOne({ userId }).populate({
            path: 'products',
            populate: [
                { path: 'category' },
                { path: 'subcategory' }
            ]
        })

        if (!wishlist) {
            wishlist = await Wishlist.create({ userId, products: [] })
        }

        return handleResponse(res, 200, "Wishlist fetched successfully", wishlist)
    } catch (error) {
        console.error("Get wishlist error:", error)
        return handleResponse(res, 500, "Internal server error")
    }
}

export const toggleWishlist = async (req, res) => {
    try {
        const userId = req.user.id
        const { productId } = req.body

        if (!productId) {
            return handleResponse(res, 400, "Product ID is required")
        }

        let wishlist = await Wishlist.findOne({ userId })
        if (!wishlist) {
            wishlist = new Wishlist({ userId, products: [] })
        }

        const isExist = wishlist.products.some(id => id.toString() === productId)

        if (isExist) {
            wishlist.products = wishlist.products.filter(id => id.toString() !== productId)
        } else {
            wishlist.products.push(productId)
        }

        await wishlist.save()
        await wishlist.populate({
            path: 'products',
            populate: [
                { path: 'category' },
                { path: 'subcategory' }
            ]
        })

        return handleResponse(res, 200, isExist ? "Removed from wishlist" : "Added to wishlist", wishlist)
    } catch (error) {
        console.error("Toggle wishlist error:", error)
        return handleResponse(res, 500, "Internal server error")
    }
}

export const removeFromWishlist = async (req, res) => {
    try {
        const userId = req.user.id
        const { productId } = req.params

        const wishlist = await Wishlist.findOne({ userId })
        if (!wishlist) {
            return handleResponse(res, 404, "Wishlist not found")
        }

        wishlist.products = wishlist.products.filter(id => id.toString() !== productId)

        await wishlist.save()
        await wishlist.populate({
            path: 'products',
            populate: [
                { path: 'category' },
                { path: 'subcategory' }
            ]
        })

        return handleResponse(res, 200, "Removed from wishlist", wishlist)
    } catch (error) {
        console.error("Remove from wishlist error:", error)
        return handleResponse(res, 500, "Internal server error")
    }
}
