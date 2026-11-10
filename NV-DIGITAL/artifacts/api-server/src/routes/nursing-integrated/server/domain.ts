import { randomUUID } from "node:crypto";
import {
  type Actor,
  type ClinicalState,
  allowed,
} from "../src/integrated/model";
export class DomainError extends Error {
  constructor(
    message: string,
    public status = 422,
  ) {
    super(message);
  }
}
function text(
  p: Record<string, unknown>,
  key: string,
  optional = false,
): string {
  const v = p[key];
  if (optional && (v === undefined || v === "")) return "";
  if (typeof v !== "string" || !v.trim() || v.length > 6000)
    throw new DomainError(`Preencha correctamente: ${key}.`);
  return v.trim();
}
function num(
  p: Record<string, unknown>,
  key: string,
  min: number,
  max: number,
) {
  const n = Number(p[key]);
  if (
    !["string", "number"].includes(typeof p[key]) ||
    p[key] === "" ||
    p[key] === undefined ||
    !Number.isFinite(n) ||
    n < min ||
    n > max
  )
    throw new DomainError(`Valor inválido: ${key}.`);
  return n;
}
function date(p: Record<string, unknown>, key: string) {
  const v = text(p, key);
  if (
    !/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(v) ||
    !Number.isFinite(Date.parse(v)) ||
    new Date(v).toISOString().slice(0, 10) !== v.slice(0, 10)
  )
    throw new DomainError(`Data inválida: ${key}.`);
  return v;
}
function requireRole(a: Actor, ...r: Parameters<typeof allowed>[1][]) {
  if (!allowed(a, ...r))
    throw new DomainError("O seu perfil não permite esta operação.", 403);
}
function find<T extends { id: string }>(rows: T[], id: string): T {
  const v = rows.find((r) => r.id === id);
  if (!v) throw new DomainError("Registo não encontrado.", 404);
  return v;
}
export function execute(
  s: ClinicalState,
  a: Actor,
  type: string,
  p: Record<string, unknown>,
) {
  const now = new Date().toISOString(),
    id = randomUUID();
  let entityId: string = id,
    detail = "";
  const patient = () => find(s.patients, text(p, "patientId"));
  const clinical = () =>
    requireRole(a, "medico", "enfermeiro", "chefe_enfermagem");
  switch (type) {
    case "patient.create": {
      clinical();
      const code = p.code === undefined ? id : text(p, "code");
      if (s.patients.some((x) => x.code === code))
        throw new DomainError("Número de processo já existente.");
      const birthDate = date(p, "birthDate");
      if (Date.parse(birthDate) > Date.now())
        throw new DomainError("Nascimento no futuro.");
      s.patients.push({
        id,
        code,
        name: text(p, "name"),
        birthDate,
        sex: text(p, "sex"),
        allergies: text(p, "allergies"),
        conditions: text(p, "conditions", true),
      });
      detail = "Processo criado";
      break;
    }
    case "patient.update": {
      clinical();
      const pt = patient(),
        old = pt.allergies;
      pt.allergies = text(p, "allergies");
      pt.conditions = text(p, "conditions", true);
      entityId = pt.id;
      detail = `Alergias/antecedentes: ${pt.code}; alergias anteriores: ${old}; actuais: ${pt.allergies}`;
      break;
    }
    case "episode.transfer": {
      clinical();
      const e = find(s.episodes, text(p, "episodeId"));
      if (e.status !== "activo") throw new DomainError("Episódio não activo.");
      const ward = text(p, "ward"),
        bed = text(p, "bed");
      if (
        s.episodes.some(
          (x) =>
            x.id !== e.id &&
            x.status !== "encerrado" &&
            x.ward === ward &&
            x.bed === bed,
        )
      )
        throw new DomainError("Leito ocupado.");
      detail = `Transferência ${e.ward}/${e.bed} para ${ward}/${bed}: ${text(p, "reason")}`;
      e.ward = ward;
      e.bed = bed;
      e.specialty = text(p, "specialty");
      entityId = e.id;
      break;
    }
    case "episode.assign": {
      requireRole(a, "enfermeiro", "chefe_enfermagem");
      const e = find(s.episodes, text(p, "episodeId"));
      if (e.status !== "activo")
        throw new DomainError("Apenas episódios activos podem ser assumidos.");
      if (e.nurseId === a.id)
        throw new DomainError("O paciente já está sob a sua responsabilidade.");
      const reason = text(p, "reason", !e.nurseId);
      const previous = e.nurseName || "sem atribuição";
      e.nurseId = a.id;
      e.nurseName = a.name;
      e.assignedAt = now;
      entityId = e.id;
      detail = `Responsabilidade de enfermagem: ${previous} → ${a.name}${reason ? "; " + reason : ""}`;
      break;
    }
    case "episode.create": {
      clinical();
      const pt = patient();
      if (
        s.episodes.some(
          (e) => e.patientId === pt.id && e.status !== "encerrado",
        )
      )
        throw new DomainError("O paciente já tem episódio activo.");
      const ward = text(p, "ward"),
        bed = text(p, "bed");
      if (
        s.episodes.some(
          (e) => e.ward === ward && e.bed === bed && e.status !== "encerrado",
        )
      )
        throw new DomainError("Leito ocupado.");
      s.episodes.push({
        id,
        patientId: pt.id,
        specialty: text(p, "specialty"),
        ward,
        bed,
        diagnosis: text(p, "diagnosis"),
        admittedAt: now,
        status: "activo",
      });
      detail = `Admissão ${pt.code} / ${ward} / ${bed}`;
      break;
    }
    case "drug.create": {
      requireRole(a, "farmaceutico");
      s.drugs.push({
        id,
        name: text(p, "name"),
        ingredient: text(p, "ingredient"),
        strength: text(p, "strength"),
        unit: text(p, "unit"),
        highAlert: p.highAlert === true,
      });
      detail = "Medicamento cadastrado";
      break;
    }
    case "drug.configure": {
      requireRole(a, "farmaceutico");
      const d = find(s.drugs, text(p, "drugId"));
      if (!d.needsReview)
        throw new DomainError(
          "Apresentação já validada. Cadastre uma nova apresentação para mudar dados clínicos.",
        );
      d.name = text(p, "name");
      d.ingredient = text(p, "ingredient");
      d.strength = text(p, "strength");
      d.unit = text(p, "unit");
      d.highAlert = p.highAlert === true;
      d.needsReview = false;
      entityId = d.id;
      detail = "Apresentação e princípio activo validados pela farmácia";
      break;
    }
    case "batch.receive": {
      requireRole(a, "farmaceutico");
      const drugId = text(p, "drugId");
      find(s.drugs, drugId);
      const expires = date(p, "expires");
      if (expires.slice(0, 10) < now.slice(0, 10))
        throw new DomainError("Não é permitido receber lote expirado.");
      s.batches.push({
        id,
        drugId,
        lot: text(p, "lot"),
        expires: expires.slice(0, 10),
        quantity: num(p, "quantity", 0.001, 1e9),
      });
      detail = "Entrada de lote e stock";
      break;
    }
    case "order.create": {
      requireRole(a, "medico");
      const pt = patient(),
        episode = find(s.episodes, text(p, "episodeId")),
        drug = find(s.drugs, text(p, "drugId"));
      if (drug.needsReview || !drug.ingredient || !drug.strength || !drug.unit)
        throw new DomainError(
          "A farmácia deve validar princípio activo, apresentação e unidade deste medicamento.",
        );
      if (episode.patientId !== pt.id || episode.status !== "activo")
        throw new DomainError("Episódio não disponível para prescrição.");
      if (p.allergyReviewed !== true)
        throw new DomainError("Confirme a revisão das alergias.");
      const norm = (x: string) =>
        x
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();
      if (norm(pt.allergies).includes(norm(drug.ingredient)))
        throw new DomainError(
          "Princípio activo identificado nas alergias. Rever a prescrição.",
        );
      const count = num(p, "count", 1, 100),
        interval = num(p, "interval", 0.5, 168),
        start = date(p, "start"),
        units = num(p, "units", 0.001, 1e5);
      if (!Number.isInteger(count))
        throw new DomainError("Número de administrações deve ser inteiro.");
      if (!a.registration)
        throw new DomainError(
          "A cédula do prescritor deve constar da sessão validada.",
        );
      s.orders.push({
        id,
        patientId: pt.id,
        episodeId: episode.id,
        drugId: drug.id,
        dose: text(p, "dose"),
        route: text(p, "route"),
        indication: text(p, "indication"),
        specialty: episode.specialty,
        instructions: text(p, "instructions", true),
        prescriber: a.name,
        registration: a.registration,
        start,
        interval,
        count,
        status: "activa",
      });
      for (let i = 0; i < count; i++)
        s.doses.push({
          id: randomUUID(),
          orderId: id,
          due: new Date(
            Date.parse(start) + i * interval * 3600000,
          ).toISOString(),
          units,
          status: "aguarda_farmacia",
        });
      detail = `Prescrição assinada: ${pt.code} / ${drug.name} / ${count} administrações`;
      break;
    }
    case "order.suspend": {
      requireRole(a, "medico");
      const order = find(s.orders, text(p, "orderId"));
      if (order.status !== "activa")
        throw new DomainError("Prescrição já suspensa.");
      order.status = "suspensa";
      detail = text(p, "reason");
      entityId = order.id;
      s.doses
        .filter(
          (d) =>
            d.orderId === order.id &&
            ["aguarda_farmacia", "dispensada"].includes(d.status),
        )
        .forEach((d) => {
          d.status = "suspensa";
          d.note = detail;
        });
      break;
    }
    case "dose.dispense": {
      requireRole(a, "farmaceutico");
      const d = find(s.doses, text(p, "doseId")),
        o = find(s.orders, d.orderId);
      if (d.status !== "aguarda_farmacia" || o.status !== "activa")
        throw new DomainError("Dose indisponível para dispensa.");
      const b = find(s.batches, text(p, "batchId"));
      if (
        b.drugId !== o.drugId ||
        b.expires < now.slice(0, 10) ||
        b.expires < d.due.slice(0, 10) ||
        b.quantity < d.units
      )
        throw new DomainError(
          "Lote incorrecto, expirado na data prevista ou stock insuficiente.",
        );
      b.quantity = Number((b.quantity - d.units).toFixed(6));
      d.status = "dispensada";
      d.batchId = b.id;
      d.pharmacist = a.name;
      entityId = d.id;
      detail = `Dispensa: lote ${b.lot}; ${d.units} unidades`;
      break;
    }
    case "dose.administer": {
      requireRole(a, "enfermeiro", "chefe_enfermagem");
      const d = find(s.doses, text(p, "doseId")),
        o = find(s.orders, d.orderId),
        pt = find(s.patients, o.patientId),
        drug = find(s.drugs, o.drugId);
      if (
        d.status !== "dispensada" ||
        o.status !== "activa" ||
        find(s.episodes, o.episodeId).status !== "activo"
      )
        throw new DomainError(
          "Administração bloqueada: confirme dispensa e prescrição activa.",
        );
      if (text(p, "patientCode") !== pt.code)
        throw new DomainError(
          "Identificação não corresponde ao paciente da prescrição.",
        );
      if (p.checks !== true)
        throw new DomainError(
          "Confirme paciente, medicamento, dose, via e horário.",
        );
      if (!d.batchId || find(s.batches, d.batchId).expires < now.slice(0, 10))
        throw new DomainError("Lote expirado. Contacte a farmácia.");
      if (drug.highAlert) {
        const witnessId = text(p, "witnessId");
        if (witnessId === a.id)
          throw new DomainError(
            "A dupla verificação exige outro profissional.",
          );
        if (
          !s.audit.some(
            (e) =>
              e.action === "dose.verify" &&
              e.entityId === d.id &&
              e.actorId === witnessId,
          )
        )
          throw new DomainError(
            "Outro enfermeiro deve registar a dupla verificação na sua sessão.",
          );
        d.witness = witnessId;
      }
      const norm = (x: string) =>
        x
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();
      if (norm(pt.allergies).includes(norm(drug.ingredient)))
        throw new DomainError(
          "Princípio activo nas alergias actuais. Contacte o prescritor.",
        );
      const note = text(p, "note", true);
      if (Math.abs(Date.parse(d.due) - Date.now()) > 3600000 && !note)
        throw new DomainError(
          "Justifique administração fora da janela de uma hora.",
        );
      d.status = "administrada";
      d.at = now;
      d.administeredBy = a.name;
      d.note = note;
      entityId = d.id;
      detail = `Administração: ${pt.code} / ${drug.name}`;
      break;
    }
    case "dose.verify": {
      requireRole(a, "enfermeiro", "chefe_enfermagem");
      const d = find(s.doses, text(p, "doseId"));
      if (d.status !== "dispensada")
        throw new DomainError("A dose não está dispensada.");
      const o = find(s.orders, d.orderId),
        pt = find(s.patients, o.patientId);
      if (text(p, "patientCode") !== pt.code || p.checks !== true)
        throw new DomainError("Confirme identidade e verificações.");
      entityId = d.id;
      detail = "Dupla verificação independente";
      break;
    }
    case "dose.omit": {
      requireRole(a, "enfermeiro", "chefe_enfermagem");
      const d = find(s.doses, text(p, "doseId"));
      if (!["dispensada", "aguarda_farmacia"].includes(d.status))
        throw new DomainError("Dose já encerrada.");
      d.status = "omitida";
      d.note = text(p, "reason");
      d.at = now;
      d.administeredBy = a.name;
      entityId = d.id;
      detail = `Não administração: ${d.note}`;
      break;
    }
    case "dose.discard": {
      requireRole(a, "farmaceutico");
      const d = find(s.doses, text(p, "doseId"));
      if (
        !d.batchId ||
        d.returned ||
        !["omitida", "suspensa"].includes(d.status)
      )
        throw new DomainError("Sem unidade pendente de conferência.");
      d.returned = true;
      d.returnDisposition = "perda";
      entityId = d.id;
      detail = `Perda sem reposição de stock: ${text(p, "reason")}`;
      break;
    }
    case "dose.return": {
      requireRole(a, "farmaceutico");
      const d = find(s.doses, text(p, "doseId"));
      if (
        !d.batchId ||
        d.returned ||
        !["omitida", "suspensa"].includes(d.status)
      )
        throw new DomainError("Sem devolução pendente.");
      detail = text(p, "reason");
      const b = find(s.batches, d.batchId);
      if (b.expires < now.slice(0, 10))
        throw new DomainError(
          "Lote expirado: registe perda, não reintegre stock.",
        );
      if (p.intact !== true)
        throw new DomainError("Confirme embalagem íntegra e conservação.");
      b.quantity = Number((b.quantity + d.units).toFixed(6));
      d.returned = true;
      d.returnDisposition = "stock";
      entityId = d.id;
      detail = `Devolução ao lote ${b.lot}: ${detail}`;
      break;
    }
    case "observation.create": {
      clinical();
      const pt = patient(),
        kind = text(p, "kind");
      if (
        ![
          "vitais",
          "balanco",
          "evolucao",
          "incidente",
          "triagem",
          "avaliacao",
          "dispositivo",
          "procedimento",
        ].includes(kind)
      )
        throw new DomainError("Tipo de registo inválido.");
      let values: Record<string, string | number> = {};
      if (kind === "vitais")
        values = {
          systolic: num(p, "systolic", 20, 350),
          diastolic: num(p, "diastolic", 10, 250),
          pulse: num(p, "pulse", 10, 300),
          temperature: num(p, "temperature", 25, 45),
          spo2: num(p, "spo2", 0, 100),
          respiration: num(p, "respiration", 1, 120),
          pain: num(p, "pain", 0, 10),
        };
      else if (kind === "balanco") {
        const direction = text(p, "direction");
        if (!["entrada", "saida"].includes(direction))
          throw new DomainError("Sentido inválido.");
        values = {
          direction,
          ml: num(p, "ml", 0.1, 50000),
          source: text(p, "source"),
        };
      } else if (kind === "triagem") {
        const priority = text(p, "priority");
        if (
          !["Vermelho", "Laranja", "Amarelo", "Verde", "Azul"].includes(
            priority,
          )
        )
          throw new DomainError("Prioridade inválida.");
        values = {
          priority,
          complaint: text(p, "complaint"),
          discriminator: text(p, "discriminator"),
        };
      } else if (kind === "avaliacao")
        values = {
          consciousness: text(p, "consciousness"),
          skin: text(p, "skin"),
          mobility: text(p, "mobility"),
          fallRisk: text(p, "fallRisk"),
          pressureRisk: text(p, "pressureRisk"),
          note: text(p, "note"),
        };
      else if (kind === "dispositivo")
        values = {
          device: text(p, "device"),
          action: text(p, "deviceAction"),
          site: text(p, "site"),
          note: text(p, "note"),
        };
      else if (kind === "procedimento")
        values = { procedure: text(p, "procedure"), note: text(p, "note") };
      else if (kind === "evolucao" && p.format === "SOAPIER") {
        const fields = [
          "subjective",
          "objective",
          "analysis",
          "plan",
          "intervention",
          "evaluation",
          "reassessment",
        ];
        values = { format: "SOAPIER" };
        for (const key of fields) values[key] = text(p, key);
        values.note = fields.map((key) => `${key}: ${values[key]}`).join("\n");
      } else values = { note: text(p, "note") };
      s.observations.push({
        id,
        patientId: pt.id,
        kind: kind as any,
        at: now,
        author: a.name,
        values,
      });
      detail = `Registo ${kind}: ${pt.code}`;
      break;
    }
    case "care.create": {
      requireRole(a, "enfermeiro", "chefe_enfermagem");
      const pt = patient();
      s.care.push({
        id,
        patientId: pt.id,
        diagnosis: text(p, "diagnosis"),
        goal: text(p, "goal"),
        intervention: text(p, "intervention"),
        due: date(p, "due"),
        status: "planeado",
        author: a.name,
      });
      detail = `Plano de cuidados: ${pt.code}`;
      break;
    }
    case "care.perform":
    case "care.evaluate": {
      requireRole(a, "enfermeiro", "chefe_enfermagem");
      const c = find(s.care, text(p, "careId"));
      if (type === "care.perform") {
        if (c.status !== "planeado")
          throw new DomainError("Intervenção já registada.");
        c.status = "realizado";
        c.performedAt = now;
        c.performedBy = a.name;
      } else {
        if (c.status !== "realizado")
          throw new DomainError("Registe a intervenção antes da avaliação.");
        c.status = "avaliado";
        c.outcome = text(p, "outcome");
        c.evaluatedAt = now;
        c.evaluatedBy = a.name;
      }
      entityId = c.id;
      detail = type === "care.perform" ? "Intervenção realizada" : c.outcome!;
      break;
    }
    case "handover.create": {
      requireRole(a, "enfermeiro", "chefe_enfermagem");
      const pt = patient();
      s.handovers.push({
        id,
        patientId: pt.id,
        situation: text(p, "situation"),
        background: text(p, "background"),
        assessment: text(p, "assessment"),
        recommendation: text(p, "recommendation"),
        authorId: a.id,
        author: a.name,
        at: now,
      });
      detail = `Passagem SBAR: ${pt.code}`;
      break;
    }
    case "handover.accept": {
      requireRole(a, "enfermeiro", "chefe_enfermagem");
      const h = find(s.handovers, text(p, "handoverId"));
      if (h.acceptedBy || h.authorId === a.id)
        throw new DomainError(
          "A passagem deve ser recebida por outro profissional e apenas uma vez.",
        );
      h.acceptedBy = a.name;
      h.acceptedAt = now;
      entityId = h.id;
      detail = "Passagem de turno recebida";
      break;
    }
    case "discharge.authorize": {
      requireRole(a, "medico");
      const e = find(s.episodes, text(p, "episodeId"));
      if (e.status !== "activo") throw new DomainError("Episódio não activo.");
      e.dischargeNote = text(p, "note");
      e.status = "alta_autorizada";
      s.orders
        .filter((o) => o.episodeId === e.id)
        .forEach((o) => {
          o.status = "suspensa";
          s.doses
            .filter(
              (d) =>
                d.orderId === o.id &&
                ["dispensada", "aguarda_farmacia"].includes(d.status),
            )
            .forEach((d) => {
              d.status = "suspensa";
              d.note = "Alta médica autorizada";
            });
        });
      entityId = e.id;
      detail = "Alta médica autorizada e doses pendentes suspensas";
      break;
    }
    case "discharge.finish": {
      requireRole(a, "enfermeiro", "chefe_enfermagem");
      const e = find(s.episodes, text(p, "episodeId"));
      if (e.status !== "alta_autorizada")
        throw new DomainError("Aguarda autorização médica.");
      e.status = "encerrado";
      entityId = e.id;
      detail = `Saída de enfermagem: ${text(p, "note")}`;
      break;
    }
    default:
      throw new DomainError("Operação desconhecida.", 400);
  }
  s.revision++;
  s.audit.push({
    id: randomUUID(),
    at: now,
    actorId: a.id,
    actor: a.name,
    action: type,
    entityId,
    detail,
  });
  return s;
}
