import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('⏳ Processando autorização...');

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      setStatus('❌ Acesso negado. Tente novamente.');
      setTimeout(() => navigate({ to: '/dashboard' }), 3000);
      return;
    }

    if (!code) {
      setStatus('❌ Código não encontrado.');
      setTimeout(() => navigate({ to: '/dashboard' }), 3000);
      return;
    }

    const saveGoogleAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          setStatus('❌ Usuário não autenticado.');
          setTimeout(() => navigate({ to: '/auth' }), 3000);
          return;
        }

        const { error: upsertError } = await supabase
          .from('google_auth')
          .upsert({
            user_id: user.id,
            auth_code: code,
            updated_at: new Date().toISOString()
          });

        if (upsertError) throw upsertError;

        setStatus('✅ Conexão realizada com sucesso!');
        setTimeout(() => navigate({ to: '/dashboard' }), 2000);

      } catch (error: any) {
        setStatus('❌ Erro: ' + error.message);
        setTimeout(() => navigate({ to: '/dashboard' }), 3000);
      }
    };

    saveGoogleAuth();
  }, [searchParams, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="p-8 bg-white rounded-lg shadow-lg text-center">
        <div className="text-4xl mb-4">
          {status.includes('✅') ? '🎉' : status.includes('❌') ? '😕' : '⏳'}
        </div>
        <h2 className="text-xl font-semibold">{status}</h2>
        <p className="mt-2 text-sm text-gray-500">
          {status.includes('sucesso') && 'Redirecionando...'}
          {status.includes('❌') && 'Você será redirecionado em instantes.'}
        </p>
      </div>
    </div>
  );
}
