import React from 'react';
import { Outlet } from 'react-router-dom';
import MobileBottomNav from '../navigation/MobileBottomNav';
import PageTransition from './PageTransition';
import NewTaskAlert from '../modals/NewTaskAlert';
import CityPrompt from '../modals/CityPrompt';
import { useDeliveryOrders } from '../../contexts/DeliveryOrderContext';

const DeliveryLayout = () => {
    const { isAlertOpen, setIsAlertOpen, newTaskData } = useDeliveryOrders();

    return (
        <div className="min-h-screen bg-slate-50">
            <main className="max-w-md mx-auto min-h-screen bg-white shadow-sm relative pb-16">
                <PageTransition>
                    <Outlet />
                </PageTransition>
            </main>
            <MobileBottomNav />

            <NewTaskAlert
                isOpen={isAlertOpen}
                onClose={() => setIsAlertOpen(false)}
                data={newTaskData}
            />
            <CityPrompt />
        </div>
    );
};

export default DeliveryLayout;
