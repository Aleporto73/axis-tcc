'use client'
import { SignUp } from '@clerk/nextjs'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function SignUpForm() {
  const searchParams = useSearchParams()
  const produto = searchParams.get('produto')
  const inviteEmail = searchParams.get('invite_email')

  // Redireciona para o contexto correto:
  // ?produto=aba → direto para ABA (veio da landing ABA ou convite de equipe)
  // ?produto=tcc → direto para TCC
  // ?produto=tdah → direto para TDAH
  // sem param → /hub (usuário escolhe baseado nas licenças)
  const redirectUrl =
    produto === 'aba' ? '/aba/dashboard' :
    produto === 'tcc' ? '/dashboard' :
    produto === 'tdah' ? '/tdah/dashboard' :
    '/hub'

  return (
    <SignUp
      appearance={{
        elements: {
          formButtonPrimary: {
            backgroundColor: produto === 'aba' ? '#c46a50' : '#2563EB',
            '&:hover': { backgroundColor: produto === 'aba' ? '#B4532F' : '#1d4ed8' }
          },
          // Quando invite_email está presente, travar visualmente o campo de e-mail.
          // Clerk não expõe prop readonly nativa — usamos CSS para impedir interação.
          // LIMITAÇÃO: usuário técnico pode burlar via DevTools (rede de segurança = with-tenant.ts match por email).
          ...(inviteEmail ? {
            'formFieldInput__emailAddress': {
              pointerEvents: 'none' as const,
              backgroundColor: '#f1f5f9',
              color: '#64748b',
              borderColor: '#e2e8f0',
              cursor: 'not-allowed',
            }
          } : {}),
        }
      }}
      initialValues={inviteEmail ? { emailAddress: inviteEmail } : undefined}
      fallbackRedirectUrl={redirectUrl}
      signInUrl={produto === 'aba' ? '/sign-in?produto=aba' : '/sign-in'}
    />
  )
}

export default function SignUpPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#F8FAFC'
    }}>
      <Suspense fallback={null}>
        <SignUpForm />
      </Suspense>
    </div>
  )
}
