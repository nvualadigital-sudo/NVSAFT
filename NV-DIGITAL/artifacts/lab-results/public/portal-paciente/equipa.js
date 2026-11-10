const app = document.querySelector("#app"),
  feedback = document.querySelector("#feedback");
let token = "",
  user = null,
  overview = null,
  tab = "requests",
  busy = false,
  patients = [];
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const time = (v) =>
  v
    ? new Intl.DateTimeFormat("pt-AO", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Africa/Luanda",
      }).format(new Date(v))
    : "";
const field = (name, label, type = "text", v = "", attrs = "") =>
  `<label>${label}<input name="${name}" type="${type}" value="${esc(v)}" ${attrs}></label>`;
const options = (list, id = "id", name = "nome") =>
  list
    .map((p) => `<option value="${esc(p[id])}">${esc(p[name])}</option>`)
    .join("");
const notice = (s) => `<p class="notice">${s}</p>`;
const empty = (s) => `<p class="empty">${s || "Sem registos."}</p>`;
function toast(s, error = false) {
  feedback.textContent = s;
  feedback.className = "visible" + (error ? " error" : "");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (feedback.className = ""), 10000);
}
async function api(path, body) {
  const r = await fetch("/api" + path, {
      method: body === undefined ? "GET" : "POST",
      cache: "no-store",
      headers: {
        ...(token ? { Authorization: "Bearer " + token } : {}),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    d = await r.json().catch(() => ({ error: "Resposta inválida." }));
  if (!r.ok) {
    if (r.status === 401) {
      token = "";
      user = null;
      login();
    }
    throw new Error(d.error || "A operação não foi confirmada.");
  }
  return d;
}
const staff = (path, body) => api("/hospital/patient-portal" + path, body);
const front = () =>
    ["admin", "gestor", "rececionista"].includes(overview?.role),
  manager = () => ["admin", "gestor"].includes(overview?.role);
function login() {
  app.innerHTML = `<main class="staff-login panel"><span class="eyebrow">NVUALASOFT · Área institucional</span><h1>Equipa da unidade</h1><p class="muted">Entre com a sua conta habitual do NVUALASOFT.</p><form method="post" id="login-form">${field("username", "Utilizador", "text", "", 'required autocomplete="username"')}${field("password", "Palavra-passe", "password", "", 'required autocomplete="current-password"')}<button class="full">Entrar</button></form><p><a href="./index.html">← Portal do paciente</a></p></main>`;
}
async function load() {
  overview = await staff("/overview");
  render();
}
function render() {
  const tabs = [
    ...(front()
      ? [
          ["requests", "Pedidos e associações"],
          ["slots", "Horários"],
          ["appointments", "Consultas"],
          ["recovery", "Recuperação de acesso"],
        ]
      : []),
    ...(overview.role === "medico"
      ? [
          ["documents", "Documentos clínicos"],
          ["appointments", "Consultas"],
        ]
      : []),
    ...(manager()
      ? [
          ["settings", "Configuração"],
          ["audit", "Histórico"],
        ]
      : []),
  ];
  if (!tabs.some((t) => t[0] === tab)) tab = tabs[0]?.[0] || "readonly";
  app.innerHTML = `<header class="staff-header"><div class="brand"><span class="logo">+</span><div><strong>NVUALASOFT</strong><small>Portal do Paciente · Equipa</small></div></div><div class="actions"><span>${esc(user.empresaNome || "")} · ${esc(user.funcionarioNome || user.username)}</span><button class="secondary" data-action="refresh">Actualizar</button><button class="secondary" data-action="logout">Sair</button></div></header><main class="staff-layout"><div class="page-head"><div><span class="eyebrow">Atendimento próximo do paciente</span><h1>Gerir o portal externo</h1><p>As alterações são guardadas na mesma base de dados do NVUALASOFT.</p></div><a href="./index.html" target="_blank" rel="noopener">Abrir portal ↗</a></div>${!overview.unit?.enabled ? notice("O portal desta unidade está desactivado. Um administrador ou gestor deve configurar e activar a unidade na aba Configuração.") : notice(`Portal activo: <a href="./index.html?unidade=${esc(overview.unit.slug)}" target="_blank" rel="noopener">Abrir acesso de ${esc(overview.unit.public_name)}</a>`)}<nav class="tabs">${tabs.map(([id, title]) => `<button class="tab" data-tab="${id}" aria-selected="${tab === id}">${title}</button>`).join("")}</nav><div id="staff-content">${content()}</div></main>`;
  if (tab === "audit") runSectionAudit();
  if (tab === "documents") runDocuments();
  if (tab === "requests") runLinks();
}
function searchForm() {
  return `<form method="post" id="search-form"><label>Pesquisar paciente por nome, BI ou processo<input name="q" required minlength="2" maxlength="100" placeholder="Pesquise antes de criar um novo processo"></label><button class="secondary">Pesquisar processo</button></form><div id="patient-search-results"></div>`;
}
function content() {
  if (tab === "settings") {
    const u = overview.unit;
    return `<section class="panel"><h2>Publicação da unidade</h2><form method="post" id="settings-form"><div class="fields">${field("name", "Nome público", "text", u?.public_name || user.empresaNome, 'required maxlength="150"')}${field("slug", "Identificador no endereço", "text", u?.slug || "", 'required pattern="[a-z0-9][a-z0-9-]{2,49}" maxlength="50" placeholder="ultracardio"')}${field("phone", "Telefone institucional", "tel", u?.phone || "", 'maxlength="80"')}${field("address", "Morada pública", "text", u?.address || "", 'maxlength="300"')}</div><label><input type="checkbox" name="enabled" ${u?.enabled ? "checked" : ""}>Activar acesso externo para esta unidade</label><button>Guardar configuração</button></form>${notice("Só as unidades activadas aparecem ao público. Em produção, o servidor exige HTTPS e PORTAL_ORIGIN igual ao endereço público, sem barra final.")}</section>`;
  }
  if (tab === "requests")
    return `<div class="two-col"><section class="panel"><h2>Pedidos dos pacientes</h2>${overview.requests.length ? overview.requests.map((r) => `<article class="unit-card"><h3>${esc(r.display_name)} · ${esc(r.kind)}</h3><small>${esc(r.username)} · ${esc(time(r.created_at))} · ${esc(r.status)}</small><p class="document-body">${r.kind === "cadastro" ? esc(`Nascimento: ${r.data.birth}\nDocumento: ${r.data.document}\nContacto: ${r.data.phone}\nMorada: ${r.data.address || ""}\nEmail: ${r.data.email || ""}`) : esc(r.data.message)}</p>${r.status === "pendente" ? `<form method="post" class="review-form" data-id="${r.id}" data-kind="${r.kind}">${r.kind === "cadastro" ? field("patientId", "ID do processo existente (use a pesquisa ao lado)", "number", "", 'min="1" step="1"') + '<label class="check"><input type="checkbox" name="identityVerified">Identidade do titular confirmada por canal institucional</label>' : ""}<label>Resposta ao paciente / fundamento<textarea name="response" required maxlength="1000"></textarea></label><div class="actions"><button name="decision" value="approve">${r.kind === "cadastro" ? "Associar processo" : "Concluir pedido"}</button><button class="danger" name="decision" value="reject">Recusar</button>${r.kind === "cadastro" ? '<button class="secondary" name="decision" value="new">Criar novo paciente e associar</button>' : ""}</div>${r.kind === "cadastro" ? '<label class="check"><input type="checkbox" name="newPatientConfirmed">Confirmei que não existe processo anterior (apenas para criar novo paciente)</label>' : ""}</form>` : `<p>${esc(r.response)}</p>`}</article>`).join("") : empty("Não existem pedidos.")}</section><aside><section class="panel"><h2>Encontrar o processo correcto</h2>${searchForm()}${notice("Compare nome, nascimento e documento com o titular. A existência de um BI no pedido não comprova a identidade. Nunca associe processos por semelhança do nome.")}</section><section class="panel"><h2>Associações da unidade</h2><div id="links-list">A carregar…</div></section></aside></div>`;
  if (tab === "slots")
    return `<div class="two-col"><section class="panel"><h2>Horários publicados</h2>${overview.slots.map((s) => `<div class="row"><div><h3>${esc(s.specialty)}</h3><small>${esc(s.clinician)} · ${esc(time(s.starts_at))}</small><small>${esc(s.location)} · ${s.active ? "Disponível para reserva" : "Retirado"}</small></div>${s.active ? `<button class="secondary" data-action="close-slot" data-id="${s.id}">Retirar</button>` : ""}</div>`).join("") || empty()}</section><section class="panel"><h2>Disponibilizar horário</h2><form method="post" id="slot-form"><label>Médico<select name="clinicianId" required><option value="">Seleccionar</option>${options(overview.workers)}</select></label>${field("specialty", "Especialidade", "text", "", 'required maxlength="120"')}${field("location", "Local / gabinete", "text", "", 'required maxlength="200"')}${field("start", "Início · hora de Angola", "datetime-local", "", "required")}${field("end", "Fim · hora de Angola", "datetime-local", "", "required")}<button>Publicar horário</button></form>${notice("Cada horário permite uma marcação. Horários sobrepostos para o mesmo médico são recusados. O calendário externo é próprio e não importa automaticamente a agenda interna antiga.")}</section></div>`;
  if (tab === "appointments")
    return `<section class="panel"><h2>Consultas do portal</h2>${overview.appointments.map((a) => `<article class="unit-card"><h3>${esc(a.nome)} · ${esc(a.specialty)}</h3><small>Processo ID ${a.patient_id} · ${esc(a.clinician)} · ${esc(time(a.starts_at))} · ${esc(a.status)}</small>${a.status === "marcada" && front() ? `<form method="post" class="appointment-form" data-id="${a.id}"><div class="fields"><label>Acção<select name="status"><option value="cancelada">Cancelar</option><option value="realizada">Registar como realizada</option><option value="faltou">Registar falta</option></select></label>${field("reason", "Motivo / registo do atendimento", "text", "", 'required maxlength="1000"')}</div><button class="secondary">Guardar estado</button></form>` : ""}</article>`).join("") || empty()}</section>`;
  if (tab === "recovery")
    return `<section class="panel"><h2>Recuperação de acesso</h2>${notice("Confirme a identidade usando os procedimentos da unidade e o contacto já verificado no processo. Não confie apenas no contacto escrito neste pedido. O código é mostrado uma vez e deve ser entregue ao titular por canal confirmado.")}<div id="reset-output"></div>${overview.recovery.map((q) => `<article class="unit-card"><h3>${esc(q.username)}</h3><small>Contacto informado: ${esc(q.contact)} · ${esc(time(q.created_at))}</small><form method="post" class="recovery-form" data-id="${q.id}">${field("reason", "Fundamento da verificação", "text", "", 'required maxlength="1000"')}<label><input type="checkbox" name="identityVerified" required>Confirmei a identidade por canal institucional</label><button>Emitir código de recuperação</button></form></article>`).join("") || empty("Sem pedidos pendentes.")}</section>`;
  if (tab === "documents")
    return `<div class="two-col"><section class="panel"><h2>Disponibilizar documento ao paciente</h2>${notice("A publicação exige uma conta individual de médico com credencial profissional verificada e vigente no NVUALASOFT. O portal não cria assinatura digital certificada.")}<form method="post" id="document-form">${field("patientId", "ID do paciente nesta unidade", "number", "", 'required min="1" step="1"')}<label>Tipo<select name="kind"><option value="resumo">Resumo clínico para o paciente</option><option value="receita">Receita / orientação emitida pelo médico</option></select></label>${field("title", "Título", "text", "", 'required maxlength="200"')}<label>Conteúdo revisto pelo médico<textarea name="body" required maxlength="10000"></textarea></label><label><input type="checkbox" required name="confirmed">Conferi o paciente e o conteúdo antes de publicar</label><button>Publicar no portal</button></form></section><section class="panel"><h2>Pesquisar paciente</h2>${searchForm()}<h2>Os meus documentos publicados</h2><div id="documents-list">A carregar…</div></section></div>`;
  if (tab === "audit")
    return '<section class="panel"><h2>Histórico de acessos e operações</h2><div id="audit-list">A carregar…</div></section>';
  return `<section class="panel"><h2>Resultados laboratoriais</h2><p>Os resultados são disponibilizados pelo circuito existente do NVUALASOFT, após libertação e validação. Continue a utilizar o módulo de laboratório para registar e validar os exames.</p><a href="/">Abrir NVUALASOFT</a></section>`;
}
async function runSectionAudit() {
  try {
    const rows = await staff("/audit");
    const target = document.querySelector("#audit-list");
    if (target)
      target.innerHTML =
        rows
          .map(
            (r) =>
              `<div class="row"><div><h3>${esc(r.action)}</h3><small>${esc(r.actor)} · ${esc(time(r.created_at))}</small><small>Referência: ${esc(r.reference)}</small></div></div>`,
          )
          .join("") || empty();
  } catch (e) {
    toast(e.message, true);
  }
}
async function runLinks() {
  try {
    const rows = await staff("/links");
    const target = document.querySelector("#links-list");
    if (target)
      target.innerHTML =
        rows
          .map(
            (l) =>
              `<div class="row"><div><h3>${esc(l.nome)}</h3><small>${esc(l.username)} · Processo ${esc(l.processo)} (ID ${l.patient_id})</small><small>${l.active ? "Activa" : "Revogada"} · ${esc(l.verified_by)}</small></div>${l.active && manager() ? `<button class="danger" data-action="revoke-link" data-id="${l.account_id}">Revogar</button>` : ""}</div>`,
          )
          .join("") || empty();
  } catch (e) {
    toast(e.message, true);
  }
}
async function runDocuments() {
  try {
    const rows = await staff("/documents");
    const target = document.querySelector("#documents-list");
    if (target)
      target.innerHTML =
        rows
          .map(
            (d) =>
              `<div class="row"><div><h3>${esc(d.title)}</h3><small>${esc(d.nome)} · ${esc(time(d.created_at))}${d.revoked_at ? " · Retirado" : ""}</small></div>${!d.revoked_at ? `<button class="danger" data-action="revoke-document" data-id="${d.id}">Retirar</button>` : ""}</div>`,
          )
          .join("") || empty();
  } catch (e) {
    toast(e.message, true);
  }
}
async function run(fn) {
  if (busy) return;
  busy = true;
  app.inert = true;
  app.setAttribute("aria-busy", "true");
  try {
    await fn();
  } catch (e) {
    toast(e.message, true);
  } finally {
    busy = false;
    app.inert = false;
    app.removeAttribute("aria-busy");
  }
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.tab) {
    tab = b.dataset.tab;
    render();
    return;
  }
  if (!b.dataset.action) return;
  run(async () => {
    if (b.dataset.action === "refresh") await load();
    if (b.dataset.action === "logout") {
      try {
        await api("/auth/logout", {});
      } finally {
        token = "";
        user = null;
        overview = null;
        login();
      }
    }
    if (b.dataset.action === "close-slot") {
      if (!confirm("Retirar este horário das opções de marcação?")) return;
      await staff(`/slots/${b.dataset.id}/close`, {});
      await load();
      toast("Horário retirado.");
    }
    if (b.dataset.action === "revoke-link") {
      const reason = prompt("Motivo da revogação da associação:");
      if (!reason) return;
      await staff("/links/revoke", { accountId: b.dataset.id, reason });
      await load();
      toast("Associação revogada.");
    }
    if (b.dataset.action === "revoke-document") {
      const reason = prompt("Motivo da retirada do documento:");
      if (!reason) return;
      await staff(`/documents/${b.dataset.id}/revoke`, { reason });
      await load();
      toast("Documento retirado do portal.");
    }
  });
});
document.addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.target,
    d = Object.fromEntries(new FormData(f)),
    decision = e.submitter?.value;
  run(async () => {
    if (f.id === "login-form") {
      const s = await api("/auth/login", d);
      if (s.role !== "empresa")
        throw new Error("Entre com uma conta institucional.");
      token = s.token;
      user = s;
      await load();
      return;
    }
    if (f.id === "search-form") {
      patients = await staff("/patients?q=" + encodeURIComponent(d.q));
      document.querySelector("#patient-search-results").innerHTML =
        patients
          .map(
            (p) =>
              `<div class="row"><div><h3>${esc(p.nome)} · ID ${p.id}</h3><small>Nascimento: ${esc(p.nasc)} · Processo: ${esc(p.processo)} · BI: ${esc(p.bi)}</small></div></div>`,
          )
          .join("") || empty("Nenhum processo encontrado.");
      return;
    }
    if (f.id === "settings-form")
      await staff("/settings", { ...d, enabled: d.enabled === "on" });
    if (f.id === "slot-form")
      await staff("/slots", {
        ...d,
        start: d.start + ":00+01:00",
        end: d.end + ":00+01:00",
      });
    if (f.id === "document-form") {
      if (!confirm("Disponibilizar este documento ao paciente indicado?"))
        return;
      await staff("/documents", { ...d, patientId: Number(d.patientId) });
    }
    if (f.classList.contains("review-form")) {
      if (decision === "new") {
        if (
          !confirm(
            "Criar um novo cadastro na unidade e associar ao titular verificado?",
          )
        )
          return;
        await staff(`/requests/${f.dataset.id}/create-patient`, {
          ...d,
          identityVerified: d.identityVerified === "on",
          newPatientConfirmed: d.newPatientConfirmed === "on",
        });
      } else {
        if (
          decision === "approve" &&
          f.dataset.kind === "cadastro" &&
          !Number(d.patientId)
        )
          throw new Error("Pesquise e indique o ID do processo correcto.");
        await staff(`/requests/${f.dataset.id}/review`, {
          ...d,
          approve: decision === "approve",
          patientId: Number(d.patientId),
          identityVerified: d.identityVerified === "on",
        });
      }
    }
    if (f.classList.contains("appointment-form"))
      await staff(`/appointments/${f.dataset.id}/status`, d);
    if (f.classList.contains("recovery-form")) {
      const result = await staff(`/recovery/${f.dataset.id}/token`, {
        ...d,
        identityVerified: d.identityVerified === "on",
      });
      await load();
      document.querySelector("#reset-output").innerHTML =
        `<p class="notice">${esc(result.message)}</p><div class="recovery-code">${esc(result.token)}</div>`;
      return;
    }
    await load();
    toast("Operação confirmada pelo servidor.");
  });
});
login();
