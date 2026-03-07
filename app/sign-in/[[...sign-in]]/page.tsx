'use client'
import { SignIn } from '@clerk/nextjs'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function SignInForm() {
  const searchParams = useSearchParams()
  const produto = searchParams.get('produto')

  // Redireciona para o contexto correto:
  // ?produto=aba → direto para ABA (veio da landing ABA)
  // ?produto=tcc → direto para TCC
  // sem param → /hub (usuário escolhe baseado nas licenças)
  const redirectUrl = produto === 'aba' ? '/aba/dashboard' : produto === 'tcc' ? '/dashboard' : '/hub'

  return (
    <SignIn
      appearance={{
        elements: {
          formButtonPrimary: {
            backgroundColor: produto === 'aba' ? '#c46a50' : '#2563EB',
            '&:hover': { backgroundColor: produto === 'aba' ? '#B4532F' : '#1d4ed8' }
          }
        }
      }}
      fallbackRedirectUrl={redirectUrl}
      signUpUrl={produto === 'aba' ? '/sign-up?produto=aba' : '/sign-up'}
    />
  )
}

export default function SignInPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#F8FAFC'
    }}>
      <Suspense fallback={null}>
        <SignInForm />
      </Suspense>
    </div>
  )
}
