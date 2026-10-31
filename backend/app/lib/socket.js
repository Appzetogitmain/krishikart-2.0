import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import SubAdmin from "../models/subAdmin.js";
import MasterAdmin from "../models/masteradmin.js";
import { computeAdminScope } from "../utils/adminScope.js";
import { cityKeysFor, ADMIN_ALL_ROOM, adminCityRoom } from "../utils/adminCity.js";

let io;

export const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    io.on("connection", (socket) => {
        console.log("Client connected:", socket.id);

        socket.on("join_order_room", (orderId) => {
            socket.join(`order_${orderId}`);
            console.log(`Socket ${socket.id} joined room order_${orderId}`);
        });

        socket.on("join_user_room", (payload) => {
            try {
                let userIdFromToken = null;
                if (payload && typeof payload === "object" && payload.token) {
                    const decoded = jwt.verify(payload.token, process.env.JWT_SECRET);
                    userIdFromToken = decoded.id;
                } else if (typeof payload === "string" && payload) {
                    const decoded = jwt.verify(payload, process.env.JWT_SECRET);
                    userIdFromToken = decoded.id;
                }

                if (!userIdFromToken) {
                    console.warn(`join_user_room: Missing or invalid token from socket ${socket.id}`);
                    return;
                }

                const roomName = `user_${userIdFromToken}`;
                socket.join(roomName);
                console.log(`Socket ${socket.id} joined ${roomName} (secured via token)`);
            } catch (err) {
                console.error("join_user_room auth error:", err.message);
            }
        });

        // Admin alerts: head office joins the all-cities room, a city admin only their own cities' rooms.
        // The admin's token is required (alerts carry customer and order details).
        socket.on("join_admin_delivery", async (payload) => {
            try {
                const token = payload && typeof payload === "object" ? payload.token : (typeof payload === "string" ? payload : null);
                if (!token) return;
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const sub = await SubAdmin.findById(decoded.id).select("role priceZoneCodes status").lean();
                const master = sub ? null : await MasterAdmin.findById(decoded.id).select("_id").lean();
                if (!sub && !master) return;
                if (sub?.status === "blocked") return;
                const scope = sub ? await computeAdminScope(sub) : null;
                if (!scope) {
                    socket.join(ADMIN_ALL_ROOM);
                } else {
                    for (const key of scope.cityKeys) socket.join(adminCityRoom(key));
                }
            } catch (err) {
                console.error("join_admin_delivery auth error:", err.message);
            }
        });

        socket.on("join_franchise_room", (payload) => {
            try {
                let franchiseIdFromToken = null;
                if (payload && typeof payload === "object" && payload.token) {
                    const decoded = jwt.verify(payload.token, process.env.JWT_SECRET);
                    franchiseIdFromToken = decoded.id;
                } else if (typeof payload === "string" && payload) {
                    const decoded = jwt.verify(payload, process.env.JWT_SECRET);
                    franchiseIdFromToken = decoded.id;
                }
                if (!franchiseIdFromToken) {
                    console.warn(`join_franchise_room: Missing or invalid token from socket ${socket.id}`);
                    return;
                }
                const roomName = `franchise_${franchiseIdFromToken}`;
                socket.join(roomName);
                console.log(`Socket ${socket.id} joined ${roomName} (secured via token)`);
            } catch (err) {
                console.error("join_franchise_room auth error:", err.message);
            }
        });

        socket.on("join_delivery_room", (deliveryId) => {
            socket.join(`delivery_${deliveryId}`);
            console.log(`Socket ${socket.id} joined delivery_${deliveryId}`);
        });

        socket.on("join_vendor_room", (payload) => {
            try {
                let vendorIdFromToken = null;

                // Expect payload as object: { token: "JWT_HERE" }
                if (payload && typeof payload === "object" && payload.token) {
                    const decoded = jwt.verify(payload.token, process.env.JWT_SECRET);
                    vendorIdFromToken = decoded.id;
                }

                if (!vendorIdFromToken) {
                    console.warn(`join_vendor_room: Missing or invalid token from socket ${socket.id}`);
                    return;
                }

                const roomName = `vendor_${vendorIdFromToken}`;
                socket.join(roomName);
                console.log(`Socket ${socket.id} joined ${roomName} (secured via token)`);
            } catch (err) {
                console.error("join_vendor_room auth error:", err.message);
            }
        });

        socket.on("disconnect", () => {
            console.log("Client disconnected:", socket.id);
        });
    });

    return io;
};

export const getIO = () => {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
};

/** Admin alert: head office always, plus the admins of the city / cities the payload belongs to */
export const emitToAdmin = (event, data) => {
    if (!io) return;
    cityKeysFor(data)
        .then((keys) => {
            let target = io.to(ADMIN_ALL_ROOM);
            for (const key of keys) target = target.to(adminCityRoom(key));
            target.emit(event, data);
        })
        .catch(() => io.to(ADMIN_ALL_ROOM).emit(event, data));
};

export const emitToOrderRoom = (orderId, event, data) => {
    if (io) {
        io.to(`order_${orderId}`).emit(event, data);
    }
};

export const emitToFranchise = (franchiseId, event, data) => {
    if (io) {
        io.to(`franchise_${franchiseId}`).emit(event, data);
    }
};

export const emitToDelivery = (deliveryId, event, data) => {
    if (io) {
        io.to(`delivery_${deliveryId}`).emit(event, data);
    }
};

export const emitToVendor = (vendorId, event, data) => {
    if (io) {
        io.to(`vendor_${vendorId}`).emit(event, data);
    }
};

export const emitToUser = (userId, event, data) => {
    if (io) {
        io.to(`user_${userId}`).emit(event, data);
    }
};
