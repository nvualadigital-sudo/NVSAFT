import { Router } from "express";
import { requireAuth, getUser } from "../lib/auth.js";
import OpenAI from "openai";
import { pool } from "@workspace/db";
import { transaction, event } from "../lib/governance.js";

const router = Router();
const providerReady = () => !!process.env.OPENAI_API_KEY || !!(process.env.NEON_AI_GATEWAY_TOKEN && process.env.NEON_AI_GATEWAY_BASE_URL);
function assistantProvider() {
  if (process.env.NEON_AI_GATEWAY_TOKEN && process.env.NEON_AI_GATEWAY_BASE_URL && !process.env.OPENAI_API_KEY)
    return { client: new OpenAI({ apiKey: process.env.NEON_AI_GATEWAY_TOKEN, baseURL: `${process.env.NEON_AI_GATEWAY_BASE_URL.replace(/\/$/, "")}/v1` }), model: process.env.NEON_AI_MODEL || "gpt-5-mini" };
  return { client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }), model: process.env.OPENAI_MODEL || "gpt-4o" };
}
router.get("/ai/status", requireAuth, (_req, res) =>
  res.json({
    available:
      process.env.AI_ASSISTANT_ENABLED === "true" &&
      providerReady(),
    documentsEnabled:
      process.env.AI_DOCUMENTS_ENABLED === "true" &&
      !!process.env.OPENAI_API_KEY,
  }),
);
router.post("/ai/assistente", requireAuth, async (req, res) => {
  const u = getUser(req);
  if (u.role !== "empresa" || !u.empresaId) {
    res.status(403).json({ error: "É necessária uma sessão institucional." });
    return;
  }
  if (
    process.env.AI_ASSISTANT_ENABLED !== "true" ||
    !providerReady()
  ) {
    res
      .status(503)
      .json({ error: "O serviço de IA não foi activado pela instituição." });
    return;
  }
  const prompt = req.body?.message;
  if (
    req.body?.externalProcessingApproved !== true ||
    typeof prompt !== "string" ||
    !prompt.trim() ||
    prompt.length > 4000
  ) {
    res
      .status(400)
      .json({
        error:
          "Confirme a autorização de envio e escreva até 4000 caracteres, sem dados identificáveis de pacientes.",
      });
    return;
  }
  try {
    const { client, model } = assistantProvider();
    const completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "És o assistente operacional do NV.Digital, em português de Angola. Ajuda a redigir textos administrativos e explicar procedimentos de utilização. Não tens acesso ao banco, pacientes, ficheiros ou APIs e não podes executar operações. Não diagnostiques, prescrevas, interpretes resultados clínicos nem recomendes doses. Não afirmes ter guardado, enviado, assinado ou executado nada. Não inventes fontes, leis, políticas hospitalares ou estado do sistema. Explica que a resposta é uma sugestão sujeita a revisão humana. A aplicação contém recepção, laboratório com catálogo aprovado e rastreabilidade, atendimento clínico, enfermagem, farmácia, finanças, biblioteca, chat e MEDLIK. Não peça dados clínicos identificáveis.",
        },
        { role: "user", content: prompt.trim() },
      ],
      max_tokens: 1500,
      temperature: 0.2,
    });
    await transaction(pool, u.empresaId, async (c) =>
      event(c, u, "ai.assistant", u.username, { characters: prompt.length }),
    );
    res.json({
      message:
        completion.choices[0]?.message?.content ||
        "O serviço não devolveu texto.",
      source:
        "Sugestão gerada pelo serviço de IA configurado; sem consulta de dados clínicos.",
    });
  } catch {
    res
      .status(502)
      .json({
        error:
          "O serviço de IA não confirmou a resposta. Nenhuma operação foi executada.",
      });
  }
});

router.post(
  "/ai/analisar-documento",
  requireAuth,
  async (req, res): Promise<void> => {
    if (
      process.env.AI_DOCUMENTS_ENABLED !== "true" ||
      req.body?.externalProcessingApproved !== true
    ) {
      res
        .status(403)
        .json({
          error:
            "O envio externo de documentos exige activação institucional e autorização explícita por pedido.",
        });
      return;
    }
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      res.status(503).json({
        error:
          "OPENAI_API_KEY não configurada. Configure a variável de ambiente no painel de Secrets.",
      });
      return;
    }

    const { imageBase64, mimeType } = req.body as {
      imageBase64?: string;
      mimeType?: string;
    };
    if (!imageBase64) {
      res.status(400).json({ error: "imageBase64 é obrigatório" });
      return;
    }

    const user = getUser(req);
    const client = new OpenAI({ apiKey });

    const prompt = `És um assistente especializado em análises clínicas laboratoriais angolanas.
Analisa este documento (pode ser um resultado de análises, requisição médica, ou relatório clínico) e extrai as seguintes informações em JSON:

{
  "pacienteNome": "nome do paciente se visível",
  "pacienteNasc": "data de nascimento DD/MM/AAAA se visível",
  "pacienteSexo": "M ou F se visível",
  "dataColheita": "data da colheita DD/MM/AAAA se visível",
  "tecnico": "nome do técnico se visível",
  "exames": [
    {
      "categoria": "categoria do exame (ex: Hematologia, Bioquímica, Microbiologia)",
      "exame": "nome do exame (ex: Hemograma Completo)",
      "parametro": "nome do parâmetro (ex: Hemoglobina)",
      "resultado": "valor numérico ou texto do resultado",
      "unidade": "unidade de medida (ex: g/dL)",
      "referencia": "valores de referência se visíveis (ex: 13.5-17.5)"
    }
  ],
  "observacoes": "observações clínicas gerais se existirem"
}

Responde APENAS com o JSON válido, sem markdown, sem texto adicional.
Se um campo não for visível no documento, usa string vazia "".
Para o campo "exames", lista todos os parâmetros individuais visíveis no documento.`;

    try {
      const response = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType || "image/jpeg"};base64,${imageBase64}`,
                  detail: "high",
                },
              },
              { type: "text", text: prompt },
            ],
          },
        ],
        max_tokens: 2000,
        temperature: 0.1,
      });

      const text = response.choices[0]?.message?.content?.trim() ?? "";
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { raw: text, parseError: true };
      }
      res.json(parsed);
    } catch (err: any) {
      res
        .status(502)
        .json({
          error: "O serviço externo não confirmou a análise do documento.",
        });
    }
  },
);

export default router;
