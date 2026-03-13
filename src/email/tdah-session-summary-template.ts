export function tdahSessionSummaryTemplate({
  patientName,
  sessionDate,
  sessionContext,
  durationMinutes,
  therapistName,
  content,
  clinicName,
}: {
  patientName: string
  sessionDate: string
  sessionContext?: string
  durationMinutes?: number
  therapistName?: string
  content: string
  clinicName?: string
}) {
  const clinic = clinicName || 'AXIS TDAH'
  const date = new Date(sessionDate).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const contextLabels: Record<string, string> = {
    clinical: '🏥 Clínico',
    home: '🏠 Domiciliar',
    school: '🏫 Escolar',
  }
  const contextLabel = sessionContext ? contextLabels[sessionContext] || sessionContext : ''

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Resumo da Sessão TDAH</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr><td style="background:#0d7377;padding:24px 28px;">
          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.7);letter-spacing:1px;text-transform:uppercase;">${clinic}</p>
          <h1 style="margin:4px 0 0;font-size:20px;font-weight:300;color:#ffffff;">Resumo da Sessão</h1>
          <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.85);">${patientName} · ${date}</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:24px 28px;">
          <div style="margin-bottom:16px;">
            ${contextLabel ? `<span style="font-size:12px;color:#0d7377;background:rgba(13,115,119,0.08);padding:4px 10px;border-radius:20px;margin-right:8px;">${contextLabel}</span>` : ''}
            ${durationMinutes ? `<span style="font-size:12px;color:#64748b;background:#f1f5f9;padding:4px 10px;border-radius:20px;margin-right:8px;">⏱ ${durationMinutes} min</span>` : ''}
            ${therapistName ? `<span style="font-size:12px;color:#64748b;background:#f1f5f9;padding:4px 10px;border-radius:20px;">👤 ${therapistName}</span>` : ''}
          </div>
          <div style="margin:16px 0;">
            <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#334155;">Como foi a sessão</p>
            <p style="margin:0;font-size:14px;color:#475569;line-height:1.7;white-space:pre-wrap;">${content}</p>
          </div>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 28px;border-top:1px solid #f1f5f9;">
          <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6;">Este resumo foi revisado e aprovado pelo terapeuta responsável antes do envio. ${clinic} · As informações clínicas detalhadas são mantidas em sigilo conforme LGPD.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
