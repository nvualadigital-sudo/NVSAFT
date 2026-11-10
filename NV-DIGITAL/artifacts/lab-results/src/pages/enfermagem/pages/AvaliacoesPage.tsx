import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useWardContext } from "../WardContext";
import { clinicalInput, clinicalRecord } from "../clinical";
import ClinicalHistory from "../components/ClinicalHistory";
import { nowLocal } from "../shared";
export default function AvaliacoesPage() {
  const { selected, author, apply, setMessage } = useWardContext();
  const [f, setF] = useState({
    when: nowLocal(),
    type: "Risco de queda",
    tool: "",
    result: "",
    measures: "",
    note: "",
    next: "",
  });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  async function save() {
    try {
      if (!selected) throw new Error("Seleccione um paciente.");
      if (![f.tool, f.result, f.measures].every((v) => v.trim()))
        throw new Error(
          "Identifique o instrumento/protocolo, resultado e medidas definidas.",
        );
      if (f.next && new Date(f.next) <= new Date(f.when))
        throw new Error("A reavaliação deve ocorrer depois do registo.");
      const e = clinicalRecord(
        selected.idEnf,
        author,
        "avaliacao",
        f.type,
        f.note,
        f.when,
        {
          instrumento: f.tool,
          resultado: f.result,
          medidas: f.measures,
          reavaliacao: f.next,
        },
      );
      await apply((p) => ({ ...p, events: [...p.events, e] }));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Falha no registo.");
    }
  }
  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border bg-white p-4">
        <h3 className="font-bold">Avaliações e prevenção de riscos</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm">
            Avaliação
            <select
              className={clinicalInput}
              value={f.type}
              onChange={(e) => set("type", e.target.value)}
            >
              {[
                "Risco de queda",
                "Risco de lesão por pressão",
                "Estado de consciência",
                "Dispositivos / acessos",
                "Mobilidade e dependência",
                "Nutrição e deglutição",
                "Outra avaliação",
              ].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Data/hora
            <input
              className={clinicalInput}
              type="datetime-local"
              value={f.when}
              onChange={(e) => set("when", e.target.value)}
            />
          </label>
          {(["tool", "result"] as const).map((key, i) => (
            <label className="text-sm" key={key}>
              {
                [
                  "Instrumento e versão (ex.: Morse, Braden, Glasgow)",
                  "Resultado e classificação atribuída pelo profissional",
                ][i]
              }
              <input
                className={clinicalInput}
                value={f[key]}
                onChange={(e) => set(key, e.target.value)}
              />
            </label>
          ))}
          <label className="text-sm">
            Reavaliação
            <input
              className={clinicalInput}
              type="datetime-local"
              value={f.next}
              onChange={(e) => set("next", e.target.value)}
            />
          </label>
        </div>
        <label className="block text-sm">
          Medidas de prevenção / plano de cuidados
          <textarea
            className={clinicalInput}
            value={f.measures}
            onChange={(e) => set("measures", e.target.value)}
          />
        </label>
        <label className="block text-sm">
          Fundamentação e observações
          <textarea
            className={clinicalInput}
            value={f.note}
            onChange={(e) => set("note", e.target.value)}
          />
        </label>
        <p className="text-xs text-slate-600">
          Registo de avaliações realizadas segundo o instrumento adoptado. Não
          calcula nem interpreta automaticamente os escores.
        </p>
        <Button onClick={save}>Guardar avaliação</Button>
      </div>
      <ClinicalHistory kind="avaliacao" />
    </div>
  );
}
