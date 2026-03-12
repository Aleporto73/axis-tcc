import Link from 'next/link'

export const metadata = {
  title: 'Termos de Uso — AXIS',
  description: 'Termos de uso do sistema AXIS, plataforma de gestão clínica para profissionais de saúde.',
}

export default function TermosPage() {
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
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Termos de Uso</h1>
        <p className="text-sm text-slate-400 mb-10">Última atualização: março de 2026</p>

        <div className="prose prose-slate prose-sm max-w-none space-y-8">

          <section>
            <h2 className="text-lg font-semibold text-slate-800">1. Sobre o AXIS</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              O AXIS é uma plataforma de apoio à gestão clínica para profissionais de saúde.
              Inclui os módulos AXIS TCC (Terapia Cognitivo-Comportamental) e AXIS ABA
              (Análise do Comportamento Aplicada). O sistema é desenvolvido e operado pela
              Psiform Tecnologia. O AXIS é uma ferramenta de organização e documentação — não
              substitui o julgamento clínico do profissional responsável.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800">2. Elegibilidade</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              O uso do sistema é destinado a profissionais de saúde com registro ativo em conselho
              profissional competente (CRP, CFF ou equivalente). Ao se cadastrar, o usuário declara
              possuir habilitação profissional válida para atuar na área.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800">3. Conta e Acesso</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Cada profissional deve manter uma única conta. O usuário é responsável por manter suas
              credenciais de acesso em sigilo. O compartilhamento de credenciais é proibido.
              A Psiform reserva-se o direito de suspender contas que violem estes termos.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800">4. Planos e Pagamento</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Cada módulo do AXIS (TCC e ABA) oferece um plano gratuito limitado e planos pagos com
              recursos ampliados. Os pagamentos são processados pela plataforma Hotmart. A cobrança
              é mensal e recorrente. O cancelamento pode ser feito a qualquer momento pelo painel da
              Hotmart, com efeito ao final do período já pago. Não há reembolso proporcional de
              períodos parciais.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800">5. Responsabilidade Clínica</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              O AXIS é uma ferramenta de apoio. Todas as decisões clínicas são de inteira
              responsabilidade do profissional que as realiza. Os cálculos automatizados (como o
              CSO-TCC e o CSO-ABA) são indicadores auxiliares e não devem ser interpretados como
              diagnósticos ou recomendações terapêuticas. O profissional deve sempre exercer seu
              julgamento clínico independente.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800">6. Dados e Privacidade</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              O tratamento de dados pessoais e clínicos está descrito na nossa{' '}
              <Link href="/privacidade" className="text-slate-800 underline hover:text-slate-600">
                Política de Privacidade
              </Link>
              . O uso do sistema implica concordância com ambos os documentos.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800">7. Propriedade Intelectual</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              O sistema AXIS, incluindo seus motores CSO-TCC e CSO-ABA, interface, código e
              documentação, são propriedade da Psiform Tecnologia. É proibida a reprodução,
              engenharia reversa ou redistribuição sem autorização expressa. Os dados clínicos
              inseridos pelo usuário permanecem de propriedade do profissional e de seus pacientes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800">8. Disponibilidade</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              O AXIS é fornecido &quot;como está&quot; (as is). Embora nos esforcemos para manter o sistema
              disponível 24h, não garantimos disponibilidade ininterrupta. Manutenções programadas
              serão comunicadas com antecedência quando possível.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800">9. Limitação de Responsabilidade</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              A Psiform Tecnologia não se responsabiliza por danos diretos ou indiretos decorrentes
              do uso ou impossibilidade de uso do sistema, incluindo perda de dados, decisões clínicas
              baseadas em informações do sistema, ou interrupções de serviço. A responsabilidade
              máxima da Psiform está limitada ao valor pago pelo usuário nos últimos 12 meses.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800">10. Alterações</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Estes termos podem ser atualizados periodicamente. Alterações significativas serão
              comunicadas por email ou notificação no sistema. O uso continuado após alterações
              constitui aceitação dos novos termos.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800">11. Contato</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Para dúvidas sobre estes termos: contato@psiform.com.br
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
