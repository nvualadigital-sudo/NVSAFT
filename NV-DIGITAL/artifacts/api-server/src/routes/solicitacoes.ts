import { Router } from "express";
import { db } from "@workspace/db";
import {
  solicitacoesTable,
  resultadosTable,
  pacientesTable,
  parceirosPacientesTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, getUser } from "../lib/auth.js";

const router = Router();
router.use("/solicitacoes", requireAuth, (req, res, next) => {
  const u = getUser(req);
  if (
    u.role === "empresa" &&
    !["admin", "gestor", "medico", "tecnico"].includes(u.funcao || "")
  ) {
    res
      .status(403)
      .json({ error: "Pedidos clínicos restritos à equipa autorizada." });
    return;
  }
  next();
});

function todayStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}
function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Lab sees all solicitacoes for their empresa (parceiros use /solicitacoes/minhas)
router.get("/solicitacoes", requireAuth, async (req, res): Promise<void> => {
  const user = getUser(req);
  if (!["admin", "gestor", "medico", "tecnico"].includes(user.funcao || "")) {
    res
      .status(403)
      .json({ error: "Pedidos clínicos restritos à equipa autorizada." });
    return;
  }
  // Only empresa/developer roles can list all solicitations; parceiros must use /minhas
  if (user.role === "parceiro") {
    res
      .status(403)
      .json({ error: "Parceiros devem usar /solicitacoes/minhas" });
    return;
  }
  if (!user.empresaId) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }
  const rows = await db
    .select()
    .from(solicitacoesTable)
    .where(eq(solicitacoesTable.empresaId, user.empresaId));
  res.json(rows);
});

// Parceiro sees only their own solicitacoes
router.get(
  "/solicitacoes/minhas",
  requireAuth,
  async (req, res): Promise<void> => {
    const user = getUser(req);
    if (!user.parceiroId) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }
    const rows = await db
      .select()
      .from(solicitacoesTable)
      .where(eq(solicitacoesTable.parceiroId, user.parceiroId));
    res.json(rows);
  },
);

router.post("/solicitacoes", requireAuth, async (req, res): Promise<void> => {
  const user = getUser(req);
  if (user.role !== "parceiro") {
    res
      .status(403)
      .json({ error: "Só parceiros podem criar solicitações externas" });
    return;
  }
  const data = req.body;
  const [row] = await db
    .insert(solicitacoesTable)
    .values({
      parceiroId: user.parceiroId!,
      empresaId: user.empresaId!,
      pacienteNome: data.pacienteNome || "",
      pacienteNascimento: data.pacienteNascimento || "",
      pacienteSexo: data.pacienteSexo || "",
      pacienteTelefone: data.pacienteTelefone || "",
      pacienteBi: data.pacienteBi || "",
      examesSolicitados: data.examesSolicitados || [],
      observacoes: data.observacoes || "",
      urgente: data.urgente || false,
      estado: "pendente",
      data: data.data || todayStr(),
      hora: data.hora || nowTime(),
      resultadoId: null,
      medicoSolicitante: data.medicoSolicitante || "",
      tipoPedido: "externo",
    })
    .returning();
  res.status(201).json(row);
});

// Internal exam request created by a médico (empresa user)
router.post(
  "/solicitacoes/interno",
  requireAuth,
  async (req, res): Promise<void> => {
    const user = getUser(req);
    if (!user.empresaId) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }
    const data = req.body;
    const [row] = await db
      .insert(solicitacoesTable)
      .values({
        parceiroId: null,
        empresaId: user.empresaId,
        pacienteNome: data.pacienteNome || "",
        pacienteNascimento: data.pacienteNascimento || "",
        pacienteSexo: data.pacienteSexo || "",
        pacienteTelefone: data.pacienteTelefone || "",
        pacienteBi: data.pacienteBi || "",
        examesSolicitados: data.examesSolicitados || [],
        observacoes: data.observacoes || "",
        urgente: data.urgente || false,
        estado: "pendente",
        data: todayStr(),
        hora: nowTime(),
        resultadoId: null,
        medicoSolicitante: user.funcionarioNome || user.username || "",
        tipoPedido: "interno",
      })
      .returning();
    res.status(201).json(row);
  },
);

// Médico sees only their own internal requests
router.get(
  "/solicitacoes/medico",
  requireAuth,
  async (req, res): Promise<void> => {
    const user = getUser(req);
    if (!user.empresaId) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }
    const nome = user.funcionarioNome || user.username || "";
    const rows = await db
      .select()
      .from(solicitacoesTable)
      .where(
        and(
          eq(solicitacoesTable.empresaId, user.empresaId),
          eq(solicitacoesTable.medicoSolicitante, nome),
        ),
      );
    res.json(rows);
  },
);

// ── Parceiro Pacientes ──────────────────────────────────────────────────────

router.get(
  "/parceiro/pacientes",
  requireAuth,
  async (req, res): Promise<void> => {
    const user = getUser(req);
    if (!user.parceiroId) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }
    const rows = await db
      .select()
      .from(parceirosPacientesTable)
      .where(eq(parceirosPacientesTable.parceiroId, user.parceiroId));
    res.json(rows);
  },
);

router.post(
  "/parceiro/pacientes",
  requireAuth,
  async (req, res): Promise<void> => {
    const user = getUser(req);
    if (!user.parceiroId) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }
    const d = req.body;
    const [row] = await db
      .insert(parceirosPacientesTable)
      .values({
        parceiroId: user.parceiroId!,
        empresaId: user.empresaId!,
        codigo: d.codigo || "",
        nome: d.nome || "",
        nascimento: d.nascimento || "",
        sexo: d.sexo || "",
        telefone: d.telefone || "",
        bi: d.bi || "",
      })
      .returning();
    res.status(201).json(row);
  },
);

router.put(
  "/parceiro/pacientes/:id",
  requireAuth,
  async (req, res): Promise<void> => {
    const user = getUser(req);
    if (!user.parceiroId) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }
    const { id } = req.params;
    const d = req.body;
    const [row] = await db
      .update(parceirosPacientesTable)
      .set({
        codigo: d.codigo ?? "",
        nome: d.nome ?? "",
        nascimento: d.nascimento ?? "",
        sexo: d.sexo ?? "",
        telefone: d.telefone ?? "",
        bi: d.bi ?? "",
      })
      .where(
        and(
          eq(parceirosPacientesTable.id, id as string),
          eq(parceirosPacientesTable.parceiroId, user.parceiroId!),
        ),
      )
      .returning();
    if (!row) {
      res.status(404).json({ error: "Paciente não encontrado" });
      return;
    }
    res.json(row);
  },
);

router.delete(
  "/parceiro/pacientes/:id",
  requireAuth,
  async (req, res): Promise<void> => {
    const user = getUser(req);
    if (!user.parceiroId) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }
    const { id } = req.params;
    await db
      .delete(parceirosPacientesTable)
      .where(
        and(
          eq(parceirosPacientesTable.id, id as string),
          eq(parceirosPacientesTable.parceiroId, user.parceiroId!),
        ),
      );
    res.json({ ok: true });
  },
);

// Parceiro/empresa views the full result of a completed solicitacao
router.get(
  "/solicitacoes/:id/resultado",
  requireAuth,
  async (req, res): Promise<void> => {
    const user = getUser(req);
    const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const [sol] = await db
      .select()
      .from(solicitacoesTable)
      .where(
        and(
          eq(solicitacoesTable.id, raw),
          eq(solicitacoesTable.empresaId, user.empresaId!),
        ),
      );
    if (!sol) {
      res.status(404).json({ error: "Solicitação não encontrada" });
      return;
    }
    if (user.role === "parceiro" && sol.parceiroId !== user.parceiroId) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }
    if (user.role === "empresa" && sol.empresaId !== user.empresaId) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }
    if (!sol.resultadoId) {
      res.status(404).json({ error: "Resultado ainda não disponível" });
      return;
    }
    const resultadoId = parseInt(sol.resultadoId, 10);
    if (isNaN(resultadoId)) {
      res.status(404).json({ error: "Resultado inválido" });
      return;
    }
    const [resultado] = await db
      .select()
      .from(resultadosTable)
      .where(
        and(
          eq(resultadosTable.id, resultadoId),
          eq(resultadosTable.empresaId, user.empresaId!),
        ),
      );
    if (!resultado) {
      res.status(404).json({ error: "Resultado não encontrado" });
      return;
    }
    const [paciente] = resultado.pacienteId
      ? await db
          .select()
          .from(pacientesTable)
          .where(
            and(
              eq(pacientesTable.id, resultado.pacienteId),
              eq(pacientesTable.empresaId, user.empresaId!),
            ),
          )
      : [undefined];
    if (resultado.pacienteId && !paciente) {
      res.status(409).json({ error: "Associação ao paciente em revisão." });
      return;
    }
    if (!resultado.dataEmissao) {
      res
        .status(409)
        .json({ error: "A versão actual aguarda validação para entrega." });
      return;
    }
    res.json({
      resultado,
      paciente: paciente
        ? user.role === "parceiro"
          ? {
              id: paciente.id,
              nome: paciente.nome,
              nasc: paciente.nasc,
              sexo: paciente.sexo,
              idade: paciente.idade,
              processo: paciente.processo,
            }
          : paciente
        : null,
    });
  },
);

// Update solicitacao status — requires ownership verification
router.put(
  "/solicitacoes/:id",
  requireAuth,
  async (req, res): Promise<void> => {
    const user = getUser(req);
    const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    // Fetch first to verify ownership
    const [existing] = await db
      .select()
      .from(solicitacoesTable)
      .where(
        and(
          eq(solicitacoesTable.id, raw),
          eq(solicitacoesTable.empresaId, user.empresaId!),
        ),
      );
    if (!existing) {
      res.status(404).json({ error: "Solicitação não encontrada" });
      return;
    }

    // Parceiro can only update their own; empresa can only update solicitações of their empresa
    if (user.role === "parceiro" && existing.parceiroId !== user.parceiroId) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }
    if (user.role === "empresa" && existing.empresaId !== user.empresaId) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }

    // Only allow updating estado and resultadoId (no other fields)
    const { estado, resultadoId } = req.body;
    if (
      user.role === "parceiro" &&
      (resultadoId !== undefined ||
        estado !== "cancelada" ||
        existing.estado !== "pendente")
    ) {
      res
        .status(403)
        .json({ error: "O parceiro apenas pode cancelar pedidos pendentes." });
      return;
    }
    const u: Record<string, any> = {};
    if (estado !== undefined) u.estado = estado;
    if (resultadoId !== undefined) u.resultadoId = String(resultadoId);

    const [row] = await db
      .update(solicitacoesTable)
      .set(u)
      .where(
        and(
          eq(solicitacoesTable.id, raw),
          eq(solicitacoesTable.empresaId, user.empresaId!),
        ),
      )
      .returning();
    if (!row) {
      res.status(404).json({ error: "Solicitação não encontrada" });
      return;
    }
    res.json(row);
  },
);

export default router;
