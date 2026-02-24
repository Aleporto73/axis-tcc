import { initializeApp } from 'firebase/app'
import { getMessaging, getToken, onMessage } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
}

const app = initializeApp(firebaseConfig)

export async function requestNotificationPermission(userId: string, tenantId: string) {
  try {
    const permission = await Notification.requestPermission()
    
    if (permission === 'granted') {
      const messaging = getMessaging(app)
      const token = await getToken(messaging, {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
      })

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: { endpoint: token, keys: { p256dh: '', auth: '' } },
          userId,
          tenantId
        })
      })

      console.log('Push habilitado!')
      return token
    }
  } catch (error) {
    console.error('Erro push:', error)
  }
}

export function listenToMessages(callback: (payload: any) => void) {
  const messaging = getMessaging(app)
  onMessage(messaging, callback)
}
