export function sessionSummaryTemplate({
  learnerName,
  sessionDate,
  durationMinutes,
  therapistName,
  content,
  achievements,
  nextSession,
}: {
  learnerName: string
  sessionDate: string
  durationMinutes?: number
  therapistName?: string
  content: string
  achievements?: string[]
  nextSession?: string
}) {
  const date = new Date(sessionDate).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const achievementsHtml = achievements && achievements.length > 0
    ? `<div style="background:#f0fdf4;border-left:3px solid #22c55e;padding:12px 16px;margin:16px 0;border-radius:0 8px 8px 0;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#16a34a;">⭐ Conquistas desta sessão</p>
        ${achievements.map(a => `<p style="margin:2px 0;font-size:13px;color:#15803d;">• ${a}</p>`).join('')}
      </div>` : ''
  const nextSessionHtml = nextSession
    ? `<div style="background:#fff7ed;border-left:3px solid #C46A2F;padding:12px 16px;margin:16px 0;border-radius:0 8px 8px 0;">
        <p style="margin:0;font-size:13px;color:#9a3412;">📅 Próxima sessão: <strong>${nextSession}</strong></p>
      </div>` : ''

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Resumo da Sessão ABA</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr><td style="background:#C46A2F;padding:24px 28px;">
          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.7);letter-spacing:1px;text-transform:uppercase;">AXIS ABA</p>
          <h1 style="margin:4px 0 0;font-size:20px;font-weight:300;color:#ffffff;">Resumo da Sessão</h1>
          <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.85);">${learnerName} · ${date}</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:24px 28px;">
          <div style="display:flex;gap:16px;margin-bottom:16px;">
            ${durationMinutes ? `<span style="font-size:12px;color:#64748b;background:#f1f5f9;padding:4px 10px;border-radius:20px;">⏱ ${durationMinutes} min</span>` : ''}
            ${therapistName ? `<span style="font-size:12px;color:#64748b;background:#f1f5f9;padding:4px 10px;border-radius:20px;">👤 ${therapistName}</span>` : ''}
          </div>
          ${achievementsHtml}
          <div style="margin:16px 0;">
            <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#334155;">Como foi a sessão</p>
            <p style="margin:0;font-size:14px;color:#475569;line-height:1.7;white-space:pre-wrap;">${content}</p>
          </div>
          ${nextSessionHtml}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 28px;border-top:1px solid #f1f5f9;">
          <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6;">Este resumo foi revisado e aprovado pelo terapeuta responsável antes do envio. AXIS ABA · Motor CSO-ABA v2.6.1 · As informações clínicas detalhadas são mantidas em sigilo conforme LGPD.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
