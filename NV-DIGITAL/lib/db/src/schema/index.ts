import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  numeric,
  jsonb,
  uuid,
  timestamp,
} from "drizzle-orm/pg-core";

// ── Empresas ─────────────────────────────────────────────────────────────────
export const empresasTable = pgTable("empresas", {
  id: uuid("id").defaultRandom().primaryKey(),
  nome: text("nome").notNull(),
  nif: text("nif").notNull().default(""),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  ativo: boolean("ativo").notNull().default(true),
  modulos: jsonb("modulos")
    .$type<string[]>()
    .notNull()
    .default(["laboratorial"]),
  parentEmpresaId: uuid("parent_empresa_id").references(
    (): any => empresasTable.id,
  ),
});

// ── Funcionários ──────────────────────────────────────────────────────────────
export const funcionariosTable = pgTable("funcionarios", {
  id: uuid("id").defaultRandom().primaryKey(),
  empresaId: uuid("empresa_id")
    .notNull()
    .references(() => empresasTable.id),
  nome: text("nome").notNull(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  funcao: text("funcao").notNull().default("tecnico"),
  ativo: boolean("ativo").notNull().default(true),
});

// ── Parceiros ─────────────────────────────────────────────────────────────────
export const parceirosTable = pgTable("parceiros", {
  id: uuid("id").defaultRandom().primaryKey(),
  empresaId: uuid("empresa_id")
    .notNull()
    .references(() => empresasTable.id),
  nome: text("nome").notNull(),
  instituicao: text("instituicao").notNull().default(""),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().default(""),
  telefone: text("telefone").notNull().default(""),
  ativo: boolean("ativo").notNull().default(true),
});

// ── Config ────────────────────────────────────────────────────────────────────
export const configTable = pgTable("config", {
  id: serial("id").primaryKey(),
  empresaId: uuid("empresa_id")
    .notNull()
    .unique()
    .references(() => empresasTable.id),
  nomeClinica: text("nome_clinica")
    .notNull()
    .default("Laboratório de Análises Clínicas"),
  nif: text("nif").notNull().default(""),
  endereco: text("endereco").notNull().default("Luanda, Angola"),
  telefone: text("telefone").notNull().default(""),
  email: text("email").notNull().default(""),
  directorTecnico: text("director_tecnico").notNull().default(""),
  logoData: text("logo_data").notNull().default(""),
  assinaturaData: text("assinatura_data").notNull().default(""),
  serie: text("serie").notNull().default("A"),
  proximoNumeroFatura: integer("proximo_numero_fatura").notNull().default(1),
  ivaTaxa: numeric("iva_taxa").notNull().default("14"),
  moeda: text("moeda").notNull().default("AOA"),
  website: text("website").notNull().default(""),
});

// ── Pacientes ─────────────────────────────────────────────────────────────────
export const pacientesTable = pgTable("pacientes", {
  id: serial("id").primaryKey(),
  empresaId: uuid("empresa_id")
    .notNull()
    .references(() => empresasTable.id),
  nome: text("nome").notNull().default(""),
  nasc: text("nasc").notNull().default(""),
  sexo: text("sexo").notNull().default(""),
  idade: text("idade").notNull().default(""),
  passaporte: text("passaporte").notNull().default(""),
  observacoes: text("observacoes").notNull().default(""),
  bi: text("bi").notNull().default(""),
  nif: text("nif").notNull().default(""),
  nacionalidade: text("nacionalidade").notNull().default(""),
  estadoCivil: text("estado_civil").notNull().default(""),
  profissao: text("profissao").notNull().default(""),
  telefone: text("telefone").notNull().default(""),
  telefone2: text("telefone2").notNull().default(""),
  email: text("email").notNull().default(""),
  endereco: text("endereco").notNull().default(""),
  grupoSanguineo: text("grupo_sanguineo").notNull().default(""),
  fatorRh: text("fator_rh").notNull().default(""),
  alergias: text("alergias").notNull().default(""),
  patologiasCronicas: text("patologias_cronicas").notNull().default(""),
  medicacaoHabitual: text("medicacao_habitual").notNull().default(""),
  contactoEmergenciaNome: text("contacto_emergencia_nome")
    .notNull()
    .default(""),
  contactoEmergenciaTel: text("contacto_emergencia_tel").notNull().default(""),
  empresa: text("empresa").notNull().default(""),
  processo: text("processo").notNull().default(""),
  medico: text("medico").notNull().default(""),
  nAmostra: text("n_amostra").notNull().default(""),
  recolha: text("recolha").notNull().default(""),
});

// ── Resultados ────────────────────────────────────────────────────────────────
export const resultadosTable = pgTable("resultados", {
  id: serial("id").primaryKey(),
  empresaId: uuid("empresa_id")
    .notNull()
    .references(() => empresasTable.id),
  pacienteId: integer("paciente_id"),
  pacienteNome: text("paciente_nome").notNull().default(""),
  data: text("data").notNull().default(""),
  dataEmissao: text("data_emissao").notNull().default(""),
  parametros: jsonb("parametros").$type<any[]>().notNull().default([]),
  tecnicoNome: text("tecnico_nome").notNull().default(""),
  solicitacaoId: text("solicitacao_id"),
});

// ── Faturas ───────────────────────────────────────────────────────────────────
export const faturasTable = pgTable("faturas", {
  billingMeta: jsonb("billing_meta").notNull().default({}),
  emitenteSnapshot: jsonb("emitente_snapshot"),
  id: serial("id").primaryKey(),
  empresaId: uuid("empresa_id")
    .notNull()
    .references(() => empresasTable.id),
  numero: text("numero").notNull().default(""),
  serie: text("serie").notNull().default("A"),
  data: text("data").notNull().default(""),
  horaOperacao: text("hora_operacao").notNull().default(""),
  dataVencimento: text("data_vencimento").notNull().default(""),
  clienteNome: text("cliente_nome").notNull().default(""),
  clienteNif: text("cliente_nif").notNull().default(""),
  clienteEndereco: text("cliente_endereco").notNull().default(""),
  linhas: jsonb("linhas").$type<any[]>().notNull().default([]),
  subtotalSemIva: numeric("subtotal_sem_iva").notNull().default("0"),
  totalIva: numeric("total_iva").notNull().default("0"),
  ivaTaxa: numeric("iva_taxa").notNull().default("14"),
  total: numeric("total").notNull().default("0"),
  estado: text("estado").notNull().default("emitida"),
  observacoes: text("observacoes").notNull().default(""),
  pacienteId: integer("paciente_id"),
  resultadoId: integer("resultado_id"),
  emitidoPor: text("emitido_por").notNull().default(""),
  codigoHash: text("codigo_hash").notNull().default(""),
  emissaoContagem: integer("emissao_contagem").notNull().default(1),
  facturaPremiada: boolean("factura_premiada").notNull().default(false),
  notaCreditoMotivo: text("nota_credito_motivo").notNull().default(""),
  tipoDocumento: text("tipo_documento").notNull().default("factura"),
  formaPagamento: text("forma_pagamento").notNull().default(""),
});

// ── Movimentos (Conta Corrente) ───────────────────────────────────────────────
export const movimentosTable = pgTable("movimentos", {
  id: serial("id").primaryKey(),
  empresaId: uuid("empresa_id")
    .notNull()
    .references(() => empresasTable.id),
  data: text("data").notNull().default(""),
  descricao: text("descricao").notNull().default(""),
  tipo: text("tipo").notNull().default("entrada"),
  valor: numeric("valor").notNull().default("0"),
  categoria: text("categoria").notNull().default(""),
  faturaId: integer("fatura_id"),
  referencia: text("referencia").notNull().default(""),
  registadoPor: text("registado_por").notNull().default(""),
});

// ── Produtos / Serviços ───────────────────────────────────────────────────────
export const produtosTable = pgTable("produtos", {
  billingMeta: jsonb("billing_meta").notNull().default({}),
  id: serial("id").primaryKey(),
  empresaId: uuid("empresa_id")
    .notNull()
    .references(() => empresasTable.id),
  stock: numeric("stock").notNull().default("0"),
  stockMinimo: numeric("stock_minimo").notNull().default("0"),
  codigo: text("codigo").notNull().default(""),
  nome: text("nome").notNull().default(""),
  categoria: text("categoria").notNull().default(""),
  preco: numeric("preco").notNull().default("0"),
  ivaIsento: boolean("iva_isento").notNull().default(false),
  descricao: text("descricao").notNull().default(""),
  ativo: boolean("ativo").notNull().default(true),
});

// ── Exames Custom ─────────────────────────────────────────────────────────────
export const examesCustomTable = pgTable("exames_custom", {
  id: serial("id").primaryKey(),
  empresaId: uuid("empresa_id")
    .notNull()
    .references(() => empresasTable.id),
  categoria: text("categoria").notNull().default(""),
  nome: text("nome").notNull().default(""),
  parametros: jsonb("parametros").$type<any[]>().notNull().default([]),
});

// ── Reagentes (Stock) ─────────────────────────────────────────────────────────
export const reagentesTable = pgTable("reagentes", {
  id: serial("id").primaryKey(),
  empresaId: uuid("empresa_id")
    .notNull()
    .references(() => empresasTable.id),
  codigo: text("codigo").notNull().default(""),
  nome: text("nome").notNull(),
  categoria: text("categoria").notNull().default(""),
  tipo: text("tipo").notNull().default("reagente"),
  unidade: text("unidade").notNull().default("unidades"),
  quantidadeAtual: numeric("quantidade_atual").notNull().default("0"),
  quantidadeMinima: numeric("quantidade_minima").notNull().default("0"),
  lote: text("lote").notNull().default(""),
  validade: text("validade").notNull().default(""),
  fornecedor: text("fornecedor").notNull().default(""),
  localizacao: text("localizacao").notNull().default(""),
  observacoes: text("observacoes").notNull().default(""),
  ativo: boolean("ativo").notNull().default(true),
});

// ── Stock Movimentos ──────────────────────────────────────────────────────────
export const stockMovimentosTable = pgTable("stock_movimentos", {
  id: serial("id").primaryKey(),
  empresaId: uuid("empresa_id")
    .notNull()
    .references(() => empresasTable.id),
  reagenteId: integer("reagente_id").notNull(),
  tipo: text("tipo").notNull(),
  quantidade: numeric("quantidade").notNull().default("0"),
  lote: text("lote").notNull().default(""),
  validade: text("validade").notNull().default(""),
  motivo: text("motivo").notNull().default(""),
  data: text("data").notNull().default(""),
  registadoPor: text("registado_por").notNull().default(""),
});

// ── Solicitações (Parceiros → Lab) ────────────────────────────────────────────
export const solicitacoesTable = pgTable("solicitacoes", {
  id: uuid("id").defaultRandom().primaryKey(),
  empresaId: uuid("empresa_id")
    .notNull()
    .references(() => empresasTable.id),
  parceiroId: uuid("parceiro_id").references(() => parceirosTable.id), // nullable for internal requests
  pacienteNome: text("paciente_nome").notNull().default(""),
  pacienteNascimento: text("paciente_nascimento").notNull().default(""),
  pacienteSexo: text("paciente_sexo").notNull().default(""),
  pacienteTelefone: text("paciente_telefone").notNull().default(""),
  pacienteBi: text("paciente_bi").notNull().default(""),
  examesSolicitados: jsonb("exames_solicitados")
    .$type<any[]>()
    .notNull()
    .default([]),
  observacoes: text("observacoes").notNull().default(""),
  urgente: boolean("urgente").notNull().default(false),
  estado: text("estado").notNull().default("pendente"),
  data: text("data").notNull().default(""),
  hora: text("hora").notNull().default(""),
  resultadoId: text("resultado_id"),
  medicoSolicitante: text("medico_solicitante").notNull().default(""),
  tipoPedido: text("tipo_pedido").notNull().default("externo"),
});

// ── Parceiros Pacientes ───────────────────────────────────────────────────────
export const parceirosPacientesTable = pgTable("parceiros_pacientes", {
  id: uuid("id").defaultRandom().primaryKey(),
  parceiroId: uuid("parceiro_id")
    .notNull()
    .references(() => parceirosTable.id),
  empresaId: uuid("empresa_id")
    .notNull()
    .references(() => empresasTable.id),
  codigo: text("codigo").notNull().default(""),
  nome: text("nome").notNull().default(""),
  nascimento: text("nascimento").notNull().default(""),
  sexo: text("sexo").notNull().default(""),
  telefone: text("telefone").notNull().default(""),
  bi: text("bi").notNull().default(""),
});
