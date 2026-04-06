/* public/firebase-messaging-sw.js */
/* eslint-disable no-undef */

importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: 'AIzaSyDvYfX5q8aT-PhvDyfZv_rj2JK89AVpblY',
  authDomain: 'projeto-nexus-62ebb.firebaseapp.com',
  projectId: 'projeto-nexus-62ebb',
  storageBucket: 'projeto-nexus-62ebb.firebasestorage.app',
  messagingSenderId: '403253351250',
  appId: '1:403253351250:web:19d496212c5bcc4653208b',
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

function asString(value, fallback = '') {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function normalizeNotificationPayload(payload) {
  const notification = payload?.notification || {};
  const data = payload?.data || {};

  const title =
    asString(notification.title) ||
    asString(data.title) ||
    'Nova notificação';

  const body =
    asString(notification.body) ||
    asString(data.body) ||
    'Você recebeu uma nova atualização.';

  const route =
    asString(data.clickAction) ||
    asString(data.url) ||
    asString(data.route) ||
    '/student/notifications';

  const icon =
    asString(notification.icon) ||
    asString(data.icon) ||
    '/icons/icon-192x192.png';

  const badge =
    asString(notification.badge) ||
    asString(data.badge) ||
    '/icons/badge-72x72.png';

  const image =
    asString(notification.image) ||
    asString(data.image) ||
    undefined;

  const tag =
    asString(data.tag) ||
    asString(notification.tag) ||
    `${asString(data.type, 'nexus-notification')}-${Date.now()}-${Math.random()}`;

  const sentAt =
    asString(data.sentAt) ||
    new Date().toISOString();

  const type =
    asString(data.type) || null;

  const entityId =
    asString(data.entityId) || null;

  return {
    title,
    options: {
      body,
      icon,
      badge,
      image,
      tag,
      renotify: true,
      requireInteraction: true,
      silent: false,
      data: {
        url: route,
        clickAction: route,
        route,
        type,
        entityId,
        tag,
        sentAt,
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
  const targetUrl =
    data.clickAction ||
    data.url ||
    data.route ||
    '/student/notifications';

  const absoluteUrl = normalizeUrl(targetUrl);
  const targetOrigin = new URL(absoluteUrl).origin;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === absoluteUrl && 'focus' in client) {
          return client.focus();
        }
      }

      for (const client of clientList) {
        try {
          const clientOrigin = new URL(client.url).origin;

          if (clientOrigin === targetOrigin && 'navigate' in client && 'focus' in client) {
            return client.navigate(absoluteUrl).then(() => client.focus());
          }
        } catch (_) {
          // ignora URL inválida do client
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(absoluteUrl);
      }

      return Promise.resolve();
    }),
  );
});

self.addEventListener('notificationclose', () => {
  // reservado para telemetria futura
});