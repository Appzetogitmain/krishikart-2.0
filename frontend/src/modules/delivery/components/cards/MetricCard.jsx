import React from 'react';
import { motion } from 'framer-motion';

const MetricCard = ({ title, value, icon: Icon, color, suffix = "" }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-4 rounded-2xl border border-border flex items-center space-x-4 shadow-sm"
        >
            <div className={`p-3 rounded-xl ${color}`}>
                {/* White icon on the coloured square (it used to be the same colour, so invisible) */}
                <Icon className="w-6 h-6 text-white" />
            </div>
            <div>
                <p className="text-sm font-medium text-muted-foreground">{title}</p>
                <p className="text-xl font-bold text-foreground">
                    {value}{suffix}
                </p>
            </div>
        </motion.div>
    );
};

export default MetricCard;
