import type { InsuranceSelection } from "@workspace/api-zod";
export type DocumentType =
  | "factura"
  | "factura-recibo"
  | "factura-global"
  | "pro-forma"
  | "nota-credito"
  | "recibo";

export type DocumentState = "rascunho" | "emitida" | "paga" | "anulada";

export interface LinhaFatura {
  originActIndex?: number;
  id?: string;
  produtoId?: number;
  codigo?: string;
  descricao: string;
  quantidade: number;
  precoUnitario: number;
  ivaIsento: boolean;
  unidade?: string;
  lote?: string;
  dataValidade?: string;
  baseLiquida?: number;
  ivaValor?: number;
}

export interface FormaPagamentoItem {
  id: string;
  forma: string;
  valor: number;
  valorRecebido?: number;
  referencia?: string;
}

export interface Fatura {
  agtMode?: "homologacao_oficial" | "formacao_local";
  agtStatus?: string;
  agtCanCorrect?: boolean;
  agtReplacementNo?: string;
  agtCorrection?: { documentNo: string; invoiceId: number };
  emitenteSnapshot?: { nif?: string; [key: string]: unknown };
  finalizarProforma?: boolean;
  proformaFinalizada?: boolean;
  dataDisponibilizacao?: string;
  opcoesDocumento?: {
    observacoesLivres: string;
    referenciaExterna: string;
    transporte: boolean;
    localCarga: string;
    moradaCarga: string;
    dataHoraCarga: string;
    localDescarga: string;
    moradaDescarga: string;
    dataHoraDescarga: string;
    matriculaVeiculo: string;
    incluirPrecosTransporte: boolean;
  };
  insurance?: InsuranceSelection | null;
  receivableBalance?: number;
  cashReceived?: number;
  insured?: boolean;
  id: number;
  numero: string;
  serie: string;
  data: string; // DD/MM/AAAA
  horaOperacao?: string; // HH:MM:SS
  dataVencimento: string; // DD/MM/AAAA
  clienteNome: string;
  clienteNif?: string;
  clienteEndereco?: string;
  clienteTelefone?: string;
  clienteEmail?: string;
  linhas: LinhaFatura[];
  subtotalSemIva: number;
  totalIva: number;
  ivaTaxa: number;
  desconto?: number;
  descontoValor?: number;
  total: number;
  estado: DocumentState;
  observacoes: string;
  pacienteId?: number;
  emitidoPor?: string;
  tipoDocumento: DocumentType;
  formaPagamento?: string;
  formasPagamentoDetalhe?: FormaPagamentoItem[];
  facturaPremiada?: boolean;
  hashAnterior?: string;
  codigoHash?: string;
  documentoOrigem?: string; // e.g. For credit notes, references FT A/2026/001
  motivoAnulacaoOuCredito?: string;
  emissaoContagem?: number;
  caixaSessaoId?: string;
  terminalCaixa?: string;
}

export interface LoteItem {
  id: string;
  numeroLote: string;
  dataFabricacao?: string;
  dataValidade: string; // DD/MM/AAAA or YYYY-MM-DD
  quantidade: number;
  precoCusto?: number;
  fornecedor?: string;
}

export interface Produto {
  id: number;
  codigo: string; // SKU or internal code
  codigoBarras?: string; // EAN-13 / Code128 barcode
  nome: string;
  descricao?: string;
  categoria: string;
  preco: number; // Preço de venda
  precoCusto?: number; // Preço de compra/custo
  stock: number;
  stockMinimo: number;
  unidadeMedida: string; // un, cx, kg, l, fr, etc.
  localizacao?: string; // Armazém A, Prateleira 3
  dataValidade?: string; // Data mais próxima do lote ativo
  loteAtual?: string;
  lotes?: LoteItem[];
  ivaIsento: boolean;
  ativo: boolean;
  fornecedorPadrao?: string;
  criadoEm?: string;
}

export type TipoMovimento =
  | "entrada"
  | "saida"
  | "ajuste"
  | "perda"
  | "validade"
  | "devolucao";

export interface MovimentoStock {
  id: string;
  data: string; // DD/MM/AAAA
  hora: string; // HH:MM:SS
  produtoId: number;
  produtoNome: string;
  produtoCodigo: string;
  tipo: TipoMovimento;
  quantidade: number; // Positive number
  stockAnterior: number;
  stockAtual: number;
  lote?: string;
  dataValidade?: string;
  motivo: string;
  referenciaDocumento?: string; // e.g. FT A/2026/001, AJ-001
  usuario: string;
  valorUnitario?: number;
  valorTotal?: number;
}

export interface PacienteCliente {
  id: number;
  nome: string;
  nif?: string;
  bi?: string;
  passaporte?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  observacoes?: string;
  criadoEm?: string;
}

export type TipoConexaoImpressora =
  | "usb"
  | "rede_tcp"
  | "serial_com"
  | "bluetooth"
  | "browser_spool";

export type LarguraPapelTermico = "80mm" | "58mm" | "72mm";

export type ProtocoloImpressora =
  | "esc_pos"
  | "tspl_etiquetas"
  | "fiscal_agt_direto"
  | "generic_raw";

export interface PerfilImpressoraTermica {
  id: string;
  nome: string;
  modelo: string;
  tipoConexao: TipoConexaoImpressora;
  enderecoIp?: string;
  portaTcp?: number;
  portaSerial?: string;
  baudRate?: number;
  larguraPapel: LarguraPapelTermico;
  colunas: number;
  protocolo: ProtocoloImpressora;
  padrao: boolean;
  ativo: boolean;
  cortarPapel: boolean;
  abrirGaveta: boolean;
  imprimirLogotipo: boolean;
  imprimirQrCodeFiscal: boolean;
  imprimirCodigoBarras: boolean;
  viasImpressao: number;
  densidadeImpressao: "claro" | "normal" | "escuro";
  rodapePersonalizado?: string;
  localizacaoSetor?: string;
}

export interface ConfiguracaoFiscalAGT {
  softwareCertificadoNumero: string; // PENDENTE_AGT até atribuição oficial
  softwareVersao: string; // e.g. "v2.5.0-PRO"
  softwareNome: string; // e.g. "PharmaStock Fiscal Core"
  chaveVersao: string; // e.g. "1.0"
  regimeIva: string; // "Regime Geral" | "Regime Simplificado" | "Regime de Exclusão"
  motivoIsencaoPadrao: string;
  terminalCaixa: string; // "POS-01"
  incluirMencaoDispensaAGT: boolean;
  exigirNifObrigatorioAcimaDe: number;
  validarHashAssinatura: boolean;
  comunicacaoSaftAtiva: boolean;
  emailContabilidadeSaft?: string;
  codigoValidacaoHash?: string;
}

export interface ConfigSistema {
  calculoFiscalAGT?: boolean;
  ambiente?: "homologacao" | "producao";
  formacaoAtiva?: boolean;
  producaoFiscalAtiva?: boolean;
  nomeClinica: string;
  logoDataUrl?: string;
  nif: string;
  endereco: string;
  telefone: string;
  email: string;
  serie: string;
  moeda: string;
  ivaTaxa: number;
  regimeIva?: string; // "Regime Geral" | "Regime Simplificado" | "Regime de Exclusão"
  bancoNome?: string;
  bancoIban?: string;
  bancoSwift?: string;
  bancoConta?: string;
  alertaDiasValidade: number; // Dias antes da validade para alertar (default: 30)
  alertaStockBaixo: boolean;
  sonsScanner: boolean;
  formatoImpressaoPadrao: "a4" | "termica";
  mensagemRodape?: string;
  perfisImpressoras?: PerfilImpressoraTermica[];
  configuracaoFiscal?: ConfiguracaoFiscalAGT;
  caixaSessaoAtual?: CaixaSessao;
  historicoCaixa?: CaixaSessao[];
}

export interface CaixaSessao {
  id: string;
  terminal: string;
  operador: string;
  abertaEm: string;
  fundoInicial: number;
  estado: "aberta" | "fechada";
  fechadaEm?: string;
  valorEsperado?: number;
  valorContado?: number;
  diferenca?: number;
}

export interface Notificacao {
  id: string;
  tipo:
    | "validade_expirada"
    | "validade_proxima"
    | "stock_baixo"
    | "fatura_vencida"
    | "sistema";
  titulo: string;
  mensagem: string;
  data: string;
  hora: string;
  lida: boolean;
  produtoId?: number;
  faturaId?: number;
  urgencia: "alta" | "media" | "baixa";
}

export interface ConsumoMensalData {
  mes: string; // e.g. "Jan", "Fev", "Mar"
  mesAno: string; // "01/2026"
  quantidadeVendida: number;
  quantidadeEntrada: number;
  quantidadePerdas: number;
  faturacaoTotal: number;
  custoTotal: number;
  lucroEstimado: number;
}

export type NivelAcesso = "admin" | "operador" | "auditor";

export interface UsuarioSistema {
  id: string;
  nome: string;
  username: string;
  email?: string;
  cargo: string;
  role: NivelAcesso;
  pin: string; // PIN de 4 dígitos para autorização rápida
  ativo: boolean;
  avatarColor?: string;
  criadoEm: string;
  ultimoAcesso?: string;
}

export interface PermissaoMatrizItem {
  modulo: string;
  descricao: string;
  admin: boolean;
  operador: boolean;
  auditor: boolean;
}

export interface KitItemComponente {
  produtoId?: number;
  produtoCodigo: string;
  produtoNome: string;
  quantidade: number;
  precoUnitario: number;
  unidade?: string;
  categoria?: string;
  ivaIsento?: boolean;
}

export interface KitProduto {
  revision?: number;
  id: string;
  codigo: string; // ex: KIT-MIC-PREV, KIT-AUTOCLAVE, KIT-MON-VIT
  nome: string; // Nome do Procedimento / Kit
  descricao: string;
  categoria: string; // "Manutenção & Calibração", "Procedimentos Laboratoriais", "Bloco Cirúrgico", "Diagnóstico por Imagem", "Instalação & Revisão", "Treinamento & Protocolos"
  itens: KitItemComponente[];
  precoTotalCalculado: number; // Soma de cada item * quantidade
  precoVendaKit: number; // Preço promocional do Kit (pode ter desconto em pacote)
  descontoPercentual?: number; // % economia calculada
  ativo: boolean;
  criadoEm?: string;
  observacoes?: string;
}

export interface BillingExtra {
  ambiente?: string;
  emitenteSnapshot?: ConfigSistema;
  printCount?: number;
  motivoIsencao?: string;
}
