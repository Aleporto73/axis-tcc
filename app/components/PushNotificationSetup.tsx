'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { Bell, BellOff, X } from 'lucide-react'

export default function PushNotificationSetup() {
  const { userId } = useAuth()
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const [showBanner, setShowBanner] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('Notification' in window)) {
      setPermission('unsupported')
      return
    }
    setPermission(Notification.permission)
    
    // Mostrar banner apenas se ainda não decidiu
    if (Notification.permission === 'default') {
      const dismissed = localStorage.getItem('push_banner_dismissed')
      if (!dismissed) {
        setTimeout(() => setShowBanner(true), 3000)
      }
    }
  }, [])

  const requestPermission = async () => {
    if (!('Notification' in window)) return
    
    try {
      setLoading(true)
      const result = await Notification.requestPermission()
      setPermission(result)

      if (result === 'granted') {
        // Registrar service worker e obter token
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
        
        const { initializeApp, getApps } = await import('firebase/app')
        const { getMessaging, getToken } = await import('firebase/messaging')

        const firebaseConfig = {
          apiKey: "AIzaSyCl15IE6pCSWywO-4IiPX0QtLqy4BiXL4E",
          authDomain: "axis-tcc.firebaseapp.com",
          projectId: "axis-tcc",
          storageBucket: "axis-tcc.firebasestorage.app",
          messagingSenderId: "911481168774",
          appId: "1:911481168774:web:8a030d698db7046485c207"
        }

        const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
        const messaging = getMessaging(app)

        const token = await getToken(messaging, {
          vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
          serviceWorkerRegistration: registration
        })

        if (token) {
          // Enviar token para o backend
          await fetch('/api/push/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fcm_token: token,
              device_info: navigator.userAgent
            })
          })
        }
      }

      setShowBanner(false)
    } catch (error) {
      console.error('[PUSH] Erro ao solicitar permissao:', error)
    } finally {
      setLoading(false)
    }
  }

  const dismissBanner = () => {
    setShowBanner(false)
    localStorage.setItem('push_banner_dismissed', 'true')
  }

  if (!showBanner || permission === 'granted' || permission === 'unsupported') {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 max-w-sm bg-white rounded-lg shadow-lg border border-neutral-200 p-4 z-50">
      <button 
        onClick={dismissBanner}
        className="absolute top-2 right-2 text-neutral-400 hover:text-neutral-600"
      >
        <X className="w-4 h-4" />
      </button>
      
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
          <Bell className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-neutral-900 mb-1">Ativar lembretes</h4>
          <p className="text-sm text-neutral-600 mb-3">
            Receba lembretes de sessoes agendadas diretamente no seu dispositivo.
          </p>
          <div className="flex gap-2">
            <button
              onClick={requestPermission}
              disabled={loading}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Ativando...' : 'Ativar'}
            </button>
            <button
              onClick={dismissBanner}
              className="px-3 py-1.5 text-neutral-600 text-sm hover:bg-neutral-100 rounded-lg"
            >
              Agora não
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
