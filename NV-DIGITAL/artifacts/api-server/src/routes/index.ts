import nursingIntegratedRouter from "./nursing-integrated/index.js";
import patientPortal, { patientPortalStaff } from "./patient-portal.js";
import { createInsuranceRouter } from "./insurance.js";
import { createGeographyRouter } from "./geography.js";
import { createProfessionalDocuments } from "./professional-documents.js";
import hrRouter from "./hr.js";
import notificationRouterV2 from "./notifications.js";
import chatSocial from "./chat-social.js";
import chatCalls from "./chat-calls.js";
import chatLive from "./chat-live.js";
import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import empresasRouter from "./empresas.js";
import licencasRouter from "./licencas.js";
import solicitacoesRouter from "./solicitacoes.js";
import laboratorioRouter from "./laboratorio.js";
import aiRouter from "./ai.js";
import assistantAgentRouter from "./assistant-agent.js";
import syncRouter from "./sync.js";
import { broadcast } from "../lib/sync.js";
import { getUser, requireAuth } from "../lib/auth.js";

import receptionRouter from "./recepcao.js";
import billingRouter, { integratedBilling } from "./billing-integrated.js";
import hospitalRouter from "./hospital.js";
import labWorkflow from "./lab-workflow.js";
import institutionRouter from "./institution.js";
import { createDocumentSignatories } from "./document-signatories.js";
import chatTools from "./chat-tools.js";
import { tenantGuard } from "../lib/tenantGuard.js";
const router: IRouter = Router();

// ── Broadcast middleware: notify LAN clients after any successful mutation ──
// Runs before route handlers, wraps res.json so we can inspect status codes.
router.use((req, res, next) => {
  if (!["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) return next();
  const originalJson = res.json.bind(res);
  (res as any).json = function (body: unknown) {
    const result = originalJson(body);
    if (res.statusCode >= 200 && res.statusCode < 300) {
      try {
        const user = getUser(req);
        if (user?.empresaId) {
          broadcast(user.empresaId, "change", {
            method: req.method,
            path: req.path,
            ts: Date.now(),
          });
        }
      } catch {
        /* non-fatal */
      }
    }
    return result;
  };
  return next();
});

router.use(healthRouter);
router.use(authRouter);
router.use("/patient-portal", patientPortal);
router.use(requireAuth);
router.use(tenantGuard);
router.use("/hospital/patient-portal", patientPortalStaff);
router.use("/hospital/hr", hrRouter);
router.use("/hospital/services/escalas", (req,res,next)=>{if(["GET","HEAD"].includes(req.method)){next();return;}res.status(409).json({error:"Utilize Recursos humanos → Escala mensal para guardar ou publicar a escala."});});
router.use("/billing-v2", integratedBilling);
router.use(billingRouter);
router.use("/hospital/notifications-v2",notificationRouterV2);
router.use("/hospital/chat-social", chatSocial);
router.use("/hospital/chat-calls", chatCalls);
router.use("/hospital/chat-live", chatLive);
router.use("/hospital/lab", labWorkflow);
router.use("/hospital", institutionRouter);
router.use("/hospital", createDocumentSignatories());
router.use("/hospital", createGeographyRouter());
router.use("/hospital", createProfessionalDocuments());
router.use("/hospital", chatTools);
router.use("/hospital", createInsuranceRouter());
router.use("/hospital/nursing-integrated", nursingIntegratedRouter);
router.use("/hospital", hospitalRouter);
router.use("/recepcao", receptionRouter);
router.use(empresasRouter);
router.use(licencasRouter);
router.use(solicitacoesRouter);

router.use(laboratorioRouter);
router.use(aiRouter);
router.use("/ai", assistantAgentRouter);
router.use(syncRouter);

export default router;
