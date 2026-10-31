import { io } from "socket.io-client";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const SOCKET_URL = API_URL.replace(/\/api$/, "");

let socket;

export const initSocket = () => {
    if (!socket) {
        socket = io(SOCKET_URL, {
            transports: ["websocket"],
            autoConnect: true
        });

        socket.on("connect", () => {
            // silent in production
        });

        socket.on("disconnect", () => {
            // silent in production
        });
    }
    return socket;
};

export const getSocket = () => {
    if (!socket) {
        return initSocket();
    }
    return socket;
};

/** Admin alerts: the server puts head office in the all-cities room and a city admin in their own cities' rooms */
export const joinAdminDeliveryTracking = () => {
    const s = getSocket();
    const token = localStorage.getItem("masterAdminToken");
    if (!token) return;
    s.emit("join_admin_delivery", { token });
};

export const joinOrderRoom = (orderId) => {
    const s = getSocket();
    s.emit("join_order_room", orderId);
};
export const joinUserRoom = () => {
    const s = getSocket();
    const token = localStorage.getItem("userToken");
    if (!token) {
        return;
    }
    s.emit("join_user_room", { token });
};
export const joinFranchiseRoom = () => {
    const s = getSocket();
    const token = localStorage.getItem("franchiseToken");
    if (!token) {
        return;
    }
    s.emit("join_franchise_room", { token });
};
export const joinDeliveryRoom = (deliveryId) => {
    const s = getSocket();
    s.emit("join_delivery_room", deliveryId);
};
export const joinVendorRoom = () => {
    const s = getSocket();
    const token = localStorage.getItem("vendorToken");

    if (!token) {
        return;
    }

    s.emit("join_vendor_room", { token });
};
