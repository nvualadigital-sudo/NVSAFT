import { hospitalApi } from "../../store/hospital";
import type { ProfessionalIssuer } from "@workspace/api-zod";
export async function printProfessional(
  kind: "medical" | "prescription" | "nursing",
  id: string,
) {
  const popup = window.open("", "_blank", "width=950,height=950");
  if (!popup) throw new Error("Permita a janela de impressão neste navegador.");
  popup.document.body.textContent = "A autorizar a impressão do documento…";
  try {
    const result = await hospitalApi<any>(
      "POST",
      `/professional-documents/${kind}/${id}/export`,
    );
    const doc = result.document,
      issuer = result.issuer as ProfessionalIssuer | null,
      institution = result.institution;
    const d = popup.document;
    d.body.replaceChildren();
    const style = d.createElement("style");
    style.textContent =
      "@page{size:A4;margin:18mm}body{font:11pt Arial,sans-serif;color:#172b3a;line-height:1.55;max-width:185mm;margin:auto}header{display:flex;align-items:center;gap:18px;border-bottom:2px solid #0f766e;padding-bottom:15px}header img{max-width:100px;max-height:70px}h1{font-size:19pt}h2{font-size:13pt}p{white-space:pre-wrap;overflow-wrap:anywhere}.state{font-weight:bold;color:#9a3412}.signatures{margin-top:28px;display:flex;gap:24px;align-items:end}.signatures img{max-width:65mm;max-height:25mm}footer{border-top:1px solid #ddd;margin-top:20px;padding-top:10px;font-size:8pt;color:#555}section{break-inside:avoid}";
    d.head.append(style);
    const text = (tag: string, value: string, parent: HTMLElement = d.body) => {
      const el = d.createElement(tag);
      el.textContent = value;
      parent.append(el);
      return el;
    };
    const image = (src: string, parent: HTMLElement, label: string) => {
      if (
        /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(src || "")
      ) {
        const el = d.createElement("img");
        el.src = src;
        el.alt = label;
        parent.append(el);
      }
    };
    const header = d.createElement("header");
    d.body.append(header);
    image(institution?.logo, header, "Logótipo da instituição");
    const details = d.createElement("div");
    header.append(details);
    text("h2", institution?.name || "Instituição", details);
    text(
      "p",
      [
        institution?.nif ? `NIF: ${institution.nif}` : "",
        institution?.address,
        institution?.phone,
      ]
        .filter(Boolean)
        .join(" · "),
      details,
    );
    const mark =
      result.state === "draft"
        ? "RASCUNHO"
        : result.state === "voided"
          ? "ANULADO / SUSPENSO"
          : "";
    if (mark) text("p", mark).className = "state";
    const title =
      kind === "prescription" ? "Receita médica" : doc.title || doc.kind;
    d.title = title;
    text("h1", title);
    const patient = doc.patient || {};
    text(
      "p",
      `Paciente: ${patient.nome || ""}\nProcesso: ${patient.processo || patient.id || ""}${patient.bi ? ` · BI: ${patient.bi}` : ""}`,
    );
    if (kind === "prescription")
      for (const item of doc.items || [])
        text(
          "p",
          `${item.name}\nDose: ${item.dose} · Via: ${item.route}\nFrequência: ${item.frequency || ""} · Duração: ${item.duration || ""}\nQuantidade: ${item.quantity} ${item.unit || ""}\n${item.instructions || ""}`,
        );
    text("p", doc.text || doc.notes || "");
    if (doc.from) text("p", `Período: ${doc.from} a ${doc.to}`);
    if (doc.validUntil) text("p", `Validade: ${doc.validUntil}`);
    if (doc.voidReason || doc.cancelReason)
      text("p", `Motivo: ${doc.voidReason || doc.cancelReason}`);
    const author = d.createElement("section");
    d.body.append(author);
    if (issuer?.name) {
      text(
        "p",
        [
          issuer.name,
          issuer.category,
          issuer.specialties,
          issuer.position,
          issuer.service,
          `${issuer.credentialAuthority || "Registo profissional"}: ${issuer.credential}`,
        ]
          .filter(Boolean)
          .join("\n"),
        author,
      );
      const signatures = d.createElement("div");
      signatures.className = "signatures";
      author.append(signatures);
      image(issuer.signatureData, signatures, "Assinatura gráfica do autor");
      image(issuer.stampData, signatures, "Carimbo profissional do autor");
      if (!issuer.signatureData)
        text(
          "p",
          "Assinatura do profissional: __________________________",
          author,
        );
    } else
      text(
        "p",
        `Profissional: ${doc.doctor || "Não registado"}\nRegisto: ${doc.registration || "Não registado"}\nAssinatura: __________________________`,
        author,
      );
    const when = doc.finalized || doc.created;
    text(
      "footer",
      `Referência: ${id} · ${when ? new Date(when).toLocaleString("pt-PT") : ""}\n${result.legacy ? "Documento legado: identificação conservada conforme o registo original." : result.state === "draft" ? "Documento em preparação; sem emissão profissional." : "Autoria e emissão registadas no sistema. As imagens são reproduções gráficas, sem certificação de assinatura digital qualificada."}`,
    );
    await Promise.all(
      [...d.images].map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.onload = () => resolve();
              img.onerror = () => resolve();
            }),
      ),
    );
    popup.focus();
    popup.print();
  } catch (error) {
    popup.close();
    throw error;
  }
}
