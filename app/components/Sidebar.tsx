'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'

export default function Sidebar() {
  const pathname = usePathname()
  
  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/')
  
  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    )},
    { href: '/sessoes', label: 'Sessões', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )},
    { href: '/pacientes', label: 'Pacientes', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    )},
    { href: '/sugestoes', label: 'Sugestões', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )},
    { href: '/ajuda', label: 'Ajuda', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )},
    { href: '/configuracoes', label: 'Configurações', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )},
  ]

  return (
    <>
      {/* Sidebar Desktop - Colapsada */}
      <aside className="hidden md:flex w-20 bg-white border-r border-slate-100 min-h-screen flex-col items-center py-8 fixed left-0 top-0 z-40">
        {/* Logo + Voltar ao Hub */}
        <Link href="/hub" className="mb-12" title="Voltar ao Hub">
          <div className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center hover:border-[#1a1f4e]/40 transition-colors bg-white">
            <span className="text-sm font-bold tracking-tight" style={{ color: '#1a1f4e' }}>TCC</span>
          </div>
        </Link>

        {/* Nav Icons */}
        <nav className="flex flex-col items-center gap-4 flex-1">
          {navItems.slice(0, 4).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={`relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 ${
                isActive(item.href)
                  ? 'text-[#FC608F] bg-[#FC608F]/10 shadow-sm shadow-[#FC608F]/10'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
              }`}
            >
              {isActive(item.href) && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[17px] w-[3px] h-5 bg-[#FC608F] rounded-r-full" />
              )}
              {item.icon}
            </Link>
          ))}
        </nav>

        {/* Bottom: Ajuda + Settings + User */}
        <div className="flex flex-col items-center gap-4">
          <Link
            href="/ajuda"
            title="Ajuda"
            className={`relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 ${
              isActive('/ajuda')
                ? 'text-[#9a9ab8] bg-[#9a9ab8]/10 shadow-sm shadow-[#9a9ab8]/10'
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
            }`}
          >
            {isActive('/ajuda') && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[17px] w-[3px] h-5 bg-[#9a9ab8] rounded-r-full" />
            )}
            {navItems[4].icon}
          </Link>
          <Link
            href="/configuracoes"
            title="Configurações"
            className={`relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 ${
              isActive('/configuracoes')
                ? 'text-[#FC608F] bg-[#FC608F]/10 shadow-sm shadow-[#FC608F]/10'
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
            }`}
          >
            {isActive('/configuracoes') && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[17px] w-[3px] h-5 bg-[#FC608F] rounded-r-full" />
            )}
            {navItems[5].icon}
          </Link>
          <UserButton 
            afterSignOutUrl="/"
            appearance={{
              elements: {
                avatarBox: "w-9 h-9"
              }
            }}
          />
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 z-40 px-2 py-2">
        <div className="flex justify-around items-center">
          {navItems.slice(0, 4).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`relative p-3 rounded-xl transition-colors ${
                isActive(item.href)
                  ? 'text-[#FC608F]'
                  : 'text-slate-400'
              }`}
            >
              {isActive(item.href) && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 w-5 h-[3px] bg-[#FC608F] rounded-b-full" />
              )}
              {item.icon}
            </Link>
          ))}
          <UserButton 
            afterSignOutUrl="/"
            appearance={{
              elements: {
                avatarBox: "w-8 h-8"
              }
            }}
          />
        </div>
      </nav>
    </>
  )
}
