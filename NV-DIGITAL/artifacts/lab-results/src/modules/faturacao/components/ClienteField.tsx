/* ============================================================================
   FICHEIRO EM FALTA — src/components/ClienteField.tsx
   Corrige o erro: Failed to resolve import "../components/ClienteField"
   Guardar exactamente neste caminho: src/components/ClienteField.tsx
   Exporta tudo o que o POSView importa:
   ClienteField, ClienteDoc, criarConsumidorFinal, clienteDePaciente,
   clienteParaDocumento, NOME_CONSUMIDOR_FINAL.
   ============================================================================ */
import React, { useMemo, useState } from "react";
import { Check, Search, UserPlus, UserX, Users, X } from "lucide-react";

export const NOME_CONSUMIDOR_FINAL = "Consumidor Final";

export interface ClienteDoc {
  consumidorFinal: boolean;
  nome: string;
  nif: string;
  telefone: string;
  endereco: string;
  pacienteId?: number | string;
}

export interface ClienteFieldProps {
  value: ClienteDoc;
  onChange: (next: ClienteDoc) => void;
  pacientes?: readonly unknown[];
  onNovoCliente?: () => void;
  exigirIdentificacao?: boolean;
  compacto?: boolean;
}

/* ------------------------------------------------------------------ CSS --- */
const CF_CSS = `
.cf-root{font-size:13px;color:#333;font-family:inherit}
.cf-root *{box-sizing:border-box}
.cf-toggle{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px}
.cf-toggle button{border:1px solid #d7dce3;background:#fff;border-radius:4px;padding:9px 8px;font-size:12px;font-weight:700;color:#5b6470;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:6px;transition:all .12s}
.cf-toggle button:hover{border-color:#9CBEE8;color:#1577EB}
.cf-toggle button.is-active{background:#1577EB;border-color:#1577EB;color:#fff}
.cf-search{position:relative;margin-bottom:8px}
.cf-search svg{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#aab1bc;pointer-events:none}
.cf-search input{width:100%;border:1px solid #d7dce3;border-radius:4px;padding:9px 10px 9px 34px;font-size:12px;font-family:inherit;outline:none;background:#fff;color:#333}
.cf-search input:focus{border-color:#1577EB;box-shadow:0 0 0 3px rgba(21,119,235,.12)}
.cf-list{border:1px solid #e3e6ea;border-radius:4px;max-height:168px;overflow-y:auto;margin-bottom:10px;background:#fff}
.cf-item{width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;background:none;border:none;border-bottom:1px solid #f0f2f5;padding:8px 10px;cursor:pointer;font-family:inherit;text-align:left}
.cf-item:last-child{border-bottom:none}
.cf-item:hover{background:#f8fafd}
.cf-item.is-active{background:#eaf3ff}
.cf-item__nome{font-size:12px;font-weight:700;color:#2f3640}
.cf-item__nif{font-size:10px;color:#9aa1ac;font-family:ui-monospace,Menlo,Consolas,monospace}
.cf-empty{padding:14px;text-align:center;font-size:11px;color:#9aa1ac;line-height:1.6}
.cf-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.cf-field label{display:block;font-size:10px;font-weight:700;color:#5b6470;text-transform:uppercase;letter-spacing:.3px;margin-bottom:4px}
.cf-field input{width:100%;border:1px solid #d7dce3;border-radius:4px;padding:8px 10px;font-size:12px;font-family:inherit;outline:none;background:#fff;color:#333}
.cf-field input:focus{border-color:#1577EB;box-shadow:0 0 0 3px rgba(21,119,235,.12)}
.cf-field input:disabled{background:#fafbfc;color:#9aa1ac}
.cf-field--full{grid-column:1/-1}
.cf-actions{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
.cf-actions button{border:1px solid #d7dce3;background:#fff;border-radius:4px;padding:8px 12px;font-size:11px;font-weight:700;color:#5b6470;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:6px}
.cf-actions button:hover{border-color:#1577EB;color:#1577EB}
.cf-warn{margin-top:8px;font-size:11px;color:#8a5a00;background:#fff8e6;border:1px solid #ffe1a1;border-radius:4px;padding:8px 10px;line-height:1.5}
.cf-note{margin-top:8px;font-size:10px;color:#9aa1ac;line-height:1.5}
`;

/* --------------------------------------------------- leitura defensiva ---- */
function campoTexto(valor: unknown): string {
  if (typeof valor === "string") return valor;
  if (typeof valor === "number") return String(valor);
  return "";
}
function ler(obj: unknown, chave: string): string {
  if (!obj || typeof obj !== "object") return "";
  return campoTexto((obj as Record<string, unknown>)[chave]);
}
function lerId(obj: unknown): number | string | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const id = (obj as Record<string, unknown>).id;
  return typeof id === "number" || typeof id === "string" ? id : undefined;
}

/* --------------------------------------------------------- conversores ---- */
export function criarConsumidorFinal(): ClienteDoc {
  return {
    consumidorFinal: true,
    nome: NOME_CONSUMIDOR_FINAL,
    nif: "",
    telefone: "",
    endereco: "",
  };
}

export function clienteDePaciente(paciente: unknown): ClienteDoc {
  return {
    consumidorFinal: false,
    nome: ler(paciente, "nome") || NOME_CONSUMIDOR_FINAL,
    nif: ler(paciente, "nif"),
    telefone: ler(paciente, "telefone"),
    endereco: ler(paciente, "endereco"),
    pacienteId: lerId(paciente),
  };
}

export function clienteParaDocumento(cliente: ClienteDoc): {
  clienteNome: string;
  clienteNif: string;
  clienteTelefone?: string;
  clienteEndereco?: string;
} {
  const semIdentificacao = cliente.consumidorFinal && !cliente.nif.trim();
  return {
    clienteNome: semIdentificacao || !cliente.nome.trim()
      ? NOME_CONSUMIDOR_FINAL
      : cliente.nome.trim(),
    clienteNif: cliente.nif.trim(),
    clienteTelefone: cliente.telefone.trim() || undefined,
    clienteEndereco: cliente.endereco.trim() || undefined,
  };
}

/* ------------------------------------------------------------ componente -- */
export const ClienteField: React.FC<ClienteFieldProps> = ({
  value, onChange, pacientes, onNovoCliente, exigirIdentificacao = false, compacto = false,
}) => {
  const [busca, setBusca] = useState("");

  const lista = useMemo(() => {
    const query = busca.trim().toLowerCase();
    return (pacientes || [])
      .map((paciente) => ({
        id: lerId(paciente),
        nome: ler(paciente, "nome"),
        nif: ler(paciente, "nif"),
        telefone: ler(paciente, "telefone"),
        endereco: ler(paciente, "endereco"),
      }))
      .filter((item) => item.nome)
      .filter((item) => !query
        || item.nome.toLowerCase().includes(query)
        || item.nif.toLowerCase().includes(query))
      .slice(0, compacto ? 6 : 60);
  }, [pacientes, busca, compacto]);

  const set = (patch: Partial<ClienteDoc>) => onChange({ ...value, ...patch });

  return (
    <div className="cf-root" data-testid="componente-cliente-field">
      <style>{CF_CSS}</style>

      <div className="cf-toggle" role="group" aria-label="Tipo de adquirente">
        <button
          type="button"
          className={value.consumidorFinal ? "is-active" : ""}
          onClick={() => onChange(criarConsumidorFinal())}
          data-testid="button-cf-consumidor"
        >
          <UserX className="w-4 h-4" /> Não é cliente
        </button>
        <button
          type="button"
          className={!value.consumidorFinal ? "is-active" : ""}
          onClick={() => set({
            consumidorFinal: false,
            nome: value.nome === NOME_CONSUMIDOR_FINAL ? "" : value.nome,
          })}
          data-testid="button-cf-registado"
        >
          <Users className="w-4 h-4" /> Cliente registado
        </button>
      </div>

      {!value.consumidorFinal && (
        <>
          <div className="cf-search">
            <Search className="w-4 h-4" />
            <input
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Pesquisar cliente por nome ou NIF..."
              aria-label="Pesquisar cliente registado"
              data-testid="input-cf-busca"
            />
          </div>
          <div className="cf-list">
            {lista.length === 0 ? (
              <div className="cf-empty">
                Nenhum cliente encontrado.
                <br />
                Use «Novo cliente» para cadastrar o adquirente.
              </div>
            ) : (
              lista.map((item, indice) => (
                <button
                  type="button"
                  key={`${item.id ?? item.nome}-${indice}`}
                  className={`cf-item ${value.pacienteId !== undefined && value.pacienteId === item.id ? "is-active" : ""}`}
                  onClick={() => {
                    onChange({
                      consumidorFinal: false,
                      nome: item.nome,
                      nif: item.nif,
                      telefone: item.telefone,
                      endereco: item.endereco,
                      pacienteId: item.id,
                    });
                    setBusca("");
                  }}
                  data-testid={`item-cf-${item.id ?? indice}`}
                >
                  <span style={{ minWidth: 0 }}>
                    <span className="cf-item__nome">{item.nome}</span>
                    <br />
                    <span className="cf-item__nif">{item.nif ? `NIF ${item.nif}` : "sem NIF registado"}</span>
                  </span>
                  {value.pacienteId === item.id && <Check className="w-4 h-4" style={{ color: "#1577EB", flexShrink: 0 }} />}
                </button>
              ))
            )}
          </div>
        </>
      )}

      <div className="cf-grid">
        <div className="cf-field cf-field--full">
          <label htmlFor="cf-nome">Nome / designação</label>
          <input
            id="cf-nome"
            value={value.nome}
            onChange={(event) => set({ nome: event.target.value, consumidorFinal: false })}
            placeholder={value.consumidorFinal ? NOME_CONSUMIDOR_FINAL : "Nome do cliente ou empresa"}
            disabled={value.consumidorFinal}
            data-testid="input-cf-nome"
          />
        </div>
        <div className="cf-field">
          <label htmlFor="cf-nif">NIF</label>
          <input
            id="cf-nif"
            value={value.nif}
            onChange={(event) => set({ nif: event.target.value.replace(/[^0-9A-Za-z]/g, ""), consumidorFinal: false })}
            placeholder="Opcional"
            disabled={value.consumidorFinal}
            style={{ fontFamily: "ui-monospace,Menlo,Consolas,monospace" }}
            data-testid="input-cf-nif"
          />
        </div>
        <div className="cf-field">
          <label htmlFor="cf-tel">Telefone</label>
          <input
            id="cf-tel"
            value={value.telefone}
            onChange={(event) => set({ telefone: event.target.value })}
            placeholder="+244 9XX XXX XXX"
            disabled={value.consumidorFinal}
            data-testid="input-cf-telefone"
          />
        </div>
        <div className="cf-field cf-field--full">
          <label htmlFor="cf-end">Morada</label>
          <input
            id="cf-end"
            value={value.endereco}
            onChange={(event) => set({ endereco: event.target.value })}
            placeholder="Morada / município"
            disabled={value.consumidorFinal}
            data-testid="input-cf-endereco"
          />
        </div>
      </div>

      {exigirIdentificacao && !value.consumidorFinal && !value.nif.trim() && (
        <div className="cf-warn" role="alert">
          Identificação obrigatória: indique o NIF do cliente ou seleccione «Não é cliente».
        </div>
      )}

      <div className="cf-actions">
        {onNovoCliente && (
          <button type="button" onClick={onNovoCliente} data-testid="button-cf-novo">
            <UserPlus className="w-3.5 h-3.5" /> Novo cliente
          </button>
        )}
        <button type="button" onClick={() => onChange(criarConsumidorFinal())} data-testid="button-cf-repor">
          <X className="w-3.5 h-3.5" /> Repor consumidor final
        </button>
      </div>
      <p className="cf-note">
        Sem identificação (NIF), o documento é emitido em nome de «{NOME_CONSUMIDOR_FINAL}» (adquirente que não é cliente).
      </p>
    </div>
  );
};

export default ClienteField;
