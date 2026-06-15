import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider';

export default function AcceptInvite() {
  const { session, refreshProfile, signOut } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = useMemo(() => searchParams.get('token'), [searchParams]);
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('Securing your agent access...');

  useEffect(() => {
    const acceptInvite = async () => {
      if (!session?.access_token) return;

      if (!token) {
        setStatus('error');
        setMessage('Invite token is missing. Ask your owner to generate a fresh invite link.');
        return;
      }

      setStatus('loading');
      setMessage('Verifying your invite...');

      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/team/accept-invite`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ token }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data.error || 'Invite could not be accepted.');
        }

        await refreshProfile();
        setStatus('success');
        setMessage('You are in. Redirecting to your assigned contacts...');
        window.setTimeout(() => navigate('/contacts', { replace: true }), 1200);
      } catch (error) {
        setStatus('error');
        setMessage(error.message);
      }
    };

    acceptInvite();
  }, [navigate, refreshProfile, session, token]);

  const isLoading = status === 'loading';
  const isSuccess = status === 'success';

  return (
    <div className="flex h-full w-full items-center justify-center bg-surface-bone p-6">
      <div className="w-full max-w-md rounded-[16px] border border-hairline bg-surface-card p-8 text-center shadow-sm">
        <div className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border ${
          isSuccess ? 'border-emerald-200 bg-emerald-50 text-emerald-600' :
          isLoading ? 'border-blue-200 bg-blue-50 text-primary' :
          'border-red-200 bg-red-50 text-red-600'
        }`}>
          {isSuccess ? <CheckCircle2 size={32} /> : isLoading ? <Loader2 size={32} className="animate-spin" /> : <AlertCircle size={32} />}
        </div>

        <div className="mb-2 flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-wide text-primary">
          <ShieldCheck size={16} />
          Agent Invite
        </div>

        <h1 className="mb-3 text-3xl font-bold font-display text-ink">
          {isSuccess ? 'Invite Accepted' : isLoading ? 'Joining Workspace' : 'Invite Needs Attention'}
        </h1>

        <p className="text-sm leading-relaxed text-charcoal">{message}</p>

        {!isLoading && !isSuccess && (
          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => navigate('/', { replace: true })}
              className="button-primary justify-center"
            >
              Go to BroadcastPilot
            </button>
            <button
              type="button"
              onClick={signOut}
              className="button-outline justify-center"
            >
              Use a different account
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
