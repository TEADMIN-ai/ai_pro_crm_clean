"use client";
import { useAuth } from '@/context/AuthContext';
export function DashboardWorkspaceIdentity({ variant }: { variant: 'sidebar' | 'header' }) {
  const { workspace, loading } = useAuth();
  if (loading) return <div role='status' aria-label='Loading workspace identity'><p className='dashboard-eyebrow'>Workspace</p><div className={variant === 'header' ? 'mt-1 text-lg sm:text-xl font-semibold text-white' : 'mt-2 text-2xl font-semibold text-white'}>Loading Torque Empire workspace...</div></div>;
  const displayName = workspace?.displayName ?? 'Workspace unavailable';
  const typeLabel = workspace?.type ? workspace.type.replace(/_/g, ' ') : 'WORKSPACE';
  const statusLabel = workspace?.status ?? 'UNKNOWN';
  if (variant === 'header') return <div><p className='dashboard-eyebrow'>{displayName}</p><h1 className='mt-1 text-lg font-semibold tracking-[-0.03em] text-white sm:text-xl'>{displayName}</h1><p className='mt-1 text-sm font-medium uppercase tracking-[0.18em] text-slate-400'>{typeLabel} - {statusLabel}</p></div>;
  return <><p className='dashboard-eyebrow'>{displayName}</p><div className='mt-2 text-2xl font-semibold tracking-[-0.04em] text-white'>{displayName}</div><p className='mt-3 text-sm leading-6 text-slate-400'>{typeLabel} workspace - {statusLabel}</p></>;
}
export function DashboardWorkspaceStatus({ governanceLabel, governanceCount }: { governanceLabel: string; governanceCount: number }) {
  const { workspace, loading } = useAuth();
  if (loading) return <div className='rounded-[24px] border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400' role='status'>Loading workspace status...</div>;
  return <div className='rounded-[24px] border border-white/10 bg-white/[0.03] p-4'><p className='text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500'>Workspace</p><p className='mt-3 text-sm font-medium text-slate-100'>{workspace?.displayName ?? 'Workspace unavailable'}</p><p className='mt-1 text-sm leading-6 text-slate-400'>{workspace ? workspace.type.replace(/_/g, ' ') + ' - ' + workspace.status : 'Canonical workspace metadata is unavailable.'}</p><div className='mt-4 flex flex-wrap gap-2'><span className='inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300'>Governance</span><span className='inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300'>{governanceLabel}{governanceCount > 0 ? ' ' + governanceCount : ''}</span></div></div>;
}
