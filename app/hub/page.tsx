'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

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
    logo: '/axistcc.png',
    hrefActive: '/dashboard',
    hrefInactive: '/produto/tcc',
    accent: '#1a1f4e',
    accentLight: '#9a9ab8',
    bgActive: 'rgba(26, 31, 78, 0.04)',
    bgInactive: 'rgba(26, 31, 78, 0.02)',
    borderActive: 'rgba(26, 31, 78, 0.18)',
    borderInactive: 'rgba(26, 31, 78, 0.08)',
    btnBg: '#1a1f4e',
    btnHover: '#2a2f6e',
    btnInactiveBg: 'rgba(26, 31, 78, 0.08)',
    btnInactiveText: '#1a1f4e',
  },
  {
    id: 'aba',
    name: 'AXIS ABA',
    description: 'Sistema de Apoio à Análise do Comportamento Aplicada',
    logo: '/axisaba.png',
    hrefActive: '/aba/dashboard',
    hrefInactive: '/produto/aba',
    accent: '#1a1f4e',
    accentLight: '#c4785a',
    bgActive: 'rgba(196, 120, 90, 0.04)',
    bgInactive: 'rgba(196, 120, 90, 0.02)',
    borderActive: 'rgba(196, 120, 90, 0.22)',
    borderInactive: 'rgba(196, 120, 90, 0.08)',
    btnBg: '#1a1f4e',
    btnHover: '#2a2f6e',
    btnInactiveBg: 'rgba(196, 120, 90, 0.10)',
    btnInactiveText: '#1a1f4e',
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
      <div className="flex min-h-screen items-center justify-center" style={{ background: '#fafafa' }}>
        <div className="text-center">
          <div
            className="h-10 w-10 mx-auto mb-4 rounded-full border-2 animate-spin"
            style={{ borderColor: '#e5e5e5', borderTopColor: '#1a1f4e' }}
          />
          <p className="text-sm" style={{ color: '#737373' }}>Carregando módulos...</p>
        </div>
      </div>
    )
  }

  const hasLicense = (productId: string) =>
    licenses.some(l => l.product_type === productId)

  return (
    <div className="min-h-screen" style={{ background: '#fafafa' }}>
      {/* Header */}
      <header className="bg-white" style={{ borderBottom: '1px solid #e8e8e8' }}>
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center gap-4">
          <Image
            src="/axis.png"
            alt="AXIS"
            width={120}
            height={40}
            className="w-auto"
            style={{ height: '40px' }}
            priority
          />
          <div style={{ width: '1px', height: '28px', background: '#e0e0e0' }} />
          <p className="text-sm font-medium" style={{ color: '#737373' }}>
            Seus módulos
          </p>
        </div>
      </header>

      {/* Cards */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {PRODUCTS.map(product => {
            const licensed = hasLicense(product.id)
            return (
              <div
                key={product.id}
                className="relative rounded-2xl overflow-hidden transition-all duration-300"
                style={{
                  background: licensed ? product.bgActive : product.bgInactive,
                  border: `1.5px solid ${licensed ? product.borderActive : product.borderInactive}`,
                  boxShadow: licensed
                    ? '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)'
                    : '0 1px 2px rgba(0,0,0,0.02)',
                }}
              >
                {/* Top accent line */}
                <div
                  style={{
                    height: '3px',
                    background: licensed
                      ? `linear-gradient(90deg, ${product.accent}, ${product.accentLight})`
                      : `linear-gradient(90deg, ${product.accent}33, ${product.accentLight}33)`,
                  }}
                />

                <div className="p-7">
                  {/* Logo + Badge row */}
                  <div className="flex items-start justify-between mb-5">
                    <Image
                      src={product.logo}
                      alt={product.name}
                      width={160}
                      height={48}
                      className="w-auto"
                      style={{
                        height: '48px',
                        opacity: licensed ? 1 : 0.45,
                        filter: licensed ? 'none' : 'grayscale(30%)',
                      }}
                    />
                    {licensed && (
                      <span
                        className="text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{
                          background: '#dcfce7',
                          color: '#166534',
                        }}
                      >
                        Ativo
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  <p
                    className="text-sm leading-relaxed mb-6"
                    style={{
                      color: licensed ? '#525252' : '#a3a3a3',
                    }}
                  >
                    {product.description}
                  </p>

                  {/* Button */}
                  {licensed ? (
                    <button
                      onClick={() => router.push(product.hrefActive)}
                      className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white transition-all duration-200"
                      style={{ background: product.btnBg }}
                      onMouseEnter={e => (e.currentTarget.style.background = product.btnHover)}
                      onMouseLeave={e => (e.currentTarget.style.background = product.btnBg)}
                    >
                      Acessar &rarr;
                    </button>
                  ) : (
                    <button
                      onClick={() => router.push(product.hrefInactive)}
                      className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-200"
                      style={{
                        background: product.btnInactiveBg,
                        color: product.btnInactiveText,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = product.btnInactiveBg.replace(/[\d.]+\)$/, '0.14)'))}
                      onMouseLeave={e => (e.currentTarget.style.background = product.btnInactiveBg)}
                    >
                      Conhecer &rarr;
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
