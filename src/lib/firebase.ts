import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyCl15IE6pCSWywO-4IiPX0QtLqy4BiXL4E",
  authDomain: "axis-tcc.firebaseapp.com",
  projectId: "axis-tcc",
  storageBucket: "axis-tcc.firebasestorage.app",
  messagingSenderId: "911481168774",
  appId: "1:911481168774:web:8a030d698db7046485c207"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

let messaging: Messaging | null = null;

export const getFirebaseMessaging = (): Messaging | null => {
  if (typeof window === 'undefined') return null;
  if (!('Notification' in window)) return null;
  if (!messaging) {
    messaging = getMessaging(app);
  }
  return messaging;
};

export const requestNotificationPermission = async (): Promise<string | null> => {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Permissao de notificacao negada');
      return null;
    }

    const msg = getFirebaseMessaging();
    if (!msg) return null;

    const token = await getToken(msg, {
      vapidKey: 'BLBz5OvYnMqGM3xPQnZPMONlJxAYxYwKxPQnZPMONlJxAYxYwKx'
    });

    console.log('FCM Token obtido:', token);
    return token;
  } catch (error) {
    console.error('Erro ao obter token FCM:', error);
    return null;
  }
};

export const onForegroundMessage = (callback: (payload: any) => void) => {
  const msg = getFirebaseMessaging();
  if (!msg) return;

  onMessage(msg, (payload) => {
    console.log('Mensagem em foreground:', payload);
    callback(payload);
  });
};
