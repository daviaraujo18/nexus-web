'use client';

import { useState } from 'react';
import OneSignal from 'react-onesignal';

export default function OneSignalTestButton() {
    const [message, setMessage] = useState('');

    const handleClick = async () => {
        try {
            await OneSignal.Notifications.requestPermission();

            const optedIn = OneSignal.User.PushSubscription.optedIn;
            const subscriptionId = OneSignal.User.PushSubscription.id;
            
            console.log('[OneSignal] optedIn:', optedIn);
            console.log('[OneSignal] subscriptionId:', subscriptionId);

            setMessage(
                `Permissão concedida. optedIn=${String(optedIn)} subscriptionId=${subscriptionId ?? 'null'}`
            );
        } catch (error) {
            console.error('[OneSignal] erro ao solicitar permissão:', error);
            setMessage('Erro ao solicitar permissão');
        }
    };

    return (
        <div className="p-4 border rounded-lg bg-white shadow-sm">
            <button
                onClick={handleClick}
                className="px-3 py-1 bg-blue-600 text-white rounded"
            >
                Ativar OneSignal
            </button>

            {message ? (
                <div className="mt-3 text-sm text-slate-700">{message}</div>
            ) : null}
        </div>
    );
}