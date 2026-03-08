// =====================================================
// AXIS ABA — Email Templates Pós-Compra
// =====================================================

export function purchaseUpgradeTemplate({
  buyerName,
  planName,
}: {
  buyerName: string
  planName: string
}) {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:32px 16px;">
    <div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
      <div style="background:#B4532F;padding:24px;text-align:center;">
        <h1 style="margin:0;color:#fff;font-size:20px;font-weight:600;">AXIS ABA</h1>
      </div>
      <div style="padding:28px 24px;">
        <p style="margin:0 0 16px;font-size:15px;color:#334155;">Olá, ${buyerName}!</p>
        <p style="margin:0 0 16px;font-size:15px;color:#334155;">
          Seu plano <strong style="color:#B4532F;">${planName}</strong> foi ativado com sucesso.
        </p>
        <p style="margin:0 0 24px;font-size:14px;color:#64748b;">
          Todas as funcionalidades do plano já estão disponíveis na sua conta.
        </p>
        <div style="text-align:center;margin:24px 0;">
          <a href="https://axisclinico.com/aba/dashboard" style="display:inline-block;background:#B4532F;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;">
            Acessar AXIS ABA
          </a>
        </div>
        <p style="margin:24px 0 0;font-size:13px;color:#94a3b8;text-align:center;">
          Dúvidas? Responda este email ou entre em contato pelo suporte.
        </p>
      </div>
      <div style="background:#f8fafc;padding:16px 24px;text-align:center;border-top:1px solid #e2e8f0;">
        <p style="margin:0;font-size:11px;color:#94a3b8;">AXIS ABA · Psiform Tecnologia · axisclinico.com</p>
      </div>
    </div>
  </div>
</body>
</html>`
}

export function purchaseNewUserTemplate({
  buyerName,
  planName,
}: {
  buyerName: string
  planName: string
}) {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:32px 16px;">
    <div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
      <div style="background:#B4532F;padding:24px;text-align:center;">
        <h1 style="margin:0;color:#fff;font-size:20px;font-weight:600;">AXIS ABA</h1>
      </div>
      <div style="padding:28px 24px;">
        <p style="margin:0 0 16px;font-size:15px;color:#334155;">Olá, ${buyerName}!</p>
        <p style="margin:0 0 16px;font-size:15px;color:#334155;">
          Bem-vindo ao <strong style="color:#B4532F;">AXIS ABA</strong>! Sua compra do plano
          <strong>${planName}</strong> foi confirmada.
        </p>
        <div style="background:#fff7ed;border-left:3px solid #B4532F;padding:14px 16px;margin:20px 0;border-radius:0 8px 8px 0;">
          <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#B4532F;">Próximo passo:</p>
          <p style="margin:0;font-size:14px;color:#334155;">
            Você receberá em instantes um <strong>convite por email</strong> para criar sua conta.
            Clique no link do convite e defina sua senha.
          </p>
        </div>
        <p style="margin:16px 0 0;font-size:14px;color:#64748b;">
          Após criar a conta, acesse: <a href="https://axisclinico.com/aba/dashboard" style="color:#B4532F;text-decoration:underline;">axisclinico.com</a>
        </p>
        <p style="margin:24px 0 0;font-size:13px;color:#94a3b8;text-align:center;">
          Dúvidas? Responda este email ou entre em contato pelo suporte.
        </p>
      </div>
      <div style="background:#f8fafc;padding:16px 24px;text-align:center;border-top:1px solid #e2e8f0;">
        <p style="margin:0;font-size:11px;color:#94a3b8;">AXIS ABA · Psiform Tecnologia · axisclinico.com</p>
      </div>
    </div>
  </div>
</body>
</html>`
}
