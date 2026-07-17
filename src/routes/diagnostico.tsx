import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/diagnostico")({
  component: DiagnosticoPage,
});

function DiagnosticoPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-blue-600">🧪 Diagnóstico do Sistema</h1>
      <p className="text-muted-foreground mt-2">Se você está vendo esta página, a rota funcionou!</p>
      
      <div className="mt-6 bg-green-50 border border-green-200 rounded-xl p-4">
        <p className="text-green-700">✅ Rota /diagnostico está funcionando!</p>
      </div>
      
      <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-amber-700">⚠️ Agora vamos adicionar os dados do sistema aqui.</p>
      </div>
    </div>
  );
}
