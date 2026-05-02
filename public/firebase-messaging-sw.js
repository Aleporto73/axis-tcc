importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCl15IE6pCSWywO-4IiPX0QtLqy4BiXL4E",
  authDomain: "axis-tcc.firebaseapp.com",
  projectId: "axis-tcc",
  storageBucket: "axis-tcc.firebasestorage.app",
  messagingSenderId: "911481168774",
  appId: "1:911481168774:web:8a030d698db7046485c207"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('Recebeu notificação em background:', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    tag: 'axis-reminder',
    requireInteraction: true
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
