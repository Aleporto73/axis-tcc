import Link from 'next/link'

export const metadata = {
  title: 'Política de Privacidade — AXIS',
  description: 'Política de privacidade e proteção de dados do AXIS, em conformidade com a LGPD.',
}

export default function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-200 py-4">
        <div className="max-w-3xl mx-auto px-6">
          <Link href="/" className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
            ← Voltar
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Política de Privacidade</h1>
        <p className="text-sm text-slate-400 mb-10">Última atualização: março de 2026 · Em conformidade com a LGPD (Lei 13.709/2018)</p>

        <div className="prose prose-slate prose-sm max-w-none space-y-8">

          <section>
            <h2 className="text-lg font-semibold text-slate-800">1. Controlador dos Dados</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              A Psiform Tecnologia, operadora da plataforma AXIS, atua como operadora de dados
              nos termos da LGPD. O controlador dos dados clínicos é o profissional de saúde
              (usuário do sistema) e/ou a clínica à qual está vinculado.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800">2. Dados Coletados</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              O AXIS coleta e processa os seguintes tipos de dados:
            </p>
            <p className="text-sm text-slate-600 leading-relaxed mt-2">
              <strong>Dados do profissional:</strong> nome, email, registro profissional (CRP/CFF),
              especialidade, dados da clínica (nome, CNPJ, endereço, telefone).
            </p>
            <p className="text-sm text-slate-600 leading-relaxed mt-2">
              <strong>Dados dos pacientes:</strong> nome, data de nascimento, informações clínicas,
              notas de sessão, registros de eventos terapêuticos, escores evolutivos (CSO-TCC/CSO-ABA),
              transcrições de sessão.
            </p>
            <p className="text-sm text-slate-600 leading-relaxed mt-2">
              <strong>Dados técnicos:</strong> logs de acesso, endereço IP (para segurança), tokens de
              push notification.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800">3. Base Legal</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              O tratamento de dados pessoais é realizado com base no consentimento do titular (Art. 7º, I, LGPD)
              e na tutela da saúde (Art. 7º, VIII, LGPD) para dados sensíveis de saúde. Os dados clínicos
              dos pacientes são tratados exclusivamente para fins de assistência à saúde, sob responsabilidade
              do profissional controlador.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800">4. Finalidade do Tratamento</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Os dados são utilizados para: organização e documentação de sessões e protocolos
              terapêuticos, cálculo de indicadores evolutivos (CSO-TCC e CSO-ABA), geração de
              relatórios clínicos, gestão de agenda e notificações, e suporte ao profissional
              via assistente virtual.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800">5. Compartilhamento</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Os dados clínicos não são compartilhados com terceiros, exceto: com responsáveis legais
              autorizados pelo profissional (quando aplicável, com consentimento registrado), com
              processadores de pagamento (Hotmart — apenas dados de cobrança, nunca dados clínicos),
              e quando exigido por ordem judicial.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800">6. Segurança dos Dados</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Implementamos medidas técnicas e organizacionais para proteger os dados: isolamento
              por tenant (multi-tenancy), autenticação via Clerk com criptografia, registros de
              auditoria imutáveis (append-only), controle de acesso baseado em papéis, soft delete
              com preservação de histórico, e histórico clínico com versionamento de motor.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800">7. Direitos do Titular</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Em conformidade com a LGPD (Art. 18), os titulares dos dados têm direito a: confirmação
              da existência de tratamento, acesso aos dados, correção de dados incompletos ou
              desatualizados, anonimização ou bloqueio de dados desnecessários, portabilidade dos dados,
              eliminação de dados (respeitando obrigações legais de retenção), e revogação do consentimento.
              Para exercer estes direitos, entre em contato pelo email: contato@psiform.com.br
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800">8. Retenção</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Os dados são mantidos enquanto a conta estiver ativa. Após cancelamento, os dados são
              mantidos por 5 anos conforme exigências do CFP para documentação clínica. Dados de
              auditoria e consentimentos são mantidos indefinidamente por questões legais. A exclusão
              de dados utiliza soft delete, preservando a integridade do histórico clínico.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800">9. Cookies e Rastreamento</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              O AXIS utiliza cookies estritamente necessários para autenticação e funcionamento
              do sistema. Não utilizamos cookies de rastreamento, publicidade ou analytics de terceiros.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800">10. Transferência Internacional</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Os dados são armazenados em servidores localizados no Brasil ou em provedores que
              oferecem nível adequado de proteção nos termos da LGPD. Serviços auxiliares
              (autenticação, notificações) podem processar dados em servidores internacionais com
              garantias contratuais de proteção equivalente.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800">11. Alterações</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Esta política pode ser atualizada. Alterações serão comunicadas por email ou
              notificação no sistema. A versão vigente estará sempre disponível nesta página.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800">12. Contato e DPO</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Para questões sobre privacidade e proteção de dados: contato@psiform.com.br
            </p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-slate-200">
          <p className="text-xs text-slate-400">
            © 2026 AXIS — Psiform Tecnologia. Todos os direitos reservados.
          </p>
        </div>
      </main>
    </div>
  )
}
