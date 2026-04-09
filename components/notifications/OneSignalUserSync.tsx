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

                id(permission !==true) {
                    console.log('[OneSignal] sem permissão ainda, não vou logar usuário');
                    return;
                }

                await OneSignal.login(String(user.id));

                console.log('[OneSignal] usuário associado com sucesso:', user.id);
                console.log(
                    '[OneSignal] subscription id:',
                    OneSignal.User.PushSubscription.id
                );
                console.log(
                    '[OneSignal] opted in:',
                    OneSignal.User.PushSubscription.optedIn
                );
            } catch (error) {
                console.error('[OneSignal] erro ao associar usuário:', error);
            }
        };

        void syncUser();
    }, [user?.id]);

    return null;
}