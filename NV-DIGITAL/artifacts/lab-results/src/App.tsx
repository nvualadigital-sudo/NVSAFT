import ChatCallService from "./pages/comunicacao/ChatCallService";
import React, { useState, useCallback, useEffect, useMemo, useRef, lazy, Suspense } from "react";
import { AppProvider, useApp } from "./store/AppContext";
import { HospitalProvider } from "./store/hospital";
import Assistente from "./components/hospital/NVAssistente";
import { countsAsRevenue, financialSummary } from "./utils/resumoFinanceiro";
import { loadSession, saveSession, Session, FuncaoFuncionario, canAccess } from "./store/auth";
import { api } from "./store/api";
import { IdleTimeout } from "./components/IdleTimeout";
import { NotificationBell } from "./components/NotificationBell";

import Login from "./pages/admin/Login";

// Cada página só é descarregada quando é aberta (arranque mais rápido)
const AdminEmpresas = lazy(() => import("./pages/admin/AdminEmpresas"));
const PortalParceiro = lazy(() => import("./pages/laboratorio/PortalParceiro"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Laboratorio = lazy(() => import("./pages/laboratorio/Laboratorio"));
const Catalogo = lazy(() => import("./pages/laboratorio/CadastrarExames"));
const Instituicao = lazy(() => import("./pages/admin/Instituicao"));
const ServicosHospitalares = lazy(() => import("./pages/gestao/ServicosHospitalares"));
const Biblioteca = lazy(() => import("./pages/admin/Biblioteca"));
const Pacientes = lazy(() => import("./pages/recepcao/Pacientes"));
const Historico = lazy(() => import("./pages/laboratorio/Historico"));
const Configuracoes = lazy(() => import("./pages/admin/Configuracoes"));
const AdminFuncionarios = lazy(() => import("./pages/admin/AdminFuncionarios"));
const Faturacao = lazy(() => import("./pages/financas/Faturacao"));
const ContaCorrente = lazy(() => import("./pages/financas/ContaCorrente"));
const GestaProdutos = lazy(() => import("./pages/financas/GestaProdutos"));
const GestaParceiros = lazy(() => import("./pages/laboratorio/GestaParceiros"));
const GestaStock = lazy(() => import("./pages/laboratorio/GestaStock"));
const Medico = lazy(() => import("./pages/medicos/Medico"));
const Imagiologia = lazy(() => import("./pages/medicos/Imagiologia"));
const MedLink = lazy(() => import("./pages/comunicacao/Medlik"));
const SolicitarExames = lazy(() => import("./pages/laboratorio/SolicitarExames"));
const PassApp = lazy(() => import("./pages/admin/PassApp"));
const NotasCredito = lazy(() => import("./pages/financas/NotasCredito"));
const PedidosCompra = lazy(() => import("./pages/financas/PedidosCompra"));
const Relatorios = lazy(() => import("./pages/financas/Relatorios"));
const Seguradoras = lazy(() => import("./pages/financas/Seguradoras"));
const Recepcao = lazy(() => import("./pages/recepcao/Recepcao"));
const Agendamento = lazy(() => import("./pages/recepcao/Agendamento"));
const Urgencia = lazy(() => import("./pages/enfermagem/Urgencia"));
const Internamento = lazy(() => import("./pages/enfermagem/Internamento"));
const Ginecologia = lazy(() => import("./pages/medicos/Ginecologia"));
const Nutricao = lazy(() => import("./pages/medicos/Nutricao"));
const Receitas = lazy(() => import("./pages/medicos/Receitas"));
const Enfermagem = lazy(() => import("./pages/enfermagem/Enfermagem"));
const Farmacia = lazy(() => import("./pages/farmacia/Farmacia"));
const ChatApp = lazy(() => import("./pages/comunicacao/Chat"));
const ResumoFinanceiro = lazy(() => import("./pages/financas/ResumoFinanceiro"));

/* ============================================================================ */
/*  DESIGN TOKENS — azul institucional                                          */
/* ============================================================================ */
const C = {
  ink: "var(--gx-ink)", ink2: "var(--gx-ink2)", primary: "var(--gx-primary)", link: "var(--gx-link)",
  accent: "var(--gx-accent)", tint: "var(--gx-tint)", line: "var(--gx-line)", bg: "var(--gx-bg)",
  surface: "var(--gx-surface)", text: "var(--gx-text)", muted: "var(--gx-muted)", onInk: "var(--gx-onink)",
  danger: "var(--gx-danger)",
};
const FONTE = "'Inter', 'Segoe UI', system-ui, -apple-system, Roboto, sans-serif";
const LAYOUT_KEY = "app_menu_layout";
const COLLAPSE_KEY = "app_menu_collapsed";
const RECENT_KEY = "app_recent_tabs";
const LAST_KEY = "app_last_tab";
const THEME_KEY = "app_theme";
type Theme = "claro" | "escuro";

const COLOUR_KEY = "app_colour_theme";
const COLOUR_THEMES = [
  {
    "id": "navy",
    "label": "Azul escuro",
    "color": "#0b2b4b",
    "primary": "#1d63b8",
    "ink": "#071a33",
    "ink2": "#05142a",
    "tint": "#eaf2fc",
    "darkTint": "#1b3558",
    "bright": "#8ab8f5",
    "hsl": "213 73% 42%"
  },
  {
    "id": "blue",
    "label": "Azul",
    "color": "#2563eb",
    "primary": "#1d4ed8",
    "ink": "#0a2a52",
    "ink2": "#081f3d",
    "tint": "#e8f0ff",
    "darkTint": "#17375f",
    "bright": "#93c5fd",
    "hsl": "224 76% 48%"
  },
  {
    "id": "teal",
    "label": "Verde água",
    "color": "#0f766e",
    "primary": "#0f766e",
    "ink": "#083d3a",
    "ink2": "#062d2a",
    "tint": "#e0f5ef",
    "darkTint": "#103d39",
    "bright": "#5eead4",
    "hsl": "175 77% 26%"
  },
  {
    "id": "green",
    "label": "Verde",
    "color": "#15803d",
    "primary": "#15803d",
    "ink": "#113a25",
    "ink2": "#0a2819",
    "tint": "#e4f5e9",
    "darkTint": "#173f29",
    "bright": "#86efac",
    "hsl": "142 72% 29%"
  },
  {
    "id": "purple",
    "label": "Roxo",
    "color": "#7c3aed",
    "primary": "#6d28d9",
    "ink": "#301653",
    "ink2": "#211039",
    "tint": "#eee8ff",
    "darkTint": "#352153",
    "bright": "#c4b5fd",
    "hsl": "263 70% 50%"
  },
  {
    "id": "amber",
    "label": "Âmbar",
    "color": "#d97706",
    "primary": "#92400e",
    "ink": "#432b16",
    "ink2": "#302010",
    "tint": "#fff2dd",
    "darkTint": "#4a321d",
    "bright": "#fcd34d",
    "hsl": "26 90% 31%"
  },
  {
    "id": "light",
    "label": "Claro",
    "color": "#e2e8f0",
    "primary": "#334155",
    "ink": "#17243a",
    "ink2": "#101a2c",
    "tint": "#f1f5f9",
    "darkTint": "#24354b",
    "bright": "#cbd5e1",
    "hsl": "215 25% 27%"
  }
] as const;
type ColourTheme = (typeof COLOUR_THEMES)[number]["id"];
type Appearance = { theme: Theme; colourTheme: ColourTheme };

function loadAppearance(key: (name: string) => string, session: Session): Appearance {
  let storedMode: string | null = null;
  let storedColour: string | null = null;
  try {
    storedMode = localStorage.getItem(key(THEME_KEY));
    storedColour = localStorage.getItem(key(COLOUR_KEY)) ||
      localStorage.getItem(["nv", "theme", session.empresaId, session.username].join(":"));
  } catch { /* Preferências são opcionais. */ }
  const colourTheme = COLOUR_THEMES.find((p) => p.id === storedColour)?.id ?? "blue";
  const theme = storedMode === "claro" || storedMode === "escuro"
    ? storedMode
    : colourTheme === "navy" || window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "escuro" : "claro";
  return { theme, colourTheme };
}


const CSS = `
.gx{--gx-ink:#0a2a52;--gx-ink2:#081f3d;--gx-primary:#0f4c9a;--gx-link:#0f4c9a;--gx-accent:#1d63b8;--gx-tint:#eaf2fc;--gx-line:#dbe4ef;--gx-bg:#f3f6fa;--gx-surface:#fff;--gx-text:#14233a;--gx-muted:#5d6d84;--gx-onink:#b9cde8;--gx-danger:#b42318}
.gx[data-theme="dark"]{--gx-ink:#071a33;--gx-ink2:#05142a;--gx-primary:#2a6fcf;--gx-link:#8ab8f5;--gx-accent:#5b9bf0;--gx-tint:#1b3558;--gx-line:#2a3d59;--gx-bg:#0c1729;--gx-surface:#13233a;--gx-text:#e6edf7;--gx-muted:#9fb0c8;--gx-onink:#a9bedc;--gx-danger:#ff7b6b;color-scheme:dark}
.gx{font-family:${FONTE};color:${C.text};-webkit-font-smoothing:antialiased}
.gx,.gx-app-main,.gx-page{min-width:0;max-width:100%}
.gx-app-main{overflow-x:auto;overscroll-behavior-x:contain}
.gx-page{width:100%;min-height:0}
.gx-page :where(.flex,.grid)>*{min-width:0}
.gx-page :where(img,video,canvas,iframe){max-width:100%}
.gx-surface{background:${C.surface}}
.gx-page{color:#14233a;color-scheme:light}
.gx[data-theme="dark"] .gx-page{background:#f3f6fa;border-radius:10px;margin:0;overflow:visible}
@media(min-width:1024px){.gx[data-theme="dark"] .gx-page{margin:10px;width:calc(100% - 20px)}}
.gx button{cursor:pointer}
.gx :focus-visible{outline:2px solid ${C.accent};outline-offset:2px}
.gx-dark :focus-visible{outline-color:#fff}
.gx-side{display:flex;width:100%;align-items:center;gap:10px;border-radius:6px;padding:8px 10px;font-size:13px;font-weight:500;color:${C.onInk};text-align:left;transition:background .12s,color .12s}
.gx-side:hover{background:rgba(255,255,255,.08);color:#fff}
.gx-side[aria-current="page"]{background:#fff;color:${C.ink};font-weight:600}
.gx-row{display:flex;width:100%;align-items:center;gap:10px;padding:9px 14px;font-size:13px;text-align:left;color:${C.text};transition:background .12s}
.gx-row:hover{background:${C.tint}}
.gx-row[aria-current="page"]{background:${C.tint};color:${C.link};font-weight:600}
.gx-btn{display:inline-flex;align-items:center;gap:8px;border:1px solid ${C.line};background:${C.surface};border-radius:6px;padding:6px 10px;font-size:12px;font-weight:600;color:${C.text};transition:background .12s,border-color .12s}
.gx-btn:hover{background:${C.tint};border-color:${C.accent}}
.gx-scroll::-webkit-scrollbar{width:6px;height:6px}
.gx-scroll::-webkit-scrollbar-thumb{background:rgba(120,140,170,.35);border-radius:3px}
.gx-bell button[aria-label="Notificações"]{width:32px;height:32px;border:1px solid ${C.line};background:${C.surface};color:${C.text};border-radius:6px}
.gx-bell button[aria-label="Notificações"]:hover{background:${C.tint};border-color:${C.accent}}
.gx-bell button[aria-label="Notificações"]>span{background:#b42318!important}
.gx[data-theme="dark"] .gx-bell .absolute.right-0{background:${C.surface};border-color:${C.line}}
.gx[data-theme="dark"] .gx-bell .text-foreground{color:${C.text}}
.gx[data-theme="dark"] .gx-bell .text-muted-foreground{color:${C.muted}}
.gx[data-theme="dark"] .gx-bell .border-border,.gx[data-theme="dark"] .gx-bell .divide-border>*{border-color:${C.line}}
.gx[data-theme="dark"] .gx-bell .absolute button:hover{background:${C.tint}}
.gx-kbd{border:1px solid ${C.line};border-radius:4px;padding:0 5px;font-size:10px;color:${C.muted};background:${C.surface}}
@keyframes gx-pop{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
.gx-pop{animation:gx-pop .12s ease-out}
.gx[data-layout="rodape"] .nv-fabs{bottom:calc(82px + env(safe-area-inset-bottom))}\n@media (prefers-reduced-motion:reduce){.gx-pop{animation:none}.gx *{transition:none!important}}
`;

const FLOATING_CSS = `
/* Ferramentas comuns em todos os layouts. */
.gx{--gx-tools-bottom:calc(20px + env(safe-area-inset-bottom))}
.gx[data-layout="rodape"]{--gx-tools-bottom:calc(88px + env(safe-area-inset-bottom))}
.gx .gx-app-main{padding-bottom:calc(112px + env(safe-area-inset-bottom))}
.gx[data-layout="rodape"] .gx-app-main{padding-bottom:calc(184px + env(safe-area-inset-bottom))}
.gx .nv-fabs{display:none}
.gx-floating-tools{position:fixed;right:20px;bottom:var(--gx-tools-bottom);z-index:35;display:flex;align-items:center;gap:12px}
.gx-float-button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;width:72px;height:72px;border-radius:50%;border:2px solid #ffffff66;color:#fff;box-shadow:0 5px 20px #071a3340;font-size:10px;font-weight:700;line-height:1.15;transition:transform .15s,box-shadow .15s}
.gx-float-button:hover{transform:translateY(-3px);box-shadow:0 8px 24px #071a3355}
.gx-float-agent{background:linear-gradient(145deg,#8b5cf6,#4c1d95)}
.gx-float-chat{background:linear-gradient(145deg,#10b981,#065f46)}
.gx-colour-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
.gx-colour-head h2{font-size:14px;font-weight:700;margin:0}
.gx-colour-head p{font-size:11px;color:var(--gx-muted);margin:4px 0 0}
.gx-colour-close{width:30px;height:30px;display:grid;place-items:center;border:1px solid var(--gx-line);border-radius:8px;background:var(--gx-surface);color:var(--gx-text)}
.gx-colour-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}
.gx-colour-option{display:flex;flex-direction:column;align-items:center;gap:7px;padding:9px 3px;border:1px solid var(--gx-line);border-radius:10px;color:var(--gx-text);font-size:10px;line-height:1.25;text-align:center;background:var(--gx-surface)}
.gx-colour-option[aria-pressed="true"]{border-color:var(--gx-accent);background:var(--gx-tint);font-weight:700}
.gx-colour-dot{width:30px;height:30px;border-radius:50%;border:1px solid #ffffff66;box-shadow:0 0 0 1px #64748b40;display:grid;place-items:center}
.gx-colour-modes{display:flex;gap:8px;padding-top:14px;margin-top:14px;border-top:1px solid var(--gx-line)}
.gx-colour-modes button{flex:1;border:1px solid var(--gx-line);border-radius:8px;padding:8px 10px;font-size:12px;background:var(--gx-surface);color:var(--gx-text)}
.gx-colour-modes button[aria-pressed="true"]{background:var(--gx-tint);border-color:var(--gx-accent);font-weight:700}
.gx-profile-actions{display:flex;gap:6px;padding:10px;border-top:1px solid var(--gx-line)}
.gx-profile-actions button{display:flex;flex:1;align-items:center;justify-content:center;gap:6px;padding:10px 5px;border:1px solid var(--gx-line);border-radius:8px;background:var(--gx-surface);color:var(--gx-text);font-size:12px;font-weight:600}
.gx-profile-actions button:hover,.gx-profile-actions button[aria-expanded="true"]{background:var(--gx-tint);border-color:var(--gx-accent)}
.gx-profile-actions button.gx-profile-logout{color:var(--gx-danger)}
.gx-profile-colours{padding:12px;border-top:1px solid var(--gx-line);max-height:min(420px,55dvh);overflow:auto}
.gx .nv-assistant{bottom:calc(var(--gx-tools-bottom) + 88px);z-index:45;max-height:calc(100dvh - var(--gx-tools-bottom) - 108px)}
.gx .gx-page{color:var(--nv-text);color-scheme:light;background:var(--nv-bg)}
.gx[data-theme="dark"] .gx-page{background:var(--nv-bg);color:var(--nv-text);color-scheme:dark}
@media(max-width:640px){
.gx{--gx-tools-bottom:calc(12px + env(safe-area-inset-bottom))}
.gx[data-layout="rodape"]{--gx-tools-bottom:calc(82px + env(safe-area-inset-bottom))}
.gx-floating-tools{right:12px;gap:8px}
.gx-float-button{width:60px;height:60px;font-size:9px;gap:4px}
.gx .nv-assistant{right:12px;bottom:calc(var(--gx-tools-bottom) + 76px);max-height:calc(100dvh - var(--gx-tools-bottom) - 96px)}
}
@media(max-width:420px){.gx-floating-tools{right:8px;gap:6px}.gx-float-button{width:50px;height:50px;font-size:8px}.gx .nv-assistant{right:8px;bottom:calc(var(--gx-tools-bottom) + 64px)}}
@media(prefers-reduced-motion:reduce){.gx-float-button{transition:none}.gx-float-button:hover{transform:none}}
@media print{.gx-floating-tools,.gx .nv-assistant{display:none!important}.gx .gx-app-main{padding-bottom:0}}

.gx[data-colour="navy"]{--gx-ink:#071a33;--gx-ink2:#05142a;--gx-primary:#1d63b8;--gx-link:#1d63b8;--gx-accent:#1d63b8;--gx-tint:#eaf2fc}
.gx[data-theme="dark"][data-colour="navy"]{--gx-link:#8ab8f5;--gx-accent:#8ab8f5;--gx-tint:#1b3558}
:root[data-gx-colour="navy"]{--nv-accent:#1d63b8;--nv-soft:#eaf2fc;--primary:213 73% 42%;--ring:213 73% 42%;--primary-foreground:0 0% 100%}
:root[data-gx-mode="escuro"][data-gx-colour="navy"]{--nv-accent:#8ab8f5;--nv-soft:#1b3558}

.gx[data-colour="blue"]{--gx-ink:#0a2a52;--gx-ink2:#081f3d;--gx-primary:#1d4ed8;--gx-link:#1d4ed8;--gx-accent:#1d4ed8;--gx-tint:#e8f0ff}
.gx[data-theme="dark"][data-colour="blue"]{--gx-link:#93c5fd;--gx-accent:#93c5fd;--gx-tint:#17375f}
:root[data-gx-colour="blue"]{--nv-accent:#1d4ed8;--nv-soft:#e8f0ff;--primary:224 76% 48%;--ring:224 76% 48%;--primary-foreground:0 0% 100%}
:root[data-gx-mode="escuro"][data-gx-colour="blue"]{--nv-accent:#93c5fd;--nv-soft:#17375f}

.gx[data-colour="teal"]{--gx-ink:#083d3a;--gx-ink2:#062d2a;--gx-primary:#0f766e;--gx-link:#0f766e;--gx-accent:#0f766e;--gx-tint:#e0f5ef}
.gx[data-theme="dark"][data-colour="teal"]{--gx-link:#5eead4;--gx-accent:#5eead4;--gx-tint:#103d39}
:root[data-gx-colour="teal"]{--nv-accent:#0f766e;--nv-soft:#e0f5ef;--primary:175 77% 26%;--ring:175 77% 26%;--primary-foreground:0 0% 100%}
:root[data-gx-mode="escuro"][data-gx-colour="teal"]{--nv-accent:#5eead4;--nv-soft:#103d39}

.gx[data-colour="green"]{--gx-ink:#113a25;--gx-ink2:#0a2819;--gx-primary:#15803d;--gx-link:#15803d;--gx-accent:#15803d;--gx-tint:#e4f5e9}
.gx[data-theme="dark"][data-colour="green"]{--gx-link:#86efac;--gx-accent:#86efac;--gx-tint:#173f29}
:root[data-gx-colour="green"]{--nv-accent:#15803d;--nv-soft:#e4f5e9;--primary:142 72% 29%;--ring:142 72% 29%;--primary-foreground:0 0% 100%}
:root[data-gx-mode="escuro"][data-gx-colour="green"]{--nv-accent:#86efac;--nv-soft:#173f29}

.gx[data-colour="purple"]{--gx-ink:#301653;--gx-ink2:#211039;--gx-primary:#6d28d9;--gx-link:#6d28d9;--gx-accent:#6d28d9;--gx-tint:#eee8ff}
.gx[data-theme="dark"][data-colour="purple"]{--gx-link:#c4b5fd;--gx-accent:#c4b5fd;--gx-tint:#352153}
:root[data-gx-colour="purple"]{--nv-accent:#6d28d9;--nv-soft:#eee8ff;--primary:263 70% 50%;--ring:263 70% 50%;--primary-foreground:0 0% 100%}
:root[data-gx-mode="escuro"][data-gx-colour="purple"]{--nv-accent:#c4b5fd;--nv-soft:#352153}

.gx[data-colour="amber"]{--gx-ink:#432b16;--gx-ink2:#302010;--gx-primary:#92400e;--gx-link:#92400e;--gx-accent:#92400e;--gx-tint:#fff2dd}
.gx[data-theme="dark"][data-colour="amber"]{--gx-link:#fcd34d;--gx-accent:#fcd34d;--gx-tint:#4a321d}
:root[data-gx-colour="amber"]{--nv-accent:#92400e;--nv-soft:#fff2dd;--primary:26 90% 31%;--ring:26 90% 31%;--primary-foreground:0 0% 100%}
:root[data-gx-mode="escuro"][data-gx-colour="amber"]{--nv-accent:#fcd34d;--nv-soft:#4a321d}

.gx[data-colour="light"]{--gx-ink:#17243a;--gx-ink2:#101a2c;--gx-primary:#334155;--gx-link:#334155;--gx-accent:#334155;--gx-tint:#f1f5f9}
.gx[data-theme="dark"][data-colour="light"]{--gx-link:#cbd5e1;--gx-accent:#cbd5e1;--gx-tint:#24354b}
:root[data-gx-colour="light"]{--nv-accent:#334155;--nv-soft:#f1f5f9;--primary:215 25% 27%;--ring:215 25% 27%;--primary-foreground:0 0% 100%}
:root[data-gx-mode="escuro"][data-gx-colour="light"]{--nv-accent:#cbd5e1;--nv-soft:#24354b}
`;

type MenuLayout = "lateral" | "cabecalho" | "rodape" | "cartao";

const LAYOUT_OPTIONS: { id: MenuLayout; label: string; desc: string; svg: string }[] = [
  { id: "lateral",   label: "Lateral",   desc: "Menu fixo à esquerda",       svg: '<rect x="3" y="4" width="18" height="16" rx="2"/><line x1="9" y1="4" x2="9" y2="20"/>' },
  { id: "cabecalho", label: "Cabeçalho", desc: "Menus na barra superior",    svg: '<rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/>' },
  { id: "rodape",    label: "Rodapé",    desc: "Navegação inferior (móvel)", svg: '<rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="15" x2="21" y2="15"/>' },
  { id: "cartao",    label: "Cartões",   desc: "Início em cartões",          svg: '<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/>' },
];

/* ============================================================================ */
/*  TABS E GRUPOS                                                               */
/* ============================================================================ */
type Tab =
  | "laboratorio" | "instituicao" | "servicos" | "biblioteca"
  | "dashboard" | "pacientes" | "lancamento" | "historico"
  | "exames" | "produtos" | "faturacao" | "contacorrente"
  | "funcionarios" | "parceiros" | "config" | "stock"
  | "hospitalar" | "escolar"
  | "medico" | "imagiologia" | "medlink"
  | "salarios" | "solicitar" | "pass" | "recepcao"
  | "internamento" | "agendamento" | "ginecologia" | "nutricao"
  | "receitas" | "notascredito" | "honorarios" | "pedidoscompra"
  | "urgencia" | "relatorios" | "enfermagem" | "farmacia" | "chat"
  | "resumofinanceiro" | "seguradoras";

interface TabDef {
  id: Tab;
  label: string;
  group: "clinico" | "financeiro" | "gestao" | "hospitalar";
  roles: FuncaoFuncionario[];
  modulo?: string;
}

const ALL_TABS: TabDef[] = [
  {
    "id": "dashboard",
    "label": "Dashboard",
    "group": "clinico",
    "roles": [
      "admin",
      "gestor",
      "tecnico",
      "rececionista",
      "financeiro",
      "medico",
      "enfermeiro",
      "farmaceutico"
    ]
  },
  {
    "id": "pacientes",
    "label": "Pacientes",
    "group": "clinico",
    "roles": [
      "admin",
      "gestor",
      "tecnico",
      "rececionista",
      "medico",
      "enfermeiro",
      "farmaceutico"
    ]
  },
  {
    "id": "laboratorio",
    "label": "Laboratório",
    "group": "clinico",
    "roles": [
      "admin",
      "gestor",
      "tecnico",
      "medico",
      "enfermeiro"
    ]
  },
  {
    "id": "historico",
    "label": "Histórico / PDF",
    "group": "clinico",
    "roles": [
      "admin",
      "gestor",
      "tecnico",
      "rececionista",
      "medico",
      "enfermeiro"
    ]
  },
  {
    "id": "exames",
    "label": "Catálogo laboratorial",
    "group": "clinico",
    "roles": [
      "admin",
      "gestor"
    ]
  },
  {
    "id": "medico",
    "label": "Portal Médico",
    "group": "clinico",
    "roles": [
      "admin",
      "gestor",
      "medico"
    ]
  },
  {
    "id": "imagiologia",
    "label": "Imagiologia",
    "group": "clinico",
    "roles": [
      "admin",
      "gestor",
      "tecnico"
    ]
  },
  {
    "id": "solicitar",
    "label": "Solicitar Exames",
    "group": "clinico",
    "roles": [
      "admin",
      "gestor",
      "medico",
      "rececionista"
    ]
  },
  {
    "id": "recepcao",
    "label": "Recepção",
    "group": "clinico",
    "roles": [
      "admin",
      "gestor",
      "rececionista",
      "medico"
    ]
  },
  {
    "id": "agendamento",
    "label": "Agendamento",
    "group": "clinico",
    "roles": [
      "admin",
      "gestor",
      "rececionista",
      "medico",
      "enfermeiro"
    ]
  },
  {
    "id": "urgencia",
    "label": "Urgência",
    "group": "clinico",
    "roles": [
      "admin",
      "gestor",
      "medico",
      "enfermeiro"
    ]
  },
  {
    "id": "internamento",
    "label": "Internamento",
    "group": "clinico",
    "roles": [
      "admin",
      "gestor",
      "medico",
      "enfermeiro"
    ]
  },
  {
    "id": "ginecologia",
    "label": "Ginecologia",
    "group": "clinico",
    "roles": [
      "admin",
      "gestor",
      "medico"
    ]
  },
  {
    "id": "nutricao",
    "label": "Nutrição",
    "group": "clinico",
    "roles": [
      "admin",
      "gestor",
      "medico"
    ]
  },
  {
    "id": "receitas",
    "label": "Receitas",
    "group": "clinico",
    "roles": [
      "admin",
      "gestor",
      "medico"
    ]
  },
  {
    "id": "enfermagem",
    "label": "Enfermagem",
    "group": "clinico",
    "roles": [
      "admin",
      "gestor",
      "medico",
      "enfermeiro",
      "farmaceutico"
    ]
  },
  {
    "id": "farmacia",
    "label": "Farmácia",
    "group": "clinico",
    "roles": [
      "admin",
      "gestor",
      "farmaceutico"
    ]
  },
  {
    "id": "chat",
    "label": "Chat",
    "group": "clinico",
    "roles": [
      "admin",
      "gestor",
      "tecnico",
      "rececionista",
      "financeiro",
      "medico",
      "enfermeiro",
      "farmaceutico"
    ]
  },
  {
    "id": "resumofinanceiro",
    "label": "Resumo Financeiro",
    "group": "financeiro",
    "roles": [
      "admin",
      "gestor",
      "financeiro"
    ]
  },
  {
    "id": "faturacao",
    "label": "Facturamento",
    "group": "financeiro",
    "roles": [
      "admin",
      "gestor",
      "rececionista",
      "financeiro"
    ]
  },
  {
    "id": "contacorrente",
    "label": "Conta Corrente",
    "group": "financeiro",
    "roles": [
      "admin",
      "gestor",
      "financeiro"
    ]
  },
  {
    "id": "produtos",
    "label": "Produtos / Serviços",
    "group": "financeiro",
    "roles": [
      "admin",
      "gestor",
      "financeiro"
    ]
  },
  {
    "id": "notascredito",
    "label": "Notas de Crédito",
    "group": "financeiro",
    "roles": [
      "admin",
      "gestor",
      "financeiro"
    ]
  },
  {
    "id": "seguradoras",
    "label": "Seguradoras",
    "group": "financeiro",
    "roles": [
      "admin",
      "gestor",
      "financeiro",
      "rececionista"
    ]
  },
  {
    "id": "stock",
    "label": "Stock de Reagentes",
    "group": "gestao",
    "roles": [
      "admin",
      "gestor",
      "tecnico"
    ]
  },
  {
    "id": "funcionarios",
    "label": "Funcionários",
    "group": "gestao",
    "roles": [
      "admin"
    ]
  },
  {
    "id": "parceiros",
    "label": "Parceiros",
    "group": "gestao",
    "roles": [
      "admin"
    ]
  },
  {
    "id": "config",
    "label": "Configurações",
    "group": "gestao",
    "roles": [
      "admin"
    ]
  },
  {
    "id": "medlink",
    "label": "MedLink",
    "group": "gestao",
    "roles": [
      "admin",
      "gestor",
      "medico"
    ]
  },
  {
    "id": "pass",
    "label": "Criador de Passes",
    "group": "gestao",
    "roles": [
      "admin",
      "gestor"
    ]
  },
  {
    "id": "pedidoscompra",
    "label": "Pedidos de Compra",
    "group": "gestao",
    "roles": [
      "admin",
      "gestor"
    ]
  },
  {
    "id": "relatorios",
    "label": "Relatórios",
    "group": "gestao",
    "roles": [
      "admin",
      "gestor",
      "financeiro"
    ]
  },
  {
    "id": "biblioteca",
    "label": "Biblioteca interna",
    "group": "gestao",
    "roles": [
      "admin",
      "gestor",
      "tecnico",
      "rececionista",
      "financeiro",
      "medico",
      "enfermeiro",
      "farmaceutico"
    ]
  },
  {
    "id": "instituicao",
    "label": "Instituição e acessos",
    "group": "gestao",
    "roles": [
      "admin",
      "gestor"
    ]
  },
  {
    "id": "servicos",
    "label": "Serviços hospitalares",
    "group": "hospitalar",
    "roles": [
      "admin",
      "gestor",
      "medico",
      "enfermeiro",
      "tecnico",
      "farmaceutico",
      "rececionista",
      "financeiro"
    ]
  }
];

/* Atalhos: carregar G e depois a letra (fora de campos de texto) */
const SHORTCUTS: Partial<Record<Tab, string>> = {
  dashboard: "d", pacientes: "p", laboratorio: "l", historico: "h", faturacao: "f", contacorrente: "c",
  stock: "s", relatorios: "r", agendamento: "a", recepcao: "e", medico: "m", farmacia: "y", chat: "t",
  seguradoras: "g", config: "o", funcionarios: "u", solicitar: "i", imagiologia: "v",
};

/* Acesso rápido do início, por função */
const QUICK_BY_ROLE: Record<FuncaoFuncionario, Tab[]> = {
  enfermeiro: ["enfermagem", "pacientes", "laboratorio", "internamento", "agendamento", "chat"],
  farmaceutico: ["enfermagem", "farmacia", "pacientes", "chat", "biblioteca"],
  admin: ["dashboard", "pacientes", "faturacao", "funcionarios", "relatorios", "config"],
  gestor: ["dashboard", "pacientes", "faturacao", "relatorios", "stock", "servicos"],
  tecnico: ["laboratorio", "pacientes", "historico", "stock", "imagiologia"],
  rececionista: ["recepcao", "agendamento", "pacientes", "solicitar", "faturacao"],
  financeiro: ["resumofinanceiro", "faturacao", "contacorrente", "notascredito", "relatorios"],
  medico: ["enfermagem", "medico", "pacientes", "solicitar", "receitas", "agendamento", "urgencia"],
};

const FUNCAO_LABEL: Record<FuncaoFuncionario, string> = {
  enfermeiro: "Enfermeiro", farmaceutico: "Farmacêutico",
  admin: "Administrador", gestor: "Gestor", tecnico: "Técnico Lab.",
  rececionista: "Recepcionista", financeiro: "Financeiro", medico: "Médico",
};

const MENU_GROUPS: { key: string; label: string; icon: Tab; ids: Tab[] }[] = [
  { key: "inicio",      label: "Início",          icon: "dashboard",    ids: ["dashboard"] },
  { key: "clinico",     label: "Clínico",         icon: "pacientes",    ids: ["recepcao","pacientes","agendamento","medico","urgencia","internamento","ginecologia","nutricao","receitas","enfermagem"] },
  { key: "diagnostico", label: "Diagnóstico",     icon: "exames",       ids: ["solicitar","laboratorio","historico","imagiologia","exames"] },
  { key: "farmacia",    label: "Farmácia",        icon: "farmacia",     ids: ["farmacia"] },
  { key: "financeiro",  label: "Financeiro",      icon: "faturacao",    ids: ["faturacao","contacorrente","notascredito","resumofinanceiro","seguradoras"] },
  { key: "stock",       label: "Stock e Compras", icon: "produtos",     ids: ["produtos","stock","pedidoscompra"] },
  { key: "admin",       label: "Administração",   icon: "funcionarios", ids: ["instituicao","funcionarios","parceiros","pass","medlink"] },
  { key: "comunicacao", label: "Comunicação",     icon: "chat",         ids: ["chat","biblioteca"] },
  { key: "relatorios",  label: "Relatórios",      icon: "relatorios",   ids: ["relatorios"] },
  { key: "modulos",     label: "Serviços hospitalares", icon: "hospitalar", ids: ["servicos"] },
  { key: "config",      label: "Configurações",   icon: "config",       ids: ["config"] },
];

const NAV_ALIASES: Readonly<Record<string, Tab>> = {
  lancamento: "laboratorio", hospitalar: "servicos", financeiro: "faturacao",
  salarios: "servicos", honorarios: "servicos",
  medlik: "medlink", arquivos: "biblioteca", triagem: "enfermagem", atendimento: "medico",
};
const normaliseTab = (value: string) => NAV_ALIASES[value] ?? value;

type NavGroup = (typeof MENU_GROUPS)[number] & { tabs: TabDef[] };

function buildGroups(allowed: TabDef[]): NavGroup[] {
  return MENU_GROUPS
    .map((g) => ({ ...g, tabs: g.ids.map((id) => allowed.find((t) => t.id === id)).filter(Boolean) as TabDef[] }))
    .filter((g) => g.tabs.length > 0);
}

/* ============================================================================ */
/*  ÍCONES                                                                      */
/* ============================================================================ */
const ICONS: Partial<Record<Tab, string>> = {
  laboratorio: '<path d="M9 3v6l-5 9a2 2 0 001.75 3h12.5A2 2 0 0020 18l-5-9V3"/><path d="M7 3h10M8 14h8"/>',
  biblioteca: '<path d="M3 4h6a4 4 0 014 4v13a4 4 0 00-4-3H3z"/><path d="M21 4h-5a3 3 0 00-3 3v14a4 4 0 014-3h4z"/>',
  instituicao: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 21v-4h6v4M8 7h2M14 7h2M8 11h2M14 11h2"/>',
  servicos: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 8v8M8 12h8"/>',
  dashboard: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  pacientes: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>',
  lancamento: '<path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/>',
  historico: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  exames: '<path d="M9 3v11a6 6 0 006-6V3"/><line x1="6" y1="3" x2="18" y2="3"/><path d="M5 21h14"/>',
  faturacao: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6"/><path d="M9 17h3"/>',
  contacorrente: '<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>',
  produtos: '<path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>',
  funcionarios: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>',
  parceiros: '<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  stock: '<path d="M9 3v11a6 6 0 006-6V3"/><line x1="6" y1="3" x2="18" y2="3"/><path d="M5 21h14"/><line x1="12" y1="16" x2="12" y2="21"/>',
  config: '<circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M19.07 19.07l-1.41-1.41M4.93 19.07l1.41-1.41"/>',
  medico: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v4M10 10h4"/>',
  imagiologia: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>',
  medlink: '<path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>',
  salarios: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>',
  solicitar: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>',
  pass: '<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>',
  recepcao: '<path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.7A2 2 0 012.18 1h3a2 2 0 012 1.72"/>',
  internamento: '<path d="M2 4v16M2 8h18a2 2 0 012 2v10M2 17h20M6 8v9"/>',
  agendamento: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  ginecologia: '<path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>',
  nutricao: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
  receitas: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/>',
  notascredito: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M9 15l3 3 3-3"/>',
  honorarios: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>',
  pedidoscompra: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/>',
  urgencia: '<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  relatorios: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/>',
  enfermagem: '<path d="M12 2l3 7h7l-5.5 4.5L18 22l-6-4-6 4 1.5-8.5L2 9h7z"/>',
  farmacia: '<path d="M10.5 20.5L20.5 10.5a3.5 3.5 0 00-5-5L5.5 15.5a3.5 3.5 0 005 5z"/><path d="M8.5 8.5l7 7"/>',
  chat: '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>',
  resumofinanceiro: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  seguradoras: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  hospitalar: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 8v8M8 12h8"/>',
  escolar: '<path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>',
};
const ICON_FALLBACK = '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>';

function Svg({ html, size = 16, stroke = 1.75 }: { html: string; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0"
      dangerouslySetInnerHTML={{ __html: html }} />
  );
}
const TabIcon = ({ id, size = 16 }: { id: Tab; size?: number }) => <Svg html={ICONS[id] ?? ICON_FALLBACK} size={size} />;

const IconChevron = ({ open }: { open?: boolean }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
    style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);
const IconSearch = () => <Svg size={15} stroke={2} html='<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>' />;
const IconMenu = () => <Svg size={18} stroke={2} html='<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>' />;
const IconLogout = () => <Svg size={15} stroke={2} html='<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>' />;

/* ============================================================================ */
/*  PEÇAS PARTILHADAS                                                           */
/* ============================================================================ */
const inicial = (s?: string) => (s || "?").trim().charAt(0).toUpperCase();

function Brand({ onDark = false, compact = false, session }: { onDark?: boolean; compact?: boolean; session: Session }) {
  const { data } = useApp();
  const nome = data.config.nomeClinica || session.empresaNome || "Laboratório";
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {data.config.logoData ? (
        <img src={data.config.logoData} alt="" className="h-9 w-9 shrink-0 rounded-md bg-white object-cover" />
      ) : (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-sm font-bold"
          style={{ background: onDark ? "#fff" : C.primary, color: onDark ? C.ink : "#fff" }}>
          {inicial(nome)}
        </div>
      )}
      {!compact && (
        <div className="min-w-0 leading-tight">
          <div className="truncate text-sm font-semibold" style={{ color: onDark ? "#fff" : C.text }}>{nome}</div>
          <div className="text-[11px]" style={{ color: onDark ? C.onInk : C.muted }}>NV Digital Hospitalar</div>
        </div>
      )}
    </div>
  );
}

function Popover({ children, onClose, align = "right", width = 256 }: { children: React.ReactNode; onClose: () => void; align?: "left" | "right"; width?: number }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="gx-pop absolute top-full z-50 mt-1.5 overflow-hidden rounded-lg border gx-surface"
        style={{ [align]: 0, width: `min(${width}px, calc(100vw - 16px))`, borderColor: C.line, boxShadow: "0 12px 32px rgba(10,42,82,.16)" } as React.CSSProperties}>
        {children}
      </div>
    </>
  );
}

function LayoutSelector({ current, onChange }: { current: MenuLayout; onChange: (l: MenuLayout) => void }) {
  const [open, setOpen] = useState(false);
  const cur = LAYOUT_OPTIONS.find((o) => o.id === current)!;
  return (
    <div className="relative">
      <button className="gx-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} title="Disposição do menu">
        <Svg html={cur.svg} size={15} />
        <span className="hidden xl:inline">{cur.label}</span>
        <IconChevron open={open} />
      </button>
      {open && (
        <Popover onClose={() => setOpen(false)} width={248}>
          <div className="border-b px-3.5 py-2.5 text-xs font-semibold" style={{ borderColor: C.line, color: C.muted }}>Disposição do menu</div>
          {LAYOUT_OPTIONS.map((o) => (
            <button key={o.id} className="gx-row" aria-current={current === o.id ? "page" : undefined}
              onClick={() => { onChange(o.id); setOpen(false); }}>
              <Svg html={o.svg} size={18} />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold">{o.label}</span>
                <span className="block text-[11px] font-normal" style={{ color: C.muted }}>{o.desc}</span>
              </span>
            </button>
          ))}
        </Popover>
      )}
    </div>
  );
}

function UserMenu({ session, onLogout, colourTheme, theme, onColour, onMode }: {
  session: Session; onLogout: () => void; colourTheme: ColourTheme; theme: Theme;
  onColour: (value: ColourTheme) => void; onMode: (value: Theme) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showColours, setShowColours] = useState(false);
  const nome = session.funcionarioNome || session.username;
  return (
    <div className="relative">
      <button className="gx-btn !p-1 !pr-2.5" onClick={() => { setOpen((o) => !o); setShowColours(false); }} aria-haspopup="menu" aria-expanded={open}>
        <span className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: C.primary }}>{inicial(nome)}</span>
        <span className="hidden max-w-[120px] truncate md:inline">{nome}</span>
        <span className="hidden md:inline"><IconChevron open={open} /></span>
      </button>
      {open && (
        <Popover onClose={() => { setOpen(false); setShowColours(false); }} width={316}>
          <div className="border-b px-3.5 py-3" style={{ borderColor: C.line }}>
            <div className="truncate text-sm font-semibold">{nome}</div>
            <div className="text-xs" style={{ color: C.muted }}>{session.funcao ? FUNCAO_LABEL[session.funcao] : "Utilizador"}</div>
            {session.empresaNome && <div className="mt-0.5 truncate text-xs" style={{ color: C.muted }}>{session.empresaNome}</div>}
          </div>
          <div className="gx-profile-actions">
            <button type="button" aria-expanded={showColours} aria-controls="gx-profile-colours"
              onClick={() => setShowColours((value) => !value)}>
              <Svg size={17} html='<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 3a9 9 0 100 18h1a2 2 0 001-3.7 1.8 1.8 0 011-3.3h2a4 4 0 004-4c0-4-4-7-9-7z"/>' />
              Cores
            </button>
            <button type="button" className="gx-profile-logout" onClick={() => { setOpen(false); onLogout(); }}>
              <IconLogout /> Terminar sessão
            </button>
          </div>
          {showColours && (
            <div id="gx-profile-colours" className="gx-profile-colours" role="group" aria-label="Tema da aplicação">
              <div className="gx-colour-head"><div><h2>Tema da aplicação</h2><p>Preferência da tua conta nesta instituição.</p></div></div>
              <div className="gx-colour-grid" role="group" aria-label="Cores disponíveis">
                {COLOUR_THEMES.map((choice) => (
                  <button type="button" key={choice.id} className="gx-colour-option"
                    aria-pressed={colourTheme === choice.id} onClick={() => onColour(choice.id)}>
                    <span className="gx-colour-dot" style={{ background: choice.color, color: choice.id === "light" ? "#17263d" : "#fff" }}>
                      {colourTheme === choice.id && <span aria-hidden="true">✓</span>}
                    </span>
                    <span>{choice.label}</span>
                  </button>
                ))}
              </div>
              <div className="gx-colour-modes" role="group" aria-label="Luminosidade">
                <button type="button" aria-pressed={theme === "claro"} onClick={() => onMode("claro")}>Modo claro</button>
                <button type="button" aria-pressed={theme === "escuro"} onClick={() => onMode("escuro")}>Modo escuro</button>
              </div>
            </div>
          )}
        </Popover>
      )}
    </div>
  );
}

function FloatingControls({ onChat, chatAllowed }: { onChat: () => void; chatAllowed: boolean }) {
  return (
    <div className="gx-floating-tools" role="group" aria-label="Ferramentas flutuantes">
        <button type="button" className="gx-float-button gx-float-agent" title="Agente IA"
          aria-label="Abrir agente IA" aria-haspopup="dialog" aria-controls="nv-assistant"
          onClick={() => window.dispatchEvent(new Event("nv:assistant-open"))}>
          <Svg size={25} html='<rect x="4" y="7" width="16" height="13" rx="4"/><path d="M12 3v4M2 11v5M22 11v5M9 16h6"/><circle cx="8.5" cy="12" r=".5"/><circle cx="15.5" cy="12" r=".5"/>' />
          <span>Agente IA</span>
        </button>
        {chatAllowed && (
          <button type="button" className="gx-float-button gx-float-chat" title="Chat da instituição"
            aria-label="Abrir chat" onClick={onChat}>
            <Svg size={25} html='<path d="M21 11.5a8.5 8.5 0 01-8.5 8.5H6l-4 3V11.5a8.5 8.5 0 0117 0z"/><circle cx="7" cy="11.5" r=".5"/><circle cx="11.5" cy="11.5" r=".5"/><circle cx="16" cy="11.5" r=".5"/>' />
            <span>Chat</span>
          </button>
        )}
    </div>
  );
}

interface ActionsProps {
  session: Session; layout: MenuLayout; onLayout: (l: MenuLayout) => void;
  onSearch: () => void; onLogout: () => void; onNav: (t: string) => void;
  theme: Theme; onTheme: () => void;
  colourTheme: ColourTheme; onColour: (value: ColourTheme) => void; onMode: (value: Theme) => void;
}
function HeaderActions({ session, layout, onLayout, onSearch, onLogout, onNav, theme, onTheme, colourTheme, onColour, onMode }: ActionsProps) {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2">
      <button className="gx-btn" onClick={onSearch} title="Procurar módulo (Ctrl+K)">
        <IconSearch />
        <span className="hidden sm:inline" style={{ color: C.muted }}>Procurar</span>
        <span className="gx-kbd hidden md:inline">Ctrl K</span>
      </button>
      <button className="gx-btn !px-2.5" onClick={onTheme} aria-label={theme === "escuro" ? "Passar para modo claro" : "Passar para modo escuro"}
        title={theme === "escuro" ? "Modo claro" : "Modo escuro"}>
        <Svg size={15} stroke={2} html={theme === "escuro"
          ? '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>'
          : '<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>'} />
      </button>
      <LayoutSelector current={layout} onChange={onLayout} />
      <div className="gx-bell"><NotificationBell onTabChange={onNav} /></div>
      <UserMenu session={session} onLogout={onLogout} colourTheme={colourTheme} theme={theme} onColour={onColour} onMode={onMode} />
    </div>
  );
}

/* ── Paleta de comandos: procurar qualquer módulo ── */
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function CommandPalette({ tabs, recents, current, onPick, onClose }: { tabs: TabDef[]; recents: TabDef[]; current: Tab; onPick: (t: Tab) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const query = norm(q.trim());
  const results = useMemo(() => {
    if (query) return tabs.filter((t) => norm(t.label).includes(query));
    const ids = new Set(recents.map((t) => t.id));
    return [...recents, ...tabs.filter((t) => !ids.has(t.id))];
  }, [tabs, recents, query]);
  const nRecent = query ? 0 : recents.length;
  useEffect(() => setI(0), [q]);
  useEffect(() => { listRef.current?.querySelector<HTMLElement>(`[data-i="${i}"]`)?.scrollIntoView({ block: "nearest" }); }, [i]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setI((x) => Math.min(x + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(x - 1, 0)); }
    else if (e.key === "Enter" && results[i]) onPick(results[i].id);
    else if (e.key === "Escape") onClose();
  };
  const sub = (txt: string) => <div className="px-4 pb-1 pt-2 text-[11px] font-semibold" style={{ color: C.muted }}>{txt}</div>;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]" style={{ background: "rgba(8,31,61,.55)" }} onClick={onClose}>
      <div className="gx-pop w-full max-w-lg overflow-hidden rounded-xl gx-surface" role="dialog" aria-label="Procurar módulo"
        style={{ boxShadow: "0 24px 60px rgba(8,31,61,.35)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 border-b px-4" style={{ borderColor: C.line }}>
          <span style={{ color: C.muted }}><IconSearch /></span>
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey}
            placeholder="Para onde queres ir?" aria-label="Procurar módulo"
            className="w-full bg-transparent py-3.5 text-sm outline-none" />
          <span className="gx-kbd">Esc</span>
        </div>
        <div ref={listRef} className="gx-scroll max-h-[50vh] overflow-y-auto pb-1.5">
          {results.length === 0 && <p className="px-4 py-6 text-center text-sm" style={{ color: C.muted }}>Nenhum módulo corresponde a “{q}”.</p>}
          {results.map((t, idx) => (
            <React.Fragment key={t.id}>
              {nRecent > 0 && idx === 0 && sub("Recentes")}
              {nRecent > 0 && idx === nRecent && sub("Todos os módulos")}
              <button data-i={idx} onClick={() => onPick(t.id)} onMouseEnter={() => setI(idx)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm"
                style={{ background: idx === i ? C.tint : "transparent", color: idx === i ? C.link : C.text, fontWeight: t.id === current ? 600 : 500 }}>
                <TabIcon id={t.id} size={16} />
                <span className="flex-1">{t.label}</span>
                <span className="text-[11px]" style={{ color: C.muted }}>{MENU_GROUPS.find((g) => g.ids.includes(t.id))?.label}</span>
                {SHORTCUTS[t.id] && <span className="gx-kbd">G {SHORTCUTS[t.id]!.toUpperCase()}</span>}
              </button>
            </React.Fragment>
          ))}
        </div>
        <div className="border-t px-4 py-2 text-[11px]" style={{ borderColor: C.line, color: C.muted }}>
          Atalho em qualquer ecrã: carrega em G e depois na letra indicada.
        </div>
      </div>
    </div>
  );
}

/* ── Cabeçalho comum (título da página + acções) ── */
function PageHeader({ session, current, leading, actions }: { session: Session; current?: TabDef; leading?: React.ReactNode; actions: ActionsProps }) {
  const grupo = MENU_GROUPS.find((g) => current && g.ids.includes(current.id));
  return (
    <header className="sticky top-0 z-20 flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b gx-surface px-3 py-2.5 sm:flex-nowrap sm:px-6" style={{ borderColor: C.line }}>
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        {leading}
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[11px]" style={{ color: C.muted }}>{grupo?.label ?? ""}</div>
          <h1 className="truncate text-[15px] font-semibold">{current?.label ?? ""}</h1>
        </div>
      </div>
      <div className="ml-auto min-w-0 max-w-full shrink-0"><HeaderActions {...actions} session={session} /></div>
    </header>
  );
}

/* ============================================================================ */
/*  LAYOUT 1 — LATERAL                                                          */
/* ============================================================================ */
function Sidebar({ session, groups, tab, onPick, open, onClose, onSearch, collapsed, onToggle, onLogout }: {
  session: Session; groups: NavGroup[]; tab: Tab; onPick: (t: Tab) => void; open: boolean; onClose: () => void;
  onSearch: () => void; collapsed: boolean; onToggle: () => void; onLogout: () => void;
}) {
  const rail = collapsed && !open; // em móvel a gaveta abre sempre completa
  const activeGroup = groups.find((g) => g.ids.includes(tab))?.key ?? null;
  const [openGroup, setOpenGroup] = useState<string | null>(activeGroup);
  useEffect(() => setOpenGroup(activeGroup), [activeGroup]);
  const nome = session.funcionarioNome || session.username;
  const center = rail ? { justifyContent: "center" as const } : undefined;

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={onClose} />}
      <aside className={`gx-dark fixed left-0 top-0 z-30 flex h-full flex-col transition-[transform,width] duration-200 lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
        style={{ background: C.ink, width: rail ? 68 : 248 }} aria-label="Menu principal">
        <div className={`border-b py-3.5 ${rail ? "flex justify-center px-0" : "px-4"}`} style={{ borderColor: "rgba(255,255,255,.1)", background: C.ink2 }}>
          <Brand onDark compact={rail} session={session} />
        </div>

        <div className={rail ? "flex justify-center pt-3" : "px-3 pt-3"}>
          {rail ? (
            <button onClick={onSearch} title="Procurar módulo (Ctrl+K)" aria-label="Procurar módulo"
              className="flex h-9 w-9 items-center justify-center rounded-md border transition hover:bg-white/10"
              style={{ borderColor: "rgba(255,255,255,.18)", color: C.onInk }}><IconSearch /></button>
          ) : (
            <button onClick={onSearch} className="flex w-full items-center gap-2 rounded-md border px-3 py-2 text-xs transition hover:bg-white/10"
              style={{ borderColor: "rgba(255,255,255,.18)", color: C.onInk }}>
              <IconSearch /> <span className="flex-1 text-left">Procurar módulo</span>
              <span className="rounded border px-1.5 text-[10px]" style={{ borderColor: "rgba(255,255,255,.25)" }}>Ctrl K</span>
            </button>
          )}
        </div>

        <nav className="gx-scroll flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
          {groups.map((g) => {
            if (g.tabs.length === 1) {
              const t = g.tabs[0];
              return (
                <button key={g.key} className="gx-side" style={center} title={rail ? g.label : undefined}
                  aria-current={tab === t.id ? "page" : undefined} onClick={() => onPick(t.id)}>
                  <TabIcon id={g.icon} />{!rail && <span className="flex-1 truncate">{g.label}</span>}
                </button>
              );
            }
            const isOpen = !rail && openGroup === g.key;
            const activeHere = g.key === activeGroup;
            return (
              <div key={g.key}>
                <button className="gx-side" style={{ ...center, ...(activeHere && !isOpen ? { color: "#fff", background: "rgba(255,255,255,.1)" } : {}) }}
                  title={rail ? g.label : undefined} aria-expanded={isOpen}
                  onClick={() => { if (rail) { onToggle(); setOpenGroup(g.key); } else setOpenGroup(isOpen ? null : g.key); }}>
                  <TabIcon id={g.icon} />
                  {!rail && <><span className="flex-1 truncate">{g.label}</span><IconChevron open={isOpen} /></>}
                </button>
                {isOpen && (
                  <div className="ml-[19px] mt-0.5 space-y-0.5 border-l pl-2" style={{ borderColor: "rgba(255,255,255,.14)" }}>
                    {g.tabs.map((t) => (
                      <button key={t.id} className="gx-side" aria-current={tab === t.id ? "page" : undefined} onClick={() => onPick(t.id)}>
                        <span className="flex-1 truncate">{t.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="hidden px-3 pb-2 lg:block">
          <button className="gx-side" style={center} onClick={onToggle} title={rail ? "Expandir menu" : "Recolher menu"}
            aria-label={rail ? "Expandir menu" : "Recolher menu"}>
            <Svg size={16} stroke={2} html={rail ? '<polyline points="9 18 15 12 9 6"/>' : '<polyline points="15 18 9 12 15 6"/>'} />
            {!rail && <span>Recolher menu</span>}
          </button>
        </div>

        <div className="border-t p-3" style={{ borderColor: "rgba(255,255,255,.1)", background: C.ink2 }}>
          {rail ? (
            <button onClick={onLogout} title="Terminar sessão" aria-label="Terminar sessão"
              className="mx-auto flex h-9 w-9 items-center justify-center rounded-md transition hover:bg-white/10" style={{ color: C.onInk }}>
              <IconLogout />
            </button>
          ) : (
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold" style={{ color: C.ink }}>{inicial(nome)}</span>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-xs font-semibold text-white">{nome}</div>
                <div className="truncate text-[11px]" style={{ color: C.onInk }}>{session.funcao ? FUNCAO_LABEL[session.funcao] : ""}</div>
              </div>
              <button onClick={onLogout} title="Terminar sessão" aria-label="Terminar sessão"
                className="flex h-8 w-8 items-center justify-center rounded-md transition hover:bg-white/10" style={{ color: C.onInk }}>
                <IconLogout />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

/* ============================================================================ */
/*  LAYOUT 2 — CABEÇALHO                                                        */
/* ============================================================================ */
function TopNav({ session, groups, tab, onPick, actions }: { session: Session; groups: NavGroup[]; tab: Tab; onPick: (t: Tab) => void; actions: ActionsProps }) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  return (
    <header className="gx-dark sticky top-0 z-40" style={{ background: C.ink }}>
      <div className="flex min-w-0 flex-wrap items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 lg:flex-nowrap">
        <div className="min-w-0 flex-1 lg:flex-none"><Brand onDark session={session} /></div>
        <nav className="ml-3 hidden flex-1 items-center gap-0.5 lg:flex" aria-label="Menu principal">
          {groups.map((g) => {
            const active = g.ids.includes(tab);
            const single = g.tabs.length === 1;
            return (
              <div key={g.key} className="relative">
                <button className="flex items-center gap-1.5 rounded-md px-3 py-2 text-[13px] font-medium transition hover:bg-white/10"
                  style={{ color: active ? "#fff" : C.onInk, background: active ? "rgba(255,255,255,.12)" : undefined }}
                  aria-expanded={openMenu === g.key}
                  onClick={() => (single ? onPick(g.tabs[0].id) : setOpenMenu(openMenu === g.key ? null : g.key))}>
                  {g.label}{!single && <IconChevron open={openMenu === g.key} />}
                </button>
                {openMenu === g.key && !single && (
                  <Popover onClose={() => setOpenMenu(null)} align="left" width={232}>
                    {g.tabs.map((t) => (
                      <button key={t.id} className="gx-row" aria-current={tab === t.id ? "page" : undefined}
                        onClick={() => { onPick(t.id); setOpenMenu(null); }}>
                        <TabIcon id={t.id} /> {t.label}
                      </button>
                    ))}
                  </Popover>
                )}
              </div>
            );
          })}
        </nav>
        <div className="order-3 w-full min-w-0 sm:order-none sm:w-auto lg:ml-auto"><HeaderActions {...actions} session={session} /></div>
        <button className="ml-auto rounded-md border p-2 lg:hidden" style={{ borderColor: "rgba(255,255,255,.25)", color: C.onInk }}
          onClick={() => setMobile((m) => !m)} aria-label="Abrir menu" aria-expanded={mobile}><IconMenu /></button>
      </div>
      {mobile && (
        <div className="gx-scroll max-h-[70vh] overflow-y-auto border-t lg:hidden" style={{ borderColor: "rgba(255,255,255,.12)", background: C.ink2 }}>
          {groups.map((g) => (
            <div key={g.key} className="px-3 py-2">
              <div className="px-2 pb-1 text-[11px] font-semibold" style={{ color: C.onInk }}>{g.label}</div>
              {g.tabs.map((t) => (
                <button key={t.id} className="gx-side" aria-current={tab === t.id ? "page" : undefined} onClick={() => { onPick(t.id); setMobile(false); }}>
                  <TabIcon id={t.id} /> {t.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </header>
  );
}

/* ============================================================================ */
/*  LAYOUT 3 — RODAPÉ (móvel)                                                   */
/* ============================================================================ */
function BottomNav({ groups, tab, onPick }: { groups: NavGroup[]; tab: Tab; onPick: (t: Tab) => void }) {
  const principais: Tab[] = ["dashboard", "pacientes", "laboratorio", "faturacao"];
  const all = groups.flatMap((g) => g.tabs);
  const main = principais.map((id) => all.find((t) => t.id === id)).filter(Boolean) as TabDef[];
  const [more, setMore] = useState(false);
  const inMain = main.some((t) => t.id === tab);

  return (
    <>
      {more && (
        <div className="fixed inset-0 z-40 flex items-end" style={{ background: "rgba(8,31,61,.55)" }} onClick={() => setMore(false)}>
          <div className="gx-pop w-full rounded-t-2xl gx-surface" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Todos os módulos">
            <div className="flex items-center justify-between border-b px-5 py-3.5" style={{ borderColor: C.line }}>
              <h2 className="text-sm font-semibold">Todos os módulos</h2>
              <button onClick={() => setMore(false)} className="gx-btn" aria-label="Fechar">Fechar</button>
            </div>
            <div className="gx-scroll max-h-[68vh] overflow-y-auto p-4">
              {groups.map((g) => (
                <div key={g.key} className="mb-4">
                  <div className="mb-2 text-xs font-semibold" style={{ color: C.muted }}>{g.label}</div>
                  <div className="grid grid-cols-2 gap-2">
                    {g.tabs.map((t) => (
                      <button key={t.id} onClick={() => { onPick(t.id); setMore(false); }}
                        className="flex items-center gap-2 rounded-lg border p-3 text-left text-[13px] font-medium"
                        style={{ borderColor: tab === t.id ? C.accent : C.line, background: tab === t.id ? C.tint : C.surface, color: tab === t.id ? C.link : C.text }}>
                        <TabIcon id={t.id} /> <span className="truncate">{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex min-w-0 border-t gx-surface" aria-label="Navegação inferior"
        style={{ borderColor: C.line, paddingBottom: "env(safe-area-inset-bottom)" }}>
        {[...main.map((t) => ({ id: t.id as string, label: t.label, active: tab === t.id, icon: <TabIcon id={t.id} size={20} />, go: () => onPick(t.id) })),
          { id: "mais", label: "Mais", active: !inMain, icon: <Svg size={20} html='<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>' stroke={2.5} />, go: () => setMore(true) },
        ].map((b) => (
          <button key={b.id} onClick={b.go} aria-current={b.active ? "page" : undefined}
            className="relative flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 pb-1.5 pt-2.5 text-[11px] font-medium"
            style={{ color: b.active ? C.link : C.muted }}>
            {b.active && <span className="absolute inset-x-5 top-0 h-[3px] rounded-b" style={{ background: C.primary }} />}
            {b.icon}
            <span className="max-w-full truncate">{b.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}

/* ============================================================================ */
/*  LAYOUT 4 — CARTÕES                                                          */
/* ============================================================================ */
function parseData(v?: string): Date | null {
  if (!v) return null;
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/.exec(v);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  return null;
}
const ehHoje = (v?: string) => parseData(v)?.toDateString() === new Date().toDateString();

function fmtMoeda(v: number, moeda: string) {
  try { return new Intl.NumberFormat("pt-AO", { style: "currency", currency: moeda || "AOA", maximumFractionDigits: 0 }).format(v); }
  catch { return `${Math.round(v).toLocaleString("pt-PT")} ${moeda}`; }
}

type StatKey = "pacientes" | "semResultados" | "resultadosHoje" | "rascunhos" | "porCobrar" | "facturadoHoje" | "saldo";
const STATS_BY_ROLE: Record<FuncaoFuncionario, StatKey[]> = {
  enfermeiro: ["pacientes", "resultadosHoje", "semResultados"],
  farmaceutico: ["pacientes"],
  admin: ["facturadoHoje", "porCobrar", "saldo", "pacientes"],
  gestor: ["facturadoHoje", "porCobrar", "saldo", "pacientes"],
  tecnico: ["semResultados", "resultadosHoje", "pacientes"],
  rececionista: ["pacientes", "rascunhos", "facturadoHoje"],
  financeiro: ["porCobrar", "facturadoHoje", "saldo", "rascunhos"],
  medico: ["resultadosHoje", "semResultados", "pacientes"],
};

function CardsHome({ session, groups, recents, onPick }: { session: Session; groups: NavGroup[]; recents: TabDef[]; onPick: (t: Tab) => void }) {
  const { data } = useApp();
  const nome = session.funcionarioNome || session.username;
  const funcao = session.funcao ?? (session.role === "empresa" ? "admin" : undefined);
  const all = groups.flatMap((g) => g.tabs);
  const quick = (funcao ? QUICK_BY_ROLE[funcao] : []).map((id) => all.find((t) => t.id === id)).filter(Boolean) as TabDef[];
  const quickIds = new Set(quick.map((t) => t.id));
  const rec = recents.filter((t) => !quickIds.has(t.id)).slice(0, 4);
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 19 ? "Boa tarde" : "Boa noite";

  const stats = useMemo(() => {
    const m = data.config.moeda || "AOA";
    const emitidas = data.faturas.filter((f) => f.estado === "emitida" && f.tipoDocumento !== "nota-credito" && countsAsRevenue(f));
    const porCobrar = financialSummary(data.faturas).pending;
    const facturadoHoje = data.faturas
      .filter((f) => countsAsRevenue(f) && ehHoje(f.data))
      .reduce((t, f) => t + f.total, 0);
    const saldo = data.movimentosCC.reduce((t, x) => t + (x.tipo === "entrada" ? x.valor : -x.valor), 0);
    const rascunhos = data.faturas.filter((f) => f.estado === "rascunho").length;
    const semResultados = data.pacientes.filter(
      (p) => !data.resultados.some((r) => r.pacienteId === p.id),
    ).length;
    const resultadosHoje = data.resultados.filter((r) => ehHoje(r.dataEmissao) || ehHoje(r.data)).length;
    const map: Record<StatKey, { label: string; valor: string; nota?: string; tab: Tab; alerta?: boolean }> = {
      pacientes: { label: "Pacientes registados", valor: String(data.pacientes.length), tab: "pacientes" },
      semResultados: { label: "Pacientes sem resultados no histórico", valor: String(semResultados), nota: "Sem resultado no histórico disponível", tab: "laboratorio" },
      resultadosHoje: { label: "Resultados de hoje", valor: String(resultadosHoje), tab: "historico" },
      rascunhos: { label: "Facturas em rascunho", valor: String(rascunhos), nota: "Ainda por emitir", tab: "faturacao", alerta: rascunhos > 0 },
      porCobrar: { label: "Por cobrar", valor: fmtMoeda(porCobrar, m), nota: `${emitidas.length} ${emitidas.length === 1 ? "factura emitida" : "facturas emitidas"}`, tab: "faturacao" },
      facturadoHoje: { label: "Facturado hoje", valor: fmtMoeda(facturadoHoje, m), tab: "faturacao" },
      saldo: { label: "Saldo da conta corrente", valor: fmtMoeda(saldo, m), tab: "contacorrente" },
    };
    return map;
  }, [data]);

  const cartoes = (funcao ? STATS_BY_ROLE[funcao] : []).map((k) => stats[k]).filter((x) => all.some((t) => t.id === x.tab));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h2 className="text-xl font-semibold">{saudacao}, {nome}</h2>
      <p className="mb-6 mt-1 text-sm" style={{ color: C.muted }}>{funcao ? FUNCAO_LABEL[funcao] : "Perfil não atribuído"}</p>

      {cartoes.length > 0 && (
        <section className="mb-8" aria-label="Resumo">
          <h3 className="mb-3 text-sm font-semibold">Resumo</h3>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {cartoes.map((x) => (
              <button key={x.label} onClick={() => onPick(x.tab)}
                className="gx-surface rounded-lg border p-4 text-left transition hover:shadow-md" style={{ borderColor: C.line }}>
                <div className="text-xs" style={{ color: C.muted }}>{x.label}</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums" style={{ color: x.alerta ? "#b42318" : C.text }}>{x.valor}</div>
                {x.nota && <div className="mt-1 text-[11px]" style={{ color: C.muted }}>{x.nota}</div>}
              </button>
            ))}
          </div>
        </section>
      )}

      {quick.length > 0 && (
        <section className="mb-8" aria-label="Acesso rápido">
          <h3 className="mb-3 text-sm font-semibold">Acesso rápido</h3>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {quick.map((t) => (
              <button key={t.id} onClick={() => onPick(t.id)}
                className="gx-surface flex items-center gap-3 rounded-lg border p-3.5 text-left text-sm font-medium transition hover:shadow-md"
                style={{ borderColor: C.line }}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md" style={{ background: C.tint, color: C.link }}>
                  <TabIcon id={t.id} size={18} />
                </span>
                <span className="flex-1 truncate">{t.label}</span>
                {SHORTCUTS[t.id] && <span className="gx-kbd">G {SHORTCUTS[t.id]!.toUpperCase()}</span>}
              </button>
            ))}
          </div>
        </section>
      )}

      {rec.length > 0 && (
        <section className="mb-8" aria-label="Usados recentemente">
          <h3 className="mb-3 text-sm font-semibold">Usados recentemente</h3>
          <div className="flex flex-wrap gap-2">
            {rec.map((t) => (
              <button key={t.id} className="gx-btn" onClick={() => onPick(t.id)}><TabIcon id={t.id} size={14} /> {t.label}</button>
            ))}
          </div>
        </section>
      )}

      <h3 className="mb-3 text-sm font-semibold">Todos os módulos</h3>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => (
          <section key={g.key} className="gx-surface overflow-hidden rounded-lg border" style={{ borderColor: C.line }}>
            <h4 className="flex items-center gap-2.5 border-b px-4 py-3 text-sm font-semibold" style={{ borderColor: C.line, background: C.tint, color: C.link }}>
              <TabIcon id={g.icon} size={17} /> {g.label}
            </h4>
            <div className="py-1">
              {g.tabs.map((t) => (
                <button key={t.id} className="gx-row" onClick={() => onPick(t.id)}>
                  <span style={{ color: C.muted }}><TabIcon id={t.id} size={15} /></span> {t.label}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

/* ============================================================================ */
/*  PÁGINAS                                                                     */
/* ============================================================================ */
class PageBoundary extends React.Component<{ children: React.ReactNode }, { erro: Error | null }> {
  state = { erro: null as Error | null };
  static getDerivedStateFromError(erro: Error) { return { erro }; }
  componentDidCatch(erro: Error) { console.error("Erro na página:", erro); }
  render() {
    if (!this.state.erro) return this.props.children;
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "#fdecea", color: "#b42318" }}>
            <Svg size={26} html='<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>' />
          </div>
          <h2 className="text-lg font-semibold">Esta página não abriu</h2>
          <p className="mb-5 mt-1.5 text-sm" style={{ color: "#5d6d84" }}>
            A página encontrou um erro. Tenta de novo; se continuar, recarrega a aplicação e verifica os dados antes de repetir uma gravação.
          </p>
          <div className="flex justify-center gap-2">
            <button className="gx-btn" onClick={() => this.setState({ erro: null })}>Tentar de novo</button>
            <button className="rounded-md px-4 py-2 text-xs font-semibold text-white" style={{ background: "#0f4c9a" }}
              onClick={() => window.location.reload()}>Recarregar</button>
          </div>
        </div>
      </div>
    );
  }
}

function PageLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-label="A carregar página">
      <div className="h-8 w-8 animate-spin rounded-full border-2" style={{ borderColor: "#dbe4ef", borderTopColor: "#0f4c9a" }} />
    </div>
  );
}

function renderPage(tab: Tab, session: Session, onNav: (tab: string) => void, allowed: string[]) {
  switch (tab) {
    case "recepcao":         return <Recepcao session={session} onNav={onNav} />;
    case "agendamento":      return <Agendamento session={session} />;
    case "urgencia":         return <Urgencia session={session} />;
    case "internamento":     return <Internamento session={session} />;
    case "ginecologia":      return <Ginecologia session={session} />;
    case "nutricao":         return <Nutricao session={session} />;
    case "receitas":         return <Receitas session={session} />;
    case "enfermagem":       return <Enfermagem session={session} />;
    case "farmacia":         return <Farmacia session={session} />;
    case "chat":             return <ChatApp session={session} />;
    case "resumofinanceiro": return <ResumoFinanceiro session={session} />;
    case "dashboard":        return <Dashboard session={session} onNav={onNav} allowed={allowed} />;
    case "pacientes":        return <Pacientes session={session} />;
    case "lancamento":
    case "laboratorio":      return <Laboratorio session={session} />;
    case "historico":        return <Historico />;
    case "exames":           return <div className="nv-workspace"><Catalogo /></div>;
    case "produtos":         return <GestaProdutos />;
    case "faturacao":        return <Faturacao session={session} onNav={onNav} />;
    case "contacorrente":    return <ContaCorrente session={session} />;
    case "funcionarios":     return <AdminFuncionarios session={session} />;
    case "parceiros":        return <GestaParceiros session={session} />;
    case "stock":            return <GestaStock session={session} />;
    case "config":           return <Configuracoes />;
    case "instituicao":       return <Instituicao />;
    case "biblioteca":       return <Biblioteca />;
    case "hospitalar":
    case "servicos":         return <ServicosHospitalares session={session} />;
    case "medico":           return <Medico session={session} />;
    case "imagiologia":      return <Imagiologia />;
    case "medlink":          return <MedLink session={session} />;
    case "salarios":         return <ServicosHospitalares session={session} initialHRTab="salarios" />;
    case "solicitar":        return <SolicitarExames session={session} />;
    case "pass":             return <PassApp session={session} />;
    case "notascredito":     return <NotasCredito />;
    case "honorarios":       return <ServicosHospitalares session={session} initialHRTab="salarios" />;
    case "pedidoscompra":    return <PedidosCompra />;
    case "seguradoras":      return <Seguradoras session={session} />;
    case "relatorios":       return <Relatorios />;
    default:                 return null;
  }
}

/* ============================================================================ */
/*  SHELL                                                                       */
/* ============================================================================ */
function FullScreen({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <div className="gx flex min-h-screen items-center justify-center px-6" style={{ background: dark ? C.ink : C.surface }}>
      <style>{CSS}</style>
      {children}
    </div>
  );
}

function Spinner({ texto }: { texto: string }) {
  return (
    <div className="text-center" role="status">
      <div className="mx-auto mb-3 h-9 w-9 animate-spin rounded-full border-2 border-white/25 border-t-white" />
      <p className="text-sm" style={{ color: C.onInk }}>{texto}</p>
    </div>
  );
}

function Shell({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const { loading, loadError, reload, isOnline, pendingCount, syncNow } = useApp();
  const { data } = useApp();
  const funcao = session.funcao ?? (session.role === "empresa" ? "admin" : undefined);
  const modulos = useMemo(() => session.modulos ?? ["laboratorial"], [session.modulos]);
  const preferenceScope = [session.empresaId ?? "", session.funcionarioId ?? session.username].map(encodeURIComponent).join(":");
  const preferenceKey = useCallback((key: string) => [key, preferenceScope].join(":"), [preferenceScope]);

  const allowedTabs = useMemo(() => ALL_TABS.filter((t) => {
    if (!canAccess(funcao, t.roles)) return false;
    if (t.modulo && !modulos.includes(t.modulo)) return false;
    return true;
  }), [funcao, modulos]);
  const groups = useMemo(() => buildGroups(allowedTabs), [allowedTabs]);

  // Abre no módulo do endereço (#pacientes), ou no último usado, ou no primeiro permitido
  const [tab, setTab] = useState<Tab>(() => {
    const h = normaliseTab(window.location.hash.slice(1));
    const fromHash = allowedTabs.find((t) => t.id === h);
    if (fromHash) return fromHash.id;
    try {
      const last = allowedTabs.find((t) => t.id === normaliseTab(localStorage.getItem(preferenceKey(LAST_KEY)) || ""));
      if (last) return last.id;
    } catch { /* ignora */ }
    return allowedTabs[0]?.id ?? "dashboard";
  });
  const [home, setHome] = useState(() => !window.location.hash); // só para o layout em cartões
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(preferenceKey(COLLAPSE_KEY)) === "1"; } catch { return false; }
  });
  const [recents, setRecents] = useState<Tab[]>(() => {
    try { const r = JSON.parse(localStorage.getItem(preferenceKey(RECENT_KEY)) || "[]"); return Array.isArray(r) ? r : []; } catch { return []; }
  });
  const [appearance, setAppearance] = useState<Appearance>(() => loadAppearance(preferenceKey, session));
  const { theme, colourTheme } = appearance;
  const changeColour = useCallback((value: ColourTheme) => {
    setAppearance({ colourTheme: value, theme: value === "navy" ? "escuro" : "claro" });
  }, []);
  const changeMode = useCallback((value: Theme) => {
    setAppearance((current) => ({ ...current, theme: value }));
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const keys = ["data-nv-theme", "data-gx-colour", "data-gx-mode"] as const;
    const previous = keys.map((key) => root.getAttribute(key));
    return () => keys.forEach((key, index) => {
      const value = previous[index];
      if (value === null) root.removeAttribute(key);
      else root.setAttribute(key, value);
    });
  }, []);
  useEffect(() => {
    document.documentElement.dataset.nvTheme = theme === "escuro" ? "navy" : colourTheme === "navy" ? "blue" : colourTheme;
    document.documentElement.dataset.gxColour = colourTheme;
    document.documentElement.dataset.gxMode = theme;
  }, [theme, colourTheme]);
  useEffect(() => {
    try {
      localStorage.setItem(preferenceKey(COLOUR_KEY), colourTheme);
      localStorage.setItem(["nv", "theme", session.empresaId, session.username].join(":"), colourTheme);
    } catch { /* Preferências são opcionais. */ }
  }, [colourTheme, preferenceKey, session.empresaId, session.username]);
  const loadedOnce = useRef(false); // o ecrã de carregamento total só serve para o primeiro carregamento
  const firstSync = useRef(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [palette, setPalette] = useState(false);
  const [layout, setLayout] = useState<MenuLayout>(() => {
    try {
      const v = localStorage.getItem(preferenceKey(LAYOUT_KEY)) as MenuLayout | null;
      return v && LAYOUT_OPTIONS.some((o) => o.id === v) ? v : "lateral";
    } catch { return "lateral"; }
  });

  useEffect(() => { try { localStorage.setItem(preferenceKey(LAYOUT_KEY), layout); } catch { /* ignora */ } }, [layout, preferenceKey]);
  useEffect(() => { try { localStorage.setItem(preferenceKey(THEME_KEY), theme); } catch { /* ignora */ } }, [theme, preferenceKey]);
  useEffect(() => { try { localStorage.setItem(preferenceKey(COLLAPSE_KEY), collapsed ? "1" : "0"); } catch { /* ignora */ } }, [collapsed, preferenceKey]);
  useEffect(() => { try { localStorage.setItem(preferenceKey(RECENT_KEY), JSON.stringify(recents)); } catch { /* ignora */ } }, [recents, preferenceKey]);



  const currentTab: Tab = allowedTabs.some((t) => t.id === tab) ? tab : (allowedTabs[0]?.id ?? "dashboard");
  const current = allowedTabs.find((t) => t.id === currentTab);

  useEffect(() => {
    const nome = data.config.nomeClinica || "NV Digital Hospitalar";
    document.title = current ? `${current.label} · ${nome}` : nome;
  }, [current, data.config.nomeClinica]);

  // Endereço acompanha o módulo: o botão "voltar" do browser e o refresh funcionam
  useEffect(() => {
    const h = "#" + currentTab;
    if (window.location.hash !== h) {
      if (firstSync.current) window.history.replaceState(null, "", h);
      else window.history.pushState(null, "", h);
    }
    firstSync.current = false;
    try { localStorage.setItem(preferenceKey(LAST_KEY), currentTab); } catch { /* ignora */ }
  }, [currentTab, preferenceKey]);

  useEffect(() => {
    const onHash = () => {
      const f = allowedTabs.find((t) => t.id === normaliseTab(window.location.hash.slice(1)));
      if (f) { setTab(f.id); setHome(false); }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [allowedTabs]);

  const recentTabs = useMemo(
    () => recents.map((id) => allowedTabs.find((t) => t.id === id)).filter(Boolean) as TabDef[],
    [recents, allowedTabs]);

  const go = useCallback((t: Tab) => {
    setTab(t); setHome(false); setSidebarOpen(false); setPalette(false);
    setRecents((r) => [t, ...r.filter((x) => x !== t)].slice(0, 5));
    window.scrollTo?.({ top: 0 });
  }, []);

  const handleTabChange = useCallback((t: string) => {
    const found = allowedTabs.find((x) => x.id === normaliseTab(t));
    if (found) go(found.id);
  }, [allowedTabs, go]);

  const pendingG = useRef<number | null>(null);
  useEffect(() => {
    let last = 0;
    const k = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // Leitores de código de barras "escrevem" muito depressa: não tratar como atalho
      const agora = performance.now();
      const rapido = agora - last < 60;
      last = agora;
      if (rapido) {
        if (pendingG.current !== null) { window.clearTimeout(pendingG.current); pendingG.current = null; }
        return;
      }
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      const key = e.key.toLowerCase();
      if (pendingG.current !== null) {
        window.clearTimeout(pendingG.current); pendingG.current = null;
        const id = (Object.keys(SHORTCUTS) as Tab[]).find((t) => SHORTCUTS[t] === key);
        const f = id && allowedTabs.find((t) => t.id === id);
        if (f) { e.preventDefault(); go(f.id); }
        return;
      }
      if (key === "g") pendingG.current = window.setTimeout(() => { pendingG.current = null; }, 1200);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [allowedTabs, go]);

  const changeLayout = useCallback((l: MenuLayout) => { setLayout(l); if (l === "cartao") setHome(true); }, []);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((p) => !p); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  if (!funcao || allowedTabs.length === 0) {
    return <FullScreen><div className="max-w-sm text-center">
      <h2 className="text-lg font-semibold">Perfil sem módulos autorizados</h2>
      <p className="my-3 text-sm">Solicita ao administrador da instituição a configuração do teu acesso.</p>
      <button className="gx-btn" onClick={onLogout}>Terminar sessão</button>
    </div></FullScreen>;
  }

  if (!loading && !loadError) loadedOnce.current = true;
  if (loading && !loadedOnce.current) return <FullScreen dark><Spinner texto="A carregar dados…" /></FullScreen>;

  if (loadError && !loadedOnce.current) {
    return (
      <FullScreen>
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "#fdecea", color: C.danger }}>
            <Svg size={26} html='<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>' />
          </div>
          <h2 className="text-lg font-semibold">Não foi possível carregar os dados</h2>
          <p className="mb-5 mt-1.5 text-sm" style={{ color: C.muted }}>{loadError}</p>
          <button onClick={reload} className="rounded-md px-5 py-2.5 text-sm font-semibold text-white" style={{ background: C.primary }}>Tentar novamente</button>
          <button onClick={onLogout} className="mx-auto mt-3 block text-sm" style={{ color: C.muted }}>Terminar sessão</button>
        </div>
      </FullScreen>
    );
  }

  const pl = (n: number) => `${n} ${n === 1 ? "alteração" : "alterações"}`;
  const aviso: { erro: boolean; texto: string; acao?: string; on?: () => void } | null = !isOnline
    ? { erro: true, texto: pendingCount > 0 ? `Sem ligação à internet. ${pl(pendingCount)} por enviar.` : "Sem ligação à internet." }
    : loadError && loadedOnce.current
      ? { erro: true, texto: "Não foi possível actualizar os dados.", acao: "Tentar de novo", on: () => { void reload(); } }
      : pendingCount > 0
        ? { erro: false, texto: `${pl(pendingCount)} por sincronizar.`, acao: "Sincronizar agora", on: () => { void syncNow(); } }
        : null;

  const actions: ActionsProps = {
    session, layout, onLayout: changeLayout, onSearch: () => setPalette(true), onLogout, onNav: handleTabChange,
    colourTheme, onColour: changeColour, onMode: changeMode,
    theme, onTheme: () => setAppearance((value) => ({ ...value, theme: value.theme === "escuro" ? "claro" : "escuro" })),
  };

  const page = (
    <div className="gx-page w-full min-w-0">
      <PageBoundary key={currentTab}>
        <Suspense fallback={<PageLoading />}>{renderPage(currentTab, session, handleTabChange, allowedTabs.map((t) => t.id))}</Suspense>
      </PageBoundary>
    </div>
  );

  let body: React.ReactNode;

  if (layout === "cartao") {
    body = (
      <div className="flex min-h-screen flex-col" style={{ background: C.bg }}>
        <PageHeader session={session} current={home ? undefined : current} actions={actions}
          leading={
            home || !current ? <Brand session={session} /> : (
              <button className="gx-btn" onClick={() => setHome(true)}>
                <Svg size={14} stroke={2.25} html='<polyline points="15 18 9 12 15 6"/>' /> Início
              </button>
            )
          } />
        <main className="gx-app-main min-w-0 flex-1">
          {home ? <CardsHome session={session} groups={groups} recents={recentTabs} onPick={go} /> : page}
        </main>
      </div>
    );
  } else if (layout === "cabecalho") {
    body = (
      <div className="flex min-h-screen flex-col" style={{ background: C.bg }}>
        <TopNav session={session} groups={groups} tab={currentTab} onPick={go} actions={actions} />
        <main className="gx-app-main min-w-0 flex-1">{page}</main>
      </div>
    );
  } else if (layout === "rodape") {
    body = (
      <div className="flex min-h-screen flex-col" style={{ background: C.bg }}>
        <PageHeader session={session} current={current} actions={actions} leading={<Brand compact session={session} />} />
        <main className="gx-app-main min-w-0 flex-1 pb-20">{page}</main>
        <BottomNav groups={groups} tab={currentTab} onPick={go} />
      </div>
    );
  } else {
    body = (
      <div className="flex h-screen min-w-0 overflow-hidden" style={{ background: C.bg, height: "100dvh" }}>
        <Sidebar session={session} groups={groups} tab={currentTab} onPick={go}
          open={sidebarOpen} onClose={() => setSidebarOpen(false)} onSearch={() => setPalette(true)}
          collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} onLogout={onLogout} />
        <div className={`flex min-w-0 flex-1 flex-col overflow-hidden transition-[margin] duration-200 ${collapsed ? "lg:ml-[68px]" : "lg:ml-[248px]"}`}>
          <PageHeader session={session} current={current} actions={actions}
            leading={
              <button className="gx-btn !p-2 lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Abrir menu"><IconMenu /></button>
            } />
          <main className="gx-app-main gx-scroll min-h-0 min-w-0 flex-1 overflow-auto">{page}</main>
        </div>
      </div>
    );
  }

  return (
    <div className="gx nv-shell" data-theme={theme === "escuro" ? "dark" : "light"} data-colour={colourTheme} data-layout={layout}>
      <style>{CSS + FLOATING_CSS}</style>
      <IdleTimeout onLogout={onLogout} />
      {body}
      {allowedTabs.some(t => t.id === "chat") && <ChatCallService key={session.empresaId+":"+session.username} username={session.username} companyName={session.empresaNome} />}
      <Assistente companyName={session.empresaNome} modules={allowedTabs.map((item) => item.id)} navigate={(module) => {
        if (allowedTabs.some((item) => item.id === module)) handleTabChange(module as Tab);
      }} />
      <FloatingControls onChat={() => handleTabChange("chat")} chatAllowed={allowedTabs.some((item) => item.id === "chat")} />
      {aviso && (
        <div role={aviso.erro ? "alert" : "status"}
          className="fixed left-1/2 top-3 z-[70] flex max-w-[92vw] -translate-x-1/2 items-center gap-3 rounded-full py-1.5 pl-4 pr-2 text-xs font-semibold text-white"
          style={{ background: aviso.erro ? "#b42318" : "#0f4c9a", boxShadow: "0 8px 24px rgba(0,0,0,.25)" }}>
          <span>{aviso.texto}</span>
          {aviso.acao && (
            <button onClick={aviso.on} className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold"
              style={{ color: aviso.erro ? "#b42318" : "#0f4c9a" }}>{aviso.acao}</button>
          )}
        </div>
      )}
      {palette && <CommandPalette tabs={allowedTabs} recents={recentTabs} current={currentTab} onPick={go} onClose={() => setPalette(false)} />}
    </div>
  );
}

/* ============================================================================ */
/*  RAIZ DA APLICAÇÃO                                                           */
/* ============================================================================ */
function getPortalMode(): "admin" | "parceiro" | "empresa" {
  const path = window.location.pathname;
  if (path.includes("/admin")) return "admin";
  if (path.includes("/parceiro")) return "parceiro";
  return "empresa";
}

export default function App() {
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [checkingSession, setCheckingSession] = useState(true);
  const mode = getPortalMode();

  useEffect(() => {
    const token = api.getToken();
    if (token) {
      api.auth.me().then((me) => {
        const s: Session = {
          role: me.role as any, empresaId: me.empresaId, empresaNome: me.empresaNome,
          username: me.username, funcao: me.funcao as any,
          funcionarioId: me.funcionarioId, funcionarioNome: me.funcionarioNome,
          parceiroId: me.parceiroId, parceiroNome: me.parceiroNome,
          parceiroInstituicao: me.parceiroInstituicao,
          modulos: (me as any).modulos,
        };
        saveSession(s); setSession(s);
      }).catch(() => { api.setToken(null); saveSession(null); setSession(null); })
        .finally(() => setCheckingSession(false));
    } else { saveSession(null); setSession(null); setCheckingSession(false); }
  }, []);

  const handleLogin = useCallback((s: Session) => { saveSession(s); setSession(s); }, []);
  const handleLogout = useCallback(async () => {
    await api.auth.logout().catch(() => {});
    api.setToken(null); saveSession(null); setSession(null);
  }, []);

  useEffect(() => {
    const onUnauth = () => { api.setToken(null); saveSession(null); setSession(null); };
    window.addEventListener("lab:unauthenticated", onUnauth);
    return () => window.removeEventListener("lab:unauthenticated", onUnauth);
  }, []);

  if (checkingSession) return <FullScreen dark><Spinner texto="A verificar sessão…" /></FullScreen>;

  if (!session) return <Login onLogin={handleLogin} mode={mode} />;
  if (session.role === "developer") return <AdminEmpresas onLogout={handleLogout} />;
  if (session.role === "parceiro") return <PortalParceiro session={session} onLogout={handleLogout} />;

  if (!session.empresaId || (session.role === "funcionario" && !session.funcao)) {
    return <FullScreen><div className="max-w-sm text-center">
      <h2 className="text-lg font-semibold">Acesso institucional incompleto</h2>
      <p className="my-3 text-sm">A conta precisa de instituição e perfil profissional válidos.</p>
      <button className="gx-btn" onClick={handleLogout}>Terminar sessão</button>
    </div></FullScreen>;
  }

  const scope = [session.empresaId, session.funcionarioId ?? session.username, session.funcao ?? session.role].join(":");
  return (
    <AppProvider key={scope}>
      <HospitalProvider key={scope} org={session.empresaId}>
        <Shell session={session} onLogout={handleLogout} />
      </HospitalProvider>
    </AppProvider>
  );
}
