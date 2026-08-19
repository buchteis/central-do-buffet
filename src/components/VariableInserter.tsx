import { useRef, useState } from "react";
import { CONTRACT_VARIABLES } from "@/lib/contract-variables";

type Props = {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string) => void;
  className?: string;
};

/** Seletor "Inserir variável": insere {variavel} na posição do cursor do textarea. */
export default function VariableInserter({ textareaRef, value, onChange, className }: Props) {
  const [last, setLast] = useState<string>("");
  const selectRef = useRef<HTMLSelectElement>(null);

  const insert = (key: string) => {
    if (!key) return;
    const token = `{${key}}`;
    const el = textareaRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + token + value.slice(end);
    onChange(next);
    setLast(key);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
    if (selectRef.current) selectRef.current.value = "";
  };

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className ?? ""}`}>
      <select
        ref={selectRef}
        defaultValue=""
        onChange={(e) => insert(e.target.value)}
        className="h-9 px-2 border border-border rounded-lg bg-background text-xs font-bold"
      >
        <option value="">+ Inserir variável</option>
        {CONTRACT_VARIABLES.map((g) => (
          <optgroup key={g.group} label={g.group}>
            {g.items.map((it) => (
              <option key={it.key} value={it.key}>
                {it.label} — {`{${it.key}}`}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {last && (
        <span className="text-[10px] text-muted-foreground">
          Inserido: <code className="font-mono">{`{${last}}`}</code>
        </span>
      )}
    </div>
  );
}
