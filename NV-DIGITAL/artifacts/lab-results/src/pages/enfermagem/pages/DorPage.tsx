import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useWardContext } from "../WardContext";
import { clinicalInput, clinicalRecord } from "../clinical";
import ClinicalHistory from "../components/ClinicalHistory";
import { nowLocal } from "../shared";
export default function DorPage() {
  const { selected, author, apply, setMessage } = useWardContext();
  const [form, setForm] = useState({
    when: nowLocal(),
    method: "numerica",
    score: "",
    location: "",
    context: "",
    intervention: "",
    recheck: "",
    reason: "",
  });
  const update = (k: keyof typeof form, v: string) =>
    setForm((p) => ({ ...p, [k]: v }));
  const max = form.method === "eva" ? 100 : 10;
  async function save() {
    try {
      if (!selected) throw new Error("Seleccione um paciente.");
      if (
        form.method !== "nao_avaliavel" &&
        (!form.score.trim() ||
          !Number.isFinite(Number(form.score)) ||
          Number(form.score) < 0 ||
          Number(form.score) > max ||
          (form.method === "numerica" && !Number.isInteger(Number(form.score))))
      )
        throw new Error(`Indique uma medição entre 0 e ${max}.`);
      if (form.method === "nao_avaliavel" && !form.reason.trim())
        throw new Error("Indique o motivo pelo qual não foi possível avaliar.");
      if (form.recheck && new Date(form.recheck) <= new Date(form.when))
        throw new Error("A reavaliação deve ser posterior ao registo.");
      const r = clinicalRecord(
        selected.idEnf,
        author,
        "dor",
        "Avaliação / reavaliação da dor",
        form.context,
        form.when,
        {
          metodo:
            form.method === "eva"
              ? "EVA — medição em mm numa linha de 100 mm"
              : form.method === "numerica"
                ? "Escala numérica 0–10"
                : "Não avaliável",
          valor: form.method === "nao_avaliavel" ? "Não avaliado" : form.score,
          unidade:
            form.method === "eva"
              ? "mm"
              : form.method === "numerica"
                ? "pontos"
                : "",
          localizacao: form.location,
          intervencao: form.intervention,
          reavaliacao: form.recheck,
          motivo: form.reason,
        },
      );
      if (await apply((p) => ({ ...p, events: [...p.events, r] })))
        update("score", "");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Falha no registo.");
    }
  }
  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border bg-white p-4">
        <h3 className="font-bold">
          Dor — avaliação e resposta às intervenções
        </h3>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm">
            Método
            <select
              className={clinicalInput}
              value={form.method}
              onChange={(e) =>
                setForm((p) => ({ ...p, method: e.target.value, score: "" }))
              }
            >
              <option value="numerica">Escala numérica (0–10)</option>
              <option value="eva">EVA (0–100 mm)</option>
              <option value="nao_avaliavel">Não foi possível avaliar</option>
            </select>
          </label>
          <label className="text-sm">
            Data/hora
            <input
              className={clinicalInput}
              type="datetime-local"
              value={form.when}
              onChange={(e) => update("when", e.target.value)}
            />
          </label>
          {form.method !== "nao_avaliavel" && (
            <label className="text-sm">
              {form.method === "eva"
                ? "Distância medida na EVA (mm)"
                : "Valor referido pelo paciente (0–10)"}
              <input
                className={clinicalInput}
                type="number"
                min={0}
                max={max}
                step={form.method === "eva" ? "0.1" : "1"}
                value={form.score}
                onChange={(e) => update("score", e.target.value)}
              />
            </label>
          )}
          {(["location", "intervention", "reason"] as const).map((key, i) => (
            <label className="text-sm" key={key}>
              {
                [
                  "Localização",
                  "Intervenção realizada / referência da prescrição",
                  "Motivo de impossibilidade ou observações",
                ][i]
              }
              <input
                className={clinicalInput}
                value={form[key]}
                onChange={(e) => update(key, e.target.value)}
              />
            </label>
          ))}
          <label className="text-sm">
            Reavaliação programada
            <input
              className={clinicalInput}
              type="datetime-local"
              value={form.recheck}
              onChange={(e) => update("recheck", e.target.value)}
            />
          </label>
        </div>
        <p className="text-xs text-slate-600">
          Na EVA, registe a distância efectivamente medida na escala utilizada;
          um campo numérico 0–10 corresponde à escala numérica. Sem avaliação
          não significa dor zero. A pontuação não determina automaticamente a
          triagem ou o tratamento.
        </p>
        <label className="block text-sm">
          Contexto e resposta à intervenção
          <textarea
            className={clinicalInput}
            value={form.context}
            onChange={(e) => update("context", e.target.value)}
          />
        </label>
        <Button onClick={save}>Guardar avaliação da dor</Button>
      </div>
      <ClinicalHistory kind="dor" />
    </div>
  );
}
