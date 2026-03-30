/* public/firebase-messaging-sw.js */
/* eslint-disable no-undef */

importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyDvYfX5q8aT-PhvDyfZv_rj2JK89AVpblY",
  authDomain: "projeto-nexus-62ebb.firebaseapp.com",
  projectId: "projeto-nexus-62ebb",
  storageBucket: "projeto-nexus-62ebb.firebasestorage.app",
  messagingSenderId: "403253351250",
  appId: "1:403253351250:web:19d496212c5bcc4653208b",
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

function normalizeUrl(path) {
  try {
    return new URL(path || '/', self.location.origin).href;
  } catch {
    return new URL('/', self.location.origin).href;
  }
}

function normalizeNotificationPayload(payload) {
  const notification = payload?.notification || {};
  const data = payload?.data || {};

  const title =
    notification.title ||
    data.title ||
    'Nova notificação';

  const body =
    notification.body ||
    data.body ||
    'Você recebeu uma nova atualização.';

  const url =
    data.clickAction ||
    data.url ||
    data.route ||
    '/student/notifications';

  const icon =
    notification.icon ||
    data.icon ||
    '/icons/icon-192x192.png';

  const badge =
    data.badge ||
    '/icons/badge-72x72.png';

  const image =
    notification.image ||
    data.image ||
    undefined;

  const tag =
    data.tag ||
    data.type ||
    'nexus-notification';

  return {
    title,
    options: {
      body,
      icon,
      badge,
      image,
      tag,
      renotify: false,
      requireInteraction: false,
      data: {
        url,
        clickAction: url,
        type: data.type || null,
        entityId: data.entityId || null,
        sentAt: data.sentAt || new Date().toISOString(),
      },
    },
  };
}

messaging.onBackgroundMessage((payload) => {
  const { title, options } = normalizeNotificationPayload(payload);
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification?.data || {};
  const targetUrl = data.clickAction || data.url || '/';
  const absoluteUrl = normalizeUrl(targetUrl);

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === absoluteUrl && 'focus' in client) {
          return client.focus();
        }
      }

      for (const client of clientList) {
        if ('navigate' in client && 'focus' in client) {
          return client.navigate(absoluteUrl).then(() => client.focus());
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(absoluteUrl);
      }

      return Promise.resolve();
    })
  );
});

self.addEventListener('notificationclose', () => {
  // reservado para telemetria futura
});