import Order from '../models/order.js';
import { sendNotificationToUser } from './pushNotificationHelper.js';
import { getISTDayKey, getISTMinutesOfDay, getShiftStartHour } from './deliverySchedule.js';

/**
 * Checks for upcoming scheduled orders and sends reminders to delivery partners.
 * Times are evaluated in IST; each order is reminded at most once.
 */
export const checkScheduledReminders = async () => {
    try {
        const now = new Date();
        const todayKey = getISTDayKey(now);
        const nowMinutes = getISTMinutesOfDay(now);

        // Find orders for today that haven't been delivered/cancelled and weren't reminded yet
        const upcomingOrders = await Order.find({
            isPreOrder: true,
            orderStatus: { $in: ['Dispatched', 'Packed', 'Accepted', 'Placed'] },
            deliveryPartnerId: { $exists: true, $ne: null },
            scheduleReminderSentAt: null
        });

        for (const order of upcomingOrders) {
            if (!order.scheduledDate) continue;
            if (getISTDayKey(order.scheduledDate) !== todayKey) continue;

            const startHour = getShiftStartHour(order.deliveryShift);
            if (startHour === null) continue;

            // Remind within the 45 minutes before the shift starts
            const minutesUntilStart = (startHour * 60) - nowMinutes;

            if (minutesUntilStart > 0 && minutesUntilStart <= 45) {
                console.log(`[Scheduler] Sending reminder for order ${order._id} to partner ${order.deliveryPartnerId}`);

                await sendNotificationToUser(order.deliveryPartnerId, {
                    title: "Upcoming Delivery Reminder",
                    body: `You have a scheduled delivery for ${order.deliveryShift} today. Please be ready!`,
                    data: {
                        type: 'scheduled_reminder',
                        orderId: order._id.toString(),
                        shift: order.deliveryShift
                    }
                }, 'delivery');

                await Order.updateOne({ _id: order._id }, { $set: { scheduleReminderSentAt: new Date() } });
            }
        }
    } catch (error) {
        console.error('[Scheduler] Error in checkScheduledReminders:', error);
    }
};

/**
 * Starts the reminder scheduler
 */
export const startScheduler = () => {
    console.log('[Scheduler] Reminder scheduler started (every 15 minutes)');
    // Run every 15 minutes
    setInterval(checkScheduledReminders, 15 * 60 * 1000);

    // Also run once immediately on start
    checkScheduledReminders();
};
