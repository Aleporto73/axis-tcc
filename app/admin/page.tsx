'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Users,
  Shield,
  AlertCircle,
  Loader2,
  CheckCircle,
  Clock,
  XCircle,
  Search
} from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  email: string;
  crp: string;
  crp_uf: string;
  role: string;
  trial_status: string;
  trial_start: string;
  trial_end: string;
  max_patients: number;
  max_sessions: number;
  is_admin: boolean;
  created_at: string;
  patient_count: number;
  session_count: number;
}

export default function AdminPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [search, setSearch] = useState('');
  const router = useRouter();

  useEffect(() => {
    const load = async () => {
      try {
        const tenantRes = await fetch('/api/user/tenant');
        const tenantData = await tenantRes.json();

        if (!tenantData.isAdmin) {
          router.push('/dashboard');
          return;
        }

        setIsAdmin(true);

        const res = await fetch('/api/admin/tenants');
        if (res.ok) {
          const data = await res.json();
          setTenants(data.tenants || []);
        }
      } catch (err) {
        console.error('[ADMIN] Erro:', err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const handleStatusChange = async (tenantId: string, newStatus: string) => {
    try {
      const res = await fetch('/api/admin/tenants', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, trialStatus: newStatus })
      });
      if (res.ok) {
        setTenants(prev => prev.map(t =>
          t.id === tenantId ? { ...t, trial_status: newStatus } : t
        ));
      }
    } catch (err) {
      console.error('[ADMIN] Erro ao atualizar:', err);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-emerald-100 text-emerald-700';
      case 'trial': return 'bg-amber-100 text-amber-700';
      case 'expired': return 'bg-red-100 text-red-700';
      case 'blocked': return 'bg-neutral-200 text-neutral-600';
      default: return 'bg-neutral-100 text-neutral-600';
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'paid': return 'Pago';
      case 'trial': return 'Trial';
      case 'expired': return 'Expirado';
      case 'blocked': return 'Bloqueado';
      default: return status;
    }
  };

  const daysLeft = (end: string) => {
    if (!end) return '-';
    const diff = Math.ceil((new Date(end).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return 'Expirado';
    return `${diff} dias`;
  };

  const filtered = tenants.filter(t =>
    t.name?.toLowerCase().includes(search.toLowerCase()) ||
    t.email?.toLowerCase().includes(search.toLowerCase()) ||
    t.crp?.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="text-neutral-400 hover:text-neutral-600">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
                  <Shield className="w-6 h-6 text-blue-600" /> Painel Admin
                </h1>
                <p className="text-sm text-neutral-500">{tenants.length} profissionais cadastrados</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-4 border border-neutral-200">
            <p className="text-sm text-neutral-500">Total</p>
            <p className="text-2xl font-bold">{tenants.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border border-emerald-200">
            <p className="text-sm text-neutral-500">Pagos</p>
            <p className="text-2xl font-bold text-emerald-600">{tenants.filter(t => t.trial_status === 'paid').length}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border border-amber-200">
            <p className="text-sm text-neutral-500">Em Trial</p>
            <p className="text-2xl font-bold text-amber-600">{tenants.filter(t => t.trial_status === 'trial').length}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border border-red-200">
            <p className="text-sm text-neutral-500">Expirados</p>
            <p className="text-2xl font-bold text-red-600">{tenants.filter(t => t.trial_status === 'expired').length}</p>
          </div>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              type="text"
              placeholder="Buscar por nome, email ou CRP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-neutral-600">Profissional</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-neutral-600">CRP</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-neutral-600">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-neutral-600">Trial</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-neutral-600">Pacientes</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-neutral-600">Sessões</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-neutral-600">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map(t => (
                  <tr key={t.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-neutral-900">{t.name}</p>
                      <p className="text-sm text-neutral-500">{t.email}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-700">
                      {t.crp ? `${t.crp}/${t.crp_uf || ''}` : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${statusColor(t.trial_status)}`}>
                        {statusLabel(t.trial_status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-700">
                      {t.trial_status === 'trial' ? daysLeft(t.trial_end) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-700">
                      {t.patient_count}/{t.max_patients === 999999 ? '∞' : t.max_patients}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-700">
                      {t.session_count}/{t.max_sessions === 999999 ? '∞' : t.max_sessions}
                    </td>
                    <td className="px-4 py-3">
                      {!t.is_admin && (
                        <select
                          value={t.trial_status}
                          onChange={(e) => handleStatusChange(t.id, e.target.value)}
                          className="text-sm border border-neutral-300 rounded px-2 py-1"
                        >
                          <option value="trial">Trial</option>
                          <option value="paid">Pago</option>
                          <option value="expired">Expirado</option>
                          <option value="blocked">Bloqueado</option>
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
