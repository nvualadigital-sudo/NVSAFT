import { useEffect, useState } from "react";
import { reqDirect } from "../../store/api";
import { useApp } from "../../store/AppContext";
import { useEnfermagemContext } from "../enfermagem/EnfermagemContext";
import type { AtendEnfermagem } from "../enfermagem/shared";
import { button, Notice } from "../comunicacao/shared";
export default function Chegadas() {
  const { data } = useApp();
  const ctx = useEnfermagemContext();
  const [items, setItems] = useState<any[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    const load = () => {
      const date = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Luanda",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      void reqDirect<any>("GET", "/recepcao?data=" + date)
        .then((x) => {
          if (active)
            setItems(
              x.items.filter(
                (i: any) =>
                  i.destino === "enfermagem" &&
                  ["aguardando", "chamado", "encaminhado"].includes(i.estado),
              ),
            );
        })
        .catch((e) => {
          if (active) setMessage(e.message);
        });
    };
    load();
    const timer = setInterval(load, 20000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  return (
    <section className="space-y-3 rounded-xl border bg-white p-4">
      <h2 className="font-bold">Chegadas da recepção · enfermagem</h2>
      <Notice message={message} />
      {items
        .filter(
          (t) =>
            !ctx.atendimentos.some(
              (a) =>
                (a as AtendEnfermagem & { receptionId?: string })
                  .receptionId === t.id,
            ),
        )
        .map((t) => (
          <article
            className="flex flex-wrap items-center justify-between gap-3 border-t pt-3"
            key={t.id}
          >
            <div>
              <strong>{t.pacienteNome}</strong>
              <p className="text-xs">
                Senha #{t.numero} · {t.processo} · {t.estado}
              </p>
            </div>
            <button
              className={button}
              disabled={busy}
              onClick={async () => {
                const patient = data.pacientes.find(
                  (p) => String(p.id) === t.pacienteId,
                );
                if (!patient) {
                  setMessage(
                    "Paciente não encontrado no cadastro da instituição. Actualize a página.",
                  );
                  return;
                }
                setBusy(true);
                try {
                  await ctx.setAtendimentos((previous) => {
                    if (previous.some((a) => (a as any).receptionId === t.id))
                      throw new Error("Esta chegada já foi recebida.");
                    const now = new Date();
                    const item = {
                      ...ctx.formNovo,
                      idEnf: Math.max(0, ...previous.map((a) => a.idEnf)) + 1,
                      codigoAtendimento:
                        Math.max(
                          0,
                          ...previous.map((a) => a.codigoAtendimento),
                        ) + 1,
                      receptionId: t.id,
                      pacienteId: patient.id,
                      nomePaciente: patient.nome,
                      dataNascimento: patient.nasc,
                      sexo: patient.sexo,
                      alergias: patient.alergias || "Confirmar com o paciente",
                      contacto: patient.telefone || "",
                      motivoAtendimento: "Chegada pela recepção",
                      nomeEnfermeiro: ctx.session.username || "",
                      dataAtendimento: now.toISOString().slice(0, 10),
                      horaAtendimento: now.toTimeString().slice(0, 5),
                    } as AtendEnfermagem;
                    return [...previous, item];
                  });
                  setMessage(
                    "Paciente recebido na enfermagem. Seleccione-o para realizar e registar a triagem.",
                  );
                  ctx.setActiveTab("enfermaria");
                } catch (e) {
                  setMessage(
                    e instanceof Error ? e.message : "Recepção não confirmada.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Receber na enfermagem
            </button>
          </article>
        ))}
    </section>
  );
}
