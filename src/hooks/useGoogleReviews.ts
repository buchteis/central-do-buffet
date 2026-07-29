import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useGoogleReviews = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          const { data } = await supabase
            .from('google_auth')
            .select('auth_code')
            .eq('user_id', user.id)
            .maybeSingle();

          setIsConnected(!!data?.auth_code);
        }
      } catch (error) {
        console.error('Erro ao verificar conexão com Google:', error);
        setIsConnected(false);
      } finally {
        setLoading(false);
      }
    };

    checkConnection();
  }, []);

  return { isConnected, loading };
};
