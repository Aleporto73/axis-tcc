'use client'

import { useState, useCallback, useEffect } from 'react'
import { HelpTip } from '@/components/Tooltip'

// =====================================================
// AXIS ABA - Anexos de Sessão (v2.7.0 Sprint 1)
//
// Lista e registra metadata de anexos (foto check-in/out,
// documentos, prescrições). Upload real via storage externo.
//
// Bible v2.7.0:
//   - EXIF bruto NUNCA armazenado
//   - Max 10MB, formatos: JPG, PNG, PDF
//   - Hash detecta duplicatas (DUPLICATE_PHOTO flag)
//   - IMUTÁVEL após upload
//
// Integra com: GET/POST /api/aba/attachments
// =====================================================

interface Attachment {
  id: string
  session_id: string
  attachment_type: string
  file_name: string
  file_hash: string
  file_size_bytes: number
  mime_type: string
  uploaded_at: string
}

interface Props {
  sessionId: string
  sessionStatus: string
  canEdit: boolean
}

const TYPE_OPTIONS = [
  { value: 'photo_checkin', label: 'Foto check-in', icon: '📸' },
  { value: 'photo_checkout', label: 'Foto check-out', icon: '📷' },
  { value: 'document', label: 'Documento', icon: '📄' },
  { value: 'prescription', label: 'Prescrição', icon: '💊' },
  { value: 'other', label: 'Outro', icon: '📎' },
] as const

const VALID_MIMES = ['image/jpeg', 'image/png', 'application/pdf']
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function SessionAttachments({ sessionId, sessionStatus, canEdit }: Props) {
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    attachment_type: 'photo_checkin' as string,
    file: null as File | null,
  })

  const isActive = sessionStatus === 'in_progress'
  const isCompleted = sessionStatus === 'completed'

  const fetchAttachments = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/aba/attachments?session_id=${sessionId}`)
      if (res.ok) {
        const data = await res.json()
        setAttachments(data.attachments || [])
      }
    } catch {
      // silencioso na carga
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => { fetchAttachments() }, [fetchAttachments])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!VALID_MIMES.includes(file.type)) {
      setError('Formato inválido. Permitidos: JPG, PNG, PDF')
      return
    }
    if (file.size > MAX_SIZE) {
      setError('Arquivo excede 10MB')
      return
    }

    setError(null)
    setForm({ ...form, file })
  }

  const handleSubmit = async () => {
    if (!form.file) {
      setError('Selecione um arquivo')
      return
    }

    setSaving(true)
    setError(null)

    try {
      // Gerar hash do arquivo no cliente
      const arrayBuffer = await form.file.arrayBuffer()
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const fileHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

      // Registrar metadata (upload real seria via storage separado)
      const res = await fetch('/api/aba/attachments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          attachment_type: form.attachment_type,
          file_name: form.file.name,
          file_hash: fileHash,
          file_size_bytes: form.file.size,
          mime_type: form.file.type,
          storage_path: `sessions/${sessionId}/${fileHash.substring(0, 8)}_${form.file.name}`,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Erro ao registrar anexo')
        setSaving(false)
        return
      }

      const result = await res.json()

      setForm({ attachment_type: 'photo_checkin', file: null })
      setShowForm(false)
      setSaving(false)

      if (result.is_duplicate) {
        setError(`Atenção: arquivo duplicado detectado (sessão ${result.duplicate_in_session})`)
      }

      await fetchAttachments()
    } catch {
      setError('Falha de conexão')
      setSaving(false)
    }
  }

  // Não mostrar se sessão ainda não iniciou
  if (sessionStatus === 'scheduled' || sessionStatus === 'cancelled') {
    return null
  }

  return (
    <div className="mb-4 border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-aba-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
          <h3 className="text-xs font-medium text-slate-600">
            Anexos ({attachments.length})
          </h3>
          <HelpTip tip="presenca_anexos" className="w-3.5 h-3.5 text-[9px]" />
        </div>
        {isActive && canEdit && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="text-[11px] text-aba-500 hover:underline"
          >
            + Anexar
          </button>
        )}
      </div>

      {/* Lista de anexos */}
      {attachments.length > 0 && (
        <div className="space-y-1.5">
          {attachments.map(att => {
            const typeOption = TYPE_OPTIONS.find(t => t.value === att.attachment_type)
            return (
              <div key={att.id} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg">
                <span className="text-xs">{typeOption?.icon || '📎'}</span>
                <span className="text-xs text-slate-700 truncate flex-1">{att.file_name}</span>
                <span className="text-[10px] text-slate-400">{formatFileSize(att.file_size_bytes)}</span>
                <span className="text-[10px] text-slate-400">
                  {new Date(att.uploaded_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {attachments.length === 0 && !loading && !showForm && (
        <p className="text-[11px] text-slate-400">Nenhum anexo registrado</p>
      )}

      {/* Formulário de upload */}
      {showForm && (
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Tipo</label>
              <select
                value={form.attachment_type}
                onChange={e => setForm({ ...form, attachment_type: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500 bg-white"
              >
                {TYPE_OPTIONS.map(t => (
                  <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Arquivo (JPG, PNG, PDF · max 10MB)</label>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                onChange={handleFileSelect}
                className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-aba-500/10 file:text-aba-500 hover:file:bg-aba-500/20"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={saving || !form.file}
              className="px-3 py-1.5 bg-aba-500 text-white text-xs font-medium rounded-lg hover:bg-aba-600 transition-colors disabled:opacity-50"
            >
              {saving ? 'Registrando...' : 'Registrar Anexo'}
            </button>
            <button
              onClick={() => { setShowForm(false); setForm({ attachment_type: 'photo_checkin', file: null }); setError(null) }}
              className="px-3 py-1.5 text-slate-400 text-xs hover:text-slate-600"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-[11px] text-red-500">{error}</p>
      )}
    </div>
  )
}
