'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import { useRole } from './RoleProvider'

// =====================================================
// AXIS TDAH - Sidebar Role-Aware (Multi-Terapeuta)
// Cor primária: #0d7377 (green-teal)
// admin: tudo + Equipe
// supervisor: tudo (sem Equipe)
// terapeuta: Painel, Pacientes (seus), Sessões (suas)
// =====================================================

const TDAH_COLOR = '#0d7377'

export default function SidebarTDAH() {
  const pathname = usePathname()
  const { role, canManageTeam, loading } = useRole()

  const isActive = (path: string) => {
    if (path === '/tdah') return pathname === '/tdah'
    return pathname === path || pathname.startsWith(path + '/')
  }

  // Ícones SVG
  const icons = {
    painel: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
    pacientes: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    sessoes: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    protocolos: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
    relatorios: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    equipe: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    config: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    ajuda: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
        <circle cx="12" cy="17" r=".5" fill="currentColor" stroke="none" />
      </svg>
    ),
  }

  // Itens de navegação baseados no role
  const allNavItems = [
    { href: '/tdah', label: 'Painel', icon: icons.painel, roles: ['admin', 'supervisor', 'terapeuta'] },
    { href: '/tdah/pacientes', label: 'Pacientes', icon: icons.pacientes, roles: ['admin', 'supervisor', 'terapeuta'] },
    { href: '/tdah/sessoes', label: 'Sessões', icon: icons.sessoes, roles: ['admin', 'supervisor', 'terapeuta'] },
    { href: '/tdah/protocolos', label: 'Protocolos', icon: icons.protocolos, roles: ['admin', 'supervisor'] },
    { href: '/tdah/relatorios', label: 'Relatórios', icon: icons.relatorios, roles: ['admin', 'supervisor'] },
    { href: '/tdah/equipe', label: 'Equipe', icon: icons.equipe, roles: ['admin'] },
  ]

  // Filtrar por role
  const navItems = loading
    ? allNavItems.filter(item => item.roles.includes('admin'))
    : allNavItems.filter(item => role && item.roles.includes(role))

  // Estilos dinâmicos com cor TDAH
  const activeClass = (path: string) =>
    isActive(path)
      ? 'shadow-sm'
      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'

  const activeStyle = (path: string) =>
    isActive(path)
      ? { color: TDAH_COLOR, backgroundColor: `${TDAH_COLOR}15` }
      : {}

  const activeIndicatorStyle = { backgroundColor: TDAH_COLOR }

  return (
    <>
      {/* Sidebar Desktop - Colapsada */}
      <aside className="hidden md:flex w-20 bg-white border-r border-slate-100 min-h-screen flex-col items-center py-8 fixed left-0 top-0 z-40">
        {/* Logo + Voltar ao Hub */}
        <Link href="/hub" className="mb-8" title="Voltar ao Hub">
          <div
            className="w-10 h-10 rounded-full border flex items-center justify-center transition-colors bg-white"
            style={{ borderColor: `${TDAH_COLOR}40` }}
          >
            <span className="text-[9px] font-bold tracking-tight" style={{ color: TDAH_COLOR }}>TDAH</span>
          </div>
        </Link>

        {/* Nav Icons */}
        <nav className="flex flex-col items-center gap-4 flex-1">
          {navItems.filter(item => item.href !== '/tdah/equipe' && item.href !== '/tdah/configuracoes').map((item) => (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={`relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 ${activeClass(item.href)}`}
              style={activeStyle(item.href)}
            >
              {isActive(item.href) && (
                <div
                  className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[17px] w-[3px] h-5 rounded-r-full"
                  style={activeIndicatorStyle}
                />
              )}
              {item.icon}
            </Link>
          ))}
        </nav>

        {/* Bottom: Equipe (admin) + Settings + User */}
        <div className="flex flex-col items-center gap-4">
          {canManageTeam && (
            <Link
              href="/tdah/equipe"
              title="Equipe"
              className={`relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 ${activeClass('/tdah/equipe')}`}
              style={activeStyle('/tdah/equipe')}
            >
              {isActive('/tdah/equipe') && (
                <div
                  className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[17px] w-[3px] h-5 rounded-r-full"
                  style={activeIndicatorStyle}
                />
              )}
              {icons.equipe}
            </Link>
          )}
          <Link
            href="/tdah/ajuda"
            title="Ajuda"
            className={`relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 ${activeClass('/tdah/ajuda')}`}
            style={activeStyle('/tdah/ajuda')}
          >
            {isActive('/tdah/ajuda') && (
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[17px] w-[3px] h-5 rounded-r-full"
                style={activeIndicatorStyle}
              />
            )}
            {icons.ajuda}
          </Link>
          <Link
            href="/tdah/configuracoes"
            title="Configurações TDAH"
            className={`relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 ${activeClass('/tdah/configuracoes')}`}
            style={activeStyle('/tdah/configuracoes')}
          >
            {isActive('/tdah/configuracoes') && (
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[17px] w-[3px] h-5 rounded-r-full"
                style={activeIndicatorStyle}
              />
            )}
            {icons.config}
          </Link>
          <UserButton
            afterSignOutUrl="/"
            appearance={{
              elements: {
                avatarBox: "w-9 h-9",
                userButtonPopoverActionButton__manageAccount: {
                  display: 'none'
                }
              }
            }}
          />
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-slate-100 z-40 px-1 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
        <div className="flex justify-around items-center">
          {navItems.filter(item => item.href !== '/tdah/equipe').slice(0, 4).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors min-w-[3.5rem] ${
                isActive(item.href)
                  ? ''
                  : 'text-slate-400'
              }`}
              style={isActive(item.href) ? { color: TDAH_COLOR } : {}}
            >
              {isActive(item.href) && (
                <div
                  className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-0.5 w-5 h-[3px] rounded-b-full"
                  style={activeIndicatorStyle}
                />
              )}
              {item.icon}
              <span className="text-[9px] font-medium leading-none truncate">{item.label}</span>
            </Link>
          ))}
          <Link
            href="/tdah/configuracoes"
            className={`relative flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors min-w-[3.5rem] ${
              isActive('/tdah/configuracoes')
                ? ''
                : 'text-slate-400'
            }`}
            style={isActive('/tdah/configuracoes') ? { color: TDAH_COLOR } : {}}
          >
            {isActive('/tdah/configuracoes') && (
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-0.5 w-5 h-[3px] rounded-b-full"
                style={activeIndicatorStyle}
              />
            )}
            {icons.config}
            <span className="text-[9px] font-medium leading-none">Config</span>
          </Link>
        </div>
      </nav>
    </>
  )
}
