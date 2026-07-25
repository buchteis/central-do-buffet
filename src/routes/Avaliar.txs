import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export default function AvaliarPage() {
  const [clientName, setClientName] = useState('');
  const [npsScore, setNpsScore] = useState<number | null>(null);
  const [ratingFood, setRatingFood] = useState(5);
  const [ratingDrinks, setRatingDrinks] = useState(5);
  const [ratingStaff, setRatingStaff] = useState(5);
  const [ratingPunctuality, setRatingPunctuality] = useState(5);
  const [comments, setComments] = useState('');
  const [improvements, setImprovements] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (npsScore === null) return alert('Por favor, selecione uma nota de 0 a 10.');

    setLoading(true);
    const { error } = await supabase.from('feedbacks').insert([
      {
        client_name: clientName,
        nps_score: npsScore,
        rating_food: ratingFood,
        rating_drinks: ratingDrinks,
        rating_staff: ratingStaff,
        rating_punctuality: ratingPunctuality,
        comments,
        improvements,
      },
    ]);

    setLoading(false);
    if (error) {
      alert('Erro ao enviar feedback: ' + error.message);
    } else {
      setSubmitted(true);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md text-center space-y-4">
          <div className="text-5xl">🎉</div>
          <h2 className="text-2xl font-bold text-gray-800">Obrigado pelo seu feedback!</h2>
          <p className="text-gray-600 text-sm">Sua opinião é fundamental para evoluirmos nossos eventos.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 flex justify-center">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-md max-w-lg w-full space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-gray-900">Como foi sua experiência?</h1>
          <p className="text-sm text-gray-500">Sua avaliação nos ajuda a melhorar!</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Seu Nome *</label>
          <input
            type="text"
            required
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className="w-full p-2.5 border border-gray-300 rounded-lg"
            placeholder="Ex: João Silva"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">De 0 a 10, o quanto você indicaria nosso Buffet? *</label>
          <div className="grid grid-cols-11 gap-1">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setNpsScore(num)}
                className={`py-2 rounded-lg text-xs font-bold ${
                  npsScore === num ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-semibold text-gray-800">Avalie os quesitos (1 a 5 estrelas):</h3>
          {[
            { label: '🥩 Comida e Cardápio', val: ratingFood, set: setRatingFood },
            { label: '🍻 Bebidas', val: ratingDrinks, set: setRatingDrinks },
            { label: '👨‍🍳 Atendimento da Equipe', val: ratingStaff, set: setRatingStaff },
            { label: '⏱️ Pontualidade e Organização', val: ratingPunctuality, set: setRatingPunctuality },
          ].map((item, idx) => (
            <div key={idx} className="flex justify-between items-center text-sm">
              <span className="text-gray-600">{item.label}</span>
              <select
                value={item.val}
                onChange={(e) => item.set(Number(e.target.value))}
                className="p-1 border border-gray-300 rounded-md bg-white font-medium"
              >
                {[5, 4, 3, 2, 1].map((s) => (
                  <option key={s} value={s}>{s} ★</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Elogios / O que mais gostou?</label>
          <textarea
            rows={2}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            className="w-full p-2.5 border border-gray-300 rounded-lg text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">O que podemos melhorar?</label>
          <textarea
            rows={2}
            value={improvements}
            onChange={(e) => setImprovements(e.target.value)}
            className="w-full p-2.5 border border-gray-300 rounded-lg text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl"
        >
          {loading ? 'Enviando...' : 'Enviar Feedback'}
        </button>
      </form>
    </div>
  );
}
