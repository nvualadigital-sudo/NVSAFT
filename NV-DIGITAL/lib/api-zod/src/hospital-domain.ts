export interface ServiceField {
  key: string;
  label: string;
  type?: "text" | "textarea" | "datetime-local" | "date" | "number";
  required?: boolean;
}
export interface ServiceDefinition {
  label: string;
  roles: string[];
  patient: boolean;
  fields: ServiceField[];
  permission?: string;
}
const field = (
  key: string,
  label: string,
  type: ServiceField["type"] = "text",
  required = true,
): ServiceField => ({ key, label, type, required });
const clinical = ["admin", "gestor", "medico", "enfermeiro"];
export const SERVICE_DEFINITIONS: Record<string, ServiceDefinition> = {
  queimados: {
    label: "Queimados e feridas",
    roles: clinical,
    patient: true,
    fields: [
      field("mechanism", "Mecanismo e agente"),
      field("incidentAt", "Data/hora do acidente", "datetime-local"),
      field("extent", "Extensão avaliada (%)", "number"),
      field("depth", "Profundidade avaliada"),
      field("site", "Localização das lesões"),
      field("inhalation", "Avaliação da exposição/lesão inalatória"),
      field("wound", "Avaliação da ferida e penso", "textarea"),
      field("plan", "Plano definido pelo profissional", "textarea"),
      field("protocol", "Protocolo institucional e versão"),
      field("followup", "Seguimento / reabilitação", "textarea"),
    ],
  },
  epidemiologia: {
    label: "Vigilância e isolamento",
    roles: clinical,
    patient: true,
    permission: "epidemiology.manage",
    fields: [
      field("syndrome", "Síndrome/doença em investigação"),
      field("onset", "Início dos sintomas", "date"),
      field("definition", "Definição de caso e versão"),
      field(
        "exposure",
        "Exposição / viagens / contactos necessários",
        "textarea",
      ),
      field("isolation", "Precauções, isolamento e localização"),
      field("authority", "Autoridade destinatária, se aplicável"),
      field(
        "notification",
        "Estado e referência da notificação manual",
        "textarea",
      ),
      field("followup", "Seguimento", "textarea"),
    ],
  },
  cirurgia: {
    label: "Bloco operatório",
    roles: clinical,
    patient: true,
    fields: [
      field("resource", "Sala"),
      field("start", "Início planeado", "datetime-local"),
      field("end", "Fim planeado", "datetime-local"),
      field("procedure", "Procedimento e local/lado"),
      field("team", "Equipa e responsáveis", "textarea"),
      field("consent", "Referência do consentimento"),
      field("protocol", "Checklist institucional aprovada / versão"),
      field("signIn", "Sign-in: responsável/hora", "text", false),
      field("timeOut", "Time-out: responsável/hora", "text", false),
      field("signOut", "Sign-out: responsável/hora", "text", false),
      field("recovery", "Registo operatório e recuperação", "textarea", false),
    ],
  },
  maternidade: {
    label: "Maternidade e vínculo neonatal",
    roles: clinical,
    patient: true,
    fields: [
      field("assessment", "Avaliação materna", "textarea"),
      field("protocol", "Protocolo / versão"),
      field("plan", "Plano e evolução", "textarea"),
      field(
        "delivery",
        "Registo do parto, quando aplicável",
        "textarea",
        false,
      ),
      field(
        "newbornPatientId",
        "ID do recém-nascido no cadastro",
        "number",
        false,
      ),
      field(
        "neonatal",
        "Avaliação neonatal / encaminhamento",
        "textarea",
        false,
      ),
    ],
  },
  equipamentos: {
    label: "Equipamentos e manutenção",
    roles: ["admin", "gestor", "tecnico", "farmaceutico"],
    patient: false,
    fields: [
      field("asset", "Código patrimonial"),
      field("equipment", "Equipamento / modelo / série"),
      field("location", "Localização"),
      field("condition", "Condição e disponibilidade"),
      field("work", "Manutenção, calibração ou avaria", "textarea"),
      field("due", "Próxima intervenção", "date"),
      field("responsible", "Técnico / entidade responsável"),
      field("evidence", "Referência da evidência técnica", "textarea"),
    ],
  },
  esterilizacao: {
    label: "Esterilização — ciclos e lotes",
    roles: ["admin", "gestor", "enfermeiro", "tecnico"],
    patient: false,
    fields: [
      field("batch", "Lote e conjuntos"),
      field("equipment", "Equipamento / ciclo"),
      field("parameters", "Parâmetros medidos", "textarea"),
      field("protocol", "Critérios e protocolo aprovado"),
      field(
        "indicators",
        "Indicadores físicos/químicos/biológicos",
        "textarea",
      ),
      field("outcome", "Conclusão técnica: aprovado ou reprovado"),
      field("location", "Destino / armazenamento"),
    ],
  },
  transporte: {
    label: "Ambulância e transporte",
    roles: [...clinical, "rececionista"],
    patient: true,
    fields: [
      field("resource", "Matrícula / viatura"),
      field("team", "Equipa / condutor"),
      field("origin", "Origem"),
      field("destination", "Destino"),
      field("start", "Saída planeada", "datetime-local"),
      field("end", "Chegada planeada", "datetime-local"),
      field("precautions", "Necessidades e precauções mínimas", "textarea"),
      field("handover", "Entrega e recepção: nome/hora", "textarea", false),
    ],
  },
  nutricao: {
    label: "Dietas e refeições",
    roles: clinical,
    patient: true,
    fields: [
      field("diet", "Dieta prescrita / referência"),
      field("restrictions", "Restrições e alergénios conferidos", "textarea"),
      field("location", "Serviço / leito"),
      field("meals", "Refeições e horários"),
      field(
        "delivery",
        "Entrega, aceitação e intercorrências",
        "textarea",
        false,
      ),
    ],
  },
  reabilitacao: {
    label: "Reabilitação e seguimento",
    roles: clinical,
    patient: true,
    fields: [
      field("discipline", "Disciplina / profissional"),
      field("goals", "Objectivos", "textarea"),
      field("assessment", "Avaliação funcional", "textarea"),
      field("session", "Sessão e evolução", "textarea"),
      field("followup", "Plano de seguimento", "textarea"),
    ],
  },
  hiperbarica: {
    label: "Medicina hiperbárica",
    roles: clinical,
    patient: true,
    fields: [
      field("indication", "Indicação e prescrição de referência"),
      field("protocol", "Protocolo e versão"),
      field("assessment", "Avaliação pré-sessão", "textarea"),
      field("parameters", "Parâmetros prescritos e medidos", "textarea"),
      field("team", "Equipa responsável"),
      field("outcome", "Evolução e intercorrências", "textarea"),
    ],
  },
  escalas: {
    label: "Recursos humanos — escalas e salários",
    roles: ["admin", "gestor", "financeiro"],
    patient: false,
    fields: [
      field("workerId", "ID do funcionário"),
      field("resource", "Profissional / posto"),
      field("service", "Serviço / unidade"),
      field("start", "Início do turno", "datetime-local"),
      field("end", "Fim do turno", "datetime-local"),
      field("notes", "Observações", "textarea", false),
    ],
  },
};
export const INSTITUTION_PROFILES = [
  { id: "geral", label: "Hospital / clínica geral" },
  { id: "queimados", label: "Queimados e reabilitação" },
  { id: "cetep", label: "Endemias e pandemias" },
];
export const DELEGATED_PERMISSIONS = [
  "lab.catalog.approve",
  "lab.validate.technical",
  "lab.validate.release",
  "lab.validate.solo",
  "lab.critical.release",
  "lab.quality",
  "lab.exception",
  "epidemiology.manage",
  "operations.approve",
  "audit.read",
] as const;
