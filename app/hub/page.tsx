'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'

interface License {
  product_type: string
  is_active: boolean
  valid_from: string
  valid_until: string | null
}

const PRODUCTS = [
  {
    id: 'tcc',
    name: 'AXIS TCC',
    description: 'Sistema de Apoio à Prática Clínica em Terapia Cognitivo-Comportamental',
    icon: '🧠',
    href: '/dashboard',
    color: 'blue',
  },
  {
    id: 'aba',
    name: 'AXIS ABA',
    description: 'Sistema de Apoio à Análise do Comportamento Aplicada',
    icon: '🧩',
    href: '/aba/dashboard',
    color: 'emerald',
  },
]

export default function HubPage() {
  const { isLoaded, userId } = useAuth()
  const router = useRouter()
  const [licenses, setLicenses] = useState<License[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isLoaded && userId) {
      fetch('/api/user/licenses')
        .then(r => r.json())
        .then(data => {
          setLicenses(data.licenses || [])
          setLoading(false)
        })
        .catch(() => setLoading(false))
    }
  }, [isLoaded, userId])

  if (!isLoaded || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-base text-neutral-600">Carregando módulos...</p>
        </div>
      </div>
    )
  }

  const hasLicense = (productId: string) =>
    licenses.some(l => l.product_type === productId)

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-2xl">⚕️</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-neutral-900">AXI Clínico</h1>
              <p className="text-sm text-neutral-500">Seus módulos</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {PRODUCTS.map(product => {
            const licensed = hasLicense(product.id)
            return (
              <div
                key={product.id}
                onClick={() => licensed && router.push(product.href)}
                className={`relative rounded-xl border-2 p-6 transition-all duration-200 ${
                  licensed
                    ? 'border-neutral-200 bg-white hover:border-blue-300 hover:shadow-md cursor-pointer'
                    : 'border-dashed border-neutral-300 bg-neutral-50 cursor-default'
                }`}
              >
                {licensed && (
                  <span className="absolute top-4 right-4 text-xs font-medium bg-green-100 text-green-700 px-2 py-1 rounded-full">
                    Ativo
                  </span>
                )}
                {!licensed && (
                  <span className="absolute top-4 right-4 text-xs font-medium bg-neutral-200 text-neutral-500 px-2 py-1 rounded-full">
                    Não contratado
                  </span>
                )}

                <div className="flex items-start gap-4">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-3xl ${
                    licensed ? 'bg-blue-50' : 'bg-neutral-100'
                  }`}>
                    {product.icon}
                  </div>
                  <div className="flex-1">
                    <h2 className={`text-lg font-semibold mb-1 ${
                      licensed ? 'text-neutral-900' : 'text-neutral-400'
                    }`}>
                      {product.name}
                    </h2>
                    <p className={`text-sm ${
                      licensed ? 'text-neutral-600' : 'text-neutral-400'
                    }`}>
                      {product.description}
                    </p>
                    {licensed && (
                      <p className="text-sm text-blue-600 font-medium mt-3">
                        Acessar →
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}

