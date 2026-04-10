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

                console.log('[OneSignal] permission:', permission);

                if (permission !== true) {
                    console.log('[OneSignal] sem permissão ainda');
                    return;
                }

                await OneSignal.login(String(user.id));

                console.log('[OneSignal] usuário associado:', user.id);
                console.log(
                    '[OneSignal] subscription id:',
                    OneSignal.User.PushSubscription.id
                );
                console.log(
                    '[OneSignal] opted in:',
                    OneSignal.User.PushSubscription.optedIn
                );
            } catch (error) {
                console.error('[OneSignal] erro:', error);
            }
        };

        void syncUser();
    }, [user?.id]);

    return null;
}