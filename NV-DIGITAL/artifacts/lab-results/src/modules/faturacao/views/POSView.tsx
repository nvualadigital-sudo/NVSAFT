/* ============================================================================
   FILE 3/3 — src/views/POSView.tsx  (COMPLETO · REFORÇADO)
   Frente de caixa com o mesmo sistema de design dos Documentos.
   Adquirente tratado por ClienteField: cliente registado OU não é cliente.

   REFORÇOS DESTA VERSÃO (sem alterar o que já funcionava):
   • Abertura de caixa em 3 passos: fundo inicial + contagem por denominação
     (notas/moedas) + gaveta de destino + impressão do relatório de abertura.
   • Fecho de caixa em 4 passos: conferência por forma de pagamento, contagem
     por denominação e por gaveta, diferença com justificação + aprovação do
     supervisor e relatório Z.
   • Relatório X (parcial) sem fechar o turno.
   • Sangrias e suprimentos com motivo, registo de movimentos e saldos.
   • GAVETAS: Gaveta Principal, Gaveta de Troco, Cofre/Drop Safe e Gaveta de
     Documentos — abertura por comando ESC/POS (Web Serial) ou modo simulado,
     com registo de cada abertura (quem, quando e porquê).
   • MAIS DISPOSITIVOS além do QR e do código de barras: impressora térmica,
     display do cliente (2.ª janela/Serial), terminal TPA, balança electrónica,
     sinalizador sonoro, cofre e UPS — com painel de estado, testes e log.
   ============================================================================ */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Barcode,
  Banknote,
  Calculator,
  Camera,
  Coffee,
  Cookie,
  Wheat,
  House,
  Apple,
  Milk,
  Heart,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Coins,
  CreditCard,
  Delete,
  FileText,
  Gauge,
  HelpCircle,
  Info,
  Keyboard,
  KeyRound,
  List,
  Lock,
  Minus,
  Monitor,
  Package,
  Pause,
  Percent,
  Play,
  Plug,
  Plus,
  Printer,
  QrCode,
  Receipt,
  RefreshCw,
  Save,
  Scale,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Tag,
  Trash2,
  Unlock,
  Usb,
  UserPlus,
  Volume2,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { inputNumber, invoicePreview } from "../utils/billingNumbers";
import { POS_SECTORS, posCategories, productSector, type PosSectorFilter } from "../utils/posCatalog";
import { command, useApp } from "../store/AppContext";
import { CaixaSessao, Fatura, Produto } from "../types";
import {
  downloadFatura,
  formatCurrency,
  generateFaturaHTML,
  openInvoicePrint,
  printIssuedInvoice,
} from "../utils/faturaGenerator";
import {
  ClienteField,
  ClienteDoc,
  criarConsumidorFinal,
  clienteDePaciente,
  clienteParaDocumento,
  NOME_CONSUMIDOR_FINAL,
} from "../components/ClienteField";

/* ------------------------------------------------------------------ CSS --- */
const getSectorIcon = (sectorName: string) => {
  const name = sectorName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (name.includes("farmacia")) return Heart;
  if (name.includes("exames-lab")) return Receipt;
  if (/bebida|drink|cafe|cafeter/.test(name)) return Coffee;
  if (/snack|bolacha|biscoito|guloseima/.test(name)) return Cookie;
  if (/mercearia|cereal|grao|farinha|massa/.test(name)) return Wheat;
  if (/casa|lar|limpeza|domest/.test(name)) return House;
  if (/fruta|horti|veget|legume/.test(name)) return Apple;
  if (/latic|leite|queijo|iogurte/.test(name)) return Milk;
  if (/higiene|beleza|saude|cuidado pessoal/.test(name)) return Heart;
  return Package;
};

const POS_CSS = `
.pos-root{background:#f2f4f7;font-family:Roboto,"Helvetica Neue",Arial,sans-serif;color:#333;min-height:100vh;font-size:14px;padding-bottom:32px}
.pos-root *{box-sizing:border-box}
.pos-container{padding:0 20px;width:100%}
.pos-breadcrumb{list-style:none;display:flex;gap:8px;margin:0;padding:12px 0;font-size:13px;color:#8a919c}
.pos-breadcrumb li+li::before{content:"/";margin-right:8px;color:#c3c9d2}
.pos-breadcrumb li.active{color:#2f3640;font-weight:700}
.pos-topbar{background:#fff;border:1px solid #e3e6ea;border-radius:4px;padding:14px 20px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.pos-topbar__title{display:flex;align-items:center;gap:12px;min-width:0}
.pos-topbar__badge{width:44px;height:44px;border-radius:50%;background:#1577EB;color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.pos-title{font-size:16px;font-weight:700;color:#2f3640;margin:0;line-height:1.3}
.pos-slogan{font-size:12px;font-weight:400;color:#9aa1ac;margin-left:6px}
.pos-topbar__actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.pos-chip{display:inline-flex;align-items:center;gap:7px;border:1px solid #e3e6ea;background:#fafbfc;border-radius:20px;padding:6px 14px;font-size:12px;font-weight:700;color:#5b6470}
.pos-chip .pos-dot{width:8px;height:8px;border-radius:50%;background:#F39C12}
.pos-chip.is-open .pos-dot{background:#28a745}
.pos-chip.is-open{border-color:#b7e4c7;background:#f2fbf5;color:#155724}
.pos-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid #d7dce3;background:#fff;color:#333;border-radius:4px;padding:9px 16px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;transition:background .12s,border-color .12s;white-space:nowrap}
.pos-btn:hover{background:#f5f7fa;border-color:#c3c9d2}
.pos-btn:disabled{opacity:.45;cursor:not-allowed}
.pos-btn--primary{background:#1577EB;border-color:#1577EB;color:#fff}
.pos-btn--primary:hover{background:#0d5fc0;border-color:#0d5fc0}
.pos-btn--dark{background:#2f3640;border-color:#2f3640;color:#fff}
.pos-btn--dark:hover{background:#1f242b;border-color:#1f242b}
.pos-btn--warn{background:#F39C12;border-color:#F39C12;color:#fff}
.pos-btn--warn:hover{background:#d98a0b;border-color:#d98a0b}
.pos-btn--success{background:#28a745;border-color:#28a745;color:#fff}
.pos-btn--success:hover{background:#1f8838;border-color:#1f8838}
.pos-btn--danger{background:#fff;border-color:#f1c0bc;color:#c2261c}
.pos-btn--danger:hover{background:#fdf3f2;border-color:#e08e86}
.pos-btn--sm{padding:6px 10px;font-size:12px}
.pos-link{color:#1577EB;font-size:12px;font-weight:700;background:none;border:none;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:5px;padding:0}
.pos-link:hover{text-decoration:underline}
.pos-link--danger{color:#c2261c}
.pos-link:disabled{opacity:.45;cursor:not-allowed;text-decoration:none}
.pos-box{background:#fff;border:1px solid #e3e6ea;border-radius:4px;margin-bottom:16px}
.pos-box__header{padding:13px 18px;border-bottom:1px solid #eef0f3;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.pos-box__title{font-size:14px;font-weight:700;color:#2f3640;display:flex;align-items:center;gap:8px}
.pos-box__content{padding:18px}
.pos-box__content--flush{padding:0}
.pos-alert{border-radius:4px;padding:12px 16px;margin-bottom:16px;font-size:13px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;line-height:1.5}
.pos-alert--open{background:#f2fbf5;border:1px solid #b7e4c7;color:#155724}
.pos-alert--closed{background:#fff8e6;border:1px solid #ffe1a1;color:#8a5a00}
.pos-alert--error{background:#fdf3f2;border:1px solid #f1c0bc;color:#a02015}
.pos-alert--success{background:#f2fbf5;border:1px solid #b7e4c7;color:#155724}
.pos-alert--info{background:#eaf3ff;border:1px solid #cfe3fb;color:#0c5460}
.pos-alert__actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.pos-layout{display:grid;grid-template-columns:minmax(0,1fr) 460px;gap:16px;align-items:start}
@media(max-width:1240px){.pos-layout{grid-template-columns:minmax(0,1fr)}.pos-right{position:static!important}}
.pos-right{position:sticky;top:16px}
.pos-searchbar{display:flex;gap:8px;flex-wrap:wrap}
.pos-search-wrap{position:relative;flex:1;min-width:220px}
.pos-search-wrap>svg{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:#aab1bc;pointer-events:none}
.pos-search{width:100%;border:1px solid #d7dce3;border-radius:4px;padding:12px 96px 12px 42px;font-size:14px;font-family:inherit;outline:none;background:#fff;color:#333}
.pos-search:focus{border-color:#1577EB;box-shadow:0 0 0 3px rgba(21,119,235,.12)}
.pos-search__hint{position:absolute;right:12px;top:50%;transform:translateY(-50%);font-size:10px;font-weight:700;color:#9aa1ac;border:1px solid #e3e6ea;border-radius:3px;padding:2px 6px;background:#fafbfc;pointer-events:none}
.pos-sectors{display:flex;gap:6px;overflow-x:auto;padding:14px 0 2px;flex-wrap:wrap}
.pos-sector{border:1px solid #d7dce3;background:#fff;color:#5b6470;border-radius:20px;padding:7px 16px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;transition:all .12s}
.pos-sector:hover{border-color:#9CBEE8;color:#1577EB}
.pos-sector.is-active{background:#1577EB;border-color:#1577EB;color:#fff}
.pos-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(158px,1fr));gap:10px;max-height:640px;overflow-y:auto;padding:14px 18px 18px}
.pos-card{position:relative;border:1px solid #e3e6ea;border-radius:8px;background:#fff;padding:10px;text-align:left;cursor:pointer;font-family:inherit;display:flex;flex-direction:column;gap:8px;min-height:238px;transition:border-color .12s,box-shadow .12s,transform .12s;overflow:hidden}
.pos-card:hover:not(:disabled){border-color:#1577EB;box-shadow:0 7px 20px rgba(21,119,235,.14);transform:translateY(-2px)}
.pos-card:disabled{cursor:not-allowed;background:#fafbfc;opacity:.65}
.pos-card__media{position:relative;width:100%;height:118px;min-height:118px;display:flex;align-items:center;justify-content:center;overflow:hidden;border:1px solid #eef2f6;border-radius:6px;background:linear-gradient(135deg,#f8fbff 0%,#edf3f9 100%)}
.pos-product-image{display:block;width:100%;height:100%;object-fit:contain;padding:7px;transition:transform .18s ease}
.pos-card:hover .pos-product-image{transform:scale(1.045)}
.pos-product-image--cart{width:42px;height:42px;min-width:42px;padding:2px;border:1px solid #e6ebf2;border-radius:6px;background:#f8fafc;object-fit:contain}
.pos-product-image-fallback{width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#6b91bd;background:linear-gradient(135deg,#f8fbff 0%,#edf3f9 100%)}
.pos-product-image-fallback svg{width:34px;height:34px;stroke-width:1.5}
.pos-product-image-fallback--service{color:#8b6dd1;background:linear-gradient(135deg,#fbf8ff 0%,#f2eaff 100%)}
.pos-product-image-fallback--cart{width:42px;height:42px;min-width:42px;flex:0 0 42px;border:1px solid #e6ebf2;border-radius:6px;background:#f8fafc}
.pos-product-image-fallback--cart svg{width:22px;height:22px}
.pos-card__stock{font-size:10px;font-weight:700;color:#5b6470;text-align:right;line-height:1.25;white-space:nowrap}
.pos-card__stock--overlay{position:absolute;top:6px;right:6px;z-index:1;padding:4px 6px;border:1px solid rgba(227,230,234,.95);border-radius:4px;background:rgba(255,255,255,.94);box-shadow:0 1px 3px rgba(16,24,40,.06)}
.pos-card__stock--overlay.is-low{color:#8a5a00;border-color:#ffe1a1;background:#fff8e6}
.pos-card__stock--overlay.is-out{color:#a02015;border-color:#f1c0bc;background:#fdf3f2}
.pos-card__name{font-size:13px;font-weight:700;color:#2f3640;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.pos-card__ref{font-size:10px;color:#9aa1ac;font-family:ui-monospace,Menlo,Consolas,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pos-card__bottom{margin-top:auto;display:flex;align-items:flex-end;justify-content:space-between;gap:6px}
.pos-card__price{font-size:14px;font-weight:700;color:#2f3640}
.pos-card__add{width:26px;height:26px;border-radius:4px;background:#eaf3ff;color:#1577EB;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .12s}
.pos-card:hover .pos-card__add{opacity:1}
.pos-card__flag{position:absolute;left:12px;right:12px;bottom:6px;font-size:10px;font-weight:700;color:#c2261c}
.pos-empty{text-align:center;padding:44px 20px;color:#8a919c;font-size:13px;line-height:2}
.pos-empty svg{color:#d4d9e0;display:block;margin:0 auto 10px}
.pos-table{width:100%;border-collapse:collapse}
.pos-table thead th{font-size:10px;text-transform:uppercase;letter-spacing:.4px;color:#8a919c;font-weight:700;padding:9px 8px;border-bottom:1px solid #e3e6ea;text-align:right;background:#fafbfc}
.pos-table thead th.text-left{text-align:left}
.pos-table tbody td{padding:8px;border-bottom:1px solid #f0f2f5;font-size:13px;text-align:right;vertical-align:middle}
.pos-table tbody tr:hover{background:#f8fafd}
.pos-table tfoot th{padding:8px;font-size:12px;color:#5b6470;text-align:right;font-weight:700}
.pos-table tfoot tr.pos-grand th{border-top:1px solid #e3e6ea;font-size:15px;color:#2f3640;padding:12px 8px}
.pos-line-title{font-weight:700;color:#2f3640;font-size:13px;text-align:left;display:block}
.pos-line-ref{font-size:10px;color:#9aa1ac;text-align:left;display:block;font-family:ui-monospace,Menlo,Consolas,monospace}
.pos-cart-product{display:flex;align-items:center;gap:9px;min-width:0}
.pos-cart-product__details{min-width:0;flex:1}
.pos-line-remove{cursor:pointer;color:#c2261c;background:none;border:none;padding:4px;display:inline-flex}
.pos-line-remove:hover{color:#e74c3c}
.pos-stepper{display:inline-flex;align-items:center;border:1px solid #d7dce3;border-radius:4px;overflow:hidden;background:#fff}
.pos-stepper button{background:none;border:none;cursor:pointer;padding:4px 7px;color:#28a745;display:flex;align-items:center}
.pos-stepper button:hover{background:#f2fbf5}
.pos-stepper input{width:44px;border:none;border-left:1px solid #eef0f3;border-right:1px solid #eef0f3;text-align:center;font-size:12px;font-weight:700;padding:5px 2px;outline:none;font-family:inherit;color:#333}
.pos-line-total{font-weight:700;color:#2f3640;white-space:nowrap}
.pos-field{margin-bottom:12px}
.pos-field:last-child{margin-bottom:0}
.pos-label{display:block;font-size:11px;font-weight:700;color:#5b6470;margin-bottom:5px;text-transform:uppercase;letter-spacing:.3px}
.pos-input{width:100%;border:1px solid #d7dce3;border-radius:4px;padding:9px 12px;font-size:13px;color:#333;background:#fff;outline:none;font-family:inherit}
.pos-input:focus{border-color:#1577EB;box-shadow:0 0 0 3px rgba(21,119,235,.12)}
.pos-input::placeholder{color:#aab1bc}
.pos-input--money{text-align:right;font-weight:700}
.pos-input-group{display:flex;align-items:stretch;border:1px solid #d7dce3;border-radius:4px;overflow:hidden;background:#fff}
.pos-input-group:focus-within{border-color:#1577EB;box-shadow:0 0 0 3px rgba(21,119,235,.12)}
.pos-input-group__addon{background:#f2f4f7;border-right:1px solid #d7dce3;padding:8px 11px;font-size:12px;font-weight:700;color:#6b7280;display:flex;align-items:center;flex-shrink:0}
.pos-input-group .pos-input{border:none;box-shadow:none!important;border-radius:0}
.pos-row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.pos-note{font-size:11px;color:#8a919c;line-height:1.5;margin-top:6px}
.pos-collapse{border-bottom:1px solid #eef0f3}
.pos-collapse:last-child{border-bottom:none}
.pos-collapse__header{width:100%;display:flex;align-items:center;gap:10px;padding:12px 18px;background:none;border:none;cursor:pointer;font-family:inherit;font-size:13px;color:#333;text-align:left}
.pos-collapse__header:hover{background:#f8fafd}
.pos-collapse__icon{color:#8a919c;display:flex;flex-shrink:0}
.pos-collapse__value{color:#8a919c;font-size:12px;margin-left:auto;max-width:45%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pos-collapse__change{color:#1577EB;font-size:12px;font-weight:700;flex-shrink:0;display:flex;align-items:center;gap:4px}
.pos-collapse__content{padding:0 18px 14px}
.pos-pay-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.pos-pay{border:1px solid #d7dce3;background:#fff;color:#5b6470;border-radius:4px;padding:10px 6px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;flex-direction:column;align-items:center;gap:5px;transition:all .12s}
.pos-pay:hover{border-color:#9CBEE8;color:#1577EB}
.pos-pay.is-active{background:#1577EB;border-color:#1577EB;color:#fff}
.pos-change-box{margin-top:10px;border:1px solid #b7e4c7;background:#f2fbf5;border-radius:4px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between}
.pos-change-box span{font-size:11px;font-weight:700;color:#155724;text-transform:uppercase;letter-spacing:.3px}
.pos-change-box strong{font-size:19px;color:#155724}
.pos-quick{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
.pos-quick button{border:1px solid #d7dce3;background:#fff;border-radius:20px;padding:6px 12px;font-size:11px;font-weight:700;color:#5b6470;cursor:pointer;font-family:inherit}
.pos-quick button:hover{border-color:#1577EB;color:#1577EB;background:#eaf3ff}
.pos-apply{display:flex;align-items:center;justify-content:center;gap:9px;width:calc(100% - 36px);margin:18px;padding:16px;border-radius:4px;background:#1577EB;color:#fff;border:none;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;transition:filter .12s}
.pos-apply:hover{filter:brightness(1.08)}
.pos-apply:disabled{background:#c3c9d2;cursor:not-allowed;filter:none}
.pos-apply small{font-weight:400;opacity:.85;font-size:12px}
.pos-shortcuts{display:flex;gap:14px;flex-wrap:wrap;padding:10px 18px;border-top:1px solid #eef0f3;background:#fafbfc;border-radius:0 0 4px 4px}
.pos-shortcut{font-size:11px;color:#8a919c;display:flex;align-items:center;gap:5px}
.pos-kbd{border:1px solid #d7dce3;border-bottom-width:2px;border-radius:3px;background:#fff;padding:1px 6px;font-size:10px;font-weight:700;color:#5b6470;font-family:ui-monospace,Menlo,Consolas,monospace}
.pos-modal{position:fixed;inset:0;z-index:400;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(16,24,40,.55)}
.pos-modal__panel{background:#fff;border-radius:6px;width:100%;max-width:460px;max-height:92vh;overflow-y:auto;box-shadow:0 20px 60px rgba(16,24,40,.35)}
.pos-modal__panel--wide{max-width:720px}
.pos-modal__header{padding:16px 20px;border-bottom:1px solid #eef0f3;display:flex;align-items:center;justify-content:space-between;gap:12px}
.pos-modal__title{font-size:15px;font-weight:700;color:#2f3640;margin:0}
.pos-modal__close{background:none;border:none;cursor:pointer;color:#9aa1ac;padding:4px;display:flex}
.pos-modal__close:hover{color:#2f3640}
.pos-modal__body{padding:20px}
.pos-modal__footer{padding:0 20px 20px;display:flex;gap:10px}
.pos-modal__footer .pos-btn{flex:1;padding:13px}
.pos-keypad__display{border:1px solid #d7dce3;border-radius:4px;background:#fafbfc;padding:14px 16px;text-align:right;margin-bottom:14px}
.pos-keypad__display small{display:block;font-size:11px;font-weight:700;color:#9aa1ac;text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px}
.pos-keypad__display strong{font-size:28px;color:#2f3640;font-weight:700;letter-spacing:-.5px}
.pos-keypad{display:grid;grid-template-columns:repeat(3,1fr) 96px;gap:8px}
.pos-key{border:1px solid #d7dce3;background:#fff;border-radius:4px;height:54px;font-size:19px;font-weight:700;color:#2f3640;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center}
.pos-key:hover{background:#f5f7fa;border-color:#c3c9d2}
.pos-key--fn{background:#fafbfc;color:#5b6470;font-size:13px}
.pos-key--ok{grid-row:span 2;background:#1577EB;border-color:#1577EB;color:#fff}
.pos-key--ok:hover{background:#0d5fc0}
.pos-held{border:1px solid #e3e6ea;border-radius:4px;padding:12px 14px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;gap:10px}
.pos-held:last-child{margin-bottom:0}
.pos-held__name{font-size:13px;font-weight:700;color:#2f3640}
.pos-held__meta{font-size:11px;color:#9aa1ac;margin-top:2px}
.pos-badge{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;border-radius:9px;background:#F39C12;color:#fff;font-size:10px;font-weight:700;padding:0 5px}
.pos-success{text-align:center;padding:26px 20px}
.pos-success__icon{width:60px;height:60px;border-radius:50%;background:#f2fbf5;color:#28a745;display:flex;align-items:center;justify-content:center;margin:0 auto 14px}
.pos-success__total{font-size:30px;font-weight:700;color:#2f3640;letter-spacing:-.5px}
.pos-summary{border:1px solid #e3e6ea;border-radius:4px;background:#fafbfc;padding:14px;margin:16px 0;text-align:left}
.pos-summary__row{display:flex;justify-content:space-between;font-size:12px;color:#5b6470;padding:3px 0;gap:12px}
.pos-summary__row strong{color:#2f3640}
.pos-summary__title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:#9aa1ac;margin:12px 0 6px}
.pos-summary__title:first-child{margin-top:0}
.pos-help{text-align:center;padding:30px 0 6px}
.pos-help button{background:none;border:none;color:#1098f7;font-size:13px;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:6px}
.pos-help button:hover{text-decoration:underline}
.pos-drawers{display:grid;grid-template-columns:repeat(auto-fit,minmax(224px,1fr));gap:10px;margin-bottom:16px}
.pos-drawer{background:#fff;border:1px solid #e3e6ea;border-radius:4px;padding:12px 14px;display:flex;align-items:center;gap:12px;transition:border-color .12s,box-shadow .12s}
.pos-drawer.is-open{border-color:#9CBEE8;box-shadow:0 0 0 3px rgba(21,119,235,.12)}
.pos-drawer__icon{width:38px;height:38px;border-radius:4px;background:#eaf3ff;color:#1577EB;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.pos-drawer__icon--troco{background:#e8f8ef;color:#28a745}
.pos-drawer__icon--cofre{background:#fff4e0;color:#F39C12}
.pos-drawer__icon--docs{background:#f3ecff;color:#7c3aed}
.pos-drawer__name{font-size:12px;font-weight:700;color:#2f3640}
.pos-drawer__value{font-size:15px;font-weight:700;color:#2f3640;margin-top:2px}
.pos-drawer__meta{font-size:10px;color:#9aa1ac;margin-top:3px;line-height:1.4}
.pos-drawer__actions{margin-left:auto;display:flex;flex-direction:column;gap:6px;align-items:flex-end}
.pos-pulse{width:8px;height:8px;border-radius:50%;background:#28a745;animation:posPulse 1.4s infinite}
@keyframes posPulse{0%,100%{opacity:1}50%{opacity:.2}}
.pos-steps{display:flex;gap:8px;padding:14px 20px 4px;flex-wrap:wrap}
.pos-step{flex:1;min-width:120px;display:flex;align-items:center;gap:7px;font-size:11px;font-weight:700;color:#9aa1ac}
.pos-step__n{width:20px;height:20px;border-radius:50%;border:1px solid #d7dce3;display:flex;align-items:center;justify-content:center;font-size:10px;background:#fff;flex-shrink:0}
.pos-step.is-active{color:#1577EB}
.pos-step.is-active .pos-step__n{background:#1577EB;border-color:#1577EB;color:#fff}
.pos-step.is-done{color:#28a745}
.pos-step.is-done .pos-step__n{background:#e8f8ef;border-color:#b7e4c7;color:#28a745}
.pos-denom{display:grid;grid-template-columns:repeat(auto-fill,minmax(116px,1fr));gap:8px}
.pos-denom__item{border:1px solid #e3e6ea;border-radius:4px;padding:8px;background:#fafbfc}
.pos-denom__head{display:flex;align-items:center;justify-content:space-between;font-size:10px;font-weight:700;color:#5b6470;margin-bottom:6px;text-transform:uppercase;letter-spacing:.3px}
.pos-denom__qty{display:flex;align-items:center;gap:4px}
.pos-denom__qty input{width:100%;border:1px solid #d7dce3;border-radius:3px;padding:5px 4px;font-size:12px;text-align:center;font-family:inherit;outline:none;background:#fff;color:#333}
.pos-denom__qty input:focus{border-color:#1577EB}
.pos-denom__mini{width:24px;height:26px;border:1px solid #d7dce3;border-radius:3px;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#5b6470;flex-shrink:0}
.pos-denom__mini:hover{border-color:#1577EB;color:#1577EB;background:#eaf3ff}
.pos-denom__sub{font-size:10px;color:#8a919c;margin-top:5px;text-align:right}
.pos-denom__total{margin-top:10px;border-top:1px dashed #d7dce3;padding-top:10px;display:flex;justify-content:space-between;align-items:center;font-size:13px;font-weight:700;color:#2f3640}
.pos-denom__total strong{font-size:18px;color:#1577EB}
.pos-dev{border:1px solid #e3e6ea;border-radius:4px;padding:12px 14px;margin-bottom:10px;display:flex;gap:12px;align-items:flex-start}
.pos-dev:hover{border-color:#cfe3fb}
.pos-dev__icon{width:36px;height:36px;border-radius:4px;background:#eaf3ff;color:#1577EB;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.pos-dev__body{flex:1;min-width:0}
.pos-dev__name{font-size:13px;font-weight:700;color:#2f3640;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.pos-dev__desc{font-size:11px;color:#8a919c;margin-top:3px;line-height:1.55}
.pos-dev__actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}
.pos-dev__extra{margin-top:10px;border-top:1px dashed #eef0f3;padding-top:10px}
.pos-status{display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.3px;border:1px solid #e3e6ea;border-radius:20px;padding:2px 9px;background:#fafbfc;color:#8a919c}
.pos-status--ok{background:#e8f8ef;border-color:#b7e4c7;color:#155724}
.pos-status--warn{background:#fff8e6;border-color:#ffe1a1;color:#8a5a00}
.pos-status--erro{background:#fdf3f2;border-color:#f1c0bc;color:#a02015}
.pos-switch{display:inline-flex;align-items:center;gap:8px;font-size:12px;color:#5b6470;cursor:pointer;user-select:none}
.pos-switch input{appearance:none;-webkit-appearance:none;width:34px;height:19px;border-radius:10px;background:#c3c9d2;position:relative;cursor:pointer;transition:background .15s;margin:0;flex-shrink:0}
.pos-switch input::after{content:"";position:absolute;top:2px;left:2px;width:15px;height:15px;border-radius:50%;background:#fff;transition:transform .15s}
.pos-switch input:checked{background:#1577EB}
.pos-switch input:checked::after{transform:translateX(15px)}
.pos-log{max-height:170px;overflow-y:auto;border:1px solid #eef0f3;border-radius:4px;background:#fafbfc;padding:8px 10px;font-size:11px;color:#5b6470;font-family:ui-monospace,Menlo,Consolas,monospace}
.pos-log div{padding:3px 0;border-bottom:1px dashed #eef0f3;display:flex;gap:8px}
.pos-log div:last-child{border-bottom:none}
.pos-log .ok{color:#155724}
.pos-log .erro{color:#c2261c}
.pos-cam{width:100%;background:#0b0f16;border-radius:4px;aspect-ratio:4/3;object-fit:cover;display:block}
.pos-breakdown{border:1px solid #e3e6ea;border-radius:4px;overflow:hidden;margin-bottom:12px}
.pos-breakdown .row{display:flex;justify-content:space-between;gap:12px;padding:8px 12px;font-size:12px;border-bottom:1px solid #f0f2f5;color:#5b6470}
.pos-breakdown .row:last-child{border-bottom:none}
.pos-breakdown .row.total{background:#fafbfc;font-weight:700;color:#2f3640}
.pos-breakdown .row strong{color:#2f3640;white-space:nowrap}
.pos-tabs{display:flex;gap:4px;border-bottom:1px solid #eef0f3;padding:0 20px;overflow-x:auto}
.pos-tab{background:none;border:none;border-bottom:2px solid transparent;padding:11px 12px;font-size:12px;font-weight:700;color:#8a919c;cursor:pointer;font-family:inherit;white-space:nowrap}
.pos-tab.is-active{color:#1577EB;border-bottom-color:#1577EB}
.pos-check{display:flex;align-items:flex-start;gap:9px;font-size:12px;color:#5b6470;line-height:1.55;cursor:pointer;margin-top:10px}
.pos-check input{margin-top:2px;flex-shrink:0}
.pos-devstrip{display:flex;gap:6px;flex-wrap:wrap;padding:9px 18px;border-top:1px solid #eef0f3;background:#fff;border-radius:0 0 4px 4px}

/* Catálogo dividido em navegação lateral + grelha, como no POS de referência. */
.pos-catalog-body{display:grid;grid-template-columns:142px minmax(0,1fr);align-items:start;gap:10px;padding:0 14px 12px}
.pos-catalog-body .pos-catalog-items{min-width:0}
.pos-catalog-body .pos-sectors{display:flex;flex-direction:column;align-items:stretch;gap:5px;overflow:visible;padding:8px 0 0;min-width:0}
.pos-catalog-body .pos-sector{display:flex;align-items:center;justify-content:flex-start;gap:9px;width:100%;min-height:35px;padding:8px 10px;border:1px solid transparent;border-radius:7px;background:transparent;color:#626a75;text-align:left;font-weight:600;white-space:normal}
.pos-catalog-body .pos-sector__icon{width:14px;height:14px;flex:0 0 14px;color:#7b838e}
.pos-catalog-body .pos-sector.is-active{box-shadow:0 2px 5px rgba(223,109,12,.12)}
.pos-catalog-body .pos-sector.is-active .pos-sector__icon{color:#fff}
.pos-catalog-body .pos-grid{min-width:0;max-height:calc(100vh - 280px);padding:8px 0 6px}
@media(max-width:1240px){.pos-catalog-body{grid-template-columns:125px minmax(0,1fr)}.pos-catalog-body .pos-grid{max-height:none}}
@media(max-width:700px){.pos-catalog-body{grid-template-columns:1fr;padding:0 10px 10px}.pos-catalog-body .pos-sectors{flex-direction:row;overflow-x:auto;padding:8px 0;gap:6px}.pos-catalog-body .pos-sector{width:auto;flex:0 0 auto;min-height:34px}.pos-catalog-body .pos-grid{padding:8px 0;max-height:none}}

/* =========================================================================
   POS MODERNO — inspirado na referência enviada, com identidade própria.
   Overrides visuais; preserva os componentes e os handlers existentes.
   ========================================================================= */
.pos-root{
  --pos-accent:#f58220;
  --pos-accent-hover:#df6d0c;
  --pos-ink:#20242b;
  --pos-muted:#737b87;
  --pos-line:#e8eaee;
  --pos-surface:#fff;
  background:#f5f6f8;
  color:var(--pos-ink);
  font-family:Inter,Roboto,"Helvetica Neue",Arial,sans-serif;
  font-size:13px;
}
.pos-container{max-width:none;padding:0 18px}
.pos-breadcrumb{padding:8px 0;color:#858b95;font-size:11px}
.pos-topbar{
  background:#fff;border:1px solid var(--pos-line);border-radius:10px;
  padding:12px 16px;margin-bottom:12px;box-shadow:0 2px 8px rgba(22,28,36,.035)
}
.pos-topbar__badge{width:38px;height:38px;border-radius:10px;background:var(--pos-accent)}
.pos-title{font-size:17px;font-weight:800;letter-spacing:-.35px;color:#1f2329}
.pos-slogan{display:block;margin:3px 0 0;font-size:11px;color:#858b95}
.pos-chip{border-radius:7px;background:#fff;padding:7px 10px;font-size:11px}
.pos-btn{border-radius:7px;padding:9px 12px;font-size:12px;transition:all .15s ease}
.pos-btn--primary,.pos-apply,.pos-sector.is-active{
  background:var(--pos-accent)!important;border-color:var(--pos-accent)!important;color:#fff!important
}
.pos-btn--primary:hover,.pos-apply:hover,.pos-sector.is-active:hover{
  background:var(--pos-accent-hover)!important;border-color:var(--pos-accent-hover)!important
}
.pos-btn--warn{background:var(--pos-accent);border-color:var(--pos-accent)}
.pos-link{color:#d96b0c}
.pos-box{border:1px solid var(--pos-line);border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(22,28,36,.025)}
.pos-box__header{padding:11px 14px;border-bottom:1px solid #f0f1f3}
.pos-box__title{font-size:13px;font-weight:800}
.pos-box__content{padding:14px}
.pos-layout{grid-template-columns:minmax(0,1fr) minmax(380px,430px);gap:12px}
.pos-right{top:12px}
.pos-searchbar{gap:7px}
.pos-search{border-radius:8px;border-color:#e0e3e8;padding:11px 88px 11px 38px;font-size:12px}
.pos-search:focus,.pos-input:focus,.pos-input-group:focus-within{border-color:var(--pos-accent);box-shadow:0 0 0 3px rgba(245,130,32,.12)}
.pos-sectors{gap:6px;padding:10px 0 2px;flex-wrap:nowrap;overflow-x:auto}
.pos-sector{border:1px solid #e6e8ec;border-radius:7px;padding:7px 12px;font-size:11px;background:#fff}
.pos-sector:hover{border-color:#f7c18f;color:#c9630b}
.pos-grid{grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:9px;max-height:calc(100vh - 290px);min-height:280px;padding:10px 0 14px}
.pos-card{min-height:190px;padding:8px;border-color:#eceef1;border-radius:9px;gap:7px;box-shadow:0 1px 2px rgba(22,28,36,.02)}
.pos-card:hover:not(:disabled){border-color:#f4b779;box-shadow:0 6px 16px rgba(173,91,15,.10);transform:translateY(-1px)}
.pos-card__media{height:94px;min-height:94px;border:0;border-radius:7px;background:#f7f8fa}
.pos-product-image{padding:5px}
.pos-product-image-fallback{background:#f7f8fa;color:#a0a7b1}
.pos-card__name{font-size:12px;font-weight:700;color:#30343a}
.pos-card__ref{font-size:10px}
.pos-card__price{font-size:13px;font-weight:800;color:#252a31}
.pos-card__add{opacity:1;background:#fff0e2;color:#dc6c0c;border-radius:6px}
.pos-card__stock--overlay{border-radius:5px;font-size:9px}
.pos-table thead th{background:#fafbfc;font-size:9px;letter-spacing:.35px}
.pos-table tbody td{padding:7px 6px;font-size:11px}
.pos-table tfoot th{font-size:11px;padding:7px 6px}
.pos-table tfoot tr.pos-grand th{font-size:15px;padding:11px 6px}
.pos-line-title{font-size:11px}
.pos-line-ref{font-size:9px}
.pos-product-image--cart{width:34px;height:34px;min-width:34px}
.pos-cart-product{gap:7px}
.pos-stepper{border-radius:6px}
.pos-stepper button{color:#d96b0c;padding:4px}
.pos-stepper button:hover{background:#fff3e8}
.pos-stepper input{width:34px;font-size:11px}
.pos-line-remove{color:#9aa1ab}
.pos-line-remove:hover{color:#d92d20}
.pos-field{margin-bottom:10px}
.pos-label{font-size:10px;letter-spacing:.35px}
.pos-input{border-radius:7px;padding:9px 10px;font-size:12px}
.pos-pay-grid{gap:7px}
.pos-pay{border-radius:7px;padding:10px 5px;font-size:10px}
.pos-pay.is-active{background:#fff0e2;border-color:#f4b779;color:#b95a08}
.pos-change-box{border-radius:8px}
.pos-change-box strong{font-size:17px}
.pos-apply{
  width:calc(100% - 28px);margin:14px;padding:14px 16px;border-radius:8px;
  font-size:14px;box-shadow:0 4px 10px rgba(223,109,12,.15)
}
.pos-shortcuts{gap:10px;padding:9px 14px;background:#fafbfc}
.pos-shortcut{font-size:10px}
.pos-kbd{border-radius:4px}
.pos-modal__panel{border-radius:12px}
.pos-modal__header{padding:15px 18px}
.pos-modal__title{font-size:14px}
.pos-modal__body{padding:18px}
.pos-modal__footer .pos-btn{border-radius:8px}
.pos-held,.pos-drawer,.pos-dev{border-radius:8px}
.pos-drawer__icon,.pos-dev__icon{border-radius:8px}
.pos-tabs{padding:0 14px}
.pos-tab{font-size:11px}
@media(min-width:1500px){
  .pos-grid{grid-template-columns:repeat(auto-fill,minmax(145px,1fr))}
  .pos-card{min-height:202px}
  .pos-card__media{height:105px;min-height:105px}
}
@media(max-width:1240px){
  .pos-layout{grid-template-columns:minmax(0,1fr)}
  .pos-grid{max-height:none;grid-template-columns:repeat(auto-fill,minmax(135px,1fr))}
  .pos-right{position:static!important}
}
@media(max-width:700px){
  .pos-container{padding:0 9px}
  .pos-topbar{padding:10px;align-items:flex-start}
  .pos-topbar__actions{width:100%}
  .pos-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;padding:9px 0}
  .pos-card{min-height:175px}
  .pos-card__media{height:85px;min-height:85px}
  .pos-row2{grid-template-columns:1fr}
  .pos-pay-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
}


/* Refinamento final: barra de acções compacta e ícones de categoria distintos. */
.pos-topbar{border-radius:10px;padding:10px 14px;gap:12px;box-shadow:0 2px 8px rgba(22,28,36,.035)}
.pos-topbar__badge{border-radius:9px;background:#fff0e2;color:#e87512;width:40px;height:40px}
.pos-topbar__actions{gap:6px}
.pos-topbar__actions .pos-btn{padding:8px 10px;border-radius:7px;font-size:11px;gap:5px}
.pos-topbar__actions .pos-btn svg{width:15px;height:15px}
.pos-topbar__actions .pos-btn .pos-badge{border-radius:5px;font-size:9px;padding:2px 5px}
.pos-chip{border-radius:7px;padding:7px 9px;font-size:10px}
.pos-breadcrumb{padding:7px 0;font-size:10px}
.pos-alert{border-radius:8px}
.pos-box{border-radius:10px}
.pos-box__header{padding:10px 13px}
.pos-catalog-body .pos-sector__icon{stroke-width:1.8}
.pos-catalog-body .pos-sector{font-size:11px}
.pos-catalog-body .pos-sector.is-active{background:#f58220!important;border-color:#f58220!important;color:#fff!important}
.pos-catalog-body .pos-sector:not(.is-active):hover{background:#fff7ef;color:#c9630b}
.pos-search{border-radius:8px}
.pos-btn--dark{background:#343942;border-color:#343942}
.pos-btn--warn{background:#f58220;border-color:#f58220}
.pos-btn--warn:hover{background:#df6d0c;border-color:#df6d0c}
.pos-btn--primary{background:#f58220;border-color:#f58220}
.pos-btn--primary:hover{background:#df6d0c;border-color:#df6d0c}
@media(max-width:900px){.pos-topbar{align-items:flex-start}.pos-topbar__actions{width:100%}}

.text-right{text-align:right}
.text-left{text-align:left}
`;

interface POSViewProps {
  onOpenScanner?: (onSelect: (p: Produto) => void) => void;
}

interface CartLine {
  product: Produto;
  quantity: number;
}

interface CompletedSale {
  numero: string;
  total: number;
  troco: number;
  fatura: Fatura;
}

interface HeldSale {
  id: string;
  cart: CartLine[];
  cliente: ClienteDoc;
  payment: string;
  restaurantMode: "Mesa" | "Takeaway" | "Delivery";
  restaurantTable: string;
  prescriptionNumber: string;
  discountPercent: string;
  discountAmount: string;
  savedAt: string;
}

/* ----------------------------------------------------------------- caixa --- */
interface Gaveta {
  id: string;
  nome: string;
  tipo: "numerario" | "troco" | "cofre" | "documentos";
  saldo: number;
  aberta: boolean;
  canal: 1 | 2;
  ultimaAbertura?: string;
  aberturas: number;
}

interface MovimentoCaixa {
  id: string;
  tipo: "abertura" | "sangria" | "suprimento" | "fecho" | "gaveta";
  valor: number;
  gavetaId?: string;
  destinoId?: string;
  motivo?: string;
  operador: string;
  em: string;
}

interface SessaoCaixaPOS extends CaixaSessao {
  gavetaFundo?: string;
  observacoes?: string;
  contagemAbertura?: ContagemMap;
  contagemFecho?: ContagemMap;
  movimentos?: MovimentoCaixa[];
  gavetas?: Gaveta[];
  diferencaMotivo?: string;
  diferencaNota?: string;
  aprovadoPor?: string;
  relatoriosX?: number;
}

type ContagemMap = Record<string, Record<string, number>>;

/* ------------------------------------------------------------ dispositivos -- */
type EstadoDispositivo = "conectado" | "simulado" | "desconectado" | "erro";

interface DispositivoEstado {
  estado: EstadoDispositivo;
  detalhe?: string;
  porta?: string;
  ultima?: string;
}

interface LogDispositivo {
  em: string;
  dispositivo: string;
  evento: string;
  tipo: "info" | "ok" | "erro";
}

const DISPOSITIVOS_CATALOGO: {
  id: string;
  nome: string;
  categoria: string;
  descricao: string;
  icon: React.ComponentType<{ className?: string }>;
  serial?: boolean;
}[] = [
  {
    id: "gaveta-dinheiro",
    nome: "Gaveta de dinheiro (RJ11 / ESC-POS)",
    categoria: "Caixa",
    serial: true,
    descricao:
      "Abertura por comando ESC p (canal 1 ou 2) ligado à impressora térmica ou por USB/Serial. Cada abertura fica registada.",
    icon: Wallet,
  },
  {
    id: "cofre-inteligente",
    nome: "Cofre / drop safe",
    categoria: "Caixa",
    serial: true,
    descricao:
      "Recebe as sangrias do turno. Permite depósito seguro de numerário sem abrir a gaveta principal.",
    icon: ShieldCheck,
  },
  {
    id: "impressora-termica",
    nome: "Impressora térmica 80 mm",
    categoria: "Caixa",
    serial: true,
    descricao:
      "Talões de venda, relatórios de abertura (X inicial), relatórios X e relatório Z de fecho com corte automático.",
    icon: Printer,
  },
  {
    id: "ups",
    nome: "UPS / alimentação do posto",
    categoria: "Caixa",
    descricao:
      "Monitoriza a energia do terminal para evitar fechos incompletos ou perda de documentos emitidos.",
    icon: Zap,
  },
  {
    id: "leitor-codigo-barras",
    nome: "Leitor de códigos de barras (USB/HID)",
    categoria: "Leitura",
    descricao:
      "Funciona como teclado: EAN-13, EAN-8, Code 128 e Code 39. Sufixo Enter obrigatório para adicionar ao carrinho.",
    icon: Barcode,
  },
  {
    id: "leitor-qr",
    nome: "Leitor QR / câmara",
    categoria: "Leitura",
    descricao:
      "QR Code por leitor dedicado ou pela câmara do dispositivo (BarcodeDetector). Útil para receitas, vouchers e produtos sem etiqueta.",
    icon: QrCode,
  },
  {
    id: "balanca",
    nome: "Balança electrónica (RS-232)",
    categoria: "Leitura",
    serial: true,
    descricao:
      "Leitura de peso para produtos vendidos ao kg ou litro, com aplicação directa na quantidade do artigo.",
    icon: Scale,
  },
  {
    id: "tpa",
    nome: "Terminal TPA / Multicaixa",
    categoria: "Pagamento",
    serial: true,
    descricao:
      "Envio do pedido de pagamento ao terminal e captura automática da referência da operação.",
    icon: CreditCard,
  },
  {
    id: "display-cliente",
    nome: "Display do cliente",
    categoria: "Atendimento",
    descricao:
      "Segundo ecrã (janela dedicada ou display de pólo por Serial) com artigos, total a pagar e troco.",
    icon: Monitor,
  },
  {
    id: "sinalizador",
    nome: "Sinalizador sonoro",
    categoria: "Atendimento",
    descricao:
      "Confirmação sonora de leitura de código, abertura de gaveta, pagamento aprovado e venda concluída.",
    icon: Volume2,
  },
];

const ESTADO_INICIAL_DISPOSITIVOS: Record<string, DispositivoEstado> =
  DISPOSITIVOS_CATALOGO.reduce(
    (acc, item) => {
      acc[item.id] = {
        estado:
          item.id === "leitor-codigo-barras"
            ? "conectado"
            : item.id === "ups"
              ? "conectado"
              : "simulado",
        detalhe:
          item.id === "leitor-codigo-barras"
            ? "Modo teclado (HID) activo"
            : item.id === "ups"
              ? "Rede eléctrica · bateria 100%"
              : "Modo simulado — ligue o hardware para comandos reais",
      };
      return acc;
    },
    {} as Record<string, DispositivoEstado>,
  );

const GAVETAS_PADRAO: Gaveta[] = [
  {
    id: "gaveta-principal",
    nome: "Gaveta Principal",
    tipo: "numerario",
    saldo: 0,
    aberta: false,
    canal: 1,
    aberturas: 0,
  },
  {
    id: "gaveta-troco",
    nome: "Gaveta de Troco",
    tipo: "troco",
    saldo: 0,
    aberta: false,
    canal: 1,
    aberturas: 0,
  },
  {
    id: "cofre",
    nome: "Cofre / Drop Safe",
    tipo: "cofre",
    saldo: 0,
    aberta: false,
    canal: 2,
    aberturas: 0,
  },
  {
    id: "gaveta-documentos",
    nome: "Gaveta de Documentos",
    tipo: "documentos",
    saldo: 0,
    aberta: false,
    canal: 2,
    aberturas: 0,
  },
];

const DENOMINACOES: { valor: number; tipo: "Nota" | "Moeda" }[] = [
  { valor: 10000, tipo: "Nota" },
  { valor: 5000, tipo: "Nota" },
  { valor: 2000, tipo: "Nota" },
  { valor: 1000, tipo: "Nota" },
  { valor: 500, tipo: "Nota" },
  { valor: 200, tipo: "Nota" },
  { valor: 100, tipo: "Nota" },
  { valor: 50, tipo: "Moeda" },
  { valor: 20, tipo: "Moeda" },
  { valor: 10, tipo: "Moeda" },
  { valor: 5, tipo: "Moeda" },
  { valor: 1, tipo: "Moeda" },
];

const MOTIVOS_GAVETA = [
  "Troco a cliente",
  "Sangria / depósito no cofre",
  "Verificação de numerário",
  "Devolução de artigo",
  "Reposição de documentos",
  "Início de turno",
  "Fecho de turno",
  "Outro motivo",
];

const MOTIVOS_DIFERENCA = [
  "Quebra de caixa (falta)",
  "Sobra de caixa",
  "Troco insuficiente",
  "Erro de operador",
  "Nota falsa retida",
  "Venda anulada não registada",
  "Outro motivo",
];

const PAYMENT_METHODS = [
  { value: "Numerário", label: "Numerário", icon: Banknote },
  { value: "Multicaixa (TPA)", label: "TPA", icon: CreditCard },
  { value: "Multicaixa Express", label: "Express", icon: CreditCard },
  { value: "Transferência Bancária", label: "Transferência", icon: CreditCard },
  { value: "Cheque", label: "Cheque", icon: Receipt },
  { value: "Crédito a 30 dias", label: "Crédito", icon: Clock },
  { value: "Misto", label: "Misto", icon: Calculator },
] as const;

type KeypadTarget =
  | "cash"
  | "mixedCash"
  | "mixedReceived"
  | "opening"
  | "closing"
  | "sangria"
  | null;

function todayStr(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}
function addDaysStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}
function isServiceProduct(product: Produto): boolean {
  const unit = (product.unidadeMedida || "").toLowerCase();
  const category = (product.categoria || "").toLowerCase();
  return (
    ["serv", "exame", "hora", "dia"].includes(unit) ||
    category.includes("serviço") ||
    category.includes("servico") ||
    category.includes("consult")
  );
}

/**
 * Lê a imagem do produto sem obrigar todos os módulos antigos a usarem já o
 * mesmo nome de campo. Aceita URL, caminho público, data URL ou objectos de
 * upload com propriedades comuns como url/src/dataUrl.
 */
function obterImagemProduto(product: Produto): string | undefined {
  const item = product as unknown as Record<string, unknown>;

  const converter = (value: unknown): string | undefined => {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      for (const key of ["url", "src", "dataUrl", "dataURL", "base64", "path"]) {
        const result = converter(obj[key]);
        if (result) return result;
      }
    }
    return undefined;
  };

  const campos = [
    item.imagem,
    item.image,
    item.imageUrl,
    item.imageURL,
    item.imagemUrl,
    item.imagemURL,
    item.urlImagem,
    item.foto,
    item.fotoUrl,
    item.fotoProduto,
    item.fotografia,
    item.photo,
    item.photoUrl,
    item.thumbnail,
    item.img,
    item.imgUrl,
    item.imagemProduto,
    item.imagemPrincipal,
  ];

  for (const campo of campos) {
    const resultado = converter(campo);
    if (resultado) return resultado;
  }

  for (const campo of [item.imagens, item.images, item.fotos]) {
    if (Array.isArray(campo)) {
      for (const imagem of campo) {
        const resultado = converter(imagem);
        if (resultado) return resultado;
      }
    }
  }

  return undefined;
}

const ProdutoImagem: React.FC<{
  produto: Produto;
  servico?: boolean;
  variante?: "catalogo" | "carrinho";
}> = ({ produto, servico = false, variante = "catalogo" }) => {
  const src = obterImagemProduto(produto);
  const [imagemFalhou, setImagemFalhou] = useState(false);

  useEffect(() => {
    setImagemFalhou(false);
  }, [src]);

  const classeImagem =
    variante === "carrinho"
      ? "pos-product-image pos-product-image--cart"
      : "pos-product-image";

  return (
    <>
      {src && !imagemFalhou ? (
        <img
          key={src}
          className={classeImagem}
          src={src}
          alt={`Imagem de ${produto.nome}`}
          loading="lazy"
          decoding="async"
          onError={() => setImagemFalhou(true)}
        />
      ) : (
        <span
          className={`pos-product-image-fallback ${servico ? "pos-product-image-fallback--service" : ""} ${variante === "carrinho" ? "pos-product-image-fallback--cart" : ""}`}
          aria-label={servico ? "Serviço sem imagem" : "Produto sem imagem"}
          title={servico ? "Serviço sem imagem associada" : "Produto sem imagem associada"}
        >
          {servico ? <Receipt aria-hidden="true" /> : <Package aria-hidden="true" />}
        </span>
      )}
    </>
  );
};
function parseExpiry(value?: string): Date | null {
  if (!value) return null;
  const parts = value.split("/");
  const date =
    parts.length === 3
      ? new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]))
      : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
function formatUnit(unit: string): string {
  return unit === "un" ? "un." : unit;
}
function nowStamp(): string {
  return new Date().toLocaleString("pt-AO", {
    dateStyle: "short",
    timeStyle: "medium",
  });
}
function qtyStep(product: Produto): number {
  return product.unidadeMedida === "kg" || product.unidadeMedida === "l"
    ? 0.1
    : 1;
}
function totalContagem(contagem: ContagemMap, gavetaId?: string): number {
  return Object.entries(contagem || {}).reduce((acc, [gid, denoms]) => {
    if (gavetaId && gid !== gavetaId) return acc;
    return (
      acc +
      Object.entries(denoms || {}).reduce(
        (sub, [denom, qtd]) => sub + Number(denom) * (Number(qtd) || 0),
        0,
      )
    );
  }, 0);
}

/* ------------------------------------------------------------ hardware ---- */
const ESC = 0x1b;
const GS = 0x1d;
const KICK_CANAL_1 = [ESC, 0x70, 0x00, 0x19, 0xfa];
const KICK_CANAL_2 = [ESC, 0x70, 0x01, 0x19, 0xfa];
const CORTE_PAPEL = [GS, 0x56, 0x42, 0x00];

let audioCtxGlobal: AudioContext | null = null;
function obterAudioContexto(): AudioContext | null {
  try {
    const Ctx =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtxGlobal) audioCtxGlobal = new Ctx();
    if (audioCtxGlobal?.state === "suspended") void audioCtxGlobal.resume();
    return audioCtxGlobal;
  } catch {
    return null;
  }
}
function tocarSom(
  tipo: "ok" | "erro" | "gaveta" | "leitura" | "moeda",
  activo = true,
) {
  if (!activo) return;
  const ctx = obterAudioContexto();
  if (!ctx) return;
  const sequencias: Record<string, number[]> = {
    ok: [880, 1320],
    erro: [320, 200],
    gaveta: [520, 780, 520],
    leitura: [1250],
    moeda: [1000, 1500, 1050],
  };
  const notas = sequencias[tipo] || [660];
  notas.forEach((freq, index) => {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const inicio = ctx.currentTime + index * 0.09;
      osc.type = "square";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, inicio);
      gain.gain.exponentialRampToValueAtTime(0.07, inicio + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(inicio);
      osc.stop(inicio + 0.1);
    } catch {
      /* áudio indisponível */
    }
  });
}

async function escreverBytes(port: any, bytes: number[]) {
  const writer = port?.writable?.getWriter();
  if (!writer) throw new Error("A porta seleccionada não permite escrita.");
  try {
    await writer.write(new Uint8Array(bytes));
  } finally {
    writer.releaseLock();
  }
}

function imprimirHTML(html: string, nomeFicheiro: string): boolean {
  try {
    const janela = window.open("", "_blank", "width=420,height=680");
    if (janela) {
      janela.document.write(html);
      janela.document.close();
      janela.focus();
      setTimeout(() => {
        try {
          janela.print();
        } catch {
          /* bloqueado */
        }
      }, 400);
      return true;
    }
  } catch {
    /* pop-up bloqueado */
  }
  downloadFatura(html, nomeFicheiro);
  return false;
}

function relatorioCaixaHTML(params: {
  titulo: string;
  empresa: string;
  nif: string;
  terminal: string;
  operador: string;
  emitidoEm: string;
  linhas: { label: string; value: string; forte?: boolean }[];
  seccoes?: { titulo: string; linhas: { label: string; value: string }[] }[];
  rodape?: string[];
}): string {
  const linhaHTML = (label: string, value: string, forte?: boolean) =>
    `<tr${forte ? ' class="forte"' : ""}><td>${label}</td><td class="v">${value}</td></tr>`;
  const seccoes = (params.seccoes || [])
    .map(
      (seccao) => `
    <tr><td colspan="2" class="sec">${seccao.titulo}</td></tr>
    ${seccao.linhas.map((l) => linhaHTML(l.label, l.value)).join("")}
  `,
    )
    .join("");
  return `<!doctype html><html lang="pt"><head><meta charset="utf-8"><title>${params.titulo}</title>
<style>
@page{size:80mm auto;margin:4mm}
body{font-family:"Courier New",monospace;width:72mm;margin:0 auto;color:#000;font-size:11px}
h1{font-size:12px;text-align:center;margin:0 0 2px;text-transform:uppercase;letter-spacing:.5px}
h2{font-size:11px;text-align:center;margin:0 0 8px;font-weight:400}
table{width:100%;border-collapse:collapse}
td{padding:2px 0;vertical-align:top}
td.v{text-align:right;white-space:nowrap;padding-left:6px}
tr.forte td{font-weight:700;font-size:12px}
td.sec{padding-top:8px;font-weight:700;text-transform:uppercase;font-size:10px;letter-spacing:.4px;border-bottom:1px dashed #000}
.hr{border-top:1px dashed #000;margin:8px 0}
.center{text-align:center}
.rodape{margin-top:10px;font-size:10px;line-height:1.5}
</style></head><body>
<h1>${params.empresa}</h1>
<h2>NIF ${params.nif}</h2>
<div class="hr"></div>
<h1>${params.titulo}</h1>
<p class="center">Terminal ${params.terminal} · Operador ${params.operador}<br/>Emitido em ${params.emitidoEm}</p>
<div class="hr"></div>
<table>${params.linhas.map((l) => linhaHTML(l.label, l.value, l.forte)).join("")}${seccoes}</table>
<div class="hr"></div>
<div class="rodape center">${(params.rodape || []).map((r) => `<div>${r}</div>`).join("")}</div>
<p class="center" style="margin-top:10px">*** Documento não fiscal ***<br/>Processado por programa validado</p>
</body></html>`;
}

const DISPLAY_CLIENTE_HTML = `<!doctype html><html lang="pt"><head><meta charset="utf-8"><title>Display do Cliente</title>
<style>
*{box-sizing:border-box}
body{margin:0;background:#0b1220;color:#fff;font-family:Roboto,"Helvetica Neue",Arial,sans-serif;min-height:100vh;display:flex;flex-direction:column}
header{padding:18px 22px;border-bottom:1px solid rgba(255,255,255,.12);display:flex;justify-content:space-between;align-items:center;gap:12px}
header strong{font-size:17px;letter-spacing:.3px}
header span{font-size:12px;opacity:.65}
main{flex:1;padding:22px;display:flex;flex-direction:column;gap:14px}
#itens{flex:1;overflow-y:auto;border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:10px 14px;min-height:120px}
.item{display:flex;justify-content:space-between;gap:12px;font-size:16px;padding:7px 0;border-bottom:1px dashed rgba(255,255,255,.14)}
.item:last-child{border-bottom:none}
.item small{opacity:.6;display:block;font-size:11px}
.item b{white-space:nowrap}
#totalBox{background:#1577EB;border-radius:10px;padding:18px 22px;text-align:right}
#totalBox small{display:block;font-size:13px;text-transform:uppercase;letter-spacing:1.4px;opacity:.85}
#totalBox strong{font-size:56px;line-height:1.05;letter-spacing:-1px}
#troco{background:#12b76a;border-radius:10px;padding:14px 22px;text-align:right;font-size:20px;font-weight:700;display:none}
#msg{text-align:center;font-size:22px;font-weight:700;min-height:30px;color:#ffd166}
.vazio{opacity:.45;font-size:14px;text-align:center;padding:26px 0}
footer{padding:12px 22px;border-top:1px solid rgba(255,255,255,.12);font-size:11px;opacity:.55;text-align:center}
</style></head><body>
<header><strong id="empresa">Ponto de Venda</strong><span id="operador">Terminal · Operador</span></header>
<main>
  <div id="msg">Bem-vindo. Aguarde o registo dos artigos.</div>
  <div id="itens"><div class="vazio">Sem artigos registados</div></div>
  <div id="troco"></div>
  <div id="totalBox"><small>Total a pagar</small><strong id="total">0,00</strong></div>
</main>
<footer>Obrigado pela sua preferência · Conserve o talão para qualquer troca</footer>
<script>
var canal = new BroadcastChannel('pos-display-cliente');
function fmt(v, moeda){ return (Number(v)||0).toLocaleString('pt-PT',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' ' + (moeda||''); }
canal.onmessage = function(ev){
  var d = ev.data || {};
  if (d.empresa) document.getElementById('empresa').textContent = d.empresa;
  if (d.operador) document.getElementById('operador').textContent = d.operador;
  if (typeof d.mensagem === 'string') document.getElementById('msg').textContent = d.mensagem;
  if (d.itens) {
    var caixa = document.getElementById('itens');
    if (!d.itens.length) { caixa.innerHTML = '<div class="vazio">Sem artigos registados</div>'; }
    else {
      caixa.innerHTML = '';
      d.itens.forEach(function(it){
        var linha = document.createElement('div');
        linha.className = 'item';
        var nome = document.createElement('span');
        nome.innerHTML = it.nome + '<small>' + it.qtd + ' x ' + it.preco + '</small>';
        var val = document.createElement('b');
        val.textContent = it.total;
        linha.appendChild(nome); linha.appendChild(val);
        caixa.appendChild(linha);
      });
      caixa.scrollTop = caixa.scrollHeight;
    }
  }
  if (typeof d.total !== 'undefined') document.getElementById('total').textContent = d.total;
  var troco = document.getElementById('troco');
  if (typeof d.troco !== 'undefined' && d.troco) { troco.style.display='block'; troco.textContent = 'TROCO: ' + d.troco; }
  else if (typeof d.troco !== 'undefined') { troco.style.display='none'; }
};
canal.postMessage({ tipo:'display-pronto' });
</script></body></html>`;

/* ------------------------------------------------------------ teclado ---- */
const Keypad: React.FC<{
  label: string;
  value: string;
  currency: string;
  onChange: (next: string) => void;
  onClose: () => void;
}> = ({ label, value, currency, onChange, onClose }) => {
  const press = (key: string) => {
    if (key === "back") {
      onChange(value.length <= 1 ? "0" : value.slice(0, -1));
      return;
    }
    if (key === "clean") {
      onChange("0");
      return;
    }
    if (key === ",") {
      if (!value.includes(",")) onChange(`${value},`);
      return;
    }
    if (value === "0") {
      onChange(key);
      return;
    }
    if (value.replace(/[^0-9]/g, "").length >= 10) return;
    onChange(value + key);
  };
  const numeric = parseFloat(value.replace(",", ".")) || 0;
  return (
    <div
      className="pos-modal"
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div className="pos-modal__panel">
        <div className="pos-modal__header">
          <h3 className="pos-modal__title">{label}</h3>
          <button
            type="button"
            className="pos-modal__close"
            onClick={onClose}
            aria-label="Fechar teclado"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="pos-modal__body">
          <div className="pos-keypad__display">
            <small>Valor</small>
            <strong>{formatCurrency(numeric, currency)}</strong>
          </div>
          <div className="pos-keypad">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "00"].map(
              (key) => (
                <button
                  type="button"
                  key={key}
                  className="pos-key"
                  onClick={() => press(key)}
                >
                  {key}
                </button>
              ),
            )}
            <button
              type="button"
              className="pos-key pos-key--fn"
              onClick={() => press("back")}
              aria-label="Apagar"
            >
              <Delete className="w-5 h-5" />
            </button>
            <button
              type="button"
              className="pos-key pos-key--fn"
              onClick={() => press("clean")}
              aria-label="Limpar"
            >
              <X className="w-5 h-5" />
            </button>
            <button
              type="button"
              className="pos-key pos-key--ok"
              onClick={onClose}
            >
              <Check className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------- contagem de numerário --- */
const ContagemDenominacoes: React.FC<{
  valores: Record<string, number>;
  moeda: string;
  onChange: (next: Record<string, number>) => void;
  testIdPrefix: string;
}> = ({ valores, moeda, onChange, testIdPrefix }) => {
  const setQtd = (denom: number, qtd: number) =>
    onChange({ ...valores, [String(denom)]: Math.max(0, qtd) });
  const total = DENOMINACOES.reduce(
    (sum, denom) => sum + denom.valor * (valores[String(denom.valor)] || 0),
    0,
  );
  return (
    <div>
      <div className="pos-denom">
        {DENOMINACOES.map(({ valor, tipo }) => {
          const qtd = valores[String(valor)] || 0;
          return (
            <div className="pos-denom__item" key={valor}>
              <div className="pos-denom__head">
                <span>
                  {tipo} {valor.toLocaleString("pt-PT")}
                </span>
                <span>{moeda}</span>
              </div>
              <div className="pos-denom__qty">
                <button
                  type="button"
                  className="pos-denom__mini"
                  onClick={() => setQtd(valor, qtd - 1)}
                  aria-label={`Menos notas de ${valor}`}
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  value={qtd || ""}
                  placeholder="0"
                  inputMode="numeric"
                  onChange={(event) =>
                    setQtd(
                      valor,
                      parseInt(event.target.value.replace(/\D/g, ""), 10) || 0,
                    )
                  }
                  aria-label={`Quantidade de ${tipo.toLowerCase()}s de ${valor}`}
                  data-testid={`${testIdPrefix}-denom-${valor}`}
                />
                <button
                  type="button"
                  className="pos-denom__mini"
                  onClick={() => setQtd(valor, qtd + 1)}
                  aria-label={`Mais notas de ${valor}`}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="pos-denom__sub">
                {formatCurrency(qtd * valor, moeda)}
              </div>
            </div>
          );
        })}
      </div>
      <div className="pos-denom__total">
        <span>Total contado</span>
        <strong data-testid={`${testIdPrefix}-total`}>
          {formatCurrency(total, moeda)}
        </strong>
      </div>
    </div>
  );
};

/* ---------------------------------------------------------------- POS ---- */
export const POSView: React.FC<POSViewProps> = ({ onOpenScanner }) => {
  const {
    faturas,
    produtos,
    pacientes,
    config,
    currentUser,
    addFatura,
    addPaciente,
    findProdutoByBarcodeOrCode,
    updateConfig, refresh,
  } = useApp();

  const fiscal = (config as any).configuracaoFiscal || {};
  const nomeEmpresa = String(
    (config as any).nomeEmpresa ||
      fiscal.nomeEmpresa ||
      fiscal.empresa ||
      config.nomeClinica || "Estabelecimento",
  );
  const nifEmpresa = String(
    (config as any).nif || fiscal.nif || fiscal.nifEmpresa || "—",
  );
  const pinSupervisor = ""; // A aprovação é validada pela sessão real no servidor.
  const terminalCaixa = String(config.caixaSessaoAtual?.terminal || fiscal.terminalCaixa || "POS-01");

  const [search, setSearch] = useState("");
  const [sector, setSector] = useState<PosSectorFilter>("Todos");
  const [category, setCategory] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);

  /* adquirente: cliente registado OU não é cliente */
  const [cliente, setCliente] = useState<ClienteDoc>(criarConsumidorFinal());

  const [payment, setPayment] = useState("Multicaixa (TPA)");
  const [cashReceived, setCashReceived] = useState<number | "">("");
  const [paymentReference, setPaymentReference] = useState("");
  const [mixedCashAmount, setMixedCashAmount] = useState<number | "">("");
  const [openingCash, setOpeningCash] = useState<number | "">("");
  const [closingCash, setClosingCash] = useState<number | "">("");
  const [discountPercent, setDiscountPercent] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [cashModal, setCashModal] = useState<"open" | "close" | null>(null);
  const [restaurantMode, setRestaurantMode] = useState<
    "Mesa" | "Takeaway" | "Delivery"
  >("Mesa");
  const [restaurantTable, setRestaurantTable] = useState("");
  const [prescriptionNumber, setPrescriptionNumber] = useState("");
  const [showCustomer, setShowCustomer] = useState(false);
  const [showDiscount, setShowDiscount] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);
  const [completedSale, setCompletedSale] = useState<CompletedSale | null>(
    null,
  );
  const [heldSales, setHeldSales] = useState<HeldSale[]>([]);
  const [showHeld, setShowHeld] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [keypadTarget, setKeypadTarget] = useState<KeypadTarget>(null);
  const [keypadBuffer, setKeypadBuffer] = useState("0");
  const [openBoxes, setOpenBoxes] = useState<Record<string, boolean>>({});
  const [showNovoClienteModal, setShowNovoClienteModal] = useState(false);
  const [novoCliNome, setNovoCliNome] = useState("");
  const [novoCliNif, setNovoCliNif] = useState("");
  const [novoCliTel, setNovoCliTel] = useState("");
  const [novoCliEnd, setNovoCliEnd] = useState("");

  /* -------- reforço da abertura/fecho de caixa -------- */
  const [cashStep, setCashStep] = useState(1);
  const [gavetaFundo, setGavetaFundo] = useState("gaveta-principal");
  const [openingNotes, setOpeningNotes] = useState("");
  const [contagemAbertura, setContagemAbertura] = useState<ContagemMap>({});
  const [contagemFecho, setContagemFecho] = useState<ContagemMap>({});
  const [gavetaContagem, setGavetaContagem] = useState("gaveta-principal");
  const [diferencaMotivo, setDiferencaMotivo] = useState("");
  const [diferencaNota, setDiferencaNota] = useState("");
  const [supervisorNome, setSupervisorNome] = useState(currentUser.nome);
  const [supervisorPin, setSupervisorPin] = useState("");
  const [confirmarValores, setConfirmarValores] = useState(false);
  const [imprimirAbertura, setImprimirAbertura] = useState(true);
  const [imprimirFecho, setImprimirFecho] = useState(true);
  const [abrirGavetaNoFecho, setAbrirGavetaNoFecho] = useState(true);
  const [gavetas, setGavetas] = useState<Gaveta[]>(GAVETAS_PADRAO);
  const [movimentos, setMovimentos] = useState<MovimentoCaixa[]>([]);
  const [showRelatorioX, setShowRelatorioX] = useState(false);
  const [showMovimentos, setShowMovimentos] = useState(false);
  const [showTesouraria, setShowTesouraria] = useState(false);
  const [tesourariaTipo, setTesourariaTipo] = useState<
    "sangria" | "suprimento"
  >("sangria");
  const [tesourariaValor, setTesourariaValor] = useState<number | "">("");
  const [tesourariaMotivo, setTesourariaMotivo] = useState("");
  const [tesourariaGaveta, setTesourariaGaveta] = useState("gaveta-principal");
  const [drawerModal, setDrawerModal] = useState<string | null>(null);
  const [drawerMotivo, setDrawerMotivo] = useState(MOTIVOS_GAVETA[0]);
  const [drawerNota, setDrawerNota] = useState("");

  /* -------- dispositivos -------- */
  const [dispositivos, setDispositivos] = useState<
    Record<string, DispositivoEstado>
  >(() => {
    try {
      const gravado = window.localStorage.getItem("pos.dispositivos.v1");
      if (gravado)
        return { ...ESTADO_INICIAL_DISPOSITIVOS, ...JSON.parse(gravado) };
    } catch {
      /* sem storage */
    }
    return ESTADO_INICIAL_DISPOSITIVOS;
  });
  const [showDevices, setShowDevices] = useState(false);
  const [deviceTab, setDeviceTab] = useState<
    "perifericos" | "leitura" | "preferencias" | "log"
  >("perifericos");
  const [deviceLog, setDeviceLog] = useState<LogDispositivo[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [cameraErro, setCameraErro] = useState("");
  const [codigoManual, setCodigoManual] = useState("");
  const [showScale, setShowScale] = useState(false);
  const [pesoLido, setPesoLido] = useState<number | "">("");
  const [scaleProduto, setScaleProduto] = useState("");
  const [scaleBusy, setScaleBusy] = useState(false);
  const [tpaBusy, setTpaBusy] = useState(false);
  const [autoKick, setAutoKick] = useState(true);
  const [autoPrint, setAutoPrint] = useState(true);
  const [somActivo, setSomActivo] = useState(true);
  const [displayAberto, setDisplayAberto] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const serialPortsRef = useRef<Record<string, any>>({});
  const displayChannelRef = useRef<BroadcastChannel | null>(null);
  const displayWindowRef = useRef<Window | null>(null);
  const gavetaTimerRef = useRef<Record<string, number>>({});

  const toggleBox = (key: string) =>
    setOpenBoxes((prev) => ({ ...prev, [key]: !prev[key] }));

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "pos.dispositivos.v1",
        JSON.stringify(dispositivos),
      );
    } catch {
      /* ignora */
    }
  }, [dispositivos]);

  const sectors = POS_SECTORS;
  const catalogCategories = useMemo(() => posCategories(produtos, sector), [produtos, sector]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return produtos
      .filter((product) => product.ativo)
      .filter(
        (product) => sector === "Todos" || productSector(product) === sector,
      )
      .filter((product) => !category || product.categoria?.trim() === category)
      .filter((product) => {
        if (!query) return true;
        return [
          product.nome,
          product.codigo,
          product.codigoBarras,
          product.categoria,
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(query));
      })
      .slice(0, 120);
  }, [produtos, search, sector, category]);

  const produtosPeso = useMemo(
    () =>
      produtos.filter(
        (product) =>
          product.ativo &&
          ["kg", "l", "g"].includes(
            (product.unidadeMedida || "").toLowerCase(),
          ),
      ),
    [produtos],
  );

  const saleLines = useMemo(() => cart.map(({ product: p, quantity }) => ({
    id: `pos-line-${p.id}`, produtoId: p.id, codigo: p.codigo,
    descricao: p.nome, quantidade: quantity, precoUnitario: p.preco,
    ivaIsento: p.ivaIsento === true, unidade: p.unidadeMedida,
    lote: p.loteAtual, dataValidade: p.dataValidade,
  })), [cart]);
  const totals = useMemo(() => {
    const discount = inputNumber(discountPercent);
    const fixed = discount > 0 ? 0 : inputNumber(discountAmount);
    const preview = invoicePreview(saleLines, config.ivaTaxa, discount, fixed,
      config.calculoFiscalAGT ? "agt2" : "legacy");
    return { ...preview, subtotal: preview.subtotalSemIva, descontoPercent: discount,
      fixedDiscount: fixed, descontoValor: Number(((preview.subtotalBruto || 0) - (preview.subtotalSemIva || 0)).toFixed(2)) };
  }, [saleLines, config.ivaTaxa, config.calculoFiscalAGT, discountPercent, discountAmount]);

  const change =
    payment === "Numerário" && typeof cashReceived === "number"
      ? Math.max(0, Math.round((cashReceived - totals.total) * 100) / 100)
      : payment === "Misto" &&
          typeof cashReceived === "number" &&
          typeof mixedCashAmount === "number"
        ? Math.max(0, Math.round((cashReceived - mixedCashAmount) * 100) / 100)
        : 0;

  const activeSession = config.caixaSessaoAtual as SessaoCaixaPOS | undefined;
  const cartSector = cart.length > 0 ? productSector(cart[0].product) : sector;

  const sessionSales = useMemo(() => {
    if (!activeSession) return [];
    return faturas.filter(
      (fatura) =>
        fatura.caixaSessaoId === activeSession.id &&
        fatura.estado === "paga" && ["factura-recibo","recibo"].includes(fatura.tipoDocumento),
    );
  }, [activeSession, faturas]);

  const resumoPorForma = useMemo(() => {
    const mapa: Record<string, number> = {};
    sessionSales.forEach((fatura) => {
      const detalhe = fatura.formasPagamentoDetalhe || [];
      if (detalhe.length > 0) {
        detalhe.forEach((item) => {
          mapa[item.forma] = (mapa[item.forma] || 0) + item.valor;
        });
      } else {
        const forma = fatura.formaPagamento || "Não definido";
        mapa[forma] = (mapa[forma] || 0) + fatura.total;
      }
    });
    return Object.entries(mapa)
      .map(([forma, valor]) => ({ forma, valor }))
      .sort((a, b) => b.valor - a.valor);
  }, [sessionSales]);

  const totalSangrias = useMemo(
    () =>
      movimentos
        .filter((m) => m.tipo === "sangria")
        .reduce((s, m) => s + m.valor, 0),
    [movimentos],
  );
  const totalSuprimentos = useMemo(
    () =>
      movimentos
        .filter((m) => m.tipo === "suprimento")
        .reduce((s, m) => s + m.valor, 0),
    [movimentos],
  );

  const expectedCash = Number(activeSession?.valorEsperado || 0);

  const expectedCofre = Math.max(0, totalSangrias - totalSuprimentos);

  const sessionTotals = useMemo(
    () => ({
      valor: sessionSales.reduce((sum, f) => sum + f.total, 0),
      qtd: sessionSales.length,
    }),
    [sessionSales],
  );

  // A sessão e os saldos são recebidos da API, nunca substituídos pelo navegador.
  const gravarSessao = useCallback((_patch: Partial<SessaoCaixaPOS>) => {}, []);
  useEffect(() => {
    const session=config.caixaSessaoAtual as SessaoCaixaPOS | undefined;
    setGavetas(session?.gavetas || GAVETAS_PADRAO);
    setMovimentos(session?.movimentos || []);
  }, [config.caixaSessaoAtual]);

  /* -------- log e estado dos dispositivos -------- */
  const registarLog = useCallback(
    (
      dispositivo: string,
      evento: string,
      tipo: LogDispositivo["tipo"] = "info",
    ) => {
      setDeviceLog((prev) =>
        [
          {
            em: new Date().toLocaleTimeString("pt-PT"),
            dispositivo,
            evento,
            tipo,
          },
          ...prev,
        ].slice(0, 80),
      );
    },
    [],
  );

  const marcarDispositivo = useCallback(
    (id: string, patch: Partial<DispositivoEstado>) => {
      setDispositivos((prev) => ({
        ...prev,
        [id]: {
          ...(prev[id] || {estado: "simulado" as const}),
          ...patch,
          ultima: nowStamp(),
        },
      }));
    },
    [],
  );

  /* -------- gavetas -------- */
  const abrirGaveta = useCallback(
    async (gavetaId: string, motivo: string, silencioso = false) => {
      const gaveta = gavetas.find((item) => item.id === gavetaId);
      if (!gaveta) return;
      try {
        const port = serialPortsRef.current["gaveta-dinheiro"];
        await command('/cash/drawer',{gavetaId,motivo,modo:port?'comando':'simulado'});
        if (port && port.writable) {
          await escreverBytes(
            port,
            gaveta.canal === 2 ? KICK_CANAL_2 : KICK_CANAL_1,
          );
          marcarDispositivo("gaveta-dinheiro", {
            estado: "conectado",
            detalhe: `Último comando: ${gaveta.nome} (canal ${gaveta.canal})`,
          });
          registarLog(
            "Gaveta",
            `ESC/POS enviado · ${gaveta.nome} (canal ${gaveta.canal}) · ${motivo}`,
            "ok",
          );
        } else {
          registarLog(
            "Gaveta",
            `Abertura simulada · ${gaveta.nome} · ${motivo}`,
            "info",
          );
        }
        tocarSom("gaveta", somActivo);
        setGavetas((prev) =>
          prev.map((item) =>
            item.id === gavetaId
              ? {
                  ...item,
                  aberta: true,
                  aberturas: item.aberturas + 1,
                  ultimaAbertura: nowStamp(),
                }
              : item,
          ),
        );
        if (gavetaTimerRef.current[gavetaId])
          window.clearTimeout(gavetaTimerRef.current[gavetaId]);
        gavetaTimerRef.current[gavetaId] = window.setTimeout(() => {
          setGavetas((prev) =>
            prev.map((item) =>
              item.id === gavetaId ? { ...item, aberta: false } : item,
            ),
          );
        }, 4200);
        setMovimentos((prev) =>
          [
            {
              id: `mov-gav-${Date.now()}-${Math.floor(Math.random() * 999)}`,
              tipo: "gaveta" as const,
              valor: 0,
              gavetaId,
              motivo,
              operador: currentUser.nome,
              em: nowStamp(),
            },
            ...prev,
          ].slice(0, 200),
        );
        if (!silencioso)
          setFeedback({
            type: "success",
            text: `${gaveta.nome}: ${port ? "comando enviado" : "simulação"} — ${motivo}. Tentativa registada no servidor.`,
          });
      } catch (error) {
        marcarDispositivo("gaveta-dinheiro", {
          estado: "erro",
          detalhe: error instanceof Error ? error.message : "Falha na porta",
        });
        registarLog(
          "Gaveta",
          `Falha ao abrir ${gaveta.nome}: ${error instanceof Error ? error.message : "erro"}`,
          "erro",
        );
        tocarSom("erro", somActivo);
        if (!silencioso)
          setFeedback({
            type: "error",
            text: "Não foi possível comandar a gaveta. Verifique a ligação ou use o modo simulado.",
          });
      }
    },
    [gavetas, marcarDispositivo, registarLog, somActivo, currentUser.nome],
  );

  const confirmarAberturaGaveta = () => {
    if (!drawerModal) return;
    const motivo =
      drawerMotivo === "Outro motivo" && drawerNota.trim()
        ? `Outro: ${drawerNota.trim()}`
        : drawerMotivo;
    void abrirGaveta(drawerModal, motivo);
    setDrawerModal(null);
    setDrawerNota("");
    setDrawerMotivo(MOTIVOS_GAVETA[0]);
  };

  /* -------- abrir caixa (reforçado) -------- */
  const passosAbertura = [
    "Fundo e gaveta",
    "Contagem de notas",
    "Confirmar abertura",
  ];
  const passosFecho = [
    "Conferência do turno",
    "Contagem do dinheiro",
    "Diferenças e aprovação",
    "Confirmar fecho",
  ];
  const passos = cashModal === "open" ? passosAbertura : passosFecho;

  const totalContadoAbertura = totalContagem(contagemAbertura);
  const totalContadoFecho = totalContagem(contagemFecho);
  const diferencaFecho =
    (typeof closingCash === "number" ? closingCash : 0) - expectedCash;

  const resetCashModal = () => {
    setCashModal(null);
    setCashStep(1);
    setConfirmarValores(false);
    setDiferencaMotivo("");
    setDiferencaNota("");
    setSupervisorNome("");
    setSupervisorPin("");
  };

  const relatorioAberturaHTML = (fundo: number) =>
    relatorioCaixaHTML({
      titulo: "Relatório de Abertura de Caixa",
      empresa: nomeEmpresa,
      nif: nifEmpresa,
      terminal: terminalCaixa,
      operador: currentUser.nome,
      emitidoEm: nowStamp(),
      linhas: [
        {
          label: "Fundo inicial",
          value: formatCurrency(fundo, config.moeda),
          forte: true,
        },
        {
          label: "Gaveta de destino",
          value:
            gavetas.find((g) => g.id === gavetaFundo)?.nome ||
            "Gaveta Principal",
        },
        { label: "Data de abertura", value: nowStamp() },
      ],
      seccoes:
        totalContadoAbertura > 0
          ? [
              {
                titulo: "Contagem por denominação",
                linhas: DENOMINACOES.filter(
                  (denom) =>
                    (contagemAbertura[gavetaFundo] || {})[String(denom.valor)],
                ).map((denom) => {
                  const qtd =
                    (contagemAbertura[gavetaFundo] || {})[
                      String(denom.valor)
                    ] || 0;
                  return {
                    label: `${qtd} x ${denom.valor.toLocaleString("pt-PT")} (${denom.tipo})`,
                    value: formatCurrency(qtd * denom.valor, config.moeda),
                  };
                }),
              },
            ]
          : undefined,
      rodape: [
        openingNotes ? `Observações: ${openingNotes}` : "",
        "Conserve este relatório com o fecho do turno.",
      ].filter(Boolean),
    });

  const openCashSession = async () => {
    const fundo = typeof openingCash === "number" ? openingCash : 0;
    if (fundo < 0) {
      setFeedback({
        type: "error",
        text: "O fundo inicial não pode ser negativo.",
      });
      return;
    }
    if (!confirmarValores) {
      setFeedback({
        type: "error",
        text: "Confirme que contou e registou correctamente o fundo inicial.",
      });
      return;
    }
    if (
      totalContadoAbertura > 0 &&
      Math.abs(totalContadoAbertura - fundo) > 0.01
    ) {
      setFeedback({
        type: "error",
        text: `A contagem (${formatCurrency(totalContadoAbertura, config.moeda)}) não coincide com o fundo declarado (${formatCurrency(fundo, config.moeda)}). Corrija antes de abrir.`,
      });
      return;
    }

    const session: SessaoCaixaPOS = {
      id: `cx-${Date.now()}`,
      terminal: terminalCaixa,
      operador: currentUser.nome,
      abertaEm: nowStamp(),
      fundoInicial: fundo,
      estado: "aberta",
      gavetaFundo,
      observacoes: openingNotes.trim() || undefined,
      contagemAbertura: totalContadoAbertura > 0 ? contagemAbertura : undefined,
      movimentos: [
        {
          id: `mov-abertura-${Date.now()}`,
          tipo: "abertura",
          valor: fundo,
          gavetaId: gavetaFundo,
          motivo:
            totalContadoAbertura > 0
              ? "Fundo inicial contado por denominação"
              : "Fundo inicial de abertura",
          operador: currentUser.nome,
          em: nowStamp(),
        },
      ],
      gavetas: GAVETAS_PADRAO.map((item) =>
        item.id === gavetaFundo
          ? { ...item, saldo: fundo }
          : { ...item, saldo: 0 },
      ),
      relatoriosX: 0,
    };
    try {
      const selectedTerminal=window.prompt('Identificador do terminal físico de caixa:',terminalCaixa);if(!selectedTerminal?.trim())return;
      await command('/cash/open', {fundoInicial:fundo, terminal:selectedTerminal.trim(), contagemAbertura, observacoes:openingNotes});
      await refresh();
    } catch (e:any) { setFeedback({type:'error',text:e.message}); return; }
    setGavetas(session.gavetas || GAVETAS_PADRAO);
    setMovimentos(session.movimentos || []);
    setFeedback({
      type: "success",
      text: `Caixa aberta com fundo de ${formatCurrency(fundo, config.moeda)} em ${session.gavetas?.find((g) => g.id === gavetaFundo)?.nome}.`,
    });
    tocarSom("moeda", somActivo);
    if (imprimirAbertura)
      imprimirHTML(
        relatorioAberturaHTML(fundo),
        `Abertura_Caixa_${terminalCaixa}`,
      );
    resetCashModal();
    setOpeningCash("");
    setOpeningNotes("");
    setContagemAbertura({});
    setCashStep(1);
    await abrirGaveta(gavetaFundo, "Início de turno", true);
  };

  const relatorioZHTML = () =>
    relatorioCaixaHTML({
      titulo: "Relatório Z · Fecho de Caixa",
      empresa: nomeEmpresa,
      nif: nifEmpresa,
      terminal: terminalCaixa,
      operador: currentUser.nome,
      emitidoEm: nowStamp(),
      linhas: [
        { label: "Abertura", value: activeSession?.abertaEm || "—" },
        { label: "Fecho", value: nowStamp() },
        { label: "N.º de vendas", value: String(sessionTotals.qtd) },
        {
          label: "Valor das vendas",
          value: formatCurrency(sessionTotals.valor, config.moeda),
        },
        {
          label: "Fundo inicial",
          value: formatCurrency(activeSession?.fundoInicial || 0, config.moeda),
        },
        {
          label: "Sangrias",
          value: `- ${formatCurrency(totalSangrias, config.moeda)}`,
        },
        {
          label: "Suprimentos",
          value: `+ ${formatCurrency(totalSuprimentos, config.moeda)}`,
        },
        {
          label: "Numerário esperado",
          value: formatCurrency(expectedCash, config.moeda),
        },
        {
          label: "Numerário contado",
          value: formatCurrency(
            typeof closingCash === "number" ? closingCash : 0,
            config.moeda,
          ),
          forte: true,
        },
        {
          label: "Diferença",
          value: formatCurrency(diferencaFecho, config.moeda),
          forte: true,
        },
      ],
      seccoes: [
        {
          titulo: "Vendas por forma de pagamento",
          linhas: resumoPorForma.length
            ? resumoPorForma.map((item) => ({
                label: item.forma,
                value: formatCurrency(item.valor, config.moeda),
              }))
            : [
                {
                  label: "Sem vendas no turno",
                  value: formatCurrency(0, config.moeda),
                },
              ],
        },
        {
          titulo: "Contagem por gaveta",
          linhas: gavetas
            .filter((gaveta) => gaveta.tipo !== "documentos")
            .map((gaveta) => ({
              label: `${gaveta.nome} (${gaveta.aberturas} aberturas)`,
              value: formatCurrency(
                totalContagem(contagemFecho, gaveta.id),
                config.moeda,
              ),
            })),
        },
      ],
      rodape: [
        diferencaFecho !== 0
          ? `Motivo da diferença: ${diferencaMotivo || "não indicado"}`
          : "Sem diferenças de caixa.",
        diferencaNota ? `Nota: ${diferencaNota}` : "",
        supervisorNome ? `Aprovado por: ${supervisorNome}` : "",
        "Documento de conferência interna. Assine e arquive com o turno.",
      ].filter(Boolean),
    });

  const closeCashSession = async () => {
    if (!activeSession) return;
    if (typeof closingCash !== "number" || closingCash < 0) {
      setFeedback({
        type: "error",
        text: "Conte o dinheiro e informe o valor encontrado na caixa.",
      });
      setCashStep(2);
      return;
    }
    if (!confirmarValores) {
      setFeedback({
        type: "error",
        text: "Confirme a conferência do turno antes de fechar a caixa.",
      });
      return;
    }
    if (Math.abs(diferencaFecho) > 0.009) {
      if (!diferencaMotivo) {
        setFeedback({
          type: "error",
          text: "Existe diferença de caixa. Seleccione o motivo da diferença.",
        });
        setCashStep(3);
        return;
      }
      if (currentUser.role !== 'admin' && (!supervisorNome.trim() || !supervisorPin)) {
        setFeedback({type:'error',text:'Indique o utilizador e a palavra-passe de um gestor para aprovar a diferença.'});return;
      }

    }

    try {
      const result=await command('/cash/close',{valorContado:closingCash,diferencaMotivo,contagemFecho,supervisorUsername:supervisorNome,supervisorPassword:supervisorPin});
      if (imprimirFecho) imprimirHTML(relatorioZHTML(),`Relatorio_Z_${terminalCaixa}`);
      await refresh();
    } catch(e:any) {setFeedback({type:'error',text:e.message});return;}
    setFeedback({
      type: "success",
      text: `Caixa fechada. Esperado: ${formatCurrency(expectedCash, config.moeda)} · Contado: ${formatCurrency(closingCash, config.moeda)} · Diferença: ${formatCurrency(diferencaFecho, config.moeda)}.`,
    });
    tocarSom("ok", somActivo);
    if (abrirGavetaNoFecho)
      await abrirGaveta(
        gavetaFundo,
        "Fecho de turno — retirada do numerário",
        true,
      );
    resetCashModal();
    setClosingCash("");
    setContagemFecho({});
    setSupervisorPin("");
    setGavetaContagem("gaveta-principal");
  };

  /* -------- tesouraria: sangria / suprimento -------- */
  const confirmarTesouraria = async () => {
    const valor = typeof tesourariaValor === "number" ? tesourariaValor : 0;
    if (valor <= 0) {
      setFeedback({
        type: "error",
        text: "Indique um valor válido para a operação de tesouraria.",
      });
      return;
    }
    if (!tesourariaMotivo.trim()) {
      setFeedback({
        type: "error",
        text: "Descreva o motivo da operação (obrigatório para auditoria).",
      });
      return;
    }
    if (!activeSession) {
      setFeedback({
        type: "error",
        text: "Abra a caixa antes de registar sangrias ou suprimentos.",
      });
      return;
    }

    const origem = tesourariaTipo === "sangria" ? tesourariaGaveta : "cofre";
    const destino = tesourariaTipo === "sangria" ? "cofre" : tesourariaGaveta;
    const saldoOrigem = gavetas.find((g) => g.id === origem)?.saldo || 0;
    if (tesourariaTipo === "sangria" && valor > saldoOrigem) {
      setFeedback({
        type: "error",
        text: `A gaveta seleccionada só tem ${formatCurrency(saldoOrigem, config.moeda)}. Não é possível sangrar mais do que existe.`,
      });
      return;
    }
    try { await command('/cash/movement',{tipo:tesourariaTipo,valor,motivo:tesourariaMotivo}); await refresh(); }
    catch(e:any) {setFeedback({type:'error',text:e.message});return;}
    tocarSom("moeda", somActivo);
    setFeedback({
      type: "success",
      text:
        tesourariaTipo === "sangria"
          ? `Sangria de ${formatCurrency(valor, config.moeda)} registada para o cofre.`
          : `Suprimento de ${formatCurrency(valor, config.moeda)} registado na gaveta.`,
    });
    void abrirGaveta(
      tesourariaTipo === "sangria" ? origem : destino,
      tesourariaTipo === "sangria"
        ? "Sangria para o cofre"
        : "Suprimento de troco",
      true,
    );
    setShowTesouraria(false);
    setTesourariaValor("");
    setTesourariaMotivo("");
  };

  /* -------- carrinho -------- */
  const addToCart = useCallback((product: Produto, requestedQuantity = 1) => {
    setFeedback(null);
    const service = isServiceProduct(product);
    setCart((previous) => {
      const currentQuantity =
        previous.find((line) => line.product.id === product.id)?.quantity || 0;
      const step = qtyStep(product);
      const quantity = Math.max(step, requestedQuantity);
      if (!service && currentQuantity + quantity > product.stock) {
        setFeedback({
          type: "error",
          text: `${product.nome} só tem ${product.stock} ${formatUnit(product.unidadeMedida)} disponível em stock.`,
        });
        return previous;
      }
      const existing = previous.find((line) => line.product.id === product.id);
      if (existing) {
        return previous.map((line) =>
          line.product.id === product.id
            ? { ...line, quantity: line.quantity + quantity }
            : line,
        );
      }
      return [...previous, { product, quantity }];
    });
  }, []);

  const handleSearchKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key !== "Enter" || !search.trim()) return;
    const exact = findProdutoByBarcodeOrCode(search.trim());
    if (exact) {
      addToCart(exact);
      tocarSom("leitura", somActivo);
      setSearch("");
      return;
    }
    if (filteredProducts.length >= 1) {
      addToCart(filteredProducts[0]);
      setSearch("");
      return;
    }
    setFeedback({
      type: "error",
      text: "Não foi encontrado um produto exacto para esse código.",
    });
    tocarSom("erro", somActivo);
  };

  const updateQuantity = (productId: number, delta: number) => {
    const line = cart.find((item) => item.product.id === productId);
    if (!line) return;
    const step = qtyStep(line.product);
    const nextQuantity = Math.max(
      0,
      Number((line.quantity + delta * step).toFixed(3)),
    );
    if (
      nextQuantity > line.quantity &&
      !isServiceProduct(line.product) &&
      nextQuantity > line.product.stock
    ) {
      setFeedback({
        type: "error",
        text: `${line.product.nome} só tem ${line.product.stock} ${formatUnit(line.product.unidadeMedida)} disponível em stock.`,
      });
      return;
    }
    setCart((previous) =>
      nextQuantity > 0
        ? previous.map((item) =>
            item.product.id === productId
              ? { ...item, quantity: nextQuantity }
              : item,
          )
        : previous.filter((item) => item.product.id !== productId),
    );
  };

  const setLineQuantity = (productId: number, raw: string) => {
    const line = cart.find((item) => item.product.id === productId);
    if (!line) return;
    const parsed = parseFloat(raw.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < 0) return;
    const nextQuantity = Number(
      Math.max(qtyStep(line.product), parsed).toFixed(3),
    );
    if (!isServiceProduct(line.product) && nextQuantity > line.product.stock) {
      setFeedback({
        type: "error",
        text: `${line.product.nome} só tem ${line.product.stock} ${formatUnit(line.product.unidadeMedida)} disponível em stock.`,
      });
      return;
    }
    setCart((previous) =>
      previous.map((item) =>
        item.product.id === productId
          ? { ...item, quantity: nextQuantity }
          : item,
      ),
    );
  };

  /* -------- vendas pausadas -------- */
  const holdSale = useCallback(() => {
    if (cart.length === 0) {
      setFeedback({ type: "error", text: "Não há artigos para pausar." });
      return;
    }
    const held: HeldSale = {
      id: `hold-${Date.now()}`,
      cart,
      cliente,
      payment,
      restaurantMode,
      restaurantTable,
      prescriptionNumber,
      discountPercent,
      discountAmount,
      savedAt: nowStamp(),
    };
    setHeldSales((prev) => [held, ...prev].slice(0, 12));
    setCart([]);
    setCliente(criarConsumidorFinal());
    setDiscountPercent("");
    setDiscountAmount("");
    setRestaurantTable("");
    setPrescriptionNumber("");
    setCashReceived("");
    setPaymentReference("");
    setMixedCashAmount("");
    setFeedback({
      type: "success",
      text: "Venda pausada. Pode retomá-la quando quiser.",
    });
    searchRef.current?.focus();
  }, [
    cart,
    cliente,
    payment,
    restaurantMode,
    restaurantTable,
    prescriptionNumber,
    discountPercent,
    discountAmount,
  ]);

  const restoreHeld = (held: HeldSale) => {
    if (!activeSession) {
      setFeedback({
        type: "error",
        text: "Abra a caixa antes de retomar uma venda pausada.",
      });
      return;
    }
    if (cart.length > 0) {
      setHeldSales((prev) => [
        {
          ...held,
          cart,
          cliente,
          payment,
          restaurantMode,
          restaurantTable,
          prescriptionNumber,
          discountPercent,
          discountAmount,
          savedAt: nowStamp(),
        },
        ...prev.filter((item) => item.id !== held.id),
      ]);
    } else {
      setHeldSales((prev) => prev.filter((item) => item.id !== held.id));
    }
    setCart(held.cart);
    setCliente(held.cliente);
    setPayment(held.payment);
    setRestaurantMode(held.restaurantMode);
    setRestaurantTable(held.restaurantTable);
    setPrescriptionNumber(held.prescriptionNumber);
    setDiscountPercent(held.discountPercent);
    setDiscountAmount(held.discountAmount);
    setShowHeld(false);
    setFeedback({ type: "success", text: "Venda retomada." });
  };

  /* -------- teclado -------- */
  const openKeypad = (target: Exclude<KeypadTarget, null>) => {
    const current =
      target === "cash"
        ? cashReceived
        : target === "mixedCash"
          ? mixedCashAmount
          : target === "mixedReceived"
            ? cashReceived
            : target === "opening"
              ? openingCash
              : target === "sangria"
                ? tesourariaValor
                : closingCash;
    setKeypadTarget(target);
    setKeypadBuffer(
      typeof current === "number" && current > 0
        ? String(current).replace(".", ",")
        : "0",
    );
  };

  const applyKeypad = (next: string) => {
    setKeypadBuffer(next);
    const parsed = parseFloat(next.replace(",", "."));
    const value: number | "" = Number.isFinite(parsed) ? parsed : "";
    if (keypadTarget === "cash" || keypadTarget === "mixedReceived")
      setCashReceived(value);
    else if (keypadTarget === "mixedCash") setMixedCashAmount(value);
    else if (keypadTarget === "opening") setOpeningCash(value);
    else if (keypadTarget === "sangria") setTesourariaValor(value);
    else if (keypadTarget === "closing") setClosingCash(value);
  };

  /* -------- novo cliente rápido -------- */
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoCliNome.trim()) return;
    const novo = await addPaciente({
      nome: novoCliNome.trim(),
      nif: novoCliNif.trim() || undefined,
      telefone: novoCliTel.trim() || undefined,
      endereco: novoCliEnd.trim() || undefined,
    });
    setCliente(clienteDePaciente(novo));
    setShowNovoClienteModal(false);
    setNovoCliNome("");
    setNovoCliNif("");
    setNovoCliTel("");
    setNovoCliEnd("");
  };

  /* -------- dispositivos: ligações -------- */
  const conectarSerial = async (deviceId: string) => {
    const serial = (navigator as any).serial;
    if (!serial) {
      marcarDispositivo(deviceId, {
        estado: "erro",
        detalhe:
          "Web Serial indisponível neste navegador (use Chrome/Edge em HTTPS) — modo simulado activo.",
      });
      registarLog(
        "Sistema",
        `Web Serial não suportado ao ligar "${deviceId}". Mantido modo simulado.`,
        "erro",
      );
      setFeedback({
        type: "error",
        text: "O navegador não suporta Web Serial. O dispositivo continua em modo simulado.",
      });
      return;
    }
    try {
      const port = await serial.requestPort();
      await port.open({ baudRate: deviceId === "balanca" ? 9600 : 9600 });
      serialPortsRef.current[deviceId] = port;
      const info = port.getInfo ? port.getInfo() : {};
      marcarDispositivo(deviceId, {
        estado: "conectado",
        porta: info.usbVendorId
          ? `USB ${info.usbVendorId}:${info.usbProductId || ""}`
          : "Porta série",
        detalhe: "Porta aberta a 9600 8N1",
      });
      registarLog("Sistema", `Porta série ligada para "${deviceId}".`, "ok");
      tocarSom("ok", somActivo);
      setFeedback({
        type: "success",
        text: "Dispositivo ligado por porta série.",
      });
    } catch (error) {
      if ((error as any)?.name === "NotFoundError") {
        registarLog("Sistema", `Ligação cancelada para "${deviceId}".`, "info");
        return;
      }
      marcarDispositivo(deviceId, {
        estado: "erro",
        detalhe: error instanceof Error ? error.message : "Falha na ligação",
      });
      registarLog(
        "Sistema",
        `Erro ao ligar "${deviceId}": ${error instanceof Error ? error.message : "desconhecido"}`,
        "erro",
      );
    }
  };

  const desconectarSerial = async (deviceId: string) => {
    const port = serialPortsRef.current[deviceId];
    if (port) {
      try {
        await port.close();
      } catch {
        /* já fechada */
      }
      delete serialPortsRef.current[deviceId];
    }
    marcarDispositivo(deviceId, {
      estado: "simulado",
      porta: undefined,
      detalhe: "Desligado — modo simulado activo",
    });
    registarLog("Sistema", `"${deviceId}" desligado.`, "info");
  };

  /* -------- display do cliente -------- */
  const abrirDisplayCliente = () => {
    try {
      if (!displayChannelRef.current) {
        displayChannelRef.current = new BroadcastChannel("pos-display-cliente");
      }
      const janela = window.open(
        "",
        "pos-display-cliente",
        "width=520,height=760",
      );
      if (!janela) {
        setFeedback({
          type: "error",
          text: "O navegador bloqueou a janela do display do cliente. Permita pop-ups para este posto.",
        });
        registarLog("Display", "Pop-up bloqueado pelo navegador.", "erro");
        return;
      }
      janela.document.write(DISPLAY_CLIENTE_HTML);
      janela.document.close();
      displayWindowRef.current = janela;
      setDisplayAberto(true);
      marcarDispositivo("display-cliente", {
        estado: "conectado",
        detalhe: "Janela do cliente activa (BroadcastChannel)",
      });
      registarLog("Display", "Display do cliente aberto.", "ok");
      setFeedback({
        type: "success",
        text: "Display do cliente aberto. Posicione-o no monitor virado para o cliente.",
      });
    } catch (error) {
      marcarDispositivo("display-cliente", {
        estado: "erro",
        detalhe: error instanceof Error ? error.message : "Falha",
      });
      registarLog("Display", "Falha ao abrir o display do cliente.", "erro");
    }
  };

  const publicarDisplay = useCallback((patch: Record<string, unknown>) => {
    if (!displayChannelRef.current) return;
    try {
      displayChannelRef.current.postMessage(patch);
    } catch {
      /* canal fechado */
    }
  }, []);

  useEffect(() => {
    publicarDisplay({
      empresa: nomeEmpresa,
      operador: `${terminalCaixa} · ${currentUser.nome}`,
      itens: cart.map((line) => ({
        nome: line.product.nome,
        qtd: line.quantity,
        preco: formatCurrency(line.product.preco, config.moeda),
        total: formatCurrency(line.quantity * line.product.preco, config.moeda),
      })),
      total: formatCurrency(totals.total, config.moeda),
      troco: change > 0 ? formatCurrency(change, config.moeda) : "",
      mensagem:
        cart.length === 0
          ? "Bem-vindo. Aguarde o registo dos artigos."
          : `${cart.length} ${cart.length === 1 ? "artigo" : "artigos"} registado(s)`,
    });
  }, [
    cart,
    totals.total,
    change,
    config.moeda,
    nomeEmpresa,
    terminalCaixa,
    currentUser.nome,
    publicarDisplay,
  ]);

  /* -------- balança -------- */
  const lerBalanca = async () => {
    setScaleBusy(true);
    try {
      const port = serialPortsRef.current["balanca"];
      let peso = 0;
      if (port && port.readable) {
        const reader = port.readable.getReader();
        const decoder = new TextDecoder();
        const limite = Date.now() + 2500;
        let texto = "";
        while (Date.now() < limite) {
          const { value, done } = await reader.read();
          if (done) break;
          texto += decoder.decode(value, { stream: true });
          const match = texto.match(/([-+]?\d+[.,]?\d*)/);
          if (match && texto.length > 2) {
            peso = parseFloat(match[1].replace(",", ".")) || 0;
            break;
          }
        }
        try {
          reader.releaseLock();
        } catch {
          /* já libertado */
        }
        marcarDispositivo("balanca", {
          estado: "conectado",
          detalhe: `Última leitura: ${peso.toFixed(3)} kg`,
        });
        registarLog(
          "Balança",
          `Leitura real recebida: ${peso.toFixed(3)}`,
          "ok",
        );
      } else {
        await new Promise((resolve) => setTimeout(resolve, 850));
        peso = Number((Math.random() * 2.4 + 0.18).toFixed(3));
        marcarDispositivo("balanca", {
          estado: "simulado",
          detalhe: `Leitura simulada: ${peso.toFixed(3)} kg`,
        });
        registarLog(
          "Balança",
          `Leitura simulada: ${peso.toFixed(3)} kg`,
          "info",
        );
      }
      setPesoLido(peso);
      tocarSom("leitura", somActivo);
    } catch (error) {
      marcarDispositivo("balanca", {
        estado: "erro",
        detalhe: error instanceof Error ? error.message : "Sem resposta",
      });
      registarLog("Balança", "Falha na leitura do peso.", "erro");
      setFeedback({
        type: "error",
        text: "A balança não respondeu. Verifique a ligação ou introduza o peso manualmente.",
      });
    } finally {
      setScaleBusy(false);
    }
  };

  const aplicarPeso = () => {
    const peso = typeof pesoLido === "number" ? pesoLido : 0;
    const product =
      produtosPeso.find((item) => String(item.id) === scaleProduto) ||
      (scaleProduto
        ? produtos.find((item) => String(item.id) === scaleProduto)
        : undefined);
    if (!product) {
      setFeedback({ type: "error", text: "Seleccione o produto a pesar." });
      return;
    }
    if (peso <= 0) {
      setFeedback({ type: "error", text: "O peso lido é inválido." });
      return;
    }
    addToCart(product, Number(peso.toFixed(3)));
    registarLog(
      "Balança",
      `${product.nome} adicionado com ${peso.toFixed(3)} ${product.unidadeMedida}`,
      "ok",
    );
    setShowScale(false);
    setPesoLido("");
    setScaleProduto("");
  };

  /* -------- TPA -------- */
  const pedirTPA = async () => {
    setFeedback({type:'error',text:'Integração bancária automática não configurada. Confirme o pagamento no TPA físico e introduza a referência do comprovativo. O software não aprova transacções bancárias.'});
  };

  /* -------- impressora -------- */
  const imprimirTeste = () => {
    const html = relatorioCaixaHTML({
      titulo: "Teste de Impressão",
      empresa: nomeEmpresa,
      nif: nifEmpresa,
      terminal: terminalCaixa,
      operador: currentUser.nome,
      emitidoEm: nowStamp(),
      linhas: [
        {
          label: "Estado",
          value: dispositivos["impressora-termica"]?.estado || "simulado",
          forte: true,
        },
        { label: "Largura", value: "80 mm" },
        { label: "Codificação", value: "PC858 / UTF-8" },
        { label: "Corte", value: "Automático" },
      ],
      rodape: [
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
        "0123456789 áàãâçéêíóôõú",
        "Se lê esta linha, a impressora está operacional.",
      ],
    });
    imprimirHTML(html, `Teste_Impressora_${terminalCaixa}`);
    registarLog("Impressora", "Página de teste enviada.", "ok");
    tocarSom("ok", somActivo);
  };

  const testarDispositivo = (deviceId: string) => {
    switch (deviceId) {
      case "gaveta-dinheiro":
        void abrirGaveta("gaveta-principal", "Teste de dispositivo");
        break;
      case "cofre-inteligente":
        void abrirGaveta("cofre", "Teste de dispositivo");
        break;
      case "impressora-termica":
        imprimirTeste();
        break;
      case "display-cliente":
        abrirDisplayCliente();
        break;
      case "leitor-qr":
        setShowScanner(true);
        break;
      case "leitor-codigo-barras":
        registarLog(
          "Leitor",
          "Leitor HID activo — leia um código para testar.",
          "info",
        );
        setFeedback({
          type: "success",
          text: "Leitor em modo teclado activo. Leia um código de barras para testar.",
        });
        searchRef.current?.focus();
        break;
      case "balanca":
        setPesoLido("");
        setShowScale(true);
        void lerBalanca();
        break;
      case "tpa":
        void pedirTPA();
        break;
      case "sinalizador":
        tocarSom("ok", true);
        tocarSom("gaveta", true);
        marcarDispositivo("sinalizador", {
          estado: "conectado",
          detalhe: "Sirene testada",
        });
        registarLog("Sinalizador", "Teste sonoro executado.", "ok");
        break;
      case "ups": {
        const bateria = navigator.onLine ? 100 : 62;
        marcarDispositivo("ups", {
          estado: "conectado",
          detalhe: `Rede estável · bateria ${bateria}%`,
        });
        registarLog("UPS", `Estado verificado · bateria ${bateria}%.`, "ok");
        break;
      }
      default:
        registarLog("Sistema", `Teste do dispositivo "${deviceId}".`, "info");
    }
  };

  /* -------- validação -------- */
  const validateSale = (): string | null => {
    if (!activeSession) return "Abra a caixa antes de emitir uma venda.";
    if (activeSession.estado !== "aberta")
      return "A sessão de caixa actual não está aberta. Abra um novo turno.";
    if (cart.length === 0)
      return "Adicione pelo menos um produto ou serviço ao carrinho.";
    if (totals.error) return totals.error;
    if (totals.total <= 0) return "A venda deve ter um total positivo.";
    for (const value of [cashReceived, mixedCashAmount])
      if (typeof value === "number" && Math.abs(value * 100 - Math.round(value * 100)) > 0.0001)
        return "Os valores de pagamento aceitam até duas casas decimais.";
    for (const line of cart) {
      if (
        !isServiceProduct(line.product) &&
        line.quantity > line.product.stock
      ) {
        return `${line.product.nome} já não tem quantidade suficiente em stock. Actualize o carrinho.`;
      }
      const expiry = parseExpiry(line.product.dataValidade);
      if (
        expiry &&
        expiry < new Date() &&
        productSector(line.product) === "Farmácia"
      ) {
        return `${line.product.nome} está fora da validade e não pode ser vendido.`;
      }
    }
    if (
      totals.descontoValor >= totals.subtotalBruto &&
      totals.subtotalBruto > 0
    ) {
      return "O desconto não pode ser igual ou superior ao total da venda.";
    }
    if (
      payment === "Numerário" &&
      (typeof cashReceived !== "number" || cashReceived < totals.total)
    ) {
      return "O valor recebido em numerário é inferior ao total da venda.";
    }
    if (
      payment === "Numerário" &&
      typeof cashReceived === "number" &&
      change >
        (gavetas.find((g) => g.id === "gaveta-troco")?.saldo || 0) +
          expectedCash
    ) {
      return "Não há numerário suficiente nas gavetas para devolver este troco. Faça um suprimento.";
    }
    if (payment === "Misto") {
      const cashPart =
        typeof mixedCashAmount === "number" ? mixedCashAmount : 0;
      if (cashPart < 0 || cashPart > totals.total)
        return "A parte em numerário do pagamento misto é inválida.";
      if (
        cashPart > 0 &&
        (typeof cashReceived !== "number" || cashReceived < cashPart)
      ) {
        return "O valor recebido em numerário é inferior à parte definida no pagamento misto.";
      }
      if (totals.total - cashPart > 0 && paymentReference.trim().length < 3) {
        return "Informe a referência da parte paga por TPA ou transferência.";
      }
    }
    if (
      payment !== "Numerário" &&
      payment !== "Misto" &&
      payment !== "Crédito a 30 dias" &&
      paymentReference.trim().length < 3
    ) {
      return "Informe a referência do pagamento ou confirme o número do TPA.";
    }
    return null;
  };

  const canComplete = Boolean(activeSession) && cart.length > 0 && !saving;

  /* -------- emissão -------- */
  const completeSale = useCallback(async () => {
    const validationError = validateSale();
    if (validationError) {
      setFeedback({ type: "error", text: validationError });
      tocarSom("erro", somActivo);
      return;
    }

    setSaving(true);
    setFeedback(null);
    const printWindow = autoPrint ? openInvoicePrint() : null;
    try {
      const isCredit = payment === "Crédito a 30 dias";
      const mixedCash =
        payment === "Misto" && typeof mixedCashAmount === "number"
          ? mixedCashAmount
          : 0;
      const mixedElectronic = Math.max(0, Math.round((totals.total - mixedCash) * 100) / 100);
      const paymentDetails =
        payment === "Misto"
          ? [
              ...(mixedCash > 0
                ? [
                    {
                      id: "payment-cash",
                      forma: "Numerário",
                      valor: mixedCash,
                      valorRecebido:
                        typeof cashReceived === "number"
                          ? cashReceived
                          : mixedCash,
                    },
                  ]
                : []),
              ...(mixedElectronic > 0
                ? [
                    {
                      id: "payment-electronic",
                      forma: "Multicaixa (TPA)",
                      valor: mixedElectronic,
                      referencia: paymentReference.trim() || undefined,
                    },
                  ]
                : []),
            ]
          : [
              {
                id: "payment",
                forma: payment,
                valor: totals.total,
                valorRecebido:
                  payment === "Numerário" ? Number(cashReceived) : undefined,
                referencia: paymentReference.trim() || undefined,
              },
            ];

      const docCliente = clienteParaDocumento(cliente);

      const fatura = await addFatura({
        serie: config.serie,
        data: todayStr(),
        dataVencimento: isCredit ? addDaysStr(30) : todayStr(),
        ...docCliente,
        clienteNome: docCliente.clienteNome || NOME_CONSUMIDOR_FINAL,
        linhas: saleLines,
        subtotalSemIva: totals.subtotal,
        totalIva: totals.totalIva,
        ivaTaxa: config.ivaTaxa || 0,
        desconto:
          totals.descontoPercent > 0 ? totals.descontoPercent : undefined,
        descontoValor: totals.fixedDiscount || undefined,
        total: totals.total,
        estado: isCredit ? "emitida" : "paga",
        observacoes: [
          `Venda POS · ${productSector(cart[0].product)} · Operador: ${currentUser.nome}`,
          cliente.consumidorFinal && !cliente.nif.trim()
            ? `Adquirente: ${NOME_CONSUMIDOR_FINAL} (não é cliente)`
            : "",
          cartSector === "Farmácia" && prescriptionNumber
            ? `Receita: ${prescriptionNumber}`
            : "",
          totals.descontoValor > 0
            ? `Desconto comercial: ${formatCurrency(totals.descontoValor, config.moeda)}`
            : "",
        ]
          .filter(Boolean)
          .join(" · "),
        tipoDocumento: isCredit ? "factura" : "factura-recibo",
        formaPagamento: payment === "Misto" ? "Pagamento misto" : payment,
        formasPagamentoDetalhe: paymentDetails,
        emitidoPor: currentUser.nome,
        caixaSessaoId: activeSession?.id,
        terminalCaixa: activeSession?.terminal,
      });

      if (cartSector === "Farmácia" && prescriptionNumber) {
        registarLog(
          "Gaveta",
          `Receita ${prescriptionNumber} arquivada na gaveta de documentos.`,
          "info",
        );
      }

      setCompletedSale({
        numero: fatura.numero,
        total: totals.total,
        troco: change,
        fatura,
      });
      setCart([]);
      setCliente(criarConsumidorFinal());
      setCashReceived("");
      setPaymentReference("");
      setMixedCashAmount("");
      setDiscountPercent("");
      setDiscountAmount("");
      setRestaurantTable("");
      setPrescriptionNumber("");
      tocarSom("ok", somActivo);
      publicarDisplay({
        mensagem: `Obrigado! Total pago: ${formatCurrency(totals.total, config.moeda)}`,
        itens: [],
        total: formatCurrency(0, config.moeda),
        troco: change > 0 ? formatCurrency(change, config.moeda) : "",
      });

      if (autoPrint) {
        const format = config.perfisImpressoras?.find((p) => p.padrao)?.larguraPapel === "58mm" ? "58mm" : "80mm";
        const printed = await printIssuedInvoice(fatura.id, format, printWindow);
        registarLog("Impressora",
          printed ? `Talão ${fatura.numero} preparado pelo servidor.` :
            `Venda ${fatura.numero} registada. Use o botão Talão para imprimir.`,
          printed ? "ok" : "info");
      }
      const usaNumerario =
        payment === "Numerário" || (payment === "Misto" && mixedCash > 0);
      if (autoKick && usaNumerario) {
        await abrirGaveta(
          change > 0 ? "gaveta-troco" : gavetaFundo,
          `Troco da venda ${fatura.numero}`,
          true,
        );
      }
      if (cartSector === "Farmácia" && prescriptionNumber) {
        await abrirGaveta(
          "gaveta-documentos",
          `Arquivo da receita ${prescriptionNumber}`,
          true,
        );
      }
    } catch (error) {
      printWindow?.close();
      setFeedback({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Não foi possível emitir a venda. O carrinho foi mantido.",
      });
      tocarSom("erro", somActivo);
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    cart,
    saleLines,
    payment,
    totals,
    cashReceived,
    mixedCashAmount,
    paymentReference,
    cliente,
    config,
    currentUser,
    cartSector,
    restaurantMode,
    restaurantTable,
    prescriptionNumber,
    activeSession,
    change,
    addFatura,
    autoKick,
    autoPrint,
    somActivo,
    gavetas,
    gavetaFundo,
    abrirGaveta,
    publicarDisplay,
    registarLog,
  ]);

  const closeCompletedSale = () => {
    setCompletedSale(null);
    searchRef.current?.focus();
  };

  /* -------- leitor QR / câmara -------- */
  useEffect(() => {
    if (!showScanner) return;
    let detector: any = null;
    let intervalo: number | undefined;
    let stream: MediaStream | null = null;
    let cancelado = false;

    const processarCodigo = (raw: string) => {
      const codigo = raw.trim();
      if (!codigo) return;
      const product = findProdutoByBarcodeOrCode(codigo);
      if (product) {
        addToCart(product);
        tocarSom("leitura", somActivo);
        setFeedback({
          type: "success",
          text: `${product.nome} adicionado por QR/código ${codigo}.`,
        });
        publicarDisplay({ mensagem: `${product.nome} registado` });
      } else {
        tocarSom("erro", somActivo);
        setFeedback({
          type: "error",
          text: `Código "${codigo}" lido, mas não existe no catálogo.`,
        });
      }
      setShowScanner(false);
    };

    const iniciar = async () => {
      setCameraErro("");
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelado) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        const Detector = (window as any).BarcodeDetector;
        if (!Detector) {
          setCameraErro(
            "Este navegador não suporta leitura por câmara (BarcodeDetector). Use um leitor USB ou introduza o código manualmente abaixo.",
          );
          marcarDispositivo("leitor-qr", {
            estado: "erro",
            detalhe: "BarcodeDetector indisponível",
          });
          return;
        }
        detector = new Detector({
          formats: [
            "qr_code",
            "ean_13",
            "ean_8",
            "code_128",
            "code_39",
            "upc_a",
            "upc_e",
            "itf",
            "data_matrix",
          ],
        });
        marcarDispositivo("leitor-qr", {
          estado: "conectado",
          detalhe: "Câmara activa · QR + EAN/UPC/Code128",
        });
        intervalo = window.setInterval(async () => {
          const video = videoRef.current;
          if (!video || video.readyState < 2 || !detector) return;
          try {
            const codigos = await detector.detect(video);
            if (codigos && codigos.length && codigos[0].rawValue)
              processarCodigo(String(codigos[0].rawValue));
          } catch {
            /* frame inválido */
          }
        }, 380);
      } catch {
        setCameraErro(
          "Não foi possível aceder à câmara. Verifique as permissões do navegador ou use um leitor USB.",
        );
        marcarDispositivo("leitor-qr", {
          estado: "simulado",
          detalhe: "Câmara indisponível",
        });
      }
    };

    void iniciar();
    return () => {
      cancelado = true;
      if (intervalo) window.clearInterval(intervalo);
      if (stream) stream.getTracks().forEach((track) => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showScanner]);

  /* -------- leitor de códigos + atalhos -------- */
  useEffect(() => {
    let barcodeBuffer = "";
    let lastKeyTime = Date.now();

    const handleKeyboardScanner = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )
        return;

      if (event.key === "F2") {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (event.key === "F3") {
        event.preventDefault();
        if (activeSession) {
          setDrawerMotivo(MOTIVOS_GAVETA[0]);
          setDrawerModal("gaveta-principal");
        }
        return;
      }
      if (event.key === "F4") {
        event.preventDefault();
        if (canComplete) void completeSale();
        return;
      }
      if (event.key === "F5") {
        event.preventDefault();
        if (activeSession) setShowRelatorioX(true);
        return;
      }
      if (event.key === "F6") {
        event.preventDefault();
        setShowDevices(true);
        return;
      }
      if (event.key === "F7") {
        event.preventDefault();
        if (activeSession) setShowTesouraria(true);
        return;
      }
      if (event.key === "F8") {
        event.preventDefault();
        setShowScanner(true);
        return;
      }
      if (event.key === "F9") {
        event.preventDefault();
        holdSale();
        return;
      }
      if (event.key === "F10") {
        event.preventDefault();
        abrirDisplayCliente();
        return;
      }
      if (event.key === "Escape") {
        setCashModal(null);
        setKeypadTarget(null);
        setCompletedSale(null);
        setShowHeld(false);
        setConfirmClear(false);
        setShowNovoClienteModal(false);
        setShowDevices(false);
        setShowScanner(false);
        setShowScale(false);
        setDrawerModal(null);
        setShowRelatorioX(false);
        setShowMovimentos(false);
        setShowTesouraria(false);
        setCashStep(1);
        return;
      }

      const now = Date.now();
      if (now - lastKeyTime > 120) barcodeBuffer = "";
      lastKeyTime = now;

      if (event.key === "Enter") {
        if (barcodeBuffer.length >= 3) {
          const product = findProdutoByBarcodeOrCode(barcodeBuffer);
          if (product) {
            event.preventDefault();
            addToCart(product);
            tocarSom("leitura", somActivo);
          } else {
            setFeedback({
              type: "error",
              text: `Código "${barcodeBuffer}" não encontrado no catálogo.`,
            });
            tocarSom("erro", somActivo);
          }
        }
        barcodeBuffer = "";
      } else if (event.key.length === 1) {
        barcodeBuffer += event.key;
      }
    };

    window.addEventListener("keydown", handleKeyboardScanner);
    return () => window.removeEventListener("keydown", handleKeyboardScanner);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    findProdutoByBarcodeOrCode,
    addToCart,
    canComplete,
    completeSale,
    holdSale,
    activeSession,
    somActivo,
  ]);

  const keypadLabel =
    keypadTarget === "cash" || keypadTarget === "mixedReceived"
      ? "Valor recebido em numerário"
      : keypadTarget === "mixedCash"
        ? "Parte em numerário"
        : keypadTarget === "opening"
          ? "Fundo inicial de caixa"
          : keypadTarget === "sangria"
            ? "Valor da operação de tesouraria"
            : "Valor contado na caixa";

  const adquirenteLabel =
    cliente.consumidorFinal && !cliente.nif.trim()
      ? NOME_CONSUMIDOR_FINAL
      : cliente.nome || NOME_CONSUMIDOR_FINAL;

  const gavetasDinheiro = gavetas.filter(
    (gaveta) => gaveta.tipo !== "documentos",
  );
  const totalEmCaixa = gavetasDinheiro.reduce(
    (sum, gaveta) => sum + gaveta.saldo,
    0,
  );
  const trocoDisponivel =
    (gavetas.find((gaveta) => gaveta.id === "gaveta-troco")?.saldo || 0) +
    expectedCash;
  const dispositivosProntos = DISPOSITIVOS_CATALOGO.filter((item) =>
    ["conectado", "simulado"].includes(
      dispositivos[item.id]?.estado || "simulado",
    ),
  ).length;

  const gavetaIcone = (tipo: Gaveta["tipo"]) =>
    tipo === "cofre" ? (
      <ShieldCheck className="w-5 h-5" />
    ) : tipo === "troco" ? (
      <Coins className="w-5 h-5" />
    ) : tipo === "documentos" ? (
      <FileText className="w-5 h-5" />
    ) : (
      <Wallet className="w-5 h-5" />
    );

  return (
    <div className="pos-root" data-testid="view-pos">
      <style>{POS_CSS}</style>

      <div className="pos-container">
        <ul className="pos-breadcrumb">
          <li>POS</li>
          <li className="active">Frente de Caixa</li>
        </ul>

        {/* ===== barra superior ===== */}
        <div className="pos-topbar">
          <div className="pos-topbar__title">
            <span className="pos-topbar__badge">
              <ShoppingCart className="w-5 h-5" />
            </span>
            <div>
              <h2 className="pos-title">
                Ponto de Venda
                <span className="pos-slogan">
                  Frente de caixa · {terminalCaixa}
                </span>
              </h2>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: "#8a919c" }}>
                Operador{" "}
                <strong style={{ color: "#5b6470" }}>{currentUser.nome}</strong>
                {activeSession && (
                  <> · turno aberto desde {activeSession.abertaEm}</>
                )}
              </p>
            </div>
          </div>
          <div className="pos-topbar__actions">
            <span className={`pos-chip ${activeSession ? "is-open" : ""}`}>
              <span className="pos-dot" />
              {activeSession ? "Caixa aberta" : "Caixa fechada"}
            </span>
            <button
              type="button"
              className="pos-btn pos-btn--sm"
              onClick={() => setShowDevices(true)}
              title="Dispositivos e periféricos (F6)"
              data-testid="button-pos-devices"
            >
              <Plug className="w-4 h-4" style={{ color: "#1577EB" }} />{" "}
              Dispositivos
              <span className="pos-badge" style={{ background: "#1577EB" }}>
                {dispositivosProntos}/{DISPOSITIVOS_CATALOGO.length}
              </span>
            </button>
            <button
              type="button"
              className="pos-btn pos-btn--sm"
              onClick={() => {
                setDrawerMotivo("Troco a cliente");
                setDrawerModal("gaveta-principal");
              }}
              disabled={!activeSession}
              title="Abrir gaveta de dinheiro (F3)"
              data-testid="button-pos-open-drawer"
            >
              <Unlock className="w-4 h-4" /> Gaveta{" "}
              <span className="pos-kbd">F3</span>
            </button>
            <button
              type="button"
              className="pos-btn pos-btn--sm"
              onClick={() => setShowRelatorioX(true)}
              disabled={!activeSession}
              title="Relatório X (parcial do turno) — F5"
              data-testid="button-pos-report-x"
            >
              <FileText className="w-4 h-4" /> Rel. X
            </button>
            <button
              type="button"
              className="pos-btn pos-btn--sm"
              onClick={() => setShowTesouraria(true)}
              disabled={!activeSession}
              title="Sangria / suprimento de numerário — F7"
              data-testid="button-pos-treasury"
            >
              <ArrowDownToLine className="w-4 h-4" /> Sangria
            </button>
            {heldSales.length > 0 && (
              <button
                type="button"
                className="pos-btn pos-btn--sm"
                onClick={() => setShowHeld(true)}
              >
                <Pause className="w-4 h-4" /> Pausadas{" "}
                <span className="pos-badge">{heldSales.length}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setCashStep(1);
                setConfirmarValores(false);
                setCashModal(activeSession ? "close" : "open");
              }}
              className={`pos-btn pos-btn--sm ${activeSession ? "pos-btn--dark" : "pos-btn--warn"}`}
              data-testid={
                activeSession ? "button-pos-close-cash" : "button-pos-open-cash"
              }
            >
              {activeSession ? (
                <>
                  <X className="w-4 h-4" /> Fechar caixa
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" /> Abrir caixa
                </>
              )}
            </button>
          </div>
        </div>

        {/* ===== estado da caixa (reforçado) ===== */}
        <div
          className={`pos-alert ${activeSession ? "pos-alert--open" : "pos-alert--closed"}`}
          data-testid="panel-pos-cash-session"
        >
          <div style={{ minWidth: 0 }}>
            {activeSession ? (
              <>
                <strong>Turno aberto</strong> · fundo inicial{" "}
                {formatCurrency(activeSession.fundoInicial, config.moeda)}
                <span style={{ margin: "0 6px" }}>·</span>
                {sessionTotals.qtd} venda(s) no valor de{" "}
                {formatCurrency(sessionTotals.valor, config.moeda)}
                <span style={{ margin: "0 6px" }}>·</span>
                sangrias -{formatCurrency(totalSangrias, config.moeda)} /
                suprimentos +{formatCurrency(totalSuprimentos, config.moeda)}
                <span style={{ margin: "0 6px" }}>·</span>
                numerário esperado{" "}
                <strong>{formatCurrency(expectedCash, config.moeda)}</strong>
                <span style={{ margin: "0 6px" }}>·</span>
                em gavetas{" "}
                <strong>{formatCurrency(totalEmCaixa, config.moeda)}</strong>
              </>
            ) : (
              <>
                <strong>A caixa está fechada.</strong> As vendas estão
                bloqueadas até abrir um turno: o fundo inicial é contado por
                denominação, fica registado na gaveta de destino e é impresso o
                relatório de abertura.
              </>
            )}
          </div>
          <div className="pos-alert__actions">
            {activeSession && (
              <>
                <button
                  type="button"
                  className="pos-link"
                  onClick={() => setShowRelatorioX(true)}
                  data-testid="button-pos-confer-x"
                >
                  Relatório X
                </button>
                <button
                  type="button"
                  className="pos-link"
                  onClick={() => setShowMovimentos(true)}
                  data-testid="button-pos-movements"
                >
                  Movimentos
                </button>
                <button
                  type="button"
                  className="pos-link"
                  onClick={() => {
                    setCashStep(1);
                    setCashModal("close");
                  }}
                  data-testid="button-pos-confer-cash"
                >
                  Conferir
                </button>
              </>
            )}
          </div>
        </div>

        {!activeSession && (
          <div className="pos-alert pos-alert--info">
            <span style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <Lock className="w-4 h-4 shrink-0" style={{ marginTop: 2 }} />
              <span>
                <strong>Vendas bloqueadas.</strong> Pode preparar o carrinho,
                mas a emissão de documentos só é permitida com a caixa aberta —
                garante o encadeamento dos números de documento e a conferência
                correcta no relatório Z.
              </span>
            </span>
            <button
              type="button"
              className="pos-btn pos-btn--sm pos-btn--warn"
              onClick={() => {
                setCashStep(1);
                setCashModal("open");
              }}
            >
              <Play className="w-4 h-4" /> Abrir caixa agora
            </button>
          </div>
        )}

        {activeSession && trocoDisponivel < 1000 && (
          <div className="pos-alert pos-alert--closed">
            <span style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <AlertTriangle
                className="w-4 h-4 shrink-0"
                style={{ marginTop: 2 }}
              />
              <span>
                <strong>Troco baixo.</strong> Existem apenas{" "}
                {formatCurrency(Math.max(0, trocoDisponivel), config.moeda)}{" "}
                disponíveis para troco. Faça um suprimento a partir do cofre
                para evitar atrasos no atendimento.
              </span>
            </span>
            <button
              type="button"
              className="pos-link"
              onClick={() => {
                setTesourariaTipo("suprimento");
                setShowTesouraria(true);
              }}
            >
              <ArrowUpFromLine className="w-4 h-4" /> Suprimento
            </button>
          </div>
        )}

        {/* ===== gavetas ===== */}
        <div className="pos-drawers" data-testid="panel-pos-drawers">
          {gavetas.map((gaveta) => (
            <div
              className={`pos-drawer ${gaveta.aberta ? "is-open" : ""}`}
              key={gaveta.id}
              data-testid={`drawer-${gaveta.id}`}
            >
              <span
                className={`pos-drawer__icon ${gaveta.tipo === "troco" ? "pos-drawer__icon--troco" : gaveta.tipo === "cofre" ? "pos-drawer__icon--cofre" : gaveta.tipo === "documentos" ? "pos-drawer__icon--docs" : ""}`}
              >
                {gavetaIcone(gaveta.tipo)}
              </span>
              <div style={{ minWidth: 0 }}>
                <div className="pos-drawer__name">{gaveta.nome}</div>
                <div className="pos-drawer__value">
                  {gaveta.tipo === "documentos"
                    ? `${gaveta.aberturas} acessos`
                    : formatCurrency(gaveta.saldo, config.moeda)}
                </div>
                <div className="pos-drawer__meta">
                  {gaveta.aberta ? (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        color: "#28a745",
                      }}
                    >
                      <span className="pos-pulse" /> Aberta
                    </span>
                  ) : (
                    <>
                      Canal {gaveta.canal} · {gaveta.aberturas} aberturas
                    </>
                  )}
                  {gaveta.ultimaAbertura && <> · {gaveta.ultimaAbertura}</>}
                </div>
              </div>
              <div className="pos-drawer__actions">
                <button
                  type="button"
                  className="pos-btn pos-btn--sm"
                  onClick={() => {
                    setDrawerMotivo(
                      gaveta.tipo === "documentos"
                        ? "Reposição de documentos"
                        : "Troco a cliente",
                    );
                    setDrawerModal(gaveta.id);
                  }}
                  data-testid={`button-open-drawer-${gaveta.id}`}
                >
                  {gaveta.aberta ? (
                    <Unlock className="w-3.5 h-3.5" />
                  ) : (
                    <Lock className="w-3.5 h-3.5" />
                  )}{" "}
                  Abrir
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* ===== feedback ===== */}
        {feedback && (
          <div
            className={`pos-alert ${feedback.type === "error" ? "pos-alert--error" : "pos-alert--success"}`}
            role="status"
            aria-live="polite"
            data-testid="status-pos-feedback"
          >
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {feedback.type === "error" ? (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              )}
              {feedback.text}
            </span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="pos-modal__close"
              aria-label="Fechar mensagem"
              data-testid="button-close-feedback"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ===== layout ===== */}
        <div className="pos-layout">
          {/* ---------- catálogo ---------- */}
          <div className="pos-box" style={{ marginBottom: 0 }}>
            <div className="pos-box__header">
              <div className="pos-box__title">
                <Package className="w-4 h-4" style={{ color: "#1577EB" }} />{" "}
                Catálogo <span className="pos-slogan">Produtos e Serviços</span>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <span style={{ fontSize: 12, color: "#8a919c" }}>
                  {filteredProducts.length} itens
                </span>
                <button
                  type="button"
                  className="pos-btn pos-btn--sm"
                  onClick={() => setShowScale(true)}
                  title="Ler peso na balança"
                >
                  <Scale className="w-4 h-4" style={{ color: "#1577EB" }} />{" "}
                  Balança
                </button>
                <button
                  type="button"
                  className="pos-btn pos-btn--sm"
                  onClick={() => setShowScanner(true)}
                  title="Ler QR / código pela câmara (F8)"
                  data-testid="button-pos-qr"
                >
                  <QrCode className="w-4 h-4" style={{ color: "#1577EB" }} /> QR
                  / Câmara
                </button>
                {onOpenScanner && (
                  <button
                    type="button"
                    className="pos-btn pos-btn--sm"
                    onClick={() =>
                      onOpenScanner((product) => addToCart(product))
                    }
                    data-testid="button-pos-scan"
                  >
                    <Barcode className="w-4 h-4" style={{ color: "#1577EB" }} />{" "}
                    Ler código
                  </button>
                )}
              </div>
            </div>

            <div className="pos-box__content" style={{ paddingBottom: 0 }}>
              <div className="pos-searchbar">
                <div className="pos-search-wrap">
                  <Search className="w-5 h-5" />
                  <input
                    ref={searchRef}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Pesquisar e adicionar ao documento"
                    className="pos-search"
                    aria-label="Pesquisar produto"
                    autoComplete="off"
                    data-testid="input-pos-search"
                  />
                  <span className="pos-search__hint">F2</span>
                </div>
                <button
                  type="button"
                  className="pos-btn"
                  onClick={() => {
                    setSearch("");
                    searchRef.current?.focus();
                  }}
                >
                  <List className="w-4 h-4" /> Ver todos
                </button>
              </div>

            </div>

            <div className="pos-catalog-body">
              <nav
                className="pos-sectors"
                role="tablist"
                aria-label="Categorias de produtos"
              >
                {sectors.map((item) => (
                  <button
                    type="button"
                    key={item}
                    role="tab"
                    aria-selected={sector === item}
                    onClick={() => {
                      setSector(item);
                      setCategory("");
                    }}
                    className={`pos-sector ${sector === item ? "is-active" : ""}`}
                    data-testid={`button-pos-sector-${item.toLowerCase()}`}
                  >
                    {React.createElement(getSectorIcon(item), {
                      className: "pos-sector__icon",
                      "aria-hidden": true,
                    })}
                    <span>{item}</span>
                  </button>
                ))}
              </nav>

              <div className="pos-catalog-items">
              <div style={{ minWidth: 0, padding: "8px 4px 10px" }}>
                <label htmlFor="pos-catalog-category" className="pos-label">
                  Categoria do catálogo da instituição
                </label>
                <select
                  id="pos-catalog-category"
                  className="pos-input"
                  aria-label="Categoria do catálogo"
                  data-testid="select-pos-category"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                >
                  <option value="">Todas as categorias</option>
                  {catalogCategories.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>

              <div className="pos-grid" data-testid="grid-pos-products">
              {filteredProducts.map((product) => {
                const service = isServiceProduct(product);
                const expiry = parseExpiry(product.dataValidade);
                const expired = Boolean(expiry && expiry < new Date());
                const unavailable = !service && product.stock <= 0;
                const lowStock =
                  !service &&
                  product.stock > 0 &&
                  product.stock <= product.stockMinimo;
                return (
                  <button
                    type="button"
                    key={product.id}
                    onClick={() => {
                      addToCart(product);
                      tocarSom("leitura", somActivo);
                    }}
                    disabled={unavailable || expired}
                    className="pos-card"
                    data-testid={`card-pos-product-${product.id}`}
                  >
                    <div className="pos-card__media">
                      <ProdutoImagem produto={product} servico={service} />
                      {!service ? (
                        <span
                          className={`pos-card__stock pos-card__stock--overlay ${unavailable ? "is-out" : lowStock ? "is-low" : ""}`}
                        >
                          {product.stock} {formatUnit(product.unidadeMedida)}
                          {lowStock ? ` · mín. ${product.stockMinimo}` : ""}
                        </span>
                      ) : (
                        <span className="pos-card__stock pos-card__stock--overlay">
                          serviço
                        </span>
                      )}
                    </div>
                    <span className="pos-card__name">{product.nome}</span>
                    <span className="pos-card__ref">
                      {product.codigo} · {product.categoria}
                    </span>
                    <div className="pos-card__bottom">
                      <span className="pos-card__price">
                        {formatCurrency(product.preco, config.moeda)}
                      </span>
                      <span className="pos-card__add">
                        <Plus className="w-4 h-4" />
                      </span>
                    </div>
                    {expired && (
                      <span className="pos-card__flag">Fora da validade</span>
                    )}
                    {unavailable && !expired && (
                      <span
                        className="pos-card__flag"
                        style={{ color: "#8a919c" }}
                      >
                        Sem stock
                      </span>
                    )}
                  </button>
                );
              })}
              {filteredProducts.length === 0 && (
                <div className="pos-empty" style={{ gridColumn: "1 / -1" }}>
                  <Search className="w-10 h-10" />
                  Nenhum produto encontrado.
                  <br />
                  Pesquise por nome, SKU ou código de barras.
                </div>
              )}
              </div>
              </div>
            </div>
          </div>

          {/* ---------- venda ---------- */}
          <div className="pos-right">
            <div className="pos-box" style={{ marginBottom: 0 }}>
              <div className="pos-box__header">
                <div className="pos-box__title">
                  <ShoppingCart
                    className="w-4 h-4"
                    style={{ color: "#1577EB" }}
                  />
                  Venda actual
                  <span className="pos-slogan">
                    {cart.length} {cart.length === 1 ? "artigo" : "artigos"}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <button
                    type="button"
                    className="pos-link"
                    onClick={holdSale}
                    disabled={cart.length === 0}
                  >
                    <Pause className="w-3.5 h-3.5" /> Pausar{" "}
                    <span className="pos-kbd">F9</span>
                  </button>
                  {cart.length > 0 && (
                    <button
                      type="button"
                      className="pos-link pos-link--danger"
                      onClick={() => setConfirmClear(true)}
                      data-testid="button-pos-clear-cart"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Limpar
                    </button>
                  )}
                </div>
              </div>

              <div className="pos-box__content pos-box__content--flush">
                {cart.length === 0 ? (
                  <div className="pos-empty">
                    <ShoppingCart className="w-10 h-10" />
                    Não existem itens associados à venda.
                    <br />
                    Seleccione um produto, leia um código de barras ou um QR
                    para começar.
                  </div>
                ) : (
                  <div style={{ maxHeight: 320, overflowY: "auto" }}>
                    <table className="pos-table" id="pos-cart">
                      <thead>
                        <tr>
                          <th style={{ width: 34 }}></th>
                          <th className="text-left">Produto</th>
                          <th style={{ width: 108 }} className="text-right">
                            Qtd.
                          </th>
                          <th style={{ width: 92 }} className="text-right">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {cart.map((line) => (
                          <tr
                            key={line.product.id}
                            data-testid={`row-pos-cart-${line.product.id}`}
                          >
                            <td
                              className="text-left"
                              style={{ paddingLeft: 10 }}
                            >
                              <button
                                type="button"
                                className="pos-line-remove"
                                onClick={() =>
                                  setCart((previous) =>
                                    previous.filter(
                                      (item) =>
                                        item.product.id !== line.product.id,
                                    ),
                                  )
                                }
                                aria-label={`Remover ${line.product.nome}`}
                                data-testid={`button-pos-remove-${line.product.id}`}
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </td>
                            <td className="text-left">
                              <div className="pos-cart-product">
                                <ProdutoImagem
                                  produto={line.product}
                                  servico={isServiceProduct(line.product)}
                                  variante="carrinho"
                                />
                                <div className="pos-cart-product__details">
                                  <span className="pos-line-title">
                                    {line.product.nome}
                                  </span>
                                  <span className="pos-line-ref">
                                    {line.product.codigo} ·{" "}
                                    {formatCurrency(
                                      line.product.preco,
                                      config.moeda,
                                    )}
                                    /{formatUnit(line.product.unidadeMedida)}
                                    {line.product.ivaIsento
                                      ? " · isento"
                                      : ` · IVA ${config.ivaTaxa || 0}%`}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="text-right">
                              <span className="pos-stepper">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateQuantity(line.product.id, -1)
                                  }
                                  aria-label="Diminuir quantidade"
                                  data-testid={`button-pos-decrease-${line.product.id}`}
                                >
                                  <Minus className="w-4 h-4" />
                                </button>
                                <input
                                  value={line.quantity}
                                  onChange={(event) =>
                                    setLineQuantity(
                                      line.product.id,
                                      event.target.value,
                                    )
                                  }
                                  aria-label={`Quantidade de ${line.product.nome}`}
                                  data-testid={`text-pos-quantity-${line.product.id}`}
                                  inputMode="decimal"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateQuantity(line.product.id, 1)
                                  }
                                  aria-label="Aumentar quantidade"
                                  data-testid={`button-pos-increase-${line.product.id}`}
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              </span>
                            </td>
                            <td
                              className="pos-line-total"
                              style={{ paddingRight: 12 }}
                            >
                              {formatCurrency(
                                line.quantity * line.product.preco,
                                config.moeda,
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        {totals.descontoValor > 0 && (
                          <tr>
                            <th colSpan={3}>
                              Desc.
                              {totals.descontoPercent > 0
                                ? ` ${totals.descontoPercent}%`
                                : ""}
                            </th>
                            <th
                              className="text-right"
                              style={{ paddingRight: 12 }}
                            >
                              -
                              {formatCurrency(
                                totals.descontoValor,
                                config.moeda,
                              )}
                            </th>
                          </tr>
                        )}
                        <tr>
                          <th colSpan={3}>Total s/IVA</th>
                          <th
                            className="text-right"
                            style={{ paddingRight: 12 }}
                          >
                            {formatCurrency(totals.subtotal, config.moeda)}
                          </th>
                        </tr>
                        <tr>
                          <th colSpan={3}>IVA ({config.ivaTaxa || 0}%)</th>
                          <th
                            className="text-right"
                            style={{ paddingRight: 12 }}
                          >
                            {formatCurrency(totals.totalIva, config.moeda)}
                          </th>
                        </tr>
                        <tr className="pos-grand">
                          <th colSpan={3}>Total c/IVA</th>
                          <th
                            className="text-right"
                            style={{ paddingRight: 12, color: "#1577EB" }}
                            data-testid="text-pos-total"
                          >
                            {formatCurrency(totals.total, config.moeda)}
                          </th>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              {/* ---- cliente / não é cliente ---- */}
              <div className="pos-collapse">
                <button
                  type="button"
                  className="pos-collapse__header"
                  onClick={() => setShowCustomer((v) => !v)}
                  data-testid="button-pos-customer-toggle"
                >
                  <span className="pos-collapse__icon">
                    <UserPlus className="w-4 h-4" />
                  </span>
                  Cliente
                  <span className="pos-collapse__value">
                    {cliente.consumidorFinal && !cliente.nif.trim()
                      ? "Não é cliente"
                      : adquirenteLabel}
                  </span>
                  <span className="pos-collapse__change">
                    Alterar{" "}
                    <ChevronDown
                      className="w-3.5 h-3.5"
                      style={{
                        transform: showCustomer ? "rotate(180deg)" : undefined,
                        transition: "transform .15s",
                      }}
                    />
                  </span>
                </button>
                {showCustomer && (
                  <div className="pos-collapse__content">
                    <ClienteField
                      value={cliente}
                      onChange={setCliente}
                      pacientes={pacientes}
                      onNovoCliente={() => setShowNovoClienteModal(true)}
                      exigirIdentificacao={false}
                      compacto
                    />
                  </div>
                )}
              </div>

              {/* ---- detalhes da operação ---- */}
              {cartSector === "Farmácia" && (
                <div
                  className="pos-collapse"
                  data-testid="panel-pos-sector-details"
                >
                  <button
                    type="button"
                    className="pos-collapse__header"
                    onClick={() => toggleBox("sector")}
                  >
                    <span className="pos-collapse__icon">
                      <Tag className="w-4 h-4" />
                    </span>
                    Detalhes da operação
                    <span className="pos-collapse__value">{cartSector}</span>
                    <span className="pos-collapse__change">
                      Alterar{" "}
                      <ChevronDown
                        className="w-3.5 h-3.5"
                        style={{
                          transform: openBoxes.sector
                            ? "rotate(180deg)"
                            : undefined,
                          transition: "transform .15s",
                        }}
                      />
                    </span>
                  </button>
                  {openBoxes.sector && (
                    <div className="pos-collapse__content">
                        <>
                          <div className="pos-field">
                            <label
                              className="pos-label"
                              htmlFor="pos-prescription"
                            >
                              N.º da receita
                            </label>
                            <input
                              id="pos-prescription"
                              value={prescriptionNumber}
                              onChange={(event) =>
                                setPrescriptionNumber(event.target.value)
                              }
                              placeholder="N.º da receita (opcional)"
                              className="pos-input"
                              aria-label="Número da receita"
                              data-testid="input-pos-prescription"
                            />
                          </div>
                          <button
                            type="button"
                            className="pos-btn pos-btn--sm"
                            onClick={() => {
                              setDrawerMotivo("Reposição de documentos");
                              setDrawerModal("gaveta-documentos");
                            }}
                          >
                            <FileText className="w-4 h-4" /> Abrir gaveta de
                            documentos / receitas
                          </button>
                        </>
                    </div>
                  )}
                </div>
              )}

              {/* ---- desconto ---- */}
              <div className="pos-collapse">
                <button
                  type="button"
                  className="pos-collapse__header"
                  onClick={() => setShowDiscount((v) => !v)}
                >
                  <span className="pos-collapse__icon">
                    <Percent className="w-4 h-4" />
                  </span>
                  Desconto
                  <span className="pos-collapse__value">
                    {totals.descontoValor > 0
                      ? formatCurrency(totals.descontoValor, config.moeda)
                      : ""}
                  </span>
                  <span className="pos-collapse__change">
                    Alterar{" "}
                    <ChevronDown
                      className="w-3.5 h-3.5"
                      style={{
                        transform: showDiscount ? "rotate(180deg)" : undefined,
                        transition: "transform .15s",
                      }}
                    />
                  </span>
                </button>
                {showDiscount && (
                  <div className="pos-collapse__content">
                    <div className="pos-row2">
                      <div className="pos-field">
                        <label className="pos-label" htmlFor="pos-discount-pct">
                          Desc. Percentual
                        </label>
                        <div className="pos-input-group">
                          <span className="pos-input-group__addon">%</span>
                          <input
                            id="pos-discount-pct"
                            className="pos-input pos-input--money"
                            value={discountPercent}
                            onChange={(event) => {
                              setDiscountPercent(
                                event.target.value.replace(/[^0-9.,]/g, ""),
                              );
                              if (event.target.value) setDiscountAmount("");
                            }}
                            onFocus={(event) => event.target.select()}
                            placeholder="0"
                            inputMode="decimal"
                          />
                        </div>
                      </div>
                      <div className="pos-field">
                        <label className="pos-label" htmlFor="pos-discount-amt">
                          Desc. Monetário
                        </label>
                        <div className="pos-input-group">
                          <span className="pos-input-group__addon">
                            {config.moeda}
                          </span>
                          <input
                            id="pos-discount-amt"
                            className="pos-input pos-input--money"
                            value={discountAmount}
                            onChange={(event) => {
                              setDiscountAmount(
                                event.target.value.replace(/[^0-9.,]/g, ""),
                              );
                              if (event.target.value) setDiscountPercent("");
                            }}
                            onFocus={(event) => event.target.select()}
                            placeholder="0,00"
                            inputMode="decimal"
                          />
                        </div>
                      </div>
                    </div>
                    <p className="pos-note">
                      O desconto é rateado proporcionalmente pelos artigos e
                      reflectido no IVA.
                    </p>
                  </div>
                )}
              </div>

              {/* ---- pagamento ---- */}
              <div className="pos-collapse">
                <button
                  type="button"
                  className="pos-collapse__header"
                  onClick={() => toggleBox("pay")}
                >
                  <span className="pos-collapse__icon">
                    <Banknote className="w-4 h-4" />
                  </span>
                  Pagamentos
                  <span className="pos-collapse__value">{payment}</span>
                  <span className="pos-collapse__change">
                    Alterar{" "}
                    <ChevronDown
                      className="w-3.5 h-3.5"
                      style={{
                        transform: openBoxes.pay ? "rotate(180deg)" : undefined,
                        transition: "transform .15s",
                      }}
                    />
                  </span>
                </button>
                {openBoxes.pay && (
                  <div className="pos-collapse__content">
                    <div className="pos-pay-grid">
                      {PAYMENT_METHODS.map(({ value, label, icon: Icon }) => (
                        <button
                          type="button"
                          key={value}
                          onClick={() => {
                            setPayment(value);
                            setCashReceived("");
                            setPaymentReference("");
                            setMixedCashAmount("");
                          }}
                          className={`pos-pay ${payment === value ? "is-active" : ""}`}
                          data-testid={`button-pos-payment-${value.toLowerCase().replaceAll(" ", "-")}`}
                        >
                          <Icon className="w-4 h-4" /> {label}
                        </button>
                      ))}
                    </div>

                    {payment === "Numerário" && (
                      <div style={{ marginTop: 12 }}>
                        <label
                          className="pos-label"
                          htmlFor="pos-cash-received"
                        >
                          Valor recebido
                        </label>
                        <div className="pos-input-group">
                          <span className="pos-input-group__addon">
                            {config.moeda}
                          </span>
                          <input
                            id="pos-cash-received"
                            type="text"
                            inputMode="decimal"
                            className="pos-input pos-input--money"
                            value={
                              cashReceived === "" ? "" : String(cashReceived)
                            }
                            onChange={(event) => {
                              const raw = event.target.value.replace(
                                /[^0-9.,]/g,
                                "",
                              );
                              setCashReceived(
                                raw === "" ? "" : Number(raw.replace(",", ".")),
                              );
                            }}
                            onFocus={(event) => event.target.select()}
                            placeholder="0,00"
                            data-testid="input-pos-cash-received"
                          />
                          <button
                            type="button"
                            className="pos-input-group__addon"
                            style={{
                              borderRight: "none",
                              borderLeft: "1px solid #d7dce3",
                              cursor: "pointer",
                              background: "#eaf3ff",
                              color: "#1577EB",
                            }}
                            onClick={() => openKeypad("cash")}
                            aria-label="Abrir teclado numérico"
                          >
                            <Calculator className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="pos-quick">
                          <button
                            type="button"
                            onClick={() =>
                              setCashReceived(Number(totals.total.toFixed(2)))
                            }
                          >
                            Valor exacto
                          </button>
                          {[1000, 2000, 5000, 10000, 20000].map((note) => (
                            <button
                              key={note}
                              type="button"
                              onClick={() =>
                                setCashReceived(
                                  (prev) =>
                                    (typeof prev === "number" ? prev : 0) +
                                    note,
                                )
                              }
                            >
                              +{note.toLocaleString("pt-PT")}
                            </button>
                          ))}
                        </div>
                        <div className="pos-change-box">
                          <span>Troco a devolver</span>
                          <strong data-testid="text-pos-change">
                            {formatCurrency(change, config.moeda)}
                          </strong>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            marginTop: 10,
                            flexWrap: "wrap",
                          }}
                        >
                          <button
                            type="button"
                            className="pos-btn pos-btn--sm"
                            onClick={() => {
                              setDrawerMotivo("Troco a cliente");
                              setDrawerModal(
                                change > 0
                                  ? "gaveta-troco"
                                  : "gaveta-principal",
                              );
                            }}
                            disabled={!activeSession}
                          >
                            <Unlock className="w-4 h-4" /> Abrir gaveta p/ troco
                          </button>
                          {change > trocoDisponivel && (
                            <span className="pos-status pos-status--warn">
                              <AlertTriangle className="w-3 h-3" /> Troco
                              insuficiente
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {payment === "Misto" && (
                      <div style={{ marginTop: 12 }}>
                        <div className="pos-row2">
                          <div className="pos-field">
                            <label
                              className="pos-label"
                              htmlFor="pos-mixed-cash"
                            >
                              Parte em numerário
                            </label>
                            <div className="pos-input-group">
                              <span className="pos-input-group__addon">
                                {config.moeda}
                              </span>
                              <input
                                id="pos-mixed-cash"
                                type="text"
                                inputMode="decimal"
                                className="pos-input pos-input--money"
                                value={
                                  mixedCashAmount === ""
                                    ? ""
                                    : String(mixedCashAmount)
                                }
                                onChange={(event) => {
                                  const raw = event.target.value.replace(
                                    /[^0-9.,]/g,
                                    "",
                                  );
                                  setMixedCashAmount(
                                    raw === ""
                                      ? ""
                                      : Number(raw.replace(",", ".")),
                                  );
                                }}
                                onFocus={(event) => event.target.select()}
                                placeholder="0,00"
                                data-testid="input-pos-mixed-cash"
                              />
                              <button
                                type="button"
                                className="pos-input-group__addon"
                                style={{
                                  borderRight: "none",
                                  borderLeft: "1px solid #d7dce3",
                                  cursor: "pointer",
                                  background: "#eaf3ff",
                                  color: "#1577EB",
                                }}
                                onClick={() => openKeypad("mixedCash")}
                                aria-label="Abrir teclado numérico"
                              >
                                <Calculator className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          <div className="pos-field">
                            <label
                              className="pos-label"
                              htmlFor="pos-mixed-received"
                            >
                              Numerário recebido
                            </label>
                            <div className="pos-input-group">
                              <span className="pos-input-group__addon">
                                {config.moeda}
                              </span>
                              <input
                                id="pos-mixed-received"
                                type="text"
                                inputMode="decimal"
                                className="pos-input pos-input--money"
                                value={
                                  cashReceived === ""
                                    ? ""
                                    : String(cashReceived)
                                }
                                onChange={(event) => {
                                  const raw = event.target.value.replace(
                                    /[^0-9.,]/g,
                                    "",
                                  );
                                  setCashReceived(
                                    raw === ""
                                      ? ""
                                      : Number(raw.replace(",", ".")),
                                  );
                                }}
                                onFocus={(event) => event.target.select()}
                                placeholder="0,00"
                                data-testid="input-pos-mixed-cash-received"
                              />
                              <button
                                type="button"
                                className="pos-input-group__addon"
                                style={{
                                  borderRight: "none",
                                  borderLeft: "1px solid #d7dce3",
                                  cursor: "pointer",
                                  background: "#eaf3ff",
                                  color: "#1577EB",
                                }}
                                onClick={() => openKeypad("mixedReceived")}
                                aria-label="Abrir teclado numérico"
                              >
                                <Calculator className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                        <div
                          className="pos-change-box"
                          style={{
                            borderColor: "#cfe3fb",
                            background: "#eaf3ff",
                            marginTop: 0,
                          }}
                        >
                          <span style={{ color: "#0c5460" }}>
                            Parte electrónica
                          </span>
                          <strong style={{ color: "#0c5460" }}>
                            {formatCurrency(
                              Math.max(
                                0,
                                totals.total -
                                  (typeof mixedCashAmount === "number"
                                    ? mixedCashAmount
                                    : 0),
                              ),
                              config.moeda,
                            )}
                          </strong>
                        </div>
                        <div className="pos-field" style={{ marginTop: 12 }}>
                          <label className="pos-label" htmlFor="pos-mixed-ref">
                            Referência da parte electrónica
                          </label>
                          <input
                            id="pos-mixed-ref"
                            value={paymentReference}
                            onChange={(event) =>
                              setPaymentReference(event.target.value)
                            }
                            placeholder="N.º do TPA, transferência ou cheque"
                            className="pos-input"
                            aria-label="Referência do pagamento misto"
                            data-testid="input-pos-mixed-reference"
                          />
                        </div>
                        <button
                          type="button"
                          className="pos-btn pos-btn--sm"
                          onClick={() => void pedirTPA()}
                          disabled={tpaBusy || totals.total <= 0}
                        >
                          <CreditCard className="w-4 h-4" />{" "}
                          {tpaBusy
                            ? "A comunicar com o TPA..."
                            : "Pedir parte electrónica ao TPA"}
                        </button>
                        {change > 0 && (
                          <div className="pos-change-box">
                            <span>Troco a devolver</span>
                            <strong>
                              {formatCurrency(change, config.moeda)}
                            </strong>
                          </div>
                        )}
                      </div>
                    )}

                    {payment !== "Numerário" &&
                      payment !== "Misto" &&
                      payment !== "Crédito a 30 dias" && (
                        <>
                          <div className="pos-field" style={{ marginTop: 12 }}>
                            <label className="pos-label" htmlFor="pos-pay-ref">
                              Referência do pagamento
                            </label>
                            <input
                              id="pos-pay-ref"
                              value={paymentReference}
                              onChange={(event) =>
                                setPaymentReference(event.target.value)
                              }
                              placeholder="Referência do TPA, transferência ou cheque"
                              className="pos-input"
                              aria-label="Referência do pagamento"
                              data-testid="input-pos-payment-reference"
                            />
                          </div>
                          {(payment === "Multicaixa (TPA)" ||
                            payment === "Multicaixa Express") && (
                            <button
                              type="button"
                              className="pos-btn pos-btn--sm pos-btn--primary"
                              onClick={() => void pedirTPA()}
                              disabled={tpaBusy}
                              data-testid="button-pos-tpa-request"
                            >
                              <CreditCard className="w-4 h-4" />{" "}
                              {tpaBusy
                                ? "A comunicar com o terminal..."
                                : "Pedir pagamento ao TPA"}
                            </button>
                          )}
                        </>
                      )}

                    {payment === "Crédito a 30 dias" && (
                      <div
                        className="pos-alert pos-alert--closed"
                        style={{ marginTop: 12, marginBottom: 0 }}
                      >
                        A venda será emitida a crédito com vencimento em{" "}
                        {addDaysStr(30)}. O documento fica pendente de
                        liquidação em Conta Corrente.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ---- finalizar ---- */}
              <button
                type="button"
                className="pos-apply"
                onClick={() => void completeSale()}
                disabled={!canComplete}
                title={
                  !activeSession
                    ? "Abra a caixa para poder emitir vendas."
                    : undefined
                }
                data-testid="button-pos-complete-sale"
              >
                {saving ? (
                  <span className="animate-pulse">A emitir documento...</span>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Cobrar e emitir{" "}
                    <small>
                      Factura Recibo ·{" "}
                      {formatCurrency(totals.total, config.moeda)} · F4
                    </small>
                  </>
                )}
              </button>

              <div className="pos-shortcuts">
                <span className="pos-shortcut">
                  <span className="pos-kbd">F2</span> Pesquisar
                </span>
                <span className="pos-shortcut">
                  <span className="pos-kbd">F3</span> Gaveta
                </span>
                <span className="pos-shortcut">
                  <span className="pos-kbd">F4</span> Cobrar
                </span>
                <span className="pos-shortcut">
                  <span className="pos-kbd">F5</span> Rel. X
                </span>
                <span className="pos-shortcut">
                  <span className="pos-kbd">F6</span> Dispositivos
                </span>
                <span className="pos-shortcut">
                  <span className="pos-kbd">F7</span> Sangria
                </span>
                <span className="pos-shortcut">
                  <span className="pos-kbd">F8</span> QR/Câmara
                </span>
                <span className="pos-shortcut">
                  <span className="pos-kbd">F9</span> Pausar
                </span>
                <span className="pos-shortcut">
                  <span className="pos-kbd">F10</span> Display cliente
                </span>
                <span className="pos-shortcut">
                  <span className="pos-kbd">Esc</span> Fechar
                </span>
              </div>

              <div className="pos-devstrip">
                <span
                  className={`pos-status ${dispositivos["leitor-codigo-barras"]?.estado === "conectado" ? "pos-status--ok" : "pos-status--warn"}`}
                >
                  <Keyboard className="w-3 h-3" /> Código barras
                </span>
                <span
                  className={`pos-status ${dispositivos["leitor-qr"]?.estado === "conectado" ? "pos-status--ok" : "pos-status--warn"}`}
                >
                  <QrCode className="w-3 h-3" /> QR
                </span>
                <span
                  className={`pos-status ${dispositivos["gaveta-dinheiro"]?.estado === "conectado" ? "pos-status--ok" : "pos-status--warn"}`}
                >
                  <Wallet className="w-3 h-3" /> Gaveta
                </span>
                <span
                  className={`pos-status ${dispositivos["impressora-termica"]?.estado === "conectado" ? "pos-status--ok" : "pos-status--warn"}`}
                >
                  <Printer className="w-3 h-3" /> Impressora
                </span>
                <span
                  className={`pos-status ${displayAberto ? "pos-status--ok" : "pos-status--warn"}`}
                >
                  <Monitor className="w-3 h-3" /> Display cliente
                </span>
                <span
                  className={`pos-status ${dispositivos["tpa"]?.estado === "conectado" ? "pos-status--ok" : "pos-status--warn"}`}
                >
                  <CreditCard className="w-3 h-3" /> TPA
                </span>
                <span
                  className={`pos-status ${dispositivos["balanca"]?.estado === "conectado" ? "pos-status--ok" : "pos-status--warn"}`}
                >
                  <Scale className="w-3 h-3" /> Balança
                </span>
                <span
                  className={`pos-status ${somActivo ? "pos-status--ok" : ""}`}
                >
                  <Volume2 className="w-3 h-3" /> Som
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="pos-help">
          <button
            type="button"
            onClick={() =>
              setFeedback({
                type: "success",
                text: "Centro de ajuda: F2 pesquisar · F3 gaveta · F4 cobrar · F5 relatório X · F6 dispositivos · F7 sangria · F8 QR · F9 pausar · F10 display do cliente.",
              })
            }
          >
            <HelpCircle className="w-4 h-4" /> Precisa de Ajuda?
          </button>
        </div>
      </div>

      {/* ===== abrir/fechar caixa (reforçado, por passos) ===== */}
      {cashModal && (
        <div
          className="pos-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pos-cash-dialog-title"
        >
          <div className="pos-modal__panel pos-modal__panel--wide">
            <div className="pos-modal__header">
              <h3 className="pos-modal__title" id="pos-cash-dialog-title">
                {cashModal === "open" ? (
                  <>
                    <Play className="w-4 h-4 inline mr-2 align-[-2px]" />
                    Abertura de caixa
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 inline mr-2 align-[-2px]" />
                    Fecho de caixa · Relatório Z
                  </>
                )}
              </h3>
              <button
                type="button"
                className="pos-modal__close"
                onClick={resetCashModal}
                aria-label="Fechar caixa"
                data-testid="button-pos-close-cash-dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="pos-steps">
              {passos.map((passo, index) => {
                const numero = index + 1;
                return (
                  <div
                    key={passo}
                    className={`pos-step ${cashStep === numero ? "is-active" : cashStep > numero ? "is-done" : ""}`}
                  >
                    <span className="pos-step__n">
                      {cashStep > numero ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        numero
                      )}
                    </span>
                    {passo}
                  </div>
                );
              })}
            </div>

            <div className="pos-modal__body">
              {/* ---------- ABERTURA ---------- */}
              {cashModal === "open" && cashStep === 1 && (
                <>
                  <p
                    style={{
                      margin: "0 0 14px",
                      fontSize: 13,
                      color: "#8a919c",
                      lineHeight: 1.6,
                    }}
                  >
                    Registe o dinheiro existente na gaveta antes de iniciar o
                    turno. O fundo é confirmado por contagem de notas e moedas
                    no passo seguinte e fica registado no relatório de abertura.
                  </p>
                  <div className="pos-row2">
                    <div className="pos-field">
                      <label className="pos-label" htmlFor="pos-cash-terminal">
                        Terminal
                      </label>
                      <input
                        id="pos-cash-terminal"
                        className="pos-input"
                        value={terminalCaixa}
                        readOnly
                      />
                    </div>
                    <div className="pos-field">
                      <label className="pos-label" htmlFor="pos-cash-operator">
                        Operador responsável
                      </label>
                      <input
                        id="pos-cash-operator"
                        className="pos-input"
                        value={currentUser.nome}
                        readOnly
                      />
                    </div>
                  </div>
                  <div className="pos-field">
                    <label className="pos-label" htmlFor="pos-cash-drawer">
                      Gaveta de destino do fundo
                    </label>
                    <select
                      id="pos-cash-drawer"
                      className="pos-input"
                      value={gavetaFundo}
                      onChange={(event) => setGavetaFundo(event.target.value)}
                      data-testid="select-pos-opening-drawer"
                    >
                      {gavetas
                        .filter((gaveta) => gaveta.tipo !== "documentos")
                        .map((gaveta) => (
                          <option key={gaveta.id} value={gaveta.id}>
                            {gaveta.nome}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="pos-field">
                    <label className="pos-label" htmlFor="pos-cash-value">
                      Fundo inicial (fundo de maneio)
                    </label>
                    <div className="pos-input-group">
                      <span className="pos-input-group__addon">
                        {config.moeda}
                      </span>
                      <input
                        id="pos-cash-value"
                        type="text"
                        inputMode="decimal"
                        autoFocus
                        value={openingCash === "" ? "" : String(openingCash)}
                        onChange={(event) => {
                          const raw = event.target.value.replace(
                            /[^0-9.,]/g,
                            "",
                          );
                          setOpeningCash(
                            raw === "" ? "" : Number(raw.replace(",", ".")),
                          );
                        }}
                        onFocus={(event) => event.target.select()}
                        className="pos-input pos-input--money"
                        style={{ fontSize: 17, padding: "13px 12px" }}
                        placeholder="0,00"
                        data-testid="input-pos-opening-cash"
                      />
                      <button
                        type="button"
                        className="pos-input-group__addon"
                        style={{
                          borderRight: "none",
                          borderLeft: "1px solid #d7dce3",
                          cursor: "pointer",
                          background: "#eaf3ff",
                          color: "#1577EB",
                        }}
                        onClick={() => openKeypad("opening")}
                        aria-label="Abrir teclado numérico"
                      >
                        <Calculator className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="pos-quick">
                      {[5000, 10000, 20000, 50000].map((valor) => (
                        <button
                          key={valor}
                          type="button"
                          onClick={() => setOpeningCash(valor)}
                        >
                          {valor.toLocaleString("pt-PT")} {config.moeda}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="pos-field">
                    <label className="pos-label" htmlFor="pos-opening-notes">
                      Observações do turno
                    </label>
                    <textarea
                      id="pos-opening-notes"
                      className="pos-input"
                      rows={2}
                      value={openingNotes}
                      onChange={(event) => setOpeningNotes(event.target.value)}
                      placeholder="Ex.: troca de turno com a operadora Ana, notas de 2.000 escassas..."
                    />
                  </div>
                  <label className="pos-switch" style={{ marginTop: 4 }}>
                    <input
                      type="checkbox"
                      checked={imprimirAbertura}
                      onChange={(event) =>
                        setImprimirAbertura(event.target.checked)
                      }
                    />
                    Imprimir relatório de abertura e abrir a gaveta
                  </label>
                </>
              )}

              {cashModal === "open" && cashStep === 2 && (
                <>
                  <p
                    style={{
                      margin: "0 0 12px",
                      fontSize: 13,
                      color: "#8a919c",
                      lineHeight: 1.6,
                    }}
                  >
                    Conte o dinheiro físico que vai colocar em{" "}
                    <strong>
                      {
                        gavetas.find((gaveta) => gaveta.id === gavetaFundo)
                          ?.nome
                      }
                    </strong>
                    . A contagem por denominação valida automaticamente o fundo
                    declarado.
                  </p>
                  <ContagemDenominacoes
                    valores={contagemAbertura[gavetaFundo] || {}}
                    moeda={config.moeda}
                    testIdPrefix="pos-opening"
                    onChange={(next) =>
                      setContagemAbertura((prev) => ({
                        ...prev,
                        [gavetaFundo]: next,
                      }))
                    }
                  />
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginTop: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      type="button"
                      className="pos-btn pos-btn--sm pos-btn--primary"
                      onClick={() =>
                        setOpeningCash(Number(totalContadoAbertura.toFixed(2)))
                      }
                      disabled={totalContadoAbertura <= 0}
                      data-testid="button-pos-apply-count"
                    >
                      <Save className="w-4 h-4" /> Usar total contado como fundo
                    </button>
                    <button
                      type="button"
                      className="pos-btn pos-btn--sm"
                      onClick={() => setContagemAbertura({})}
                    >
                      <RefreshCw className="w-4 h-4" /> Limpar contagem
                    </button>
                  </div>
                  {totalContadoAbertura > 0 &&
                    typeof openingCash === "number" &&
                    Math.abs(totalContadoAbertura - openingCash) > 0.01 && (
                      <div
                        className="pos-alert pos-alert--error"
                        style={{ marginTop: 12, marginBottom: 0 }}
                      >
                        <span style={{ display: "flex", gap: 8 }}>
                          <AlertTriangle
                            className="w-4 h-4 shrink-0"
                            style={{ marginTop: 2 }}
                          />
                          Divergência entre o fundo declarado (
                          {formatCurrency(openingCash, config.moeda)}) e o
                          contado (
                          {formatCurrency(totalContadoAbertura, config.moeda)}).
                          Corrija antes de continuar.
                        </span>
                      </div>
                    )}
                </>
              )}

              {cashModal === "open" && cashStep === 3 && (
                <>
                  <div className="pos-summary" style={{ margin: 0 }}>
                    <div className="pos-summary__title">Dados da abertura</div>
                    <div className="pos-summary__row">
                      <span>Terminal</span>
                      <strong>{terminalCaixa}</strong>
                    </div>
                    <div className="pos-summary__row">
                      <span>Operador</span>
                      <strong>{currentUser.nome}</strong>
                    </div>
                    <div className="pos-summary__row">
                      <span>Abertura em</span>
                      <strong>{nowStamp()}</strong>
                    </div>
                    <div className="pos-summary__row">
                      <span>Gaveta de destino</span>
                      <strong>
                        {
                          gavetas.find((gaveta) => gaveta.id === gavetaFundo)
                            ?.nome
                        }
                      </strong>
                    </div>
                    <div
                      className="pos-summary__row"
                      style={{
                        borderTop: "1px solid #e3e6ea",
                        marginTop: 6,
                        paddingTop: 8,
                      }}
                    >
                      <span>Fundo inicial declarado</span>
                      <strong>
                        {formatCurrency(
                          typeof openingCash === "number" ? openingCash : 0,
                          config.moeda,
                        )}
                      </strong>
                    </div>
                    {totalContadoAbertura > 0 && (
                      <div className="pos-summary__row">
                        <span>Total contado por denominação</span>
                        <strong>
                          {formatCurrency(totalContadoAbertura, config.moeda)}
                        </strong>
                      </div>
                    )}
                  </div>
                  {openingNotes.trim() && (
                    <p className="pos-note">Observações: {openingNotes}</p>
                  )}
                  <label className="pos-check">
                    <input
                      type="checkbox"
                      checked={confirmarValores}
                      onChange={(event) =>
                        setConfirmarValores(event.target.checked)
                      }
                      data-testid="check-pos-opening-confirm"
                    />
                    <span>
                      Confirmo que contei o numerário, que o fundo corresponde
                      ao registado e que sou responsável por este turno de
                      caixa.
                    </span>
                  </label>
                </>
              )}

              {/* ---------- FECHO ---------- */}
              {cashModal === "close" && cashStep === 1 && (
                <>
                  <p
                    style={{
                      margin: "0 0 14px",
                      fontSize: 13,
                      color: "#8a919c",
                      lineHeight: 1.6,
                    }}
                  >
                    Confira o turno antes de contar o dinheiro. Estes valores
                    alimentam o relatório Z e ficam arquivados no histórico de
                    caixa.
                  </p>
                  <div className="pos-breakdown">
                    <div className="row">
                      <span>Turno aberto em</span>
                      <strong>{activeSession?.abertaEm}</strong>
                    </div>
                    <div className="row">
                      <span>Operador / terminal</span>
                      <strong>
                        {currentUser.nome} · {terminalCaixa}
                      </strong>
                    </div>
                    <div className="row">
                      <span>Número de vendas</span>
                      <strong>{sessionTotals.qtd}</strong>
                    </div>
                    <div className="row total">
                      <span>Valor total facturado</span>
                      <strong>
                        {formatCurrency(sessionTotals.valor, config.moeda)}
                      </strong>
                    </div>
                  </div>
                  <div className="pos-summary" style={{ margin: "0 0 14px" }}>
                    <div className="pos-summary__title">
                      Por forma de pagamento
                    </div>
                    {resumoPorForma.length === 0 && (
                      <div className="pos-summary__row">
                        <span>Sem vendas registadas no turno</span>
                        <strong>{formatCurrency(0, config.moeda)}</strong>
                      </div>
                    )}
                    {resumoPorForma.map((item) => (
                      <div className="pos-summary__row" key={item.forma}>
                        <span>{item.forma}</span>
                        <strong>
                          {formatCurrency(item.valor, config.moeda)}
                        </strong>
                      </div>
                    ))}
                  </div>
                  <div className="pos-summary" style={{ margin: 0 }}>
                    <div className="pos-summary__title">Numerário</div>
                    <div className="pos-summary__row">
                      <span>Fundo inicial</span>
                      <strong>
                        {formatCurrency(
                          activeSession?.fundoInicial || 0,
                          config.moeda,
                        )}
                      </strong>
                    </div>
                    <div className="pos-summary__row">
                      <span>Entradas em numerário</span>
                      <strong>
                        +{" "}
                        {formatCurrency(
                          resumoPorForma.find(
                            (item) => item.forma === "Numerário",
                          )?.valor || 0,
                          config.moeda,
                        )}
                      </strong>
                    </div>
                    <div className="pos-summary__row">
                      <span>Sangrias para o cofre</span>
                      <strong>
                        - {formatCurrency(totalSangrias, config.moeda)}
                      </strong>
                    </div>
                    <div className="pos-summary__row">
                      <span>Suprimentos do cofre</span>
                      <strong>
                        + {formatCurrency(totalSuprimentos, config.moeda)}
                      </strong>
                    </div>
                    <div
                      className="pos-summary__row"
                      style={{
                        borderTop: "1px solid #e3e6ea",
                        marginTop: 6,
                        paddingTop: 8,
                      }}
                    >
                      <span>Numerário esperado nas gavetas</span>
                      <strong data-testid="text-pos-expected-cash">
                        {formatCurrency(expectedCash, config.moeda)}
                      </strong>
                    </div>
                    <div className="pos-summary__row">
                      <span>Esperado no cofre</span>
                      <strong>
                        {formatCurrency(expectedCofre, config.moeda)}
                      </strong>
                    </div>
                  </div>
                  {(heldSales.length > 0 || cart.length > 0) && (
                    <div
                      className="pos-alert pos-alert--closed"
                      style={{ marginTop: 14, marginBottom: 0 }}
                    >
                      <span style={{ display: "flex", gap: 8 }}>
                        <AlertTriangle
                          className="w-4 h-4 shrink-0"
                          style={{ marginTop: 2 }}
                        />
                        <span>
                          {heldSales.length > 0 && (
                            <>
                              Existem <strong>{heldSales.length}</strong>{" "}
                              venda(s) pausada(s) que não serão contabilizadas
                              neste fecho.{" "}
                            </>
                          )}
                          {cart.length > 0 && (
                            <>
                              O carrinho actual tem{" "}
                              <strong>{cart.length}</strong> artigo(s) por
                              cobrar.{" "}
                            </>
                          )}
                          Resolva antes de fechar para não perder facturação.
                        </span>
                      </span>
                      <div className="pos-alert__actions">
                        {heldSales.length > 0 && (
                          <button
                            type="button"
                            className="pos-link"
                            onClick={() => {
                              resetCashModal();
                              setShowHeld(true);
                            }}
                          >
                            Ver pausadas
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginTop: 14,
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      type="button"
                      className="pos-btn pos-btn--sm"
                      onClick={() => setShowRelatorioX(true)}
                    >
                      <FileText className="w-4 h-4" /> Ver relatório X
                    </button>
                    <button
                      type="button"
                      className="pos-btn pos-btn--sm"
                      onClick={() => setShowMovimentos(true)}
                    >
                      <List className="w-4 h-4" /> Movimentos de caixa
                    </button>
                    <label
                      className="pos-switch"
                      style={{ marginLeft: "auto" }}
                    >
                      <input
                        type="checkbox"
                        checked={imprimirFecho}
                        onChange={(event) =>
                          setImprimirFecho(event.target.checked)
                        }
                      />
                      Imprimir relatório Z
                    </label>
                    <label className="pos-switch">
                      <input
                        type="checkbox"
                        checked={abrirGavetaNoFecho}
                        onChange={(event) =>
                          setAbrirGavetaNoFecho(event.target.checked)
                        }
                      />
                      Abrir gaveta no fecho
                    </label>
                  </div>
                </>
              )}

              {cashModal === "close" && cashStep === 2 && (
                <>
                  <p
                    style={{
                      margin: "0 0 12px",
                      fontSize: 13,
                      color: "#8a919c",
                      lineHeight: 1.6,
                    }}
                  >
                    Conte o dinheiro de cada gaveta. O total contado é somado
                    automaticamente e comparado com o valor esperado.
                  </p>
                  <div
                    className="pos-tabs"
                    style={{ padding: "0 0 10px", borderBottom: "none" }}
                  >
                    {gavetasDinheiro.map((gaveta) => (
                      <button
                        type="button"
                        key={gaveta.id}
                        className={`pos-tab ${gavetaContagem === gaveta.id ? "is-active" : ""}`}
                        onClick={() => setGavetaContagem(gaveta.id)}
                        data-testid={`tab-pos-count-${gaveta.id}`}
                      >
                        {gaveta.nome}
                        {totalContagem(contagemFecho, gaveta.id) > 0 &&
                          ` · ${formatCurrency(totalContagem(contagemFecho, gaveta.id), config.moeda)}`}
                      </button>
                    ))}
                  </div>
                  <ContagemDenominacoes
                    valores={contagemFecho[gavetaContagem] || {}}
                    moeda={config.moeda}
                    testIdPrefix="pos-closing"
                    onChange={(next) => {
                      const novoMapa = {
                        ...contagemFecho,
                        [gavetaContagem]: next,
                      };
                      setContagemFecho(novoMapa);
                      const total = totalContagem(novoMapa);
                      setClosingCash(total > 0 ? total : "");
                    }}
                  />
                  <div className="pos-field" style={{ marginTop: 14 }}>
                    <label className="pos-label" htmlFor="pos-cash-value">
                      Valor contado (total das gavetas)
                    </label>
                    <div className="pos-input-group">
                      <span className="pos-input-group__addon">
                        {config.moeda}
                      </span>
                      <input
                        id="pos-cash-value"
                        type="text"
                        inputMode="decimal"
                        value={closingCash === "" ? "" : String(closingCash)}
                        onChange={(event) => {
                          const raw = event.target.value.replace(
                            /[^0-9.,]/g,
                            "",
                          );
                          setClosingCash(
                            raw === "" ? "" : Number(raw.replace(",", ".")),
                          );
                        }}
                        onFocus={(event) => event.target.select()}
                        className="pos-input pos-input--money"
                        style={{ fontSize: 17, padding: "13px 12px" }}
                        placeholder="0,00"
                        data-testid="input-pos-closing-cash"
                      />
                      <button
                        type="button"
                        className="pos-input-group__addon"
                        style={{
                          borderRight: "none",
                          borderLeft: "1px solid #d7dce3",
                          cursor: "pointer",
                          background: "#eaf3ff",
                          color: "#1577EB",
                        }}
                        onClick={() => openKeypad("closing")}
                        aria-label="Abrir teclado numérico"
                      >
                        <Calculator className="w-4 h-4" />
                      </button>
                    </div>
                    <div
                      className="pos-change-box"
                      style={{
                        borderColor:
                          diferencaFecho === 0 ? "#b7e4c7" : "#f1c0bc",
                        background:
                          diferencaFecho === 0 ? "#f2fbf5" : "#fdf3f2",
                      }}
                    >
                      <span
                        style={{
                          color: diferencaFecho === 0 ? "#155724" : "#a02015",
                        }}
                      >
                        Diferença (contado - esperado)
                      </span>
                      <strong
                        style={{
                          color: diferencaFecho === 0 ? "#155724" : "#a02015",
                        }}
                        data-testid="text-pos-cash-difference"
                      >
                        {formatCurrency(diferencaFecho, config.moeda)}
                      </strong>
                    </div>
                  </div>
                </>
              )}

              {cashModal === "close" && cashStep === 3 && (
                <>
                  <div className="pos-summary" style={{ margin: "0 0 14px" }}>
                    <div className="pos-summary__row">
                      <span>Numerário esperado</span>
                      <strong>
                        {formatCurrency(expectedCash, config.moeda)}
                      </strong>
                    </div>
                    <div className="pos-summary__row">
                      <span>Numerário contado</span>
                      <strong>
                        {formatCurrency(
                          typeof closingCash === "number" ? closingCash : 0,
                          config.moeda,
                        )}
                      </strong>
                    </div>
                    <div
                      className="pos-summary__row"
                      style={{
                        borderTop: "1px solid #e3e6ea",
                        marginTop: 6,
                        paddingTop: 8,
                      }}
                    >
                      <span>Diferença</span>
                      <strong
                        style={{
                          color: diferencaFecho === 0 ? "#28a745" : "#c2261c",
                          fontSize: 16,
                        }}
                      >
                        {formatCurrency(diferencaFecho, config.moeda)}
                      </strong>
                    </div>
                  </div>
                  {Math.abs(diferencaFecho) > 0.009 ? (
                    <>
                      <div
                        className="pos-alert pos-alert--error"
                        style={{ marginTop: 0 }}
                      >
                        <span style={{ display: "flex", gap: 8 }}>
                          <AlertTriangle
                            className="w-4 h-4 shrink-0"
                            style={{ marginTop: 2 }}
                          />
                          Foi detectada uma diferença de caixa. É obrigatório
                          indicar o motivo e obter a aprovação de um supervisor
                          antes de fechar o turno.
                        </span>
                      </div>
                      <div className="pos-field">
                        <label className="pos-label" htmlFor="pos-diff-reason">
                          Motivo da diferença *
                        </label>
                        <select
                          id="pos-diff-reason"
                          className="pos-input"
                          value={diferencaMotivo}
                          onChange={(event) =>
                            setDiferencaMotivo(event.target.value)
                          }
                          data-testid="select-pos-difference-reason"
                        >
                          <option value="">Seleccione...</option>
                          {MOTIVOS_DIFERENCA.map((motivo) => (
                            <option key={motivo} value={motivo}>
                              {motivo}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="pos-field">
                        <label className="pos-label" htmlFor="pos-diff-note">
                          Descrição detalhada
                        </label>
                        <textarea
                          id="pos-diff-note"
                          className="pos-input"
                          rows={3}
                          value={diferencaNota}
                          onChange={(event) =>
                            setDiferencaNota(event.target.value)
                          }
                          placeholder="Explique o que originou a diferença e as medidas correctivas aplicadas..."
                        />
                      </div>
                      <p className="pos-note">A diferença exige aprovação de um gestor da instituição. O servidor valida as credenciais e regista o responsável.</p>
                      {currentUser.role!=='admin'&&<div className="pos-row2"><label>Utilizador do gestor<input className="pos-input" autoComplete="off" value={supervisorNome} onChange={e=>setSupervisorNome(e.target.value)}/></label><label>Palavra-passe do gestor<input className="pos-input" type="password" autoComplete="new-password" value={supervisorPin} onChange={e=>setSupervisorPin(e.target.value)}/></label></div>}

                    </>
                  ) : (
                    <div
                      className="pos-alert pos-alert--success"
                      style={{ marginTop: 0 }}
                    >
                      <span style={{ display: "flex", gap: 8 }}>
                        <CheckCircle2
                          className="w-4 h-4 shrink-0"
                          style={{ marginTop: 2 }}
                        />
                        Sem diferenças de caixa: o valor contado coincide com o
                        esperado pelo sistema. Pode avançar para a confirmação.
                      </span>
                    </div>
                  )}
                </>
              )}

              {cashModal === "close" && cashStep === 4 && (
                <>
                  <div className="pos-summary" style={{ margin: "0 0 14px" }}>
                    <div className="pos-summary__title">
                      Resumo final do turno
                    </div>
                    <div className="pos-summary__row">
                      <span>Vendas emitidas</span>
                      <strong>{sessionTotals.qtd}</strong>
                    </div>
                    <div className="pos-summary__row">
                      <span>Valor facturado</span>
                      <strong>
                        {formatCurrency(sessionTotals.valor, config.moeda)}
                      </strong>
                    </div>
                    {resumoPorForma.map((item) => (
                      <div className="pos-summary__row" key={item.forma}>
                        <span>{item.forma}</span>
                        <strong>
                          {formatCurrency(item.valor, config.moeda)}
                        </strong>
                      </div>
                    ))}
                    <div className="pos-summary__row">
                      <span>Fundo inicial</span>
                      <strong>
                        {formatCurrency(
                          activeSession?.fundoInicial || 0,
                          config.moeda,
                        )}
                      </strong>
                    </div>
                    <div className="pos-summary__row">
                      <span>Sangrias / suprimentos</span>
                      <strong>
                        -{formatCurrency(totalSangrias, config.moeda)} / +
                        {formatCurrency(totalSuprimentos, config.moeda)}
                      </strong>
                    </div>
                    <div className="pos-summary__row">
                      <span>Numerário esperado</span>
                      <strong>
                        {formatCurrency(expectedCash, config.moeda)}
                      </strong>
                    </div>
                    <div className="pos-summary__row">
                      <span>Numerário contado</span>
                      <strong>
                        {formatCurrency(
                          typeof closingCash === "number" ? closingCash : 0,
                          config.moeda,
                        )}
                      </strong>
                    </div>
                    <div
                      className="pos-summary__row"
                      style={{
                        borderTop: "1px solid #e3e6ea",
                        marginTop: 6,
                        paddingTop: 8,
                      }}
                    >
                      <span>Diferença</span>
                      <strong
                        style={{
                          color: diferencaFecho === 0 ? "#28a745" : "#c2261c",
                        }}
                      >
                        {formatCurrency(diferencaFecho, config.moeda)}
                      </strong>
                    </div>
                    {diferencaMotivo && (
                      <div className="pos-summary__row">
                        <span>Motivo</span>
                        <strong>{diferencaMotivo}</strong>
                      </div>
                    )}
                    {supervisorNome && (
                      <div className="pos-summary__row">
                        <span>Aprovado por</span>
                        <strong>{supervisorNome}</strong>
                      </div>
                    )}
                  </div>
                  <div className="pos-summary" style={{ margin: "0 0 14px" }}>
                    <div className="pos-summary__title">
                      Contagem por gaveta
                    </div>
                    {gavetasDinheiro.map((gaveta) => (
                      <div className="pos-summary__row" key={gaveta.id}>
                        <span>
                          {gaveta.nome} · {gaveta.aberturas} aberturas
                        </span>
                        <strong>
                          {formatCurrency(
                            totalContagem(contagemFecho, gaveta.id),
                            config.moeda,
                          )}
                        </strong>
                      </div>
                    ))}
                  </div>
                  <label className="pos-check">
                    <input
                      type="checkbox"
                      checked={confirmarValores}
                      onChange={(event) =>
                        setConfirmarValores(event.target.checked)
                      }
                      data-testid="check-pos-closing-confirm"
                    />
                    <span>
                      Confirmo a contagem, aceito o relatório Z gerado e declaro
                      encerrado o turno de caixa de {currentUser.nome}.
                      {imprimirFecho
                        ? " O relatório Z será impresso/guardado."
                        : ""}
                    </span>
                  </label>
                </>
              )}
            </div>

            <div className="pos-modal__footer">
              {cashStep > 1 && (
                <button
                  type="button"
                  className="pos-btn"
                  onClick={() => setCashStep((prev) => Math.max(1, prev - 1))}
                >
                  <ChevronDown
                    className="w-4 h-4"
                    style={{ transform: "rotate(90deg)" }}
                  />{" "}
                  Voltar
                </button>
              )}
              {cashStep < passos.length ? (
                <>
                  <button
                    type="button"
                    className="pos-btn"
                    onClick={resetCashModal}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="pos-btn pos-btn--primary"
                    onClick={() => {
                      if (
                        cashModal === "close" &&
                        cashStep === 2 &&
                        typeof closingCash !== "number"
                      ) {
                        setFeedback({
                          type: "error",
                          text: "Conte o dinheiro ou introduza o valor total contado.",
                        });
                        return;
                      }
                      if (
                        cashModal === "open" &&
                        cashStep === 1 &&
                        typeof openingCash !== "number"
                      ) {
                        setFeedback({
                          type: "error",
                          text: "Indique o fundo inicial (pode ser 0,00 se não houver fundo).",
                        });
                        return;
                      }
                      if (cashModal === "open" && cashStep === 2) {
                        setOpeningCash((prev) =>
                          typeof prev === "number"
                            ? prev
                            : totalContadoAbertura,
                        );
                      }
                      setFeedback(null);
                      setCashStep((prev) => prev + 1);
                    }}
                    data-testid={`button-pos-cash-step-${cashStep + 1}`}
                  >
                    Seguinte{" "}
                    <ChevronDown
                      className="w-4 h-4"
                      style={{ transform: "rotate(-90deg)" }}
                    />
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="pos-btn"
                    onClick={resetCashModal}
                  >
                    Cancelar
                  </button>
                  {cashModal === "open" ? (
                    <button
                      type="button"
                      className="pos-btn pos-btn--success"
                      onClick={() => void openCashSession()}
                      data-testid="button-pos-confirm-open-cash"
                    >
                      <Play className="w-4 h-4" /> Confirmar abertura
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="pos-btn pos-btn--dark"
                      onClick={() => void closeCashSession()}
                      data-testid="button-pos-confirm-close-cash"
                    >
                      <Lock className="w-4 h-4" /> Confirmar fecho e emitir Z
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== relatório X ===== */}
      {showRelatorioX && (
        <div
          className="pos-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Relatório X"
        >
          <div className="pos-modal__panel pos-modal__panel--wide">
            <div className="pos-modal__header">
              <h3 className="pos-modal__title">
                <FileText className="w-4 h-4 inline mr-2 align-[-2px]" />
                Relatório X · conferência parcial do turno
              </h3>
              <button
                type="button"
                className="pos-modal__close"
                onClick={() => setShowRelatorioX(false)}
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="pos-modal__body">
              <div className="pos-summary" style={{ margin: "0 0 14px" }}>
                <div className="pos-summary__row">
                  <span>Turno aberto em</span>
                  <strong>{activeSession?.abertaEm}</strong>
                </div>
                <div className="pos-summary__row">
                  <span>Operador / terminal</span>
                  <strong>
                    {currentUser.nome} · {terminalCaixa}
                  </strong>
                </div>
                <div className="pos-summary__row">
                  <span>Vendas</span>
                  <strong>{sessionTotals.qtd}</strong>
                </div>
                <div className="pos-summary__row">
                  <span>Facturado</span>
                  <strong>
                    {formatCurrency(sessionTotals.valor, config.moeda)}
                  </strong>
                </div>
                <div className="pos-summary__row">
                  <span>Fundo inicial</span>
                  <strong>
                    {formatCurrency(
                      activeSession?.fundoInicial || 0,
                      config.moeda,
                    )}
                  </strong>
                </div>
                <div className="pos-summary__row">
                  <span>Sangrias</span>
                  <strong>
                    -{formatCurrency(totalSangrias, config.moeda)}
                  </strong>
                </div>
                <div className="pos-summary__row">
                  <span>Suprimentos</span>
                  <strong>
                    +{formatCurrency(totalSuprimentos, config.moeda)}
                  </strong>
                </div>
                <div
                  className="pos-summary__row"
                  style={{
                    borderTop: "1px solid #e3e6ea",
                    marginTop: 6,
                    paddingTop: 8,
                  }}
                >
                  <span>Numerário esperado</span>
                  <strong>{formatCurrency(expectedCash, config.moeda)}</strong>
                </div>
                <div className="pos-summary__row">
                  <span>Registado nas gavetas</span>
                  <strong>{formatCurrency(totalEmCaixa, config.moeda)}</strong>
                </div>
              </div>
              <div className="pos-breakdown">
                {resumoPorForma.length === 0 && (
                  <div className="row">
                    <span>Sem vendas no turno</span>
                    <strong>{formatCurrency(0, config.moeda)}</strong>
                  </div>
                )}
                {resumoPorForma.map((item) => (
                  <div className="row" key={item.forma}>
                    <span>{item.forma}</span>
                    <strong>{formatCurrency(item.valor, config.moeda)}</strong>
                  </div>
                ))}
                <div className="row total">
                  <span>Total</span>
                  <strong>
                    {formatCurrency(sessionTotals.valor, config.moeda)}
                  </strong>
                </div>
              </div>
              <p className="pos-note">
                O relatório X não encerra o turno: serve para conferências
                intermédias, mudanças de operador e validação de sangrias.
              </p>
            </div>
            <div className="pos-modal__footer">
              <button
                type="button"
                className="pos-btn"
                onClick={() => setShowRelatorioX(false)}
              >
                Fechar
              </button>
              <button
                type="button"
                className="pos-btn pos-btn--primary"
                onClick={() => {
                  const html = relatorioCaixaHTML({
                    titulo: "Relatório X · Conferência Parcial",
                    empresa: nomeEmpresa,
                    nif: nifEmpresa,
                    terminal: terminalCaixa,
                    operador: currentUser.nome,
                    emitidoEm: nowStamp(),
                    linhas: [
                      {
                        label: "Abertura do turno",
                        value: activeSession?.abertaEm || "—",
                      },
                      {
                        label: "N.º de vendas",
                        value: String(sessionTotals.qtd),
                      },
                      {
                        label: "Valor facturado",
                        value: formatCurrency(
                          sessionTotals.valor,
                          config.moeda,
                        ),
                        forte: true,
                      },
                      {
                        label: "Fundo inicial",
                        value: formatCurrency(
                          activeSession?.fundoInicial || 0,
                          config.moeda,
                        ),
                      },
                      {
                        label: "Sangrias",
                        value: `- ${formatCurrency(totalSangrias, config.moeda)}`,
                      },
                      {
                        label: "Suprimentos",
                        value: `+ ${formatCurrency(totalSuprimentos, config.moeda)}`,
                      },
                      {
                        label: "Numerário esperado",
                        value: formatCurrency(expectedCash, config.moeda),
                        forte: true,
                      },
                    ],
                    seccoes: [
                      {
                        titulo: "Por forma de pagamento",
                        linhas: resumoPorForma.length
                          ? resumoPorForma.map((item) => ({
                              label: item.forma,
                              value: formatCurrency(item.valor, config.moeda),
                            }))
                          : [
                              {
                                label: "Sem vendas",
                                value: formatCurrency(0, config.moeda),
                              },
                            ],
                      },
                    ],
                    rodape: ["Relatório X — não encerra o turno de caixa."],
                  });
                  imprimirHTML(
                    html,
                    `Relatorio_X_${terminalCaixa}_${Date.now()}`,
                  );
                  gravarSessao({
                    relatoriosX: (activeSession?.relatoriosX || 0) + 1,
                  });
                  registarLog("Impressora", "Relatório X emitido.", "ok");
                  setFeedback({
                    type: "success",
                    text: "Relatório X emitido.",
                  });
                }}
                data-testid="button-pos-print-x"
              >
                <Printer className="w-4 h-4" /> Imprimir relatório X
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== movimentos de caixa ===== */}
      {showMovimentos && (
        <div
          className="pos-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Movimentos de caixa"
        >
          <div className="pos-modal__panel pos-modal__panel--wide">
            <div className="pos-modal__header">
              <h3 className="pos-modal__title">
                <List className="w-4 h-4 inline mr-2 align-[-2px]" />
                Movimentos de caixa ({movimentos.length})
              </h3>
              <button
                type="button"
                className="pos-modal__close"
                onClick={() => setShowMovimentos(false)}
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="pos-modal__body">
              {movimentos.length === 0 ? (
                <div className="pos-empty">
                  <List className="w-10 h-10" />
                  Sem movimentos registados neste turno.
                </div>
              ) : (
                <table className="pos-table">
                  <thead>
                    <tr>
                      <th className="text-left">Quando</th>
                      <th className="text-left">Tipo</th>
                      <th className="text-left">Gaveta / motivo</th>
                      <th className="text-left">Operador</th>
                      <th>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimentos.map((movimento) => (
                      <tr key={movimento.id}>
                        <td className="text-left" style={{ fontSize: 12 }}>
                          {movimento.em}
                        </td>
                        <td
                          className="text-left"
                          style={{
                            textTransform: "capitalize",
                            fontWeight: 700,
                          }}
                        >
                          {movimento.tipo}
                        </td>
                        <td className="text-left" style={{ fontSize: 12 }}>
                          {gavetas.find(
                            (gaveta) => gaveta.id === movimento.gavetaId,
                          )?.nome || "—"}
                          {movimento.destinoId && (
                            <>
                              {" "}
                              →{" "}
                              {
                                gavetas.find(
                                  (gaveta) => gaveta.id === movimento.destinoId,
                                )?.nome
                              }
                            </>
                          )}
                          <br />
                          <span style={{ color: "#9aa1ac" }}>
                            {movimento.motivo}
                          </span>
                        </td>
                        <td className="text-left" style={{ fontSize: 12 }}>
                          {movimento.operador}
                        </td>
                        <td style={{ fontWeight: 700 }}>
                          {movimento.tipo === "gaveta"
                            ? "—"
                            : (movimento.tipo === "sangria"
                                ? "- "
                                : movimento.tipo === "suprimento"
                                  ? "+ "
                                  : "") +
                              formatCurrency(movimento.valor, config.moeda)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="pos-modal__footer">
              <button
                type="button"
                className="pos-btn"
                onClick={() => setShowMovimentos(false)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== sangria / suprimento ===== */}
      {showTesouraria && (
        <div
          className="pos-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Tesouraria"
        >
          <div className="pos-modal__panel">
            <div className="pos-modal__header">
              <h3 className="pos-modal__title">
                <ArrowDownToLine className="w-4 h-4 inline mr-2 align-[-2px]" />
                Tesouraria · sangria e suprimento
              </h3>
              <button
                type="button"
                className="pos-modal__close"
                onClick={() => setShowTesouraria(false)}
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="pos-modal__body">
              <div
                className="pos-pay-grid"
                style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 14 }}
              >
                <button
                  type="button"
                  className={`pos-pay ${tesourariaTipo === "sangria" ? "is-active" : ""}`}
                  onClick={() => setTesourariaTipo("sangria")}
                >
                  <ArrowDownToLine className="w-4 h-4" /> Sangria (retirar p/
                  cofre)
                </button>
                <button
                  type="button"
                  className={`pos-pay ${tesourariaTipo === "suprimento" ? "is-active" : ""}`}
                  onClick={() => setTesourariaTipo("suprimento")}
                >
                  <ArrowUpFromLine className="w-4 h-4" /> Suprimento (reforçar
                  troco)
                </button>
              </div>
              <div className="pos-field">
                <label className="pos-label" htmlFor="pos-treasury-drawer">
                  {tesourariaTipo === "sangria"
                    ? "Gaveta de origem"
                    : "Gaveta de destino"}
                </label>
                <select
                  id="pos-treasury-drawer"
                  className="pos-input"
                  value={tesourariaGaveta}
                  onChange={(event) => setTesourariaGaveta(event.target.value)}
                >
                  {gavetas
                    .filter(
                      (gaveta) =>
                        gaveta.tipo !== "cofre" && gaveta.tipo !== "documentos",
                    )
                    .map((gaveta) => (
                      <option key={gaveta.id} value={gaveta.id}>
                        {gaveta.nome} ·{" "}
                        {formatCurrency(gaveta.saldo, config.moeda)}
                      </option>
                    ))}
                </select>
              </div>
              <div className="pos-field">
                <label className="pos-label" htmlFor="pos-treasury-value">
                  Valor
                </label>
                <div className="pos-input-group">
                  <span className="pos-input-group__addon">{config.moeda}</span>
                  <input
                    id="pos-treasury-value"
                    type="text"
                    inputMode="decimal"
                    className="pos-input pos-input--money"
                    value={
                      tesourariaValor === "" ? "" : String(tesourariaValor)
                    }
                    onChange={(event) => {
                      const raw = event.target.value.replace(/[^0-9.,]/g, "");
                      setTesourariaValor(
                        raw === "" ? "" : Number(raw.replace(",", ".")),
                      );
                    }}
                    onFocus={(event) => event.target.select()}
                    placeholder="0,00"
                    data-testid="input-pos-treasury-value"
                  />
                  <button
                    type="button"
                    className="pos-input-group__addon"
                    style={{
                      borderRight: "none",
                      borderLeft: "1px solid #d7dce3",
                      cursor: "pointer",
                      background: "#eaf3ff",
                      color: "#1577EB",
                    }}
                    onClick={() => openKeypad("sangria")}
                    aria-label="Abrir teclado numérico"
                  >
                    <Calculator className="w-4 h-4" />
                  </button>
                </div>
                <div className="pos-quick">
                  {[1000, 5000, 10000, 25000].map((valor) => (
                    <button
                      key={valor}
                      type="button"
                      onClick={() => setTesourariaValor(valor)}
                    >
                      {valor.toLocaleString("pt-PT")}
                    </button>
                  ))}
                </div>
              </div>
              <div className="pos-field">
                <label className="pos-label" htmlFor="pos-treasury-reason">
                  Motivo (obrigatório)
                </label>
                <input
                  id="pos-treasury-reason"
                  className="pos-input"
                  value={tesourariaMotivo}
                  onChange={(event) => setTesourariaMotivo(event.target.value)}
                  placeholder={
                    tesourariaTipo === "sangria"
                      ? "Ex.: excesso de numerário na gaveta"
                      : "Ex.: reforço de troco para o turno da tarde"
                  }
                  data-testid="input-pos-treasury-reason"
                />
              </div>
              <div className="pos-summary" style={{ margin: 0 }}>
                <div className="pos-summary__row">
                  <span>Esperado nas gavetas após a operação</span>
                  <strong>
                    {formatCurrency(
                      Math.max(
                        0,
                        expectedCash +
                          (tesourariaTipo === "suprimento" ? 0 : 0),
                      ),
                      config.moeda,
                    )}
                  </strong>
                </div>
                <div className="pos-summary__row">
                  <span>Esperado no cofre</span>
                  <strong>{formatCurrency(expectedCofre, config.moeda)}</strong>
                </div>
              </div>
              <p className="pos-note">
                Sangrias e suprimentos não alteram a facturação; apenas
                movimentam numerário entre gavetas e cofre e ficam registados no
                relatório Z com operador, hora e motivo.
              </p>
            </div>
            <div className="pos-modal__footer">
              <button
                type="button"
                className="pos-btn"
                onClick={() => setShowTesouraria(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="pos-btn pos-btn--primary"
                onClick={confirmarTesouraria}
                data-testid="button-pos-confirm-treasury"
              >
                <Check className="w-4 h-4" /> Registar{" "}
                {tesourariaTipo === "sangria" ? "sangria" : "suprimento"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== motivo de abertura de gaveta ===== */}
      {drawerModal && (
        <div
          className="pos-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Abrir gaveta"
        >
          <div className="pos-modal__panel">
            <div className="pos-modal__header">
              <h3 className="pos-modal__title">
                <Unlock className="w-4 h-4 inline mr-2 align-[-2px]" />
                Abrir{" "}
                {gavetas.find((gaveta) => gaveta.id === drawerModal)?.nome}
              </h3>
              <button
                type="button"
                className="pos-modal__close"
                onClick={() => setDrawerModal(null)}
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="pos-modal__body">
              <p
                style={{
                  margin: "0 0 12px",
                  fontSize: 13,
                  color: "#8a919c",
                  lineHeight: 1.6,
                }}
              >
                Todas as aberturas de gaveta ficam registadas com operador, hora
                e motivo. O comando é enviado por ESC/POS (canal{" "}
                {gavetas.find((gaveta) => gaveta.id === drawerModal)?.canal})
                quando o hardware está ligado.
              </p>
              <div className="pos-field">
                <label className="pos-label" htmlFor="pos-drawer-reason">
                  Motivo da abertura *
                </label>
                <select
                  id="pos-drawer-reason"
                  className="pos-input"
                  value={drawerMotivo}
                  onChange={(event) => setDrawerMotivo(event.target.value)}
                  data-testid="select-pos-drawer-reason"
                >
                  {MOTIVOS_GAVETA.map((motivo) => (
                    <option key={motivo} value={motivo}>
                      {motivo}
                    </option>
                  ))}
                </select>
              </div>
              {drawerMotivo === "Outro motivo" && (
                <div className="pos-field">
                  <label className="pos-label" htmlFor="pos-drawer-note">
                    Descreva o motivo
                  </label>
                  <input
                    id="pos-drawer-note"
                    className="pos-input"
                    value={drawerNota}
                    onChange={(event) => setDrawerNota(event.target.value)}
                    placeholder="Ex.: retirada de notas danificadas"
                  />
                </div>
              )}
              <div className="pos-summary" style={{ margin: 0 }}>
                <div className="pos-summary__row">
                  <span>Estado actual</span>
                  <strong>{dispositivos["gaveta-dinheiro"]?.estado}</strong>
                </div>
                <div className="pos-summary__row">
                  <span>Ligação</span>
                  <strong>
                    {dispositivos["gaveta-dinheiro"]?.porta || "Modo simulado"}
                  </strong>
                </div>
                <div className="pos-summary__row">
                  <span>Aberturas neste turno</span>
                  <strong>
                    {gavetas.find((gaveta) => gaveta.id === drawerModal)
                      ?.aberturas || 0}
                  </strong>
                </div>
              </div>
            </div>
            <div className="pos-modal__footer">
              <button
                type="button"
                className="pos-btn"
                onClick={() => setDrawerModal(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="pos-btn pos-btn--primary"
                onClick={confirmarAberturaGaveta}
                data-testid="button-pos-confirm-drawer"
              >
                <Unlock className="w-4 h-4" /> Abrir gaveta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== dispositivos e periféricos ===== */}
      {showDevices && (
        <div
          className="pos-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Dispositivos"
        >
          <div className="pos-modal__panel pos-modal__panel--wide">
            <div className="pos-modal__header">
              <h3 className="pos-modal__title">
                <Plug className="w-4 h-4 inline mr-2 align-[-2px]" />
                Dispositivos e periféricos do posto
              </h3>
              <button
                type="button"
                className="pos-modal__close"
                onClick={() => setShowDevices(false)}
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="pos-tabs">
              {(
                [
                  { id: "perifericos", label: "Periféricos" },
                  { id: "leitura", label: "Leitura & Pagamento" },
                  { id: "preferencias", label: "Preferências" },
                  { id: "log", label: `Registo (${deviceLog.length})` },
                ] as const
              ).map((tab) => (
                <button
                  type="button"
                  key={tab.id}
                  className={`pos-tab ${deviceTab === tab.id ? "is-active" : ""}`}
                  onClick={() => setDeviceTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="pos-modal__body">
              {deviceTab === "perifericos" &&
                DISPOSITIVOS_CATALOGO.filter(
                  (item) =>
                    item.categoria === "Caixa" ||
                    item.categoria === "Atendimento",
                ).map((item) => {
                  const estado = dispositivos[item.id] || {
                    estado: "simulado" as EstadoDispositivo,
                  };
                  const Icone = item.icon;
                  return (
                    <div className="pos-dev" key={item.id}>
                      <span className="pos-dev__icon">
                        <Icone className="w-5 h-5" />
                      </span>
                      <div className="pos-dev__body">
                        <div className="pos-dev__name">
                          {item.nome}
                          <span
                            className={`pos-status ${estado.estado === "conectado" ? "pos-status--ok" : estado.estado === "erro" ? "pos-status--erro" : estado.estado === "desconectado" ? "" : "pos-status--warn"}`}
                          >
                            {estado.estado}
                          </span>
                        </div>
                        <div className="pos-dev__desc">{item.descricao}</div>
                        {estado.detalhe && (
                          <div
                            className="pos-dev__desc"
                            style={{ color: "#5b6470" }}
                          >
                            <Gauge className="w-3 h-3 inline align-[-2px] mr-1" />
                            {estado.detalhe}
                          </div>
                        )}
                        <div className="pos-dev__actions">
                          <button
                            type="button"
                            className="pos-btn pos-btn--sm"
                            onClick={() => testarDispositivo(item.id)}
                          >
                            <Zap className="w-3.5 h-3.5" /> Testar
                          </button>
                          {item.serial && estado.estado !== "conectado" && (
                            <button
                              type="button"
                              className="pos-btn pos-btn--sm pos-btn--primary"
                              onClick={() => void conectarSerial(item.id)}
                            >
                              <Usb className="w-3.5 h-3.5" /> Ligar porta
                            </button>
                          )}
                          {item.serial && estado.estado === "conectado" && (
                            <button
                              type="button"
                              className="pos-btn pos-btn--sm pos-btn--danger"
                              onClick={() => void desconectarSerial(item.id)}
                            >
                              <X className="w-3.5 h-3.5" /> Desligar
                            </button>
                          )}
                          {item.id === "gaveta-dinheiro" && (
                            <button
                              type="button"
                              className="pos-btn pos-btn--sm"
                              onClick={() => {
                                setDrawerMotivo("Verificação de numerário");
                                setDrawerModal("gaveta-principal");
                              }}
                            >
                              <Unlock className="w-3.5 h-3.5" /> Abrir gaveta
                              principal
                            </button>
                          )}
                          {item.id === "cofre-inteligente" && (
                            <button
                              type="button"
                              className="pos-btn pos-btn--sm"
                              onClick={() => {
                                setTesourariaTipo("sangria");
                                setShowTesouraria(true);
                              }}
                            >
                              <ArrowDownToLine className="w-3.5 h-3.5" />{" "}
                              Sangria
                            </button>
                          )}
                          {item.id === "display-cliente" && (
                            <button
                              type="button"
                              className="pos-btn pos-btn--sm"
                              onClick={abrirDisplayCliente}
                              data-testid="button-pos-open-display"
                            >
                              <Monitor className="w-3.5 h-3.5" />{" "}
                              {displayAberto
                                ? "Reabrir janela"
                                : "Abrir display"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

              {deviceTab === "leitura" && (
                <>
                  {DISPOSITIVOS_CATALOGO.filter(
                    (item) =>
                      item.categoria === "Leitura" ||
                      item.categoria === "Pagamento",
                  ).map((item) => {
                    const estado = dispositivos[item.id] || {
                      estado: "simulado" as EstadoDispositivo,
                    };
                    const Icone = item.icon;
                    return (
                      <div className="pos-dev" key={item.id}>
                        <span className="pos-dev__icon">
                          <Icone className="w-5 h-5" />
                        </span>
                        <div className="pos-dev__body">
                          <div className="pos-dev__name">
                            {item.nome}
                            <span
                              className={`pos-status ${estado.estado === "conectado" ? "pos-status--ok" : estado.estado === "erro" ? "pos-status--erro" : "pos-status--warn"}`}
                            >
                              {estado.estado}
                            </span>
                          </div>
                          <div className="pos-dev__desc">{item.descricao}</div>
                          {estado.detalhe && (
                            <div
                              className="pos-dev__desc"
                              style={{ color: "#5b6470" }}
                            >
                              {estado.detalhe}
                            </div>
                          )}
                          <div className="pos-dev__actions">
                            <button
                              type="button"
                              className="pos-btn pos-btn--sm"
                              onClick={() => testarDispositivo(item.id)}
                            >
                              <Zap className="w-3.5 h-3.5" /> Testar
                            </button>
                            {item.serial && estado.estado !== "conectado" && (
                              <button
                                type="button"
                                className="pos-btn pos-btn--sm pos-btn--primary"
                                onClick={() => void conectarSerial(item.id)}
                              >
                                <Usb className="w-3.5 h-3.5" /> Ligar porta
                              </button>
                            )}
                            {item.id === "leitor-qr" && (
                              <button
                                type="button"
                                className="pos-btn pos-btn--sm"
                                onClick={() => setShowScanner(true)}
                              >
                                <Camera className="w-3.5 h-3.5" /> Abrir câmara
                                (F8)
                              </button>
                            )}
                            {item.id === "balanca" && (
                              <button
                                type="button"
                                className="pos-btn pos-btn--sm"
                                onClick={() => {
                                  setPesoLido("");
                                  setShowScale(true);
                                  void lerBalanca();
                                }}
                              >
                                <Scale className="w-3.5 h-3.5" /> Ler peso
                              </button>
                            )}
                            {item.id === "tpa" && (
                              <button
                                type="button"
                                className="pos-btn pos-btn--sm"
                                onClick={() => void pedirTPA()}
                                disabled={tpaBusy}
                              >
                                <CreditCard className="w-3.5 h-3.5" />{" "}
                                {tpaBusy ? "A comunicar..." : "Pedir pagamento"}
                              </button>
                            )}
                          </div>
                          {item.id === "leitor-codigo-barras" && (
                            <div className="pos-dev__extra">
                              <p className="pos-note" style={{ marginTop: 0 }}>
                                O leitor funciona como teclado: coloque o foco
                                na pesquisa (F2) e leia o código. O sufixo Enter
                                adiciona automaticamente o artigo ao carrinho.
                                Códigos desconhecidos são reportados no ecrã.
                              </p>
                              <button
                                type="button"
                                className="pos-btn pos-btn--sm"
                                onClick={() => {
                                  setShowDevices(false);
                                  searchRef.current?.focus();
                                }}
                              >
                                <Keyboard className="w-3.5 h-3.5" /> Activar
                                entrada do leitor
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {deviceTab === "preferencias" && (
                <>
                  <label className="pos-switch" style={{ marginBottom: 12 }}>
                    <input
                      type="checkbox"
                      checked={autoKick}
                      onChange={(event) => setAutoKick(event.target.checked)}
                      data-testid="switch-pos-auto-kick"
                    />
                    Abrir automaticamente a gaveta em vendas com numerário
                    (troco)
                  </label>
                  <label className="pos-switch" style={{ marginBottom: 12 }}>
                    <input
                      type="checkbox"
                      checked={autoPrint}
                      onChange={(event) => setAutoPrint(event.target.checked)}
                      data-testid="switch-pos-auto-print"
                    />
                    Imprimir automaticamente o talão térmico após cada venda
                  </label>
                  <label className="pos-switch" style={{ marginBottom: 12 }}>
                    <input
                      type="checkbox"
                      checked={imprimirAbertura}
                      onChange={(event) =>
                        setImprimirAbertura(event.target.checked)
                      }
                    />
                    Imprimir relatório de abertura e abrir a gaveta ao abrir
                    caixa
                  </label>
                  <label className="pos-switch" style={{ marginBottom: 12 }}>
                    <input
                      type="checkbox"
                      checked={imprimirFecho}
                      onChange={(event) =>
                        setImprimirFecho(event.target.checked)
                      }
                    />
                    Imprimir relatório Z no fecho de caixa
                  </label>
                  <label className="pos-switch" style={{ marginBottom: 12 }}>
                    <input
                      type="checkbox"
                      checked={somActivo}
                      onChange={(event) => {
                        setSomActivo(event.target.checked);
                        marcarDispositivo("sinalizador", {
                          estado: event.target.checked
                            ? "conectado"
                            : "desconectado",
                          detalhe: event.target.checked
                            ? "Sinalizador activo"
                            : "Sinalizador silenciado",
                        });
                      }}
                      data-testid="switch-pos-sound"
                    />
                    Sinalizador sonoro (leituras, gaveta, pagamentos e vendas)
                  </label>
                  <div className="pos-field" style={{ marginTop: 16 }}>
                    <label className="pos-label">
                      Terminal e identificação fiscal
                    </label>
                    <div className="pos-breakdown">
                      <div className="row">
                        <span>Terminal de caixa</span>
                        <strong>{terminalCaixa}</strong>
                      </div>
                      <div className="row">
                        <span>Estabelecimento</span>
                        <strong>{nomeEmpresa}</strong>
                      </div>
                      <div className="row">
                        <span>NIF</span>
                        <strong>{nifEmpresa}</strong>
                      </div>
                      <div className="row">
                        <span>Moeda</span>
                        <strong>{config.moeda}</strong>
                      </div>
                      <div className="row">
                        <span>IVA</span>
                        <strong>{config.ivaTaxa || 0}%</strong>
                      </div>
                    </div>
                  </div>
                  <p className="pos-note">
                    As preferências ficam gravadas neste posto. Sem hardware
                    ligado, todos os periféricos trabalham em modo simulado para
                    que o fluxo de venda continue a poder ser testado de ponta a
                    ponta.
                  </p>
                </>
              )}

              {deviceTab === "log" && (
                <>
                  <div className="pos-log" data-testid="panel-pos-device-log">
                    {deviceLog.length === 0 && (
                      <div>Sem eventos registados nesta sessão.</div>
                    )}
                    {deviceLog.map((evento, index) => (
                      <div key={`${evento.em}-${index}`}>
                        <span>{evento.em}</span>
                        <span>[{evento.dispositivo}]</span>
                        <span className={evento.tipo}>{evento.evento}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button
                      type="button"
                      className="pos-btn pos-btn--sm"
                      onClick={() => setDeviceLog([])}
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Limpar registo
                    </button>
                    <button
                      type="button"
                      className="pos-btn pos-btn--sm"
                      onClick={() => setShowMovimentos(true)}
                    >
                      <List className="w-3.5 h-3.5" /> Movimentos de caixa
                    </button>
                  </div>
                </>
              )}
            </div>
            <div className="pos-modal__footer">
              <button
                type="button"
                className="pos-btn"
                onClick={() => setShowDevices(false)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== leitor QR / câmara ===== */}
      {showScanner && (
        <div
          className="pos-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Leitor QR e de códigos"
        >
          <div className="pos-modal__panel">
            <div className="pos-modal__header">
              <h3 className="pos-modal__title">
                <QrCode className="w-4 h-4 inline mr-2 align-[-2px]" />
                Leitor QR / código pela câmara
              </h3>
              <button
                type="button"
                className="pos-modal__close"
                onClick={() => setShowScanner(false)}
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="pos-modal__body">
              <video
                ref={videoRef}
                className="pos-cam"
                muted
                playsInline
                aria-label="Pré-visualização da câmara"
                data-testid="video-pos-camera"
              />
              {cameraErro && (
                <div
                  className="pos-alert pos-alert--closed"
                  style={{ marginTop: 12, marginBottom: 0 }}
                >
                  <span style={{ display: "flex", gap: 8 }}>
                    <AlertTriangle
                      className="w-4 h-4 shrink-0"
                      style={{ marginTop: 2 }}
                    />
                    {cameraErro}
                  </span>
                </div>
              )}
              {!cameraErro && (
                <p className="pos-note" style={{ marginTop: 10 }}>
                  Aponte a câmara para o QR ou código de barras. Formatos
                  suportados: QR Code, Data Matrix, EAN-13, EAN-8, UPC-A/E, Code
                  128 e Code 39. A leitura adiciona o artigo automaticamente.
                </p>
              )}
              <div className="pos-field" style={{ marginTop: 12 }}>
                <label className="pos-label" htmlFor="pos-manual-code">
                  Introduzir código manualmente
                </label>
                <div className="pos-input-group">
                  <span className="pos-input-group__addon">
                    <Barcode className="w-4 h-4" />
                  </span>
                  <input
                    id="pos-manual-code"
                    className="pos-input"
                    value={codigoManual}
                    onChange={(event) => setCodigoManual(event.target.value)}
                    placeholder="Código de barras, SKU ou código QR"
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" || !codigoManual.trim()) return;
                      const product = findProdutoByBarcodeOrCode(
                        codigoManual.trim(),
                      );
                      if (product) {
                        addToCart(product);
                        tocarSom("leitura", somActivo);
                        setCodigoManual("");
                        setShowScanner(false);
                        setFeedback({
                          type: "success",
                          text: `${product.nome} adicionado.`,
                        });
                      } else {
                        tocarSom("erro", somActivo);
                        setFeedback({
                          type: "error",
                          text: `Código "${codigoManual.trim()}" não encontrado no catálogo.`,
                        });
                      }
                    }}
                    data-testid="input-pos-manual-code"
                  />
                </div>
              </div>
              {onOpenScanner && (
                <button
                  type="button"
                  className="pos-btn pos-btn--sm"
                  onClick={() => {
                    setShowScanner(false);
                    onOpenScanner((product) => addToCart(product));
                  }}
                >
                  <Barcode className="w-4 h-4" /> Usar leitor de códigos externo
                </button>
              )}
            </div>
            <div className="pos-modal__footer">
              <button
                type="button"
                className="pos-btn"
                onClick={() => setShowScanner(false)}
              >
                Fechar
              </button>
              <button
                type="button"
                className="pos-btn pos-btn--primary"
                disabled={!codigoManual.trim()}
                onClick={() => {
                  const product = findProdutoByBarcodeOrCode(
                    codigoManual.trim(),
                  );
                  if (product) {
                    addToCart(product);
                    tocarSom("leitura", somActivo);
                    setCodigoManual("");
                    setShowScanner(false);
                    setFeedback({
                      type: "success",
                      text: `${product.nome} adicionado.`,
                    });
                  } else {
                    tocarSom("erro", somActivo);
                    setFeedback({
                      type: "error",
                      text: `Código "${codigoManual.trim()}" não encontrado no catálogo.`,
                    });
                  }
                }}
              >
                <Check className="w-4 h-4" /> Adicionar artigo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== balança ===== */}
      {showScale && (
        <div
          className="pos-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Balança electrónica"
        >
          <div className="pos-modal__panel">
            <div className="pos-modal__header">
              <h3 className="pos-modal__title">
                <Scale className="w-4 h-4 inline mr-2 align-[-2px]" />
                Balança electrónica
              </h3>
              <button
                type="button"
                className="pos-modal__close"
                onClick={() => setShowScale(false)}
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="pos-modal__body">
              <div className="pos-keypad__display">
                <small>Peso lido</small>
                <strong>
                  {typeof pesoLido === "number" ? pesoLido.toFixed(3) : "0,000"}{" "}
                  kg
                </strong>
              </div>
              <button
                type="button"
                className="pos-btn pos-btn--sm"
                onClick={() => void lerBalanca()}
                disabled={scaleBusy}
                data-testid="button-pos-read-scale"
              >
                <RefreshCw className="w-4 h-4" />{" "}
                {scaleBusy ? "A ler balança..." : "Ler novamente"}
              </button>
              <div className="pos-field" style={{ marginTop: 14 }}>
                <label className="pos-label" htmlFor="pos-scale-product">
                  Produto a pesar
                </label>
                <select
                  id="pos-scale-product"
                  className="pos-input"
                  value={scaleProduto}
                  onChange={(event) => setScaleProduto(event.target.value)}
                  data-testid="select-pos-scale-product"
                >
                  <option value="">
                    Seleccione um produto vendido ao peso...
                  </option>
                  {produtosPeso.map((product) => (
                    <option key={product.id} value={String(product.id)}>
                      {product.nome} ·{" "}
                      {formatCurrency(product.preco, config.moeda)}/
                      {formatUnit(product.unidadeMedida)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="pos-field">
                <label className="pos-label" htmlFor="pos-scale-manual">
                  Peso manual (se a balança falhar)
                </label>
                <input
                  id="pos-scale-manual"
                  type="text"
                  inputMode="decimal"
                  className="pos-input pos-input--money"
                  value={pesoLido === "" ? "" : String(pesoLido)}
                  onChange={(event) => {
                    const raw = event.target.value.replace(/[^0-9.,]/g, "");
                    setPesoLido(
                      raw === "" ? "" : Number(raw.replace(",", ".")),
                    );
                  }}
                  placeholder="0,000"
                />
              </div>
              <p className="pos-note">
                Estado: <strong>{dispositivos["balanca"]?.estado}</strong> —{" "}
                {dispositivos["balanca"]?.detalhe}. Sem hardware ligado, a
                leitura é simulada para permitir o fluxo completo de venda ao
                peso.
              </p>
            </div>
            <div className="pos-modal__footer">
              <button
                type="button"
                className="pos-btn"
                onClick={() => setShowScale(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="pos-btn pos-btn--primary"
                onClick={aplicarPeso}
                disabled={
                  !scaleProduto || typeof pesoLido !== "number" || pesoLido <= 0
                }
              >
                <Plus className="w-4 h-4" /> Adicionar ao carrinho
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== limpar carrinho ===== */}
      {confirmClear && (
        <div className="pos-modal" role="dialog" aria-modal="true">
          <div className="pos-modal__panel" style={{ maxWidth: 400 }}>
            <div className="pos-modal__header">
              <h3 className="pos-modal__title">Limpar venda actual</h3>
              <button
                type="button"
                className="pos-modal__close"
                onClick={() => setConfirmClear(false)}
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="pos-modal__body">
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: "#5b6470",
                  lineHeight: 1.6,
                }}
              >
                Vai remover {cart.length}{" "}
                {cart.length === 1 ? "artigo" : "artigos"} no valor de{" "}
                <strong>{formatCurrency(totals.total, config.moeda)}</strong>.
                Esta acção não pode ser anulada.
              </p>
            </div>
            <div className="pos-modal__footer">
              <button
                type="button"
                className="pos-btn"
                onClick={() => setConfirmClear(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="pos-btn pos-btn--danger"
                onClick={() => {
                  setCart([]);
                  setDiscountPercent("");
                  setDiscountAmount("");
                  setConfirmClear(false);
                  setFeedback({ type: "success", text: "Venda limpa." });
                }}
              >
                <Trash2 className="w-4 h-4" /> Limpar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== vendas pausadas ===== */}
      {showHeld && (
        <div
          className="pos-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Vendas pausadas"
        >
          <div className="pos-modal__panel pos-modal__panel--wide">
            <div className="pos-modal__header">
              <h3 className="pos-modal__title">
                <Pause className="w-4 h-4 inline mr-2 align-[-2px]" />
                Vendas pausadas ({heldSales.length})
              </h3>
              <button
                type="button"
                className="pos-modal__close"
                onClick={() => setShowHeld(false)}
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="pos-modal__body">
              {!activeSession && (
                <div
                  className="pos-alert pos-alert--closed"
                  style={{ marginTop: 0 }}
                >
                  <span style={{ display: "flex", gap: 8 }}>
                    <Lock
                      className="w-4 h-4 shrink-0"
                      style={{ marginTop: 2 }}
                    />
                    A caixa está fechada: abra um turno para retomar e cobrar
                    estas vendas.
                  </span>
                </div>
              )}
              {heldSales.length === 0 ? (
                <div className="pos-empty">
                  <Pause className="w-10 h-10" />
                  Não existem vendas pausadas.
                </div>
              ) : (
                heldSales.map((held, index) => {
                  const heldTotal = held.cart.reduce(
                    (sum, line) => sum + line.quantity * line.product.preco,
                    0,
                  );
                  const heldName =
                    held.cliente.consumidorFinal && !held.cliente.nif.trim()
                      ? NOME_CONSUMIDOR_FINAL
                      : held.cliente.nome;
                  return (
                    <div className="pos-held" key={held.id}>
                      <div style={{ minWidth: 0 }}>
                        <div className="pos-held__name">
                          Venda #{heldSales.length - index} · {heldName}
                        </div>
                        <div className="pos-held__meta">
                          {held.cart.length}{" "}
                          {held.cart.length === 1 ? "artigo" : "artigos"} ·{" "}
                          {formatCurrency(heldTotal, config.moeda)} · pausada{" "}
                          {held.savedAt}
                        </div>
                        <div
                          className="pos-held__meta"
                          style={{ marginTop: 2 }}
                        >
                          {held.cart
                            .slice(0, 3)
                            .map((line) => line.product.nome)
                            .join(", ")}
                          {held.cart.length > 3
                            ? ` +${held.cart.length - 3}`
                            : ""}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button
                          type="button"
                          className="pos-btn pos-btn--sm pos-btn--primary"
                          onClick={() => restoreHeld(held)}
                        >
                          <Play className="w-3.5 h-3.5" /> Retomar
                        </button>
                        <button
                          type="button"
                          className="pos-btn pos-btn--sm pos-btn--danger"
                          onClick={() =>
                            setHeldSales((prev) =>
                              prev.filter((item) => item.id !== held.id),
                            )
                          }
                          aria-label="Eliminar venda pausada"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="pos-modal__footer">
              <button
                type="button"
                className="pos-btn"
                onClick={() => setShowHeld(false)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== novo cliente ===== */}
      {showNovoClienteModal && (
        <div
          className="pos-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Cadastrar novo cliente"
        >
          <div className="pos-modal__panel">
            <div className="pos-modal__header">
              <h3 className="pos-modal__title">
                <UserPlus className="w-4 h-4 inline mr-2 align-[-2px]" />
                Cadastrar Novo Cliente
              </h3>
              <button
                type="button"
                className="pos-modal__close"
                onClick={() => setShowNovoClienteModal(false)}
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateCustomer} className="pos-modal__body">
              <div className="pos-field">
                <label className="pos-label" htmlFor="pos-new-nome">
                  Nome Completo *
                </label>
                <input
                  id="pos-new-nome"
                  required
                  autoFocus
                  value={novoCliNome}
                  onChange={(e) => setNovoCliNome(e.target.value)}
                  placeholder="Nome do cliente ou empresa..."
                  className="pos-input"
                />
              </div>
              <div className="pos-field">
                <label className="pos-label" htmlFor="pos-new-nif">
                  NIF / BI
                </label>
                <input
                  id="pos-new-nif"
                  value={novoCliNif}
                  onChange={(e) => setNovoCliNif(e.target.value)}
                  placeholder="Ex: 5417082910"
                  className="pos-input"
                  style={{
                    fontFamily: "ui-monospace,Menlo,Consolas,monospace",
                  }}
                />
              </div>
              <div className="pos-field">
                <label className="pos-label" htmlFor="pos-new-tel">
                  Telefone
                </label>
                <input
                  id="pos-new-tel"
                  value={novoCliTel}
                  onChange={(e) => setNovoCliTel(e.target.value)}
                  placeholder="+244 9XX XXX XXX"
                  className="pos-input"
                />
              </div>
              <div className="pos-field">
                <label className="pos-label" htmlFor="pos-new-end">
                  Morada
                </label>
                <input
                  id="pos-new-end"
                  value={novoCliEnd}
                  onChange={(e) => setNovoCliEnd(e.target.value)}
                  placeholder="Ex: Luanda, Maianga"
                  className="pos-input"
                />
              </div>
              <div
                className="pos-modal__footer"
                style={{ padding: 0, marginTop: 14 }}
              >
                <button
                  type="button"
                  className="pos-btn"
                  onClick={() => setShowNovoClienteModal(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="pos-btn pos-btn--primary">
                  Salvar e Selecionar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== teclado numérico ===== */}
      {keypadTarget && (
        <Keypad
          label={keypadLabel}
          value={keypadBuffer}
          currency={config.moeda}
          onChange={applyKeypad}
          onClose={() => setKeypadTarget(null)}
        />
      )}

      {/* ===== venda concluída ===== */}
      {completedSale && (
        <div
          className="pos-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pos-sale-success-title"
        >
          <div className="pos-modal__panel">
            <div className="pos-success">
              <div className="pos-success__icon">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3
                className="pos-modal__title"
                id="pos-sale-success-title"
                style={{ fontSize: 18 }}
              >
                Venda emitida com sucesso
              </h3>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "#8a919c" }}>
                Factura Recibo{" "}
                <strong
                  style={{
                    fontFamily: "ui-monospace,Menlo,Consolas,monospace",
                    color: "#2f3640",
                  }}
                >
                  {completedSale.numero}
                </strong>
              </p>
              <p className="pos-success__total" style={{ margin: "14px 0 0" }}>
                {formatCurrency(completedSale.total, config.moeda)}
              </p>
              {completedSale.troco > 0 && (
                <p
                  style={{
                    margin: "8px 0 0",
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#155724",
                  }}
                >
                  Troco a devolver:{" "}
                  {formatCurrency(completedSale.troco, config.moeda)}
                </p>
              )}
              <div className="pos-summary">
                <div className="pos-summary__row">
                  <span>Cliente</span>
                  <strong>
                    {completedSale.fatura.clienteNome}
                    {completedSale.fatura.clienteNif
                      ? ` · NIF ${completedSale.fatura.clienteNif}`
                      : " · não é cliente"}
                  </strong>
                </div>
                <div className="pos-summary__row">
                  <span>Pagamento</span>
                  <strong>{completedSale.fatura.formaPagamento}</strong>
                </div>
                <div className="pos-summary__row">
                  <span>Artigos</span>
                  <strong>{completedSale.fatura.linhas.length}</strong>
                </div>
                <div className="pos-summary__row">
                  <span>Estado</span>
                  <strong>{completedSale.fatura.estado}</strong>
                </div>
                <div className="pos-summary__row">
                  <span>Caixa / terminal</span>
                  <strong>
                    {completedSale.fatura.terminalCaixa || terminalCaixa}
                  </strong>
                </div>
              </div>
            </div>
            <div
              className="pos-modal__footer"
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}
            >
              <button
                type="button"
                className="pos-btn"
                onClick={() =>
                  downloadFatura(
                    generateFaturaHTML(completedSale.fatura, config, {
                      termica: true,
                    }),
                    `${completedSale.numero}_termica`,
                  )
                }
                data-testid="button-pos-print-receipt"
              >
                <Printer className="w-4 h-4" /> Talão
              </button>
              <button
                type="button"
                className="pos-btn"
                onClick={() =>
                  downloadFatura(
                    generateFaturaHTML(completedSale.fatura, config, {
                      termica: false,
                    }),
                    completedSale.numero,
                  )
                }
              >
                <Receipt className="w-4 h-4" /> A4
              </button>
              <button
                type="button"
                className="pos-btn pos-btn--primary"
                onClick={closeCompletedSale}
                data-testid="button-pos-new-sale"
              >
                <Plus className="w-4 h-4" /> Nova venda
              </button>
            </div>
            <div
              style={{
                padding: "0 20px 20px",
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              <button
                type="button"
                className="pos-btn pos-btn--sm"
                onClick={() => {
                  setDrawerMotivo("Troco a cliente");
                  setDrawerModal(
                    change > 0 ? "gaveta-troco" : "gaveta-principal",
                  );
                }}
              >
                <Unlock className="w-3.5 h-3.5" /> Abrir gaveta novamente
              </button>
              <button
                type="button"
                className="pos-btn pos-btn--sm"
                onClick={() =>
                  publicarDisplay({
                    mensagem: "Obrigado pela sua preferência!",
                  })
                }
              >
                <Monitor className="w-3.5 h-3.5" /> Mensagem no display
              </button>
              <button
                type="button"
                className="pos-btn pos-btn--sm"
                onClick={imprimirTeste}
              >
                <Printer className="w-3.5 h-3.5" /> Testar impressora
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POSView;
