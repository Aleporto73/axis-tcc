'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

// =====================================================
// AXIS ABA - Role Context Provider (Multi-Terapeuta)
// Busca /api/aba/me uma vez e distribui role para toda a UI.
// =====================================================

export type UserRole = 'admin' | 'supervisor' | 'terapeuta'

interface ProfileData {
  id: string
  tenant_id: string
  role: UserRole
  name: string
  email?: string
  crp?: string
  crp_uf?: string
  tenant_name?: string
  tenant_plan?: string
  is_active: boolean
}

interface RoleContextValue {
  profile: ProfileData | null
  role: UserRole | null
  isAdmin: boolean
  isSupervisor: boolean
  isTerapeuta: boolean
  canManageTeam: boolean       // admin only
  canManageProtocols: boolean  // admin + supervisor
  canCreateLearners: boolean   // admin + supervisor
  loading: boolean
}

const RoleContext = createContext<RoleContextValue>({
  profile: null,
  role: null,
  isAdmin: false,
  isSupervisor: false,
  isTerapeuta: false,
  canManageTeam: false,
  canManageProtocols: false,
  canCreateLearners: false,
  loading: true,
})

export function useRole() {
  return useContext(RoleContext)
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch('/api/aba/me')
        if (res.ok) {
          const data = await res.json()
          setProfile(data.profile)
        }
      } catch (err) {
        console.error('[RoleProvider] Erro ao buscar perfil:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [])

  const role = profile?.role ?? null
  const isAdmin = role === 'admin'
  const isSupervisor = role === 'supervisor'
  const isTerapeuta = role === 'terapeuta'

  const value: RoleContextValue = {
    profile,
    role,
    isAdmin,
    isSupervisor,
    isTerapeuta,
    canManageTeam: isAdmin,
    canManageProtocols: isAdmin || isSupervisor,
    canCreateLearners: isAdmin || isSupervisor,
    loading,
  }

  return (
    <RoleContext.Provider value={value}>
      {children}
    </RoleContext.Provider>
  )
}
