'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Bell, Check, X, Loader2 } from 'lucide-react'

function AtivarLembretesContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  
  const [status, setStatus] = useState<'loading' | 'ready' | 'activating' | 'success' | 'error' | 'denied'>('loading')
  const [patientName, setPatientName] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setErrorMsg('Link invalido')
      return
    }
    setStatus('ready')
  }, [token])

  const handleActivate = async () => {
    if (!('Notification' in window)) {
      setStatus('error')
      setErrorMsg('Seu navegador não suporta notificações')
      return
    }

    try {
      setStatus('activating')

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setStatus('denied')
        return
      }

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

      const fcmToken = await getToken(messaging, {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: registration
      })

      if (!fcmToken) {
        setStatus('error')
        setErrorMsg('Não foi possível ativar notificações')
        return
      }

      const res = await fetch('/api/patient/push/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_token: token,
          fcm_token: fcmToken,
          device_info: navigator.userAgent
        })
      })

      const data = await res.json()

      if (res.ok) {
        setPatientName(data.patient_name || '')
        setStatus('success')
      } else {
        setStatus('error')
        setErrorMsg(data.error || 'Erro ao ativar')
      }

    } catch (error) {
      console.error('Erro:', error)
      setStatus('error')
      setErrorMsg('Erro ao ativar notificações')
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8">
      {status === 'loading' && (
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto" />
        </div>
      )}

      {status === 'ready' && (
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-6">
            <Bell className="w-10 h-10 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 mb-3">Ativar Lembretes</h1>
          <p className="text-neutral-600 mb-6">Receba lembretes das suas sessoes diretamente no seu celular ou computador.</p>
          <p className="text-sm text-neutral-500 mb-8 bg-neutral-50 p-4 rounded-lg">
            Você recebera apenas lembretes de horario das suas sessoes. Nenhuma informacao clínica sera enviada.
          </p>
          <button onClick={handleActivate} className="w-full px-6 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold text-lg transition-colors">
            Ativar Notificações
          </button>
        </div>
      )}

      {status === 'activating' && (
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-neutral-600">Ativando notificações...</p>
        </div>
      )}

      {status === 'success' && (
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 mb-3">Lembretes Ativados!</h1>
          <p className="text-neutral-600 mb-4">{patientName ? `${patientName}, você` : 'Você'} recebera lembretes antes das suas sessoes.</p>
          <p className="text-sm text-neutral-500">Pode fechar esta página.</p>
        </div>
      )}

      {status === 'denied' && (
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-6">
            <Bell className="w-10 h-10 text-amber-600" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 mb-3">Permissao Negada</h1>
          <p className="text-neutral-600 mb-6">Para receber lembretes, você precisa permitir notificações no seu navegador.</p>
          <button onClick={() => setStatus('ready')} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
            Tentar Novamente
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
            <X className="w-10 h-10 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 mb-3">Erro</h1>
          <p className="text-neutral-600">{errorMsg || 'Não foi possível ativar os lembretes.'}</p>
        </div>
      )}

      <div className="mt-8 pt-6 border-t border-neutral-100 text-center">
        <p className="text-xs text-neutral-400">AXIS TCC - Sistema de Apoio Clínico</p>
      </div>
    </div>
  )
}

export default function AtivarLembretesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
      <Suspense fallback={<div className="text-center"><Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto" /></div>}>
        <AtivarLembretesContent />
      </Suspense>
    </div>
  )
}
