import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Star } from 'lucide-react';

interface Review {
  reviewer: {
    displayName: string;
  };
  starRating: number;
  comment: string;
  createTime: string;
}

export const GoogleReviews = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState({ average: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          setLoading(false);
          return;
        }

        const { data: authData } = await supabase
          .from('google_auth')
          .select('auth_code')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!authData) {
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.functions.invoke('get-google-reviews', {
          body: {
            user_id: user.id,
            auth_code: authData.auth_code
          }
        });

        if (error) {
          console.error('Erro ao buscar avaliações:', error);
          setError('Erro ao carregar avaliações');
        } else if (data) {
          setReviews(data.reviews || []);
          setStats({
            average: data.averageRating || 0,
            total: data.totalReviewCount || 0
          });
        }
      } catch (err) {
        console.error('Erro:', err);
        setError('Erro ao carregar avaliações');
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
  }, []);

  if (loading) {
    return <div className="p-4 text-center text-gray-500">Carregando avaliações...</div>;
  }

  if (error) {
    return <div className="p-4 text-center text-red-500">{error}</div>;
  }

  if (!reviews.length) {
    return <div className="p-4 text-center text-gray-500">Nenhuma avaliação encontrada</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg bg-blue-50">
          <p className="text-sm text-gray-600">⭐ Nota Média</p>
          <p className="text-2xl font-bold text-blue-600">
            {stats.average.toFixed(1)} ★
          </p>
        </div>
        <div className="p-4 rounded-lg bg-green-50">
          <p className="text-sm text-gray-600">📝 Total Avaliações</p>
          <p className="text-2xl font-bold text-green-600">{stats.total}</p>
        </div>
        <div className="p-4 rounded-lg bg-purple-50">
          <p className="text-sm text-gray-600">📊 Última Avaliação</p>
          <p className="text-sm font-medium">
            {reviews[0]?.createTime
              ? new Date(reviews[0].createTime).toLocaleDateString('pt-BR')
              : '-'}
          </p>
        </div>
      </div>

      <div className="p-6 bg-white rounded-lg shadow">
        <h3 className="mb-4 text-lg font-semibold">📋 Últimas Avaliações</h3>
        <div className="space-y-4">
          {reviews.slice(0, 10).map((review, index) => (
            <div key={index} className="pb-4 border-b last:border-0">
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-semibold">
                    {review.reviewer?.displayName || 'Anônimo'}
                  </span>
                  <div className="flex mt-1 text-yellow-500">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${i < review.starRating ? 'fill-yellow-500' : 'fill-gray-300'}`}
                      />
                    ))}
                  </div>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(review.createTime).toLocaleDateString('pt-BR')}
                </span>
              </div>
              {review.comment && (
                <p className="mt-2 text-sm text-gray-600">{review.comment}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
