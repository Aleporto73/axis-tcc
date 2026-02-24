'use client'
import { useEffect, useState } from 'react'

interface ToastProps {
  message: string
  type?: 'success' | 'error'
  onClose: () => void
}

export default function Toast({ message, type = 'success', onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true))
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(onClose, 200)
    }, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div className={`
      fixed bottom-6 right-6 z-50
      flex items-center gap-3 px-4 py-3 
      bg-slate-900 text-white text-sm rounded-xl shadow-lg
      transition-all duration-200
      ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
    `}>
      <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
        type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'
      }`}>
        {type === 'success' ? (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </div>
      {message}
    </div>
  )
}
