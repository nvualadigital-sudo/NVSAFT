const app = document.querySelector("#app"),
  feedback = document.querySelector("#feedback"),
  detail = document.querySelector("#detail");
let formDirty = false,
  lastActivity = Date.now();
let csrf = "",
  session = null,
  units = [],
  unitId = "",
  page = "home",
  data = null,
  slots = [],
  authTab = "login",
  busy = false,
  sequence = 0,
  lastResultIds = null,
  alertEnabled = false;
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
const money = (v) =>
  new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA" }).format(
    Number(v || 0),
  );
const badge = (s) => `<span class="badge ${esc(s)}">${esc(s)}</span>`;
const empty = (s = "Ainda não existem registos disponíveis.") =>
  `<div class="empty">${esc(s)}</div>`;
const brand = `<div class="brand"><span class="logo" aria-hidden="true">+</span><div><strong>NVUALASOFT</strong><small>Portal do Paciente</small></div></div>`;
const field = (name, label, type = "text", extra = "") =>
  `<label>${label}<input name="${name}" type="${type}" ${extra}></label>`;
const unitField = () =>
  `<label>Unidade de saúde<select name="unitId" required><option value="">Seleccionar unidade</option>${units.map((u) => `<option value="${esc(u.id)}" ${u.slug === new URLSearchParams(location.search).get("unidade") ? "selected" : ""}>${esc(u.name)}</option>`).join("")}</select></label>`;
const identityFields = () =>
  `${field("name", "Nome completo", "text", 'required maxlength="200" autocomplete="name"')}${field("birth", "Data de nascimento", "date", "required")}${field("document", "BI / passaporte / documento do titular", "text", 'required maxlength="80"')}${field("phone", "Telefone", "tel", 'required maxlength="80" autocomplete="tel"')}${field("email", "Email (opcional)", "email", 'maxlength="120" autocomplete="email"')}${field("address", "Morada (opcional)", "text", 'maxlength="300" autocomplete="street-address"')}`;
function toast(message, error = false) {
  feedback.textContent = message;
  feedback.className = "visible" + (error ? " error" : "");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(
    () => (feedback.className = ""),
    error ? 10000 : 6500,
  );
}
async function api(path, body) {
  const res = await fetch("/api/patient-portal" + path, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers:
      body === undefined
        ? {}
        : { "Content-Type": "application/json", "X-CSRF-Token": csrf },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const d = await res
    .json()
    .catch(() => ({ error: "Resposta inválida do servidor." }));
  if (!res.ok) {
    if (res.status === 401 && session) {
      session = null;
      data = null;
      csrf = "";
      renderAuth();
    }
    throw new Error(d.error || "A operação não foi confirmada.");
  }
  if (d.csrf) csrf = d.csrf;
  return d;
}
function renderAuth() {
  formDirty = false;
  app.innerHTML = `<header class="auth-header">${brand}<a href="./equipa.html">Acesso da equipa →</a></header><main id="main" class="auth-layout"><section class="hero"><span class="eyebrow">O seu cuidado, mais próximo</span><h1>A sua saúde.<br>Num só lugar.</h1><p>Consulte resultados, organize as suas consultas e acompanhe os seus cuidados nas unidades associadas.</p><div class="benefit"><span>01</span><div><b>Consultas sem complicações</b><small>Escolha os horários disponibilizados pela sua unidade.</small></div></div><div class="benefit"><span>02</span><div><b>Informação clínica disponível</b><small>Veja os resultados e documentos publicados para si.</small></div></div><div class="benefit"><span>03</span><div><b>Acesso pessoal</b><small>A unidade confirma a sua identidade antes de dar acesso ao processo.</small></div></div></section><section class="panel auth-panel"><span class="eyebrow">Bem-vindo ao seu portal</span><h1>${authTab === "register" ? "Criar acesso" : authTab === "recovery" ? "Recuperar acesso" : authTab === "reset" ? "Nova palavra-passe" : "Entre na sua conta"}</h1><div class="tabs" role="tablist"><button class="tab" data-auth="login" role="tab" aria-selected="${authTab === "login"}">Entrar</button><button class="tab" data-auth="register" role="tab" aria-selected="${authTab === "register"}">Novo registo</button></div>${!units.length ? '<p class="notice warning">Ainda não há unidades com o portal activado. A equipa deve activar a sua unidade na área institucional.</p>' : ""}
<form method="post" id="auth-form" data-kind="${authTab}">${authTab === "register" ? `${unitField()}<div class="fields">${identityFields()}</div><div class="notice">O registo é um pedido de acesso. A unidade verificará o titular e associará o processo correcto. Dados clínicos não são mostrados antes dessa confirmação.</div>` : ""}${authTab === "recovery" ? unitField() + field("contact", "Telefone ou email para contacto", "text", 'required maxlength="150"') : ""}${authTab !== "reset" ? field("username", "Utilizador", "text", 'required minlength="4" maxlength="120" autocomplete="username" autocapitalize="none" spellcheck="false"') : field("token", "Código entregue pela unidade", "text", 'required maxlength="80" autocomplete="off"')}${authTab !== "recovery" ? field("password", authTab === "reset" ? "Nova palavra-passe" : "Palavra-passe", "password", `required ${authTab !== "login" ? 'minlength="12"' : ""} maxlength="72" autocomplete="${authTab === "login" ? "current-password" : "new-password"}"`) : ""}${["register", "reset"].includes(authTab) ? field("confirmation", "Confirmar palavra-passe", "password", 'required minlength="12" maxlength="72" autocomplete="new-password"') : ""}${authTab === "register" ? '<label class="check"><input name="consent" type="checkbox" required>Confirmo que solicito acesso aos meus próprios dados e autorizo a unidade a verificar a minha identidade para este pedido.</label>' : ""}<button class="full" type="submit">${{ login: "Entrar no portal", register: "Enviar registo", recovery: "Solicitar recuperação", reset: "Alterar palavra-passe" }[authTab]}</button></form><p class="actions"><button class="secondary" data-auth="recovery">Esqueci-me da palavra-passe</button><button class="secondary" data-auth="reset">Tenho um código</button></p><small>Este portal não é um serviço de urgência. Em caso de urgência, procure uma unidade de saúde.</small></section></main>`;
}
const pages = [
  ["home", "⌂", "Visão geral"],
  ["appointments", "◷", "Consultas"],
  ["results", "▤", "Resultados de exames"],
  ["prescriptions", "✚", "Receitas"],
  ["history", "≡", "Resumos clínicos"],
  ["invoices", "▣", "Facturas e extrato"],
  ["units", "⊕", "Minhas unidades"],
  ["profile", "○", "Os meus dados"],
  ["security", "◇", "Segurança"],
];
function renderShell() {
  formDirty = false;
  const u = units.find((u) => u.id === unitId);
  app.innerHTML = `<div class="shell"><aside class="sidebar">${brand}<span class="eyebrow">Área pessoal</span><nav class="nav" aria-label="Portal do paciente">${pages.map(([id, icon, title]) => `<button data-page="${id}" aria-current="${page === id ? "page" : "false"}"><span aria-hidden="true">${icon}</span>${title}</button>`).join("")}</nav><div class="sidebar-footer">Acesso pessoal e reservado.<br><br><a href="./equipa.html">Área institucional</a></div></aside><div><header class="topbar"><select class="unit-select" id="unit-select" aria-label="Unidade activa">${session.links.length ? session.links.map((l) => `<option value="${esc(l.id)}" ${l.id === unitId ? "selected" : ""}>${esc(l.name)}</option>`).join("") : "<option>Associação pendente</option>"}</select><div class="person"><span class="avatar">${esc(session.name?.[0] || "P")}</span><strong>${esc(session.name)}</strong><button class="secondary" data-action="logout">Sair</button></div></header><main id="main" class="content"><header class="page-head"><div><span class="eyebrow">${esc(u?.name || "Portal pessoal")}</span><h1>${esc(pages.find((p) => p[0] === page)?.[2] || "Portal")}</h1><p>${page === "home" ? "Acompanhe a sua saúde com tranquilidade." : "Informação da unidade seleccionada · horários de Angola"}</p></div><button class="secondary" data-action="refresh">Actualizar</button></header><div id="page-content">${renderPage()}</div></main><footer class="footer">NVUALASOFT · Informação disponibilizada pela sua unidade de saúde. ${esc(u?.phone || "")}<br>Não utilize este portal para situações urgentes.</footer></div></div>`;
}
const appointmentRows = (list, short = false) =>
  list.length
    ? list
        .map(
          (a) =>
            `<div class="row"><div><h3>${esc(a.specialty)}</h3><small>${esc(time(a.starts_at))} · ${esc(a.location)}</small><small>${esc(a.clinician)}</small></div><div class="actions">${badge(a.status)}${a.status === "marcada" && new Date(a.starts_at) > new Date() ? `<button class="secondary" data-action="cancel" data-id="${esc(a.id)}">Cancelar</button>` : ""}${!short ? `<button class="secondary" data-action="appointment-print" data-id="${esc(a.id)}">Comprovativo</button>` : ""}</div></div>`,
        )
        .join("")
    : empty("Ainda não tem consultas marcadas nesta unidade.");
function renderPage() {
  if (page === "units") return unitsPage();
  if (page === "security") return securityPage();
  if (!unitId)
    return `<section class="panel"><h2>A sua associação está em análise</h2><p>A unidade precisa de confirmar a sua identidade e o processo clínico. Depois da aprovação, as consultas e os dados ficam disponíveis aqui.</p>${requestList()}<button data-page="units">Consultar unidades</button></section>`;
  if (!data) return '<div class="loading">A carregar os seus dados…</div>';
  const d = data,
    upcoming = d.appointments.filter(
      (a) => a.status === "marcada" && new Date(a.starts_at) > new Date(),
    );
  if (page === "home")
    return `<section class="welcome"><div><span class="eyebrow">O seu espaço de saúde</span><h1>Olá, ${esc(d.profile?.nome?.split(" ")[0] || session.name)}.</h1><p>Escolha uma consulta ou veja as novidades da sua unidade.</p></div><button data-page="appointments">+ Marcar consulta</button></section><div class="stats">${[
      ["Próximas consultas", upcoming.length],
      ["Resultados disponíveis", d.results.length],
      [
        "Receitas publicadas",
        d.documents.filter((x) => x.kind === "receita").length,
      ],
      ["Unidades associadas", session.links.length],
    ]
      .map(
        ([label, n]) =>
          `<div class="stat"><small>${label}</small><strong>${n}</strong></div>`,
      )
      .join(
        "",
      )}</div><div class="two-col"><section class="panel"><h2>As próximas consultas</h2>${appointmentRows(upcoming.slice(0, 3), true)}</section><section class="panel"><h2>Novidades dos seus cuidados</h2>${
      d.results
        .slice(0, 3)
        .map(
          (r) =>
            `<div class="row"><div><h3>${esc(r.title)}</h3><small>Resultado disponibilizado · ${esc(time(r.released_at))}</small></div><button class="secondary" data-action="result" data-id="${r.id}">Ver</button></div>`,
        )
        .join("") || empty("Os resultados validados aparecerão aqui.")
    }<p><button class="secondary" data-action="alerts">${alertEnabled ? "Alertas activados nesta sessão" : "Activar avisos nesta sessão"}</button></p></section></div><section class="panel"><h2>Pedidos à unidade</h2>${requestList()}</section>`;
  if (page === "appointments")
    return `<section class="panel"><h2>Marcar uma consulta</h2><p class="muted">Os horários abaixo foram disponibilizados pela unidade. A marcação reserva o horário após confirmação do servidor.</p><label>Filtrar especialidade<input id="specialty-filter" type="search" placeholder="Ex.: Cardiologia"></label><div id="slot-list">${slotRows(slots)}</div></section><section class="panel"><h2>As minhas consultas</h2>${appointmentRows(d.appointments)}</section>`;
  if (page === "results")
    return `<section class="panel"><h2>Resultados de exames</h2><p class="notice">São mostradas apenas as versões mais recentes já libertadas no circuito laboratorial. Durante uma correcção, o resultado fica indisponível até nova validação.</p>${d.results.length ? `<div class="table-wrap"><table><thead><tr><th>Exame</th><th>Disponibilizado</th><th>Estado</th><th>Documento</th></tr></thead><tbody>${d.results.map((r) => `<tr><td>${esc(r.title)}<small>Versão ${r.version}</small></td><td>${esc(time(r.released_at))}</td><td>${badge("validado")}</td><td><button class="secondary" data-action="result" data-id="${r.id}">Ver / PDF</button></td></tr>`).join("")}</tbody></table></div>` : empty("Sem resultados publicados para o seu processo.")}</section>`;
  if (page === "prescriptions" || page === "history") {
    const list = d.documents.filter(
      (x) => x.kind === (page === "prescriptions" ? "receita" : "resumo"),
    );
    return `<section class="panel"><h2>${page === "prescriptions" ? "Receitas publicadas pela equipa médica" : "Resumos clínicos disponibilizados"}</h2><p class="muted">Documentos publicados pelo profissional responsável para consulta pelo titular.</p>${list.map((x) => `<div class="row"><div><h3>${esc(x.title)}</h3><small>${esc(x.author_name)} · ${esc(time(x.created_at))}</small></div><button class="secondary" data-action="document" data-id="${x.id}">Abrir / PDF</button></div>`).join("") || empty()}</section>`;
  }
  if (page === "invoices")
    return `<section class="panel"><h2>Facturas e extrato por documento</h2><p class="notice">Arquivo de facturação associado ao seu processo. Os documentos de homologação não são apresentados. Para pagamentos ou divergências, contacte a unidade.</p>${d.invoices.length ? `<div class="table-wrap"><table><thead><tr><th>Documento</th><th>Data</th><th>Total</th><th>Estado</th></tr></thead><tbody>${d.invoices.map((f) => `<tr><td>${esc(f.numero)}<small>${esc(f.tipo_documento)} · Série ${esc(f.serie)}</small></td><td>${esc(f.data)}</td><td>${esc(money(f.total))}</td><td>${badge(f.estado)}</td></tr>`).join("")}</tbody></table></div>` : empty("Não há facturas disponíveis para o seu processo.")}</section>`;
  if (page === "profile")
    return `<div class="two-col"><section class="panel"><h2>Identificação do processo</h2><dl>${[
      ["Nome", d.profile.nome],
      ["Nascimento", d.profile.nasc],
      ["Sexo", d.profile.sexo],
      ["Processo", d.profile.processo],
      ["Telefone", d.profile.telefone],
      ["Email", d.profile.email],
      ["Morada", d.profile.endereco],
    ]
      .map(
        ([k, v]) =>
          `<dt class="muted">${k}</dt><dd><p>${esc(v || "Não informado")}</p></dd>`,
      )
      .join(
        "",
      )}</dl></section><section class="panel"><h2>Solicitar actualização</h2><p class="muted">A equipa confere os dados antes de alterar o cadastro.</p><form method="post" id="request-form"><label>Tipo<select name="kind"><option value="contacto">Contactos e dados pessoais</option><option value="seguro">Seguro e enquadramento</option></select></label><label>O que pretende actualizar?<textarea name="message" required maxlength="2000"></textarea></label><button>Enviar à unidade</button></form><p class="notice">O enquadramento e as isenções são verificados pela unidade. Uma solicitação não activa um seguro nem altera cobranças.</p></section></div>`;
  return "";
}
function slotRows(list) {
  return list.length
    ? list
        .map(
          (s) =>
            `<div class="row"><div><h3>${esc(s.specialty)}</h3><small>${esc(time(s.starts_at))} · ${esc(s.clinician)}</small><small>${esc(s.location)}</small></div><button data-action="book" data-id="${s.id}">Marcar consulta</button></div>`,
        )
        .join("")
    : empty(
        "Não existem horários disponíveis. Contacte a unidade ou volte a consultar mais tarde.",
      );
}
function requestList() {
  return (
    session.requests
      .map(
        (r) =>
          `<div class="row"><div><h3>${esc({ cadastro: "Associação à unidade", contacto: "Actualização de dados", seguro: "Seguro e enquadramento" }[r.kind] || r.kind)}</h3><small>${esc(units.find((u) => u.id === r.empresa_id)?.name || "Unidade")} · ${esc(time(r.created_at))}</small>${r.response ? `<p>${esc(r.response)}</p>` : ""}</div>${badge(r.status)}</div>`,
      )
      .join("") || empty("Não há pedidos de actualização.")
  );
}
function unitsPage() {
  return `<section class="panel"><h2>Unidades disponíveis na rede</h2>${
    units
      .map((u) => {
        const linked = session.links.some((l) => l.id === u.id),
          pending = session.requests.some(
            (r) =>
              r.empresa_id === u.id &&
              r.kind === "cadastro" &&
              r.status === "pendente",
          );
        return `<article class="unit-card"><div class="row"><div><h3>${esc(u.name)}</h3><small>${esc(u.address)}</small><small>${esc(u.phone)}</small></div>${linked ? badge("associada") : pending ? badge("pendente") : `<button data-action="join" data-id="${u.id}">Solicitar associação</button>`}</div></article>`;
      })
      .join("") || empty("Não há unidades disponíveis.")
  }<div id="join-form-container"></div></section><section class="panel"><h2>Estado dos pedidos</h2>${requestList()}</section>`;
}
function securityPage() {
  return `<div class="two-col"><section class="panel"><h2>Alterar palavra-passe</h2><form method="post" id="password-form">${field("currentPassword", "Palavra-passe actual", "password", 'required autocomplete="current-password"')}${field("password", "Nova palavra-passe", "password", 'required minlength="12" maxlength="72" autocomplete="new-password"')}${field("confirmation", "Confirmar nova palavra-passe", "password", 'required minlength="12" maxlength="72" autocomplete="new-password"')}<button>Alterar e terminar sessões</button></form></section><section class="panel"><h2>Cuide do seu acesso</h2><p>Não partilhe a sua palavra-passe. Ao terminar num computador partilhado, escolha <strong>Sair</strong>.</p><p>As sessões expiram após 30 minutos de inactividade ou 8 horas. Uma alteração de palavra-passe termina todas as sessões.</p><p class="notice">A recuperação é feita após confirmação da identidade pela unidade. Nunca utilize o apelido ou o número de BI como palavra-passe.</p></section></div>`;
}
async function load() {
  const n = ++sequence;
  session = await api("/session");
  if (n !== sequence) return;
  if (!session.links.some((l) => l.id === unitId)) {
    unitId = session.links[0]?.id || "";
    lastResultIds = null;
  }
  if (unitId) {
    const org = unitId;
    const [d, s] = await Promise.all([
      api(`/units/${org}/data`),
      api(`/units/${org}/slots`),
    ]);
    if (n !== sequence || org !== unitId) return;
    data = d;
    slots = s;
    const ids = new Set(d.results.map((r) => r.id));
    if (
      alertEnabled &&
      lastResultIds &&
      [...ids].some((id) => !lastResultIds.has(id))
    ) {
      toast("A unidade disponibilizou um novo resultado.");
      if ("Notification" in window && Notification.permission === "granted")
        new Notification("Portal NVUALASOFT", {
          body: "Existe uma actualização nos seus cuidados. Entre no portal para consultar.",
        });
    }
    lastResultIds = ids;
  } else {
    data = null;
    slots = [];
  }
  renderShell();
}
function showDocument(title, content, meta = "") {
  document.querySelector("#detail-content").innerHTML =
    `<span class="eyebrow">${esc(units.find((u) => u.id === unitId)?.name || "NVUALASOFT")}</span><h1>${esc(title)}</h1><div class="document-meta">${esc(data?.profile?.nome || session.name)} · Processo ${esc(data?.profile?.processo || "")}<br>${esc(meta)}</div>${content}<p class="muted">Disponibilizado no Portal do Paciente · ${esc(time(new Date()))}<br>Confirme com a unidade a validade de documentos que necessitem de assinatura ou autenticação.</p>`;
  detail.showModal();
}
async function run(fn) {
  if (busy) return;
  busy = true;
  app.setAttribute("aria-busy", "true");
  app.inert = true;
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
  if (b.dataset.auth) {
    authTab = b.dataset.auth;
    renderAuth();
    return;
  }
  if (b.dataset.page) {
    if (formDirty && !confirm("Descartar os dados ainda não enviados?")) return;
    page = b.dataset.page;
    renderShell();
    return;
  }
  const action = b.dataset.action,
    id = b.dataset.id;
  if (!action) return;
  run(async () => {
    if (action === "logout") {
      await api("/logout", {});
      session = null;
      data = null;
      csrf = "";
      ++sequence;
      renderAuth();
    }
    if (action === "refresh") {
      if (formDirty && !confirm("Descartar os dados ainda não enviados?"))
        return;
      await load();
    }
    if (action === "book") {
      if (!confirm("Confirmar a marcação deste horário?")) return;
      await api("/appointments", {
        unitId,
        slotId: id,
        requestId: crypto.randomUUID(),
      });
      await load();
      toast("Consulta marcada e guardada pela unidade.");
    }
    if (action === "cancel") {
      if (!confirm("Cancelar esta consulta?")) return;
      await api(`/appointments/${id}/cancel`, { unitId });
      await load();
      toast("Consulta cancelada.");
    }
    if (action === "join") {
      document.querySelector("#join-form-container").innerHTML =
        `<h2>Solicitar associação a ${esc(units.find((u) => u.id === id)?.name)}</h2><form method="post" id="join-form" data-unit="${id}"><div class="fields">${identityFields()}</div><button>Enviar pedido</button></form>`;
      document
        .querySelector("#join-form")
        .scrollIntoView({ behavior: "smooth" });
    }
    if (action === "alerts") {
      if ("Notification" in window && Notification.permission === "default")
        await Notification.requestPermission();
      alertEnabled = true;
      toast("Avisos activados enquanto o portal estiver aberto.");
      renderShell();
    }
    if (action === "result") {
      await load();
      const r = data.results.find((r) => r.id === id);
      if (!r)
        throw new Error(
          "Este resultado já não está disponível. Actualize a página.",
        );
      showDocument(
        r.title,
        `<table><thead><tr><th>Resultado</th><th>Unidade</th><th>Referência</th></tr></thead><tbody><tr><td>${esc(r.measured)}</td><td>${esc(r.unit)}</td><td>${esc(r.reference)}</td></tr></tbody></table><p>Método: ${esc(r.method)}</p><p class="document-body">${esc(r.comment)}</p>`,
        `Versão ${r.version} · Libertado em ${time(r.released_at)} · ${r.released_by}`,
      );
    }
    if (action === "document") {
      await load();
      const d = data.documents.find((x) => x.id === id);
      if (!d) throw new Error("Documento retirado ou indisponível.");
      showDocument(
        d.title,
        `<div class="document-body">${esc(d.body)}</div>`,
        `${d.author_name} · ${time(d.created_at)}`,
      );
    }
    if (action === "appointment-print") {
      const a = data.appointments.find((a) => a.id === id);
      showDocument(
        "Comprovativo de consulta",
        `<h2>${esc(a.specialty)}</h2><p>${esc(a.clinician)}</p><p>${esc(time(a.starts_at))}</p><p>${esc(a.location)}</p><p>Estado: ${esc(a.status)}</p><p>Referência: ${esc(a.id)}</p>`,
        "Comprovativo de marcação. Não comprova a realização do acto médico.",
      );
    }
  });
});
document.addEventListener("change", (e) => {
  if (e.target.id === "unit-select") {
    if (formDirty && !confirm("Descartar os dados ainda não enviados?")) {
      e.target.value = unitId;
      return;
    }
    unitId = e.target.value;
    data = null;
    lastResultIds = null;
    renderShell();
    run(load);
  }
});
document.addEventListener("input", (e) => {
  if (e.target.closest("form")) formDirty = true;
  if (e.target.id === "specialty-filter") {
    const q = e.target.value.toLocaleLowerCase("pt");
    document.querySelector("#slot-list").innerHTML = slotRows(
      slots.filter((s) => s.specialty.toLocaleLowerCase("pt").includes(q)),
    );
  }
});
document.addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.target,
    d = Object.fromEntries(new FormData(f));
  run(async () => {
    if (d.confirmation !== undefined && d.password !== d.confirmation)
      throw new Error("As palavras-passe não coincidem.");
    if (f.id === "auth-form") {
      const kind = f.dataset.kind;
      const response = await api("/" + kind, d);
      if (["login", "register"].includes(kind)) {
        unitId = "";
        page = "home";
        await load();
        if (response.message) toast(response.message);
      } else {
        authTab = "login";
        renderAuth();
        toast(response.message);
      }
    }
    if (f.id === "join-form") {
      await api("/requests", {
        ...d,
        unitId: f.dataset.unit,
        kind: "cadastro",
      });
      await load();
      toast("Pedido de associação enviado.");
    }
    if (f.id === "request-form") {
      await api("/requests", { ...d, unitId });
      await load();
      toast("Pedido enviado à unidade.");
    }
    if (f.id === "password-form") {
      const result = await api("/password", d);
      session = null;
      data = null;
      csrf = "";
      renderAuth();
      toast(result.message);
    }
  });
});
document
  .querySelector("#close-detail")
  .addEventListener("click", () => detail.close());
document
  .querySelector("#print-detail")
  .addEventListener("click", () => window.print());
for (const event of ["pointerdown", "keydown", "input"])
  document.addEventListener(event, () => (lastActivity = Date.now()), {
    passive: true,
  });
setInterval(() => {
  if (session && !busy && Date.now() - lastActivity >= 30 * 60 * 1000) {
    run(async () => {
      try {
        await api("/logout", {});
      } finally {
        session = null;
        data = null;
        csrf = "";
        if (detail.open) detail.close();
        renderAuth();
        toast("A sessão terminou por inactividade. Entre novamente.");
      }
    });
    return;
  }
  if (
    !formDirty &&
    Date.now() - lastActivity < 25 * 60 * 1000 &&
    session &&
    !busy &&
    !document.hidden &&
    !detail.open &&
    !document.querySelector("input:focus,textarea:focus,select:focus") &&
    !document.querySelector("#join-form")
  )
    run(load);
}, 60000);
(async () => {
  try {
    units = await api("/units");
    try {
      await load();
    } catch {
      renderAuth();
    }
  } catch (e) {
    renderAuth();
    toast("Não foi possível ligar ao servidor: " + e.message, true);
  }
})();
