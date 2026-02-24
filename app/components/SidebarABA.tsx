'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'

export default function SidebarABA() {
  const pathname = usePathname()
  
  const isActive = (path: string) => {
    if (path === '/aba') return pathname === '/aba'
    return pathname === path || pathname.startsWith(path + '/')
  }
  
  const navItems = [
    { href: '/aba', label: 'Painel', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    )},
    { href: '/aba/aprendizes', label: 'Aprendizes', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    )},
    { href: '/aba/sessoes', label: 'Sessões', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )},
    { href: '/aba/pei', label: 'PEI', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    )},
    { href: '/aba/relatorios', label: 'Relatórios', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )},
    { href: '/aba/configuracoes', label: 'Configurações', icon: (
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
          <div className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center hover:border-aba-500/40 transition-colors overflow-hidden bg-white">
            <img src="/favicon_axis.png" alt="AXIS" width={28} height={28} style={{ objectFit: 'contain' }} />
          </div>
        </Link>

        {/* Module Badge */}
        <div className="mb-6 px-2 py-1 rounded-full bg-aba-500/10 border border-aba-500/20">
          <span className="text-[10px] font-semibold text-aba-500 tracking-wider">ABA</span>
        </div>

        {/* Nav Icons */}
        <nav className="flex flex-col items-center gap-4 flex-1">
          {navItems.slice(0, 5).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={`relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 ${
                isActive(item.href)
                  ? 'text-aba-500 bg-aba-500/10 shadow-sm shadow-aba-500/10'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
              }`}
            >
              {isActive(item.href) && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[17px] w-[3px] h-5 bg-aba-500 rounded-r-full" />
              )}
              {item.icon}
            </Link>
          ))}
        </nav>

        {/* Bottom: Settings + User */}
        <div className="flex flex-col items-center gap-4">
          <Link
            href="/aba/configuracoes"
            title="Configurações ABA"
            className={`relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 ${
              isActive('/aba/configuracoes')
                ? 'text-aba-500 bg-aba-500/10 shadow-sm shadow-aba-500/10'
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
            }`}
          >
            {isActive('/aba/configuracoes') && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[17px] w-[3px] h-5 bg-aba-500 rounded-r-full" />
            )}
            {navItems[4].icon}
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
          {navItems.slice(0, 5).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`relative p-3 rounded-xl transition-colors ${
                isActive(item.href)
                  ? 'text-aba-500'
                  : 'text-slate-400'
              }`}
            >
              {isActive(item.href) && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 w-5 h-[3px] bg-aba-500 rounded-b-full" />
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
