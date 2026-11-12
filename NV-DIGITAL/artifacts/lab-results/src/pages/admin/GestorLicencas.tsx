import { useCallback, useEffect, useState } from "react";
import { api } from "../../store/api";

type License = {
  empresa_id: string; nome: string; ativo: boolean; modulos: string[];
  plano: string | null; estado: string | null; inicio: string | null; fim: string | null;
  valor_mensal: string | null; observacoes: string | null; situacao: string;
};
const MODULES = [
  ["laboratorial","Laboratório legado"],["hospitalar","Hospitalar legado"],["escolar","Escolar legado"],
  ["comercial","Comércio / POS"],["faturacao","Facturação"],["farmacia","Farmácia"],
  ["laboratorio","Laboratório independente"]
];
const today = () => new Date().toISOString().slice(0, 10);
const dateInput = (value: string | null) => value ? String(value).slice(0,10) : "";
export default function GestorLicencas() {
  const [rows,setRows] = useState<License[]>([]);
  const [selected,setSelected] = useState<string>("");
  const [form,setForm] = useState({plano:"personalizado",estado:"activo",inicio:today(),fim:"",valorMensal:"0",observacoes:"",modulos:[] as string[]});
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState("");
  const [message,setMessage] = useState("");
  const [history,setHistory] = useState<any[]>([]);
  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await api.empresas.licencas()); setError(""); }
    catch (e:any) { setError(e?.message || "Erro ao carregar licenças. Verifique a migração da base de dados."); }
    finally { setLoading(false); }
  },[]);
  useEffect(()=>{void load()},[load]);
  const select = (id:string) => {
    setSelected(id);setHistory([]);setMessage("");setError("");
    const r=rows.find(x=>x.empresa_id===id); if (!r) return;
    setForm({plano:r.plano||"personalizado",estado:r.estado||"activo",
      inicio:dateInput(r.inicio)||today(),fim:dateInput(r.fim),
      valorMensal:r.valor_mensal||"0",observacoes:r.observacoes||"",modulos:r.modulos||[]});
  };
  async function save(e:React.FormEvent) {
    e.preventDefault();
    if (!selected || !form.modulos.length) {setError("Seleccione uma empresa e pelo menos um módulo.");return;}
    setSaving(true);setMessage("");setError("");
    try {
      await api.empresas.guardarLicenca(selected,{...form,valorMensal:Number(form.valorMensal),fim:form.fim||null});
      await load();
      setMessage("Licença e módulos guardados. A alteração ficou registada na auditoria.");
    } catch(e:any) {setError(e?.message||"Não foi possível guardar.");}
    finally{setSaving(false);}
  }
  async function showHistory() {
    if (!selected) return;
    try{setHistory(await api.empresas.auditoriaLicenca(selected));}
    catch(e:any){setError(e?.message||"Falha ao consultar auditoria.");}
  }
  return <section className="rounded-xl border border-border bg-white p-5 shadow-sm space-y-4">
    <div>
      <h2 className="text-base font-bold text-primary">Licenças e Assinaturas — NV-DIGITAL</h2>
      <p className="text-xs text-muted-foreground mt-1">Gestão exclusiva do desenvolvedor. Os registos existentes não são alterados até guardar uma licença.</p>
    </div>
    {loading && <p className="text-sm">A carregar licenças…</p>}
    {error && <p className="text-sm text-red-700 bg-red-50 rounded-lg p-3" role="alert">{error}</p>}
    {message && <p className="text-sm text-green-800 bg-green-50 rounded-lg p-3" role="status">{message}</p>}
    <div className="grid md:grid-cols-3 gap-3">
      <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-600">Empresas</p><strong>{rows.length}</strong></div>
      <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-600">Licenças vigentes</p><strong>{rows.filter(r=>r.situacao==="vigente").length}</strong></div>
      <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-600">Sem licença configurada</p><strong>{rows.filter(r=>r.situacao==="sem_licenca").length}</strong></div>
    </div>
    <form onSubmit={save} className="space-y-4">
      <label className="block text-sm font-semibold">Empresa
        <select className="w-full mt-1 rounded-lg border border-border p-2 bg-white" value={selected} onChange={e=>select(e.target.value)}>
          <option value="">Seleccione uma empresa…</option>
          {rows.map(r=><option key={r.empresa_id} value={r.empresa_id}>{r.nome} — {r.situacao}</option>)}
        </select>
      </label>
      {selected && <>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="text-xs font-medium">Plano
            <select className="w-full mt-1 rounded border p-2" value={form.plano} onChange={e=>setForm({...form,plano:e.target.value})}>
              {["personalizado","comercial","farmacia","laboratorio","clinico","hospitalar"].map(p=><option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium">Estado
            <select className="w-full mt-1 rounded border p-2" value={form.estado} onChange={e=>setForm({...form,estado:e.target.value})}>
              <option value="activo">Activo</option><option value="suspenso">Suspenso</option><option value="cancelado">Cancelado</option>
            </select>
          </label>
          <label className="text-xs font-medium">Início
            <input type="date" className="w-full mt-1 rounded border p-2" value={form.inicio} onChange={e=>setForm({...form,inicio:e.target.value})} required/>
          </label>
          <label className="text-xs font-medium">Fim (opcional)
            <input type="date" className="w-full mt-1 rounded border p-2" value={form.fim} onChange={e=>setForm({...form,fim:e.target.value})}/>
          </label>
        </div>
        <label className="block text-xs font-medium">Valor mensal (AOA)
          <input type="number" min="0" step="0.01" className="w-full mt-1 rounded border p-2" value={form.valorMensal} onChange={e=>setForm({...form,valorMensal:e.target.value})}/>
        </label>
        <fieldset className="border border-border rounded-lg p-3">
          <legend className="text-xs font-bold px-2">Módulos autorizados</legend>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {MODULES.map(([key,label])=><label key={key} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.modulos.includes(key)} onChange={e=>setForm({...form,modulos:e.target.checked?[...form.modulos,key]:form.modulos.filter(m=>m!==key)})}/>
              {label}
            </label>)}
          </div>
        </fieldset>
        <label className="block text-xs font-medium">Observações contratuais
          <textarea className="w-full mt-1 rounded border p-2" value={form.observacoes} maxLength={2000} onChange={e=>setForm({...form,observacoes:e.target.value})}/>
        </label>
        <div className="flex gap-2 flex-wrap">
          <button className="rounded-lg px-4 py-2 bg-primary text-primary-foreground font-semibold" type="submit" disabled={saving}>{saving?"A guardar…":"Guardar licença e módulos"}</button>
          <button className="rounded-lg px-4 py-2 border border-border" type="button" onClick={showHistory}>Ver auditoria</button>
        </div>
        {history.length>0&&<div className="max-h-48 overflow-y-auto text-xs bg-slate-50 rounded-lg p-3 space-y-2">
          {history.map(h=><div key={h.id}>{new Date(h.data).toLocaleString("pt-AO")} — {h.operador} — {h.novo?.estado || "actualização"}</div>)}
        </div>}
      </>}
    </form>
    <p className="text-xs text-amber-800">Aviso: este painel regista contratos e módulos. A cobrança automática e o bloqueio de todas as APIs por licença exigem validação adicional antes da utilização comercial.</p>
  </section>;
}
