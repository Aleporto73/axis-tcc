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
  hotmart_plan: string | null
}

const FREE_CTA_COLORS: Record<string, { bg: string; hover: string }> = {
  tcc: { bg: '#1a1f4e', hover: '#2a2f6e' },
  aba: { bg: '#B4532F', hover: '#963f24' },
  tdah: { bg: '#0d7377', hover: '#0a5c5f' },
}

const FREE_CTA_LABELS: Record<string, string> = {
  tcc: 'Utilizar com 1 paciente FREE',
  aba: 'Utilizar com 1 aprendiz FREE',
  tdah: 'Utilizar com 1 paciente FREE',
}

const PRODUCTS = [
  {
    id: 'tcc',
    name: 'AXIS TCC',
    description: 'Sistema clínico para acompanhamento e documentação em Terapia Cognitivo-Comportamental',
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
    shadowActive: undefined as string | undefined,
  },
  {
    id: 'aba',
    name: 'AXIS ABA',
    description: 'Sistema clínico para acompanhamento e documentação em Análise do Comportamento Aplicada',
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
    shadowActive: undefined as string | undefined,
  },
  {
    id: 'tdah',
    name: 'AXIS TDAH',
    description: 'Sistema clínico para acompanhamento e documentação em TDAH com integração tricontextual',
    logo: '/axistdah.png',
    hrefActive: '/tdah/dashboard',
    hrefInactive: '/produto/tdah',
    accent: '#0d7377',
    accentLight: '#34b3b8',
    bgActive: 'rgba(13, 115, 119, 0.06)',
    bgInactive: 'rgba(13, 115, 119, 0.03)',
    borderActive: 'rgba(13, 115, 119, 0.30)',
    borderInactive: 'rgba(13, 115, 119, 0.12)',
    btnBg: '#0d7377',
    btnHover: '#0a5c5f',
    btnInactiveBg: 'rgba(13, 115, 119, 0.10)',
    btnInactiveText: '#0d7377',
    // Teal needs higher opacity than navy/terracotta for equal visual weight
    shadowActive: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(13,115,119,0.08)',
  },
]

export default function HubPage() {
  const { isLoaded, userId } = useAuth()
  const router = useRouter()
  const [licenses, setLicenses] = useState<License[]>([])
  const [loading, setLoading] = useState(true)
  const [activating, setActivating] = useState<string | null>(null)

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
      <div className="flex min-h-screen items-center justify-center bg-[#f4f5f7]">
        <div className="text-center">
          <div className="h-10 w-10 mx-auto mb-4 rounded-full border-2 border-neutral-200 border-t-tcc-700 animate-spin" role="status" aria-label="Carregando" />
          <p className="text-sm text-neutral-500">Carregando módulos...</p>
        </div>
      </div>
    )
  }

  const hasLicense = (productId: string) =>
    licenses.some(l => l.product_type === productId && l.is_active)

  const isPaid = (productId: string) =>
    licenses.some(l => l.product_type === productId && l.is_active && l.hotmart_plan != null && l.hotmart_plan !== '')

  async function handleActivateFree(productType: string) {
    setActivating(productType)
    try {
      const res = await fetch('/api/user/activate-free', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_type: productType }),
      })
      const data = await res.json()

      if (res.ok && data.redirect) {
        router.push(data.redirect)
      } else if (res.status === 409 && data.redirect) {
        // Já tem licença — redireciona direto
        router.push(data.redirect)
      } else {
        console.error('[HUB] activate-free failed:', data)
        setActivating(null)
      }
    } catch (err) {
      console.error('[HUB] activate-free error:', err)
      setActivating(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f5f7]">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 shadow-sm">
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
          <div className="w-px h-7 bg-neutral-300" />
          <p className="text-sm font-medium text-neutral-500">
            Seus módulos
          </p>
        </div>
      </header>

      {/* Cards */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {PRODUCTS.map(product => {
            const licensed = hasLicense(product.id)
            const freeColors = FREE_CTA_COLORS[product.id]
            const isActivating = activating === product.id

            return (
              <div
                key={product.id}
                className="relative rounded-2xl overflow-hidden transition-all duration-300"
                style={{
                  background: licensed ? product.bgActive : product.bgInactive,
                  border: `1.5px solid ${licensed ? product.borderActive : product.borderInactive}`,
                  boxShadow: licensed
                    ? (product.shadowActive ?? '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)')
                    : '0 1px 3px rgba(0,0,0,0.04), 0 2px 6px rgba(0,0,0,0.02)',
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
                      isPaid(product.id) ? (
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-800">
                          Ativo
                        </span>
                      ) : (
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                          Free
                        </span>
                      )
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

                  {/* Buttons */}
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
                    <div className="space-y-2.5">
                      {/* Começar FREE — solid */}
                      <button
                        onClick={() => handleActivateFree(product.id)}
                        disabled={isActivating || activating !== null}
                        className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white transition-all duration-200 disabled:opacity-60"
                        style={{ background: freeColors.bg }}
                        onMouseEnter={e => { if (!isActivating) e.currentTarget.style.background = freeColors.hover }}
                        onMouseLeave={e => { if (!isActivating) e.currentTarget.style.background = freeColors.bg }}
                      >
                        {isActivating ? 'Ativando...' : (FREE_CTA_LABELS[product.id] || 'Começar FREE')}
                      </button>
                    </div>
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
