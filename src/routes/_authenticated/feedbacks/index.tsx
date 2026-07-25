import { createFileRoute } from '@tanstack/react-router';
import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { NpsCard } from '@/components/feedback/NpsCard';

export const Route = createFileRoute('/_authenticated/feedbacks/')({
  component: FeedbacksDashboard,
});

function FeedbacksDashboard() {
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  const fetchFeedbacks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('feedbacks')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setFeedbacks(data);
    }
    setLoading(false);
  };

  const avgNps = feedbacks.length
    ? (feedbacks.reduce((acc, f) => acc + f.nps_score, 0) / feedbacks.length).toFixed(1)
    : '0';

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Qualidade & Feedbacks</h1>
        <p className="text-sm text-gray-500">Acompanhe a satisfação dos clientes em tempo real.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 bg-orange-50 border border-orange-100 rounded-2xl">
          <span className="text-xs font-semibold text-orange-600 uppercase tracking-wider">NPS Médio</span>
          <div className="text-3xl font-black text-orange-600 mt-1">{avgNps} <span className="text-sm font-normal text-gray-500">/ 10</span></div>
        </div>

        <div className="p-5 bg-blue-50 border border-blue-100 rounded-2xl">
          <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Total de Respostas</span>
          <div className="text-3xl font-black text-blue-600 mt-1">{feedbacks.length}</div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-bold text-gray-800">Mural de Opiniões</h3>
        {loading ? (
          <p className="text-sm text-gray-500">Carregando...</p>
        ) : feedbacks.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum feedback recebido ainda.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {feedbacks.map((f) => (
              <NpsCard
                key={f.id}
                clientName={f.client_name}
                npsScore={f.nps_score}
                comments={f.comments}
                improvements={f.improvements}
                createdAt={f.created_at}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default FeedbacksDashboard;
          
