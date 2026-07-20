import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import { 
  Users, 
  UserPlus, 
  CheckCircle2, 
  Copy, 
  Phone, 
  Wallet,
  Briefcase
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/equipe")({
  head: () => ({ meta: [{ title: "Equipe & Freelancers — Central do Buffet" }] }),
  component: EquipePage,
});

function EquipePage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    funcao: "Garçom",
    whatsapp: "",
    tipo_chave_pix: "cpf",
    chave_pix: "",
    valor_diaria_padrao: "",
  });

  // Query para buscar a lista de freelancers
  const { data: equipe = [], isLoading } = useQuery({
    queryKey: ["equipe_freelancers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipe_freelancers")
        .select("*")
        .order("nome", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  // Mutation para cadastrar freelancer
  const createFreelancerMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("equipe_freelancers").insert([
        {
          nome: form.nome,
          funcao: form.funcao,
          whatsapp: form.whatsapp,
          tipo_chave_pix: form.tipo_chave_pix,
          chave_pix: form.chave_pix,
          valor_diaria_padrao: Number(form.valor_diaria_padrao || 0),
        },
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipe_freelancers"] });
      toast.success("Profissional cadastrado com sucesso!");
      setIsModalOpen(false);
      setForm({
        nome: "",
        funcao: "Garçom",
        whatsapp: "",
        tipo_chave_pix: "cpf",
        chave_pix: "",
        valor_diaria_padrao: "",
      });
    },
    onError: (err: any) => {
      toast.error(`Erro ao cadastrar: ${err.message}`);
    },
  });

  const handleCopyPix = (pix: string) => {
    navigator.clipboard.writeText(pix);
    toast.success("Chave Pix copiada!");
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
            <Users className="size-7 text-indigo-600" /> Equipe & Freelancers
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Cadastre e gerencie a equipe externa do seu buffet.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors"
        >
          <UserPlus className="size-4" /> Novo Freelancer
        </button>
      </div>

      {/* Tabela de Profissionais */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Carregando equipe...</div>
        ) : equipe.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            Nenhum profissional cadastrado na sua base.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="p-4">Nome</th>
                  <th className="p-4">Função</th>
                  <th className="p-4">WhatsApp</th>
                  <th className="p-4">Chave Pix</th>
                  <th className="p-4 text-right">Diária Padrão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {equipe.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-4 font-semibold text-slate-800">{f.nome}</td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                        <Briefcase className="size-3" /> {f.funcao}
                      </span>
                    </td>
                    <td className="p-4 text-slate-600">
                      {f.whatsapp ? (
                        <span className="flex items-center gap-1.5">
                          <Phone className="size-3.5 text-emerald-600" /> {f.whatsapp}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-600 bg-slate-50 border px-2 py-1 rounded-md">
                          {f.chave_pix}
                        </span>
                        <button
                          onClick={() => handleCopyPix(f.chave_pix)}
                          className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800"
                          title="Copiar Pix"
                        >
                          <Copy className="size-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="p-4 text-right font-bold text-slate-800">
                      {brl(f.valor_diaria_padrao)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Cadastro */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-800">Cadastrar Freelancer</h2>
            
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createFreelancerMutation.mutate();
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-xs font-semibold text-slate-600">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  className="w-full mt-1 p-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Função</label>
                  <select
                    value={form.funcao}
                    onChange={(e) => setForm({ ...form, funcao: e.target.value })}
                    className="w-full mt-1 p-2.5 border rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="Garçom">Garçom</option>
                    <option value="Cozinheiro">Cozinheiro</option>
                    <option value="Churrasqueiro">Churrasqueiro</option>
                    <option value="Recepcionista">Recepcionista</option>
                    <option value="Limpeza">Limpeza</option>
                    <option value="Servente">Servente</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">WhatsApp</label>
                  <input
                    type="text"
                    value={form.whatsapp}
                    onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                    placeholder="(31) 99999-9999"
                    className="w-full mt-1 p-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Tipo de Chave Pix</label>
                  <select
                    value={form.tipo_chave_pix}
                    onChange={(e) => setForm({ ...form, tipo_chave_pix: e.target.value })}
                    className="w-full mt-1 p-2.5 border rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="cpf">CPF</option>
                    <option value="telefone">Telefone</option>
                    <option value="email">E-mail</option>
                    <option value="chave_aleatoria">Aleatória</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Diária Padrão (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.valor_diaria_padrao}
                    onChange={(e) => setForm({ ...form, valor_diaria_padrao: e.target.value })}
                    placeholder="150.00"
                    className="w-full mt-1 p-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600">Chave Pix</label>
                <input
                  type="text"
                  required
                  value={form.chave_pix}
                  onChange={(e) => setForm({ ...form, chave_pix: e.target.value })}
                  placeholder="Cole a chave Pix aqui"
                  className="w-full mt-1 p-2.5 border rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createFreelancerMutation.isPending}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm"
                >
                  {createFreelancerMutation.isPending ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
          }
              
