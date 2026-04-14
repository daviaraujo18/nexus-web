'use client';

import { useEffect } from 'react';
import OneSignal from 'react-onesignal';
import { useAuth } from '@/context/AuthContext';

export default function OneSignalUserSync() {
    const { user } = useAuth();

    useEffect(() => {
        const syncUser = async () => {
            if (!user?.id) return;

            try {
                const permission = OneSignal.Notifications.permission;

                if (permission !== true) {
                    return;
                }

                await OneSignal.login(String(user.id));
            } catch (error) {
                console.error('[OneSignal] erro:', error);
            }
        };

        void syncUser();
    }, [user?.id]);

    return null;
}