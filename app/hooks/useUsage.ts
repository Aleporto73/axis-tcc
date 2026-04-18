'use client'

import { useCallback, useEffect, useState } from 'react'

export interface UsageStatus {
  minutes_used: number
  limit: number | null
  is_free: boolean
  limit_reached: boolean
}

/**
 * Hook que consome /api/tcc/transcription/usage.
 * Retorna { data, loading, error, refetch }.
 *
 * Fase 12.2.
 */
export function useUsage() {
  const [data, setData] = useState<UsageStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUsage = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/tcc/transcription/usage')
      if (!res.ok) {
        setError('Falha ao carregar uso')
        setData(null)
        return
      }
      const json = await res.json()
      setData(json)
      setError(null)
    } catch {
      setError('Erro de conexao')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsage()
  }, [fetchUsage])

  return { data, loading, error, refetch: fetchUsage }
}
