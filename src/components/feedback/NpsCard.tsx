import React from 'react';

interface FeedbackProps {
  clientName: string;
  npsScore: number;
  comments?: string;
  improvements?: string;
  createdAt: string;
}

export const NpsCard: React.FC<FeedbackProps> = ({
  clientName,
  npsScore,
  comments,
  improvements,
  createdAt,
}) => {
  const getBadgeColor = (score: number) => {
    if (score >= 9) return 'bg-green-100 text-green-800 border-green-200';
    if (score >= 7) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  return (
    <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm space-y-3">
      <div className="flex justify-between items-center">
        <h4 className="font-semibold text-gray-800">{clientName}</h4>
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getBadgeColor(npsScore)}`}>
          NPS {npsScore}/10
        </span>
      </div>
      
      {comments && (
        <p className="text-sm text-gray-600 bg-gray-50 p-2.5 rounded-lg italic">
          "{comments}"
        </p>
      )}

      {improvements && (
        <div className="text-xs text-gray-500">
          <strong className="text-gray-700">Sugestão de melhoria:</strong> {improvements}
        </div>
      )}

      <span className="text-[10px] text-gray-400 block text-right">
        {new Date(createdAt).toLocaleDateString('pt-BR')}
      </span>
    </div>
  );
};

