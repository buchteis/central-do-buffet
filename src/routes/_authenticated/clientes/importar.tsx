import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { ArrowLeft, Download, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAccess } from "@/hooks/useTenantAccess";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/clientes/importar")({
  head: () => ({ meta: [{ title: "Importar Clientes — Meu Churras" }] }),
  component: ImportClientsPage,
});

type FieldKey = "name" | "phone" | "whatsapp" | "email" | "cpf" | "address" | "city" | "notes";

const FIELDS: { key: FieldKey; label: string; required?: boolean }[] = [
  { key: "name", label: "Nome", required: true },
  { key: "phone", label: "Telefone", required: true },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "email", label: "E-mail" },
  { key: "cpf", label: "CPF" },
  { key: "address", label: "Endereço" },
  { key: "city", label: "Cidade" },
  { key: "notes", label: "Observações" },
];

const AUTO_MATCH: Record<FieldKey, string[]> = {
  name: ["nome", "name", "cliente", "razao social", "razão social"],
  phone: ["telefone", "phone", "tel", "celular", "fone"],
  whatsapp: ["whatsapp", "whats", "wpp", "zap"],
  email: ["email", "e-mail", "mail"],
  cpf: ["cpf", "documento", "doc"],
  address: ["endereco", "endereço", "address", "rua"],
  city: ["cidade", "city", "municipio", "município"],
  notes: ["observacao", "observação", "obs", "notes", "notas", "comentario", "comentário"],
};

type Mapping = Partial<Record<FieldKey, string>>;
type Row = Record<string, unknown>;
type DupStrategy = "skip" | "update";

function normalizeHeader(s: string) {
  return s
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function autoMap(headers: string[]): Mapping {
  const m: Mapping = {};
  const normalized = headers.map((h) => ({ raw: h, n: normalizeHeader(h) }));
  for (const f of FIELDS) {
    const candidates = AUTO_MATCH[f.key];
    const hit = normalized.find((h) => candidates.some((c) => h.n === c || h.n.includes(c)));
    if (hit) m[f.key] = hit.raw;
  }
  return m;
}

function digitsOnly(s: unknown): string {
  return String(s ?? "").replace(/\D/g, "");
}

function ImportClientsPage() {
  const router = useRouter();
  const { data: access } = useTenantAccess();
  const [rows, setRows] = useState<Row[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [strategy, setStrategy] = useState<DupStrategy>("skip");
  const [fileName, setFileName] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; duplicates: number; errors: number; errorDetails: string[] } | null>(null);

  const unmappedHeaders = useMemo(() => {
    const mapped = new Set(Object.values(mapping).filter(Boolean) as string[]);
    return headers.filter((h) => !mapped.has(h));
  }, [headers, mapping]);

  async function handleFile(file: File) {
    setFileName(file.name);
    setResult(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Row>(ws, { defval: "" });
      if (!json.length) {
        toast.error("A planilha está vazia.");
        return;
      }
      const hdrs = Object.keys(json[0]);
      setHeaders(hdrs);
      setRows(json);
      setMapping(autoMap(hdrs));
    } catch (e: any) {
      toast.error("Não foi possível ler o arquivo: " + (e?.message ?? "erro"));
    }
  }

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
      ["nome", "telefone", "whatsapp", "email", "cpf", "endereco", "cidade", "observacoes"],
      ["João Silva", "11987654321", "11987654321", "joao@email.com", "", "Rua A, 100", "São Paulo", ""],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clientes");
    XLSX.writeFile(wb, "modelo-clientes.xlsx");
  }

  async function handleImport() {
    if (!access?.userId || !access?.tenant?.id) {
      toast.error("Sessão inválida.");
      return;
    }
    if (!mapping.name || !mapping.phone) {
      toast.error("Mapeie ao menos os campos Nome e Telefone.");
      return;
    }
    setImporting(true);
    const tenantId = access.tenant.id;
    const ownerId = access.userId;

    // Existing clients for dedupe
    const { data: existing } = await supabase
      .from("clients")
      .select("id, phone, whatsapp, email")
      .eq("tenant_id", tenantId);
    const byPhone = new Map<string, string>();
    const byEmail = new Map<string, string>();
    (existing ?? []).forEach((c: any) => {
      const p = digitsOnly(c.phone);
      const w = digitsOnly(c.whatsapp);
      if (p) byPhone.set(p, c.id);
      if (w) byPhone.set(w, c.id);
      if (c.email) byEmail.set(String(c.email).toLowerCase().trim(), c.id);
    });

    let imported = 0;
    let duplicates = 0;
    let errors = 0;
    const errorDetails: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const get = (k: FieldKey) => {
        const col = mapping[k];
        if (!col) return null;
        const v = r[col];
        const s = v == null ? "" : String(v).trim();
        return s === "" ? null : s;
      };
      const name = get("name");
      const phoneRaw = get("phone");
      const whatsappRaw = get("whatsapp") ?? phoneRaw;
      const email = get("email")?.toLowerCase() ?? null;

      if (!name || !phoneRaw) {
        errors++;
        errorDetails.push(`Linha ${i + 2}: nome ou telefone ausente.`);
        continue;
      }

      const phoneDigits = digitsOnly(phoneRaw);
      const emailKey = email ?? "";
      const dupId =
        (phoneDigits && byPhone.get(phoneDigits)) || (emailKey && byEmail.get(emailKey)) || null;

      const payload: any = {
        owner_id: ownerId,
        tenant_id: tenantId,
        name,
        phone: phoneRaw,
        whatsapp: whatsappRaw,
        email,
        cpf: get("cpf"),
        address: get("address"),
        city: get("city"),
        notes: get("notes"),
        origem: "importacao",
      };
      Object.keys(payload).forEach((k) => payload[k] === null && delete payload[k]);

      if (dupId) {
        if (strategy === "skip") {
          duplicates++;
          continue;
        }
        const { error } = await supabase.from("clients").update(payload).eq("id", dupId);
        if (error) {
          errors++;
          errorDetails.push(`Linha ${i + 2}: ${error.message}`);
        } else {
          duplicates++;
        }
      } else {
        const { data, error } = await supabase.from("clients").insert(payload).select("id").single();
        if (error) {
          errors++;
          errorDetails.push(`Linha ${i + 2}: ${error.message}`);
        } else {
          imported++;
          if (phoneDigits) byPhone.set(phoneDigits, data!.id);
          if (emailKey) byEmail.set(emailKey, data!.id);
        }
      }
    }

    setImporting(false);
    setResult({ imported, duplicates, errors, errorDetails: errorDetails.slice(0, 20) });
    if (imported > 0) toast.success(`${imported} cliente(s) importado(s).`);
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link to="/clientes" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="size-3" /> Voltar para Clientes
          </Link>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mt-2">Importar clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Envie um arquivo XLS, XLSX ou CSV para adicionar clientes em lote.
          </p>
        </div>
        <button
          onClick={downloadTemplate}
          className="inline-flex items-center gap-1 h-9 px-4 rounded-full border border-border text-xs font-bold hover:bg-accent"
        >
          <Download className="size-4" /> Baixar modelo
        </button>
      </div>

      {!rows.length && (
        <label className="block bg-card rounded-2xl border-2 border-dashed border-border p-12 text-center cursor-pointer hover:bg-muted/30 transition">
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <FileSpreadsheet className="size-10 mx-auto text-muted-foreground mb-3" />
          <div className="text-sm font-semibold">Clique para escolher um arquivo</div>
          <div className="text-xs text-muted-foreground mt-1">Formatos aceitos: .xlsx, .xls, .csv</div>
        </label>
      )}

      {rows.length > 0 && !result && (
        <>
          <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold">Arquivo: {fileName}</div>
              <div className="text-xs text-muted-foreground">{rows.length} linha(s) detectada(s)</div>
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                Relacione as colunas
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {FIELDS.map((f) => (
                  <label key={f.key} className="flex items-center gap-2 text-sm">
                    <span className="w-32 text-xs font-semibold">
                      {f.label} {f.required && <span className="text-primary">*</span>}
                    </span>
                    <select
                      value={mapping[f.key] ?? ""}
                      onChange={(e) =>
                        setMapping((m) => ({ ...m, [f.key]: e.target.value || undefined }))
                      }
                      className="flex-1 bg-muted/40 border border-border rounded-md px-2 py-1.5 text-xs"
                    >
                      <option value="">— não importar —</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>

            {unmappedHeaders.length > 0 && (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-xs flex gap-2">
                <AlertTriangle className="size-4 text-amber-600 shrink-0" />
                <div>
                  <div className="font-bold text-amber-700 dark:text-amber-400">
                    Colunas não utilizadas
                  </div>
                  <div className="text-muted-foreground mt-0.5">
                    Os seguintes campos não têm equivalente e serão ignorados:{" "}
                    <span className="font-mono">{unmappedHeaders.join(", ")}</span>
                  </div>
                </div>
              </div>
            )}

            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                Ao encontrar duplicados (por telefone ou e-mail)
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setStrategy("skip")}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${strategy === "skip" ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}
                >
                  Ignorar
                </button>
                <button
                  onClick={() => setStrategy("update")}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${strategy === "update" ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}
                >
                  Atualizar cadastro existente
                </button>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="px-5 py-3 border-b border-border text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Prévia (primeiras 10 linhas)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    {FIELDS.map((f) => (
                      <th key={f.key} className="px-3 py-2 font-bold">
                        {f.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.slice(0, 10).map((r, i) => (
                    <tr key={i}>
                      {FIELDS.map((f) => {
                        const col = mapping[f.key];
                        const v = col ? r[col] : "";
                        return (
                          <td key={f.key} className="px-3 py-2">
                            {v ? String(v) : <span className="text-muted-foreground">—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setRows([]);
                setHeaders([]);
                setMapping({});
                setFileName("");
              }}
              className="h-10 px-4 rounded-full border border-border text-xs font-bold hover:bg-accent"
            >
              Cancelar
            </button>
            <button
              disabled={importing}
              onClick={handleImport}
              className="inline-flex items-center gap-1 h-10 px-5 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-lg shadow-primary/20 disabled:opacity-50"
            >
              <Upload className="size-4" /> {importing ? "Importando…" : `Importar ${rows.length} cliente(s)`}
            </button>
          </div>
        </>
      )}

      {result && (
        <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-6 text-green-600" />
            <div className="text-lg font-bold">Importação concluída</div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-muted/30 p-4 text-center">
              <div className="text-2xl font-extrabold text-primary">{result.imported}</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mt-1">
                Importados
              </div>
            </div>
            <div className="rounded-lg bg-muted/30 p-4 text-center">
              <div className="text-2xl font-extrabold">{result.duplicates}</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mt-1">
                Duplicados
              </div>
            </div>
            <div className="rounded-lg bg-muted/30 p-4 text-center">
              <div className="text-2xl font-extrabold text-destructive">{result.errors}</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mt-1">
                Erros
              </div>
            </div>
          </div>
          {result.errorDetails.length > 0 && (
            <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3">
              <div className="text-xs font-bold mb-1">Detalhes dos erros</div>
              <ul className="text-xs text-muted-foreground space-y-0.5 list-disc pl-4">
                {result.errorDetails.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setRows([]);
                setHeaders([]);
                setMapping({});
                setFileName("");
                setResult(null);
              }}
              className="h-10 px-4 rounded-full border border-border text-xs font-bold hover:bg-accent"
            >
              Importar outro arquivo
            </button>
            <button
              onClick={() => router.navigate({ to: "/clientes" })}
              className="h-10 px-5 rounded-full bg-primary text-primary-foreground text-xs font-bold"
            >
              Ver clientes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
