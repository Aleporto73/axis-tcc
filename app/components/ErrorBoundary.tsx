'use client'

import React, { Component, type ErrorInfo, type ReactNode } from 'react'

// =====================================================
// AXIS ABA — Error Boundary
//
// Captura erros de renderização React nos filhos.
// Mostra mensagem amigável + botão recarregar.
//
// Uso:
//   <ErrorBoundary>
//     <ComponenteQuePodevDarErro />
//   </ErrorBoundary>
//
//   <ErrorBoundary fallback={<MeuFallback />}>
//     ...
//   </ErrorBoundary>
// =====================================================

interface ErrorBoundaryProps {
  children: ReactNode
  /** Componente fallback customizado. Se não fornecido, usa o padrão. */
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[AXIS ErrorBoundary]', error, errorInfo.componentStack)
  }

  handleReload = () => {
    window.location.reload()
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex items-center justify-center min-h-[50vh] px-4">
          <div className="max-w-md w-full text-center">
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-lg font-medium text-slate-800 mb-1">Algo deu errado</h2>
            <p className="text-sm text-slate-400 mb-6">
              Ocorreu um erro inesperado. Tente recarregar a página ou voltar para o painel.
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mb-6 p-3 bg-red-50 rounded-lg text-left">
                <p className="text-xs font-mono text-red-600 break-all">{this.state.error.message}</p>
              </div>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
              >
                Tentar novamente
              </button>
              <button
                onClick={this.handleReload}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-aba-500 text-white hover:bg-aba-500/90 transition-colors"
              >
                Recarregar página
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
