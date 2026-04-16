'use client'

import { useEffect, useState } from 'react'

interface Segment {
  index: number
  start: number
  end: number
  text: string
}

interface SegmentBlock {
  timestamp: string
  startSeconds: number
  segments: Segment[]
}

interface TranscriptViewProps {
  transcriptId: string
  fallbackText?: string
}

/**
 * Formata segundos em HH:MM:SS
 */
function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

/**
 * Agrupa segments em blocos de 30 segundos.
 * Block 00:00:00 = segments com start em [0, 30)
 * Block 00:00:30 = segments com start em [30, 60)
 * etc.
 */
function groupByBlocks(segments: Segment[]): SegmentBlock[] {
  const blocks = new Map<number, Segment[]>()

  for (const seg of segments) {
    const blockStart = Math.floor(seg.start / 30) * 30
    if (!blocks.has(blockStart)) {
      blocks.set(blockStart, [])
    }
    blocks.get(blockStart)!.push(seg)
  }

  return Array.from(blocks.entries())
    .sort(([a], [b]) => a - b)
    .map(([startSeconds, segs]) => ({
      timestamp: formatTime(startSeconds),
      startSeconds,
      segments: segs.sort((a, b) => a.start - b.start),
    }))
}

export default function TranscriptView({ transcriptId, fallbackText }: TranscriptViewProps) {
  const [segments, setSegments] = useState<Segment[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!transcriptId) {
      setLoading(false)
      return
    }

    let cancelled = false

    async function fetchSegments() {
      try {
        const res = await fetch(`/api/transcribe/segments/${transcriptId}`)
        if (!res.ok) throw new Error(`${res.status}`)
        const data = await res.json()
        if (!cancelled) {
          setSegments(data.segments || [])
        }
      } catch (err) {
        console.error('[TranscriptView] Erro ao buscar segments:', err)
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchSegments()
    return () => { cancelled = true }
  }, [transcriptId])

  // Loading
  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-3 bg-slate-100 rounded w-20" />
        <div className="h-3 bg-slate-100 rounded w-full" />
        <div className="h-3 bg-slate-100 rounded w-5/6" />
        <div className="h-3 bg-slate-100 rounded w-20 mt-4" />
        <div className="h-3 bg-slate-100 rounded w-full" />
      </div>
    )
  }

  // Sem transcrição
  if (!fallbackText && (!segments || segments.length === 0) && !error) {
    return (
      <p className="text-center text-slate-400 italic py-8">
        Esta sessão não tem transcrição
      </p>
    )
  }

  // Fallback: erro na rota ou segments vazios (transcrição legada)
  if (error || !segments || segments.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <div className="border-l-2 border-slate-200 pl-4">
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
              {fallbackText || 'Transcrição disponível'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Segments agrupados em blocos de 30s
  const blocks = groupByBlocks(segments)

  return (
    <div className="space-y-6">
      {blocks.map((block) => (
        <div key={block.startSeconds}>
          {/* Timestamp + linha separadora */}
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xs text-slate-500 font-mono whitespace-nowrap">
              {block.timestamp}
            </span>
            <div className="flex-1 border-t border-slate-200" />
          </div>

          {/* Bloco de texto */}
          <div className="border-l-2 border-slate-200 pl-4 space-y-2">
            {block.segments.map((seg) => (
              <span key={seg.index} className="block text-sm text-slate-700 leading-relaxed">
                {seg.text}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
