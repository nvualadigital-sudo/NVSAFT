import PatientGeographyFields from "../../components/hospital/PatientGeography";
import { emptyPatientGeography, addressLabel, type PatientGeography } from "@workspace/api-zod";
import { hospitalApi } from "../../store/hospital";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import * as QRCode from "qrcode";
import jsQR from "jsqr";
import { useApp } from "../../store/AppContext";
import { Paciente } from "../../store/storage";
import { patientDisplayReference } from "../../utils/displayReference";

const GRUPOS_SANGUINEOS = ["A", "B", "AB", "O"];
const FATORES_RH = ["Positivo (+)", "Negativo (−)"];
const ESTADOS_CIVIS = [
  "Solteiro(a)",
  "Casado(a)",
  "União de Facto",
  "Divorciado(a)",
  "Viúvo(a)",
];

const emptyForm: Omit<Paciente, "id"> = {
  nome: "",
  nasc: "",
  sexo: "",
  idade: "",
  bi: "",
  nif: "",
  nacionalidade: "Angolana",
  estadoCivil: "",
  profissao: "",
  telefone: "",
  telefone2: "",
  email: "",
  endereco: "",
  grupoSanguineo: "",
  fatorRh: "",
  alergias: "",
  patologiasCronicas: "",
  medicacaoHabitual: "",
  contactoEmergenciaNome: "",
  contactoEmergenciaTel: "",
  empresa: "",
  processo: "",
  medico: "",
  nAmostra: "",
  recolha: "",
};

type ViewMode = "lista" | "form" | "perfil";

interface ExtractedData {
  nome?: string;
  filiacao?: string;
  nasc?: string;
  sexo?: string;
  bi?: string;
  nif?: string;
  nacionalidade?: string;
  endereco?: string;
  naturalDe?: string;
  provincia?: string;
  estadoCivil?: string;
  altura?: string;
  emitidoEm?: string;
  validoAte?: string;
  foto?: string;
}

// ===== CORREÇÃO: Tesseract.js v5 com melhor suporte a português =====
let tesseractPromise: Promise<any> | null = null;
function loadTesseract(): Promise<any> {
  if ((window as any).Tesseract) {
    return Promise.resolve((window as any).Tesseract);
  }
  if (!tesseractPromise) {
    tesseractPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src =
        "https://cdn.jsdelivr.net/npm/tesseract.js@5.0.4/dist/tesseract.min.js";
      script.onload = () => {
        if ((window as any).Tesseract) {
          resolve((window as any).Tesseract);
        } else {
          reject(
            new Error("Tesseract.js carregado mas não disponível globalmente"),
          );
        }
      };
      script.onerror = () =>
        reject(new Error("Falha ao carregar Tesseract.js"));
      document.head.appendChild(script);
    });
  }
  return tesseractPromise;
}

let pdfjsPromise: Promise<any> | null = null;
function loadPDFjs(): Promise<any> {
  if ((window as any).pdfjsLib) {
    return Promise.resolve((window as any).pdfjsLib);
  }
  if (!pdfjsPromise) {
    pdfjsPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      script.onload = () => {
        try {
          (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        } catch (e) {
          console.warn("PDF.js worker config warning:", e);
        }
        resolve((window as any).pdfjsLib);
      };
      script.onerror = () => reject(new Error("Falha ao carregar PDF.js"));
      document.head.appendChild(script);
    });
  }
  return pdfjsPromise;
}

let mammothPromise: Promise<any> | null = null;
function loadMammoth(): Promise<any> {
  if ((window as any).mammoth) {
    return Promise.resolve((window as any).mammoth);
  }
  if (!mammothPromise) {
    mammothPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js";
      script.onload = () => resolve((window as any).mammoth);
      script.onerror = () => reject(new Error("Falha ao carregar Mammoth.js"));
      document.head.appendChild(script);
    });
  }
  return mammothPromise;
}

async function extractTextFromPDF(file: File): Promise<string> {
  const pdfjsLib = await loadPDFjs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(" ");
    fullText += pageText + "\n";
  }
  return fullText;
}

async function extractTextFromDOCX(file: File): Promise<string> {
  const mammoth = await loadMammoth();
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

async function convertPdfToImage(file: File): Promise<string> {
  const pdfjsLib = await loadPDFjs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 3 });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  canvas.height = viewport.height;
  canvas.width = viewport.width;
  await page.render({ canvasContext: context!, viewport: viewport }).promise;
  return canvas.toDataURL("image/png");
}

// ===== CORREÇÃO: Pré-processamento melhorado com múltiplas técnicas =====
async function preprocessImage(imageData: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(imageData);
        return;
      }

      // Escala adequada para OCR (2x é bom equilíbrio)
      const scale = 2;
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const imageDataObj = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageDataObj.data;

      // ===== TÉCNICA 1: Conversão para escala de cinzentos =====
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        // Fórmula de luminosidade humana (mais precisa)
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }

      // ===== TÉCNICA 2: Ajuste de contraste adaptativo =====
      // Encontrar min/max para normalização
      let minVal = 255,
        maxVal = 0;
      for (let i = 0; i < data.length; i += 4) {
        const val = data[i];
        if (val < minVal) minVal = val;
        if (val > maxVal) maxVal = val;
      }

      // Normalização de contraste (stretching)
      const range = maxVal - minVal;
      if (range > 0) {
        for (let i = 0; i < data.length; i += 4) {
          const val = data[i];
          const normalized = ((val - minVal) / range) * 255;
          data[i] = normalized;
          data[i + 1] = normalized;
          data[i + 2] = normalized;
        }
      }

      // ===== TÉCNICA 3: Binarização adaptativa (Otsu simplificado) =====
      // Calcular threshold ótimo
      const histogram = new Array(256).fill(0);
      for (let i = 0; i < data.length; i += 4) {
        histogram[Math.floor(data[i])]++;
      }

      const totalPixels = data.length / 4;
      let sum = 0;
      for (let i = 0; i < 256; i++) {
        sum += i * histogram[i];
      }

      let sumB = 0,
        wB = 0,
        wF = 0;
      let maxVariance = 0;
      let threshold = 128;

      for (let t = 0; t < 256; t++) {
        wB += histogram[t];
        if (wB === 0) continue;
        wF = totalPixels - wB;
        if (wF === 0) break;

        sumB += t * histogram[t];
        const mB = sumB / wB;
        const mF = (sum - sumB) / wF;

        const variance = wB * wF * (mB - mF) * (mB - mF);
        if (variance > maxVariance) {
          maxVariance = variance;
          threshold = t;
        }
      }

      // Aplicar binarização com threshold encontrado
      for (let i = 0; i < data.length; i += 4) {
        const val = data[i] > threshold ? 255 : 0;
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
      }

      ctx.putImageData(imageDataObj, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(imageData);
    img.src = imageData;
  });
}

function normalizeOCRText(raw: string): string {
  let t = raw;

  // Remover caracteres de ruído indesejados do OCR
  t = t.replace(/[品口\_\|]/g, " ");

  // Normalizar dois pontos fullwidth para normais
  t = t.replace(/：/g, ":");

  // Normalizar indicadores de número
  t = t.replace(/N[°º\.oO]\s*/gi, "Nº ");
  t = t.replace(/S\/N[°º\.oO]\s*/gi, "S/Nº ");
  t = t.replace(/(S\/Nº)([A-Z])/gi, "$1 $2");

  // Dicionário de Correção de Erros Globais (Fuzzy OCR)
  const fuzzyCorrections: { [key: string]: string } = {
    BiIhete: "Bilhete",
    ldentidade: "Identidade",
    NascImento: "Nascimento",
    Nascimenio: "Nascimento",
    FiIia: "Filia",
    Fllla: "Filia",
    Residêncla: "Residência",
    ResidencIa: "Residência",
    Províncla: "Província",
    ProvincIa: "Província",
    Estada: "Estado",
    Váiido: "Válido",
    VâIido: "Válido",
    REPÚBLlCA: "REPÚBLICA",
    REPUBLlCA: "REPUBLICA",
  };

  Object.keys(fuzzyCorrections).forEach((key) => {
    const regex = new RegExp(key, "g");
    t = t.replace(regex, fuzzyCorrections[key]);
  });

  // Separar campos colados
  const separadores = [
    "Nome Completo:",
    "Filiação:",
    "Filiacao:",
    "Bilhete de Identidade",
    "Residência:",
    "Residencia:",
    "Natural de:",
    "Província de:",
    "Provincia de:",
    "Data de Nascimento:",
    "Sexo:",
    "Altura",
    "Estado Civil:",
    "Emitido em:",
    "Válido até:",
    "Valido ate:",
    "ASSINATURA",
    "DIRECTOR NACIONAL",
    "REPUBLICA DE ANGOLA",
  ];

  separadores.forEach((sep) => {
    const escaped = sep.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(?<!\\n)(${escaped})`, "gi");
    t = t.replace(regex, "\n$1");
  });

  // Separar campos colados sem dois pontos
  t = t.replace(/(\d{4})(Sexo)/gi, "$1 $2");
  t = t.replace(/([\d,\.]+)(Estado)/gi, "$1 $2");
  t = t.replace(/(\d{4})(Valido)/gi, "$1 $2");
  t = t.replace(/(\d{4})(Emitido)/gi, "$1 $2");
  t = t.replace(/(FEMININO|MASCULINO)\s*(Altura)/gi, "$1 $2");
  t = t.replace(/(SOLTEIRO|SOLTEIRA|CASADO|CASADA)\s*(Emitido)/gi, "$1 $2");

  // Normalizar espaços múltiplos horizontais
  t = t.replace(/[^\S\r\n]+/g, " ");

  return t
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function extractField(
  text: string,
  patterns: RegExp[],
  fallback?: () => string | undefined,
): string | undefined {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1] && match[1].trim()) {
      return match[1].trim().replace(/\s+/g, " ");
    }
  }
  return fallback ? fallback() : undefined;
}

// ===== CORREÇÃO: repairAngolanBI mais conservador =====
function repairAngolanBI(raw: string): string {
  let cleaned = raw.replace(/[\s\-\.\_\|\/]/g, "").toUpperCase();

  // O BI angolano tem exatamente 14 caracteres (9 números + 2 letras + 3 números)
  const match = cleaned.match(/[A-Z0-9]{14}/);
  if (!match) return raw;

  let bi = match[0];
  let part1 = bi.slice(0, 9);
  let part2 = bi.slice(9, 11);
  let part3 = bi.slice(11, 14);

  // Correções conservadoras apenas para erros óbvios de OCR
  // Part 1: Deve ser apenas números
  part1 = part1
    .replace(/[OQ]/g, "0") // O ou Q -> 0
    .replace(/[IL\|]/g, "1") // I, L ou | -> 1
    .replace(/Z/g, "2") // Z -> 2 (erro comum)
    .replace(/S/g, "5") // S -> 5 (erro comum)
    .replace(/B/g, "8") // B -> 8 (erro comum)
    .replace(/G/g, "6") // G -> 6 (erro comum)
    .replace(/T/g, "7"); // T -> 7 (erro comum)

  // Part 2: Deve ser apenas letras (2 letras)
  // Correções conservadoras - apenas erros muito óbvios
  part2 = part2
    .replace(/0/g, "O") // 0 -> O
    .replace(/1/g, "I") // 1 -> I
    .replace(/2/g, "Z") // 2 -> Z
    .replace(/5/g, "S") // 5 -> S
    .replace(/8/g, "B"); // 8 -> B

  // Correções específicas para combinações comuns em BIs angolanos
  if (part2 === "1A" || part2 === "IA" || part2 === "0A") part2 = "LA";
  if (part2 === "8A") part2 = "BA";
  if (part2 === "H1" || part2 === "Hl") part2 = "HI";

  // Part 3: Deve ser apenas números
  part3 = part3
    .replace(/[OQ]/g, "0")
    .replace(/[IL\|]/g, "1")
    .replace(/Z/g, "2")
    .replace(/S/g, "5")
    .replace(/B/g, "8")
    .replace(/G/g, "6")
    .replace(/T/g, "7");

  return part1 + part2 + part3;
}

function parseDocumentText(rawText: string): ExtractedData {
  const data: ExtractedData = {};
  const text = normalizeOCRText(rawText);
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  console.log("=== TEXTO REPARADO E NORMALIZADO ===");
  console.log(text);
  console.log("====================================");

  function fuzzyExtractField(
    keywords: RegExp,
    excludeKeywords: RegExp[] = [],
  ): string | undefined {
    for (let i = 0; i < lines.length; i++) {
      if (keywords.test(lines[i])) {
        let textOnLine = lines[i].replace(keywords, "").trim();
        textOnLine = textOnLine.replace(/^[:\-\._\|\/\s\=]+/, "").trim();

        if (
          textOnLine.length >= 3 &&
          !excludeKeywords.some((ex) => ex.test(textOnLine))
        ) {
          if (
            keywords.source.includes("Filia") &&
            (textOnLine.toLowerCase().endsWith(" e") ||
              textOnLine.toLowerCase().endsWith(" e l") ||
              textOnLine.toLowerCase().endsWith(" e i"))
          ) {
            if (i + 1 < lines.length) {
              const nextLine = lines[i + 1].trim();
              if (
                !/Nome|Filia|Nasc|Sexo|Estado|Emitido|Valido|Bilhete/i.test(
                  nextLine,
                )
              ) {
                textOnLine += " " + nextLine;
              }
            }
          }
          return textOnLine;
        }

        for (let j = 1; j <= 2; j++) {
          if (i + j < lines.length) {
            const nextLine = lines[i + j].trim();
            if (
              nextLine.length >= 3 &&
              !excludeKeywords.some((ex) => ex.test(nextLine)) &&
              !/Nome|Filia|Nasc|Sexo|Estado|Emitido|Valido|Bilhete/i.test(
                nextLine,
              )
            ) {
              return nextLine;
            }
          }
        }
      }
    }
    return undefined;
  }

  // 1. NOME COMPLETO
  data.nome = fuzzyExtractField(/(?:Nome\s*Completo|Nome|Completo)[:\s]*/i);
  if (!data.nome) {
    for (const line of lines) {
      if (
        line.length > 8 &&
        /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]+$/.test(line) &&
        !/REPÚBLICA|ANGOLA|MINISTÉRIO|JUSTIÇA|BILHETE|IDENTIDADE/i.test(line)
      ) {
        data.nome = line;
        break;
      }
    }
  }
  if (data.nome) {
    data.nome = data.nome
      .replace(/[^A-ZÁÉÍÓÚÂÊÔÃÕÇ\s\-]/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  // 2. FILIAÇÃO
  data.filiacao = fuzzyExtractField(/(?:Filia[çc][aã]o|Filia[cç]ao)[:\s]*/i);

  // 3. NÚMERO DO BI - CORREÇÃO: Regex mais flexível para capturar mesmo com erros de OCR
  // Tentar primeiro o formato exato, depois formatos mais flexíveis
  const biPatterns = [
    /\b(\d{9}\s*[A-Z]{2}\s*\d{3})\b/i, // Formato exato
    /\b(\d{8,10}\s*[A-Z]{1,3}\s*\d{2,4})\b/i, // Formato flexível
    /\b([A-Z0-9]{14})\b/i, // 14 caracteres alfanuméricos
  ];

  let biFound = false;
  for (const pattern of biPatterns) {
    const match = text.match(pattern);
    if (match) {
      data.bi = repairAngolanBI(match[1]);
      biFound = true;
      break;
    }
  }

  if (!biFound) {
    const fallbackBi = fuzzyExtractField(
      /(?:Bilhete\s+de\s+Identidade|N[º°\.oO])[:\s]*/i,
    );
    if (fallbackBi) {
      data.bi = repairAngolanBI(fallbackBi);
    }
  }

  // 4. RESIDÊNCIA / ENDEREÇO
  data.endereco = fuzzyExtractField(
    /(?:Resid[eê]ncia|Morada|Residencia)[:\s]*/i,
  );

  // 5. NATURAL DE
  data.naturalDe = fuzzyExtractField(/(?:Natural\s+de|Naturalidade)[:\s]*/i);

  // 6. PROVÍNCIA
  data.provincia = fuzzyExtractField(
    /(?:Prov[ií]ncia(?:\s+de)?|Provincia)[:\s]*/i,
  );

  function cleanOCRDate(dateStr: string): string {
    let cleaned = dateStr.replace(/[Oo]/g, "0");
    cleaned = cleaned.replace(/[lI\|]/g, "1");
    cleaned = cleaned.replace(/[\-\.]/g, "/");
    return cleaned;
  }

  // 7. DATA DE NASCIMENTO - CORREÇÃO: Mais robusto
  const birthKeywords = /(?:Nascimento|Nascido|Nasc)[:\s]*/i;
  for (let i = 0; i < lines.length; i++) {
    if (birthKeywords.test(lines[i])) {
      // Procurar na mesma linha e nas próximas 2 linhas
      for (let j = 0; j <= 2; j++) {
        if (i + j < lines.length) {
          const line = lines[i + j];
          // Tentar vários formatos de data
          const datePatterns = [
            /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})\b/, // DD/MM/AAAA
            /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2})\b/, // DD/MM/AA
            /\b(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})\b/, // AAAA/MM/DD
          ];

          for (const pattern of datePatterns) {
            const dateMatch = line.match(pattern);
            if (dateMatch) {
              data.nasc = cleanOCRDate(dateMatch[1]);
              break;
            }
          }
          if (data.nasc) break;
        }
      }
    }
    if (data.nasc) break;
  }

  // Fallback: procurar qualquer data no texto
  if (!data.nasc) {
    const generalDateMatch = text.match(
      /\b(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})\b/,
    );
    if (generalDateMatch) {
      data.nasc = cleanOCRDate(generalDateMatch[1]);
    }
  }

  // 8. SEXO - CORREÇÃO: Mais preciso
  const sexoLine = lines.find((l) => /Sexo[:\s]*/i.test(l));
  if (sexoLine) {
    if (/FEMININO|\bFEM\b|\bF\b/i.test(sexoLine)) {
      data.sexo = "F";
    } else if (/MASCULINO|\bMASC\b|\bM\b/i.test(sexoLine)) {
      data.sexo = "M";
    }
  }

  // Fallback: procurar no texto geral
  if (!data.sexo) {
    if (/FEMININO/i.test(text)) {
      data.sexo = "F";
    } else if (/MASCULINO/i.test(text)) {
      data.sexo = "M";
    }
  }

  // 9. ESTADO CIVIL
  if (/SOLTEIR[OA]/i.test(text)) data.estadoCivil = "Solteiro(a)";
  else if (/CASAD[OA]/i.test(text)) data.estadoCivil = "Casado(a)";
  else if (/DIVORCIAD[OA]/i.test(text)) data.estadoCivil = "Divorciado(a)";
  else if (/VI[UÚ]V[OA]/i.test(text)) data.estadoCivil = "Viúvo(a)";
  else if (/UNI[AÃ]O\s+DE\s+FACTO/i.test(text))
    data.estadoCivil = "União de Facto";

  // 10. ALTURA
  for (let i = 0; i < lines.length; i++) {
    if (/Altura/i.test(lines[i])) {
      const altMatch = lines[i].match(/\b([12][\.,]\d{2})\b/);
      if (altMatch) {
        data.altura = altMatch[1].replace(",", ".");
        break;
      }
      if (i + 1 < lines.length) {
        const nextAltMatch = lines[i + 1].match(/\b([12][\.,]\d{2})\b/);
        if (nextAltMatch) {
          data.altura = nextAltMatch[1].replace(",", ".");
          break;
        }
      }
    }
  }

  // 11. EMITIDO EM
  const issueKeywords = /(?:Emitido|Emiss[aã]o)[:\s]*/i;
  for (let i = 0; i < lines.length; i++) {
    if (issueKeywords.test(lines[i])) {
      for (let j = 0; j <= 2; j++) {
        if (i + j < lines.length) {
          const dateMatch = lines[i + j].match(
            /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b/,
          );
          if (dateMatch && cleanOCRDate(dateMatch[1]) !== data.nasc) {
            data.emitidoEm = cleanOCRDate(dateMatch[1]);
            break;
          }
        }
      }
    }
    if (data.emitidoEm) break;
  }

  // 12. VÁLIDO ATÉ
  const expiryKeywords = /(?:V[aá]lido|Caducidade|Expira)[:\s]*/i;
  for (let i = 0; i < lines.length; i++) {
    if (expiryKeywords.test(lines[i])) {
      for (let j = 0; j <= 2; j++) {
        if (i + j < lines.length) {
          const dateMatch = lines[i + j].match(
            /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b/,
          );
          if (
            dateMatch &&
            cleanOCRDate(dateMatch[1]) !== data.nasc &&
            cleanOCRDate(dateMatch[1]) !== data.emitidoEm
          ) {
            data.validoAte = cleanOCRDate(dateMatch[1]);
            break;
          }
        }
      }
    }
    if (data.validoAte) break;
  }

  // 13. NACIONALIDADE
  if (/ANGOLA|ANGOLAN/i.test(text) || /REPUBLICA\s+DE\s+ANGOLA/i.test(text)) {
    data.nacionalidade = "Angolana";
  }

  // 14. NIF
  const nifMatch = text.match(/(?:NIF|N\.?I\.?F\.?)[:\s]*(\d{9,10})/i);
  if (nifMatch) {
    data.nif = nifMatch[1];
  }

  return data;
}

// Componente de Cadastro Automático
function AutoRegisterModal({
  onRegister,
  onClose,
}: {
  onRegister: (data: Omit<Paciente, "id">) => void;
  onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [extractedData, setExtractedData] = useState<ExtractedData>({});
  const [error, setError] = useState("");
  const [rawText, setRawText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    const validTypes = [
      "image/jpeg",
      "image/png",
      "image/jpg",
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!validTypes.includes(selectedFile.type)) {
      setError("Formato não suportado. Use IMG, PDF ou DOCX");
      return;
    }
    setError("");
    setFile(selectedFile);
    setExtractedData({});
    setRawText("");
  };

  const processDocument = async () => {
    if (!file) return;
    setProcessing(true);
    setProgress(0);
    setError("");
    setStatus("A preparar...");

    try {
      let text = "";
      let foto: string | undefined;

      if (file.type.startsWith("image/")) {
        setStatus("A carregar motor OCR...");
        setProgress(5);
        const Tesseract = await loadTesseract();
        setProgress(15);

        const reader = new FileReader();
        const imageData = await new Promise<string>((resolve, reject) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = () => reject(new Error("Falha ao ler imagem"));
          reader.readAsDataURL(file);
        });

        setStatus("A melhorar qualidade da imagem...");
        setProgress(20);
        const enhancedImage = await preprocessImage(imageData);
        setProgress(30);

        setStatus("A extrair foto...");
        foto = await extractPhoto(enhancedImage);

        setStatus("A reconhecer texto (isto pode demorar)...");
        setProgress(35);

        // CORREÇÃO: Usar português + inglês para melhor precisão
        const result = await Tesseract.recognize(enhancedImage, "por+eng", {
          logger: (m: any) => {
            if (m.status === "recognizing text") {
              setProgress(35 + Math.round(m.progress * 55));
            }
          },
        });

        text = result?.data?.text || "";
        setProgress(95);
      } else if (file.type === "application/pdf") {
        setStatus("A extrair texto do PDF...");
        setProgress(30);
        text = await extractTextFromPDF(file);
        setProgress(70);
        setStatus("A converter PDF para imagem...");
        const imageData = await convertPdfToImage(file);
        foto = await extractPhoto(imageData);
        setProgress(90);
      } else if (file.type.includes("wordprocessingml")) {
        setStatus("A extrair texto do DOCX...");
        setProgress(50);
        text = await extractTextFromDOCX(file);
        setProgress(90);
      }

      setRawText(text);
      console.log("Texto bruto extraído:", text);

      if (!text || text.trim().length === 0) {
        setError(
          "Nenhum texto foi extraído do documento. Verifique a qualidade da imagem.",
        );
        setProgress(100);
        return;
      }

      const data = parseDocumentText(text);
      if (foto) data.foto = foto;

      setExtractedData(data);
      setStatus("");
      setProgress(100);

      if (!data.nome) {
        setError(
          "Não foi possível extrair o nome. Verifique o documento ou preencha manualmente.",
        );
      }
    } catch (err: any) {
      console.error("Erro ao processar documento:", err);
      const errorMessage = err?.message || "Erro desconhecido";
      setError(
        `Erro ao processar documento: ${errorMessage}. Verifique o formato e conteúdo.`,
      );
    } finally {
      setProcessing(false);
    }
  };

  const extractPhoto = (imageSource: string): Promise<string | undefined> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          const photoWidth = img.width * 0.25;
          const photoHeight = img.height * 0.4;
          const photoX = img.width * 0.02;
          const photoY = img.height * 0.05;
          canvas.width = photoWidth;
          canvas.height = photoHeight;
          ctx?.drawImage(
            img,
            photoX,
            photoY,
            photoWidth,
            photoHeight,
            0,
            0,
            photoWidth,
            photoHeight,
          );
          resolve(canvas.toDataURL("image/jpeg", 0.8));
        } catch {
          resolve(undefined);
        }
      };
      img.onerror = () => resolve(undefined);
      img.src = imageSource;
    });
  };

  const handleRegister = () => {
    if (!extractedData.nome) {
      setError("O nome é obrigatório para cadastrar o paciente.");
      return;
    }
    const pacienteData: Omit<Paciente, "id"> = {
      ...emptyForm,
      nome: extractedData.nome || "",
      nasc: extractedData.nasc || "",
      sexo: extractedData.sexo || "",
      idade: extractedData.nasc ? calcIdade(extractedData.nasc) : "",
      bi: extractedData.bi || "",
      nif: extractedData.nif || "",
      nacionalidade: extractedData.nacionalidade || "Angolana",
      estadoCivil: extractedData.estadoCivil || "",
      endereco: extractedData.endereco || "",
    };
    onRegister(pacienteData);
    onClose();
  };

  const handleEdit = (field: keyof ExtractedData, value: string) => {
    setExtractedData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col my-8">
        <div className="p-6 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-foreground">
                🤖 Cadastro Automático de Paciente
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Carregue um documento (IMG, PDF ou DOCX) — o sistema extrai os
                dados e cadastra automaticamente
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground text-2xl leading-none"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!file ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const droppedFile = e.dataTransfer.files[0];
                if (droppedFile) {
                  const validTypes = [
                    "image/jpeg",
                    "image/png",
                    "image/jpg",
                    "application/pdf",
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                  ];
                  if (validTypes.includes(droppedFile.type)) {
                    setError("");
                    setFile(droppedFile);
                    setExtractedData({});
                    setRawText("");
                  } else {
                    setError("Formato não suportado. Use IMG, PDF ou DOCX");
                  }
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-xl p-12 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
            >
              <div className="text-6xl mb-4">📄</div>
              <div className="text-lg font-bold text-foreground mb-2">
                Arraste o documento aqui ou clique para selecionar
              </div>
              <div className="text-sm text-muted-foreground mb-4">
                Formatos aceites: JPG, PNG, PDF, DOCX
              </div>
              <div className="flex gap-2 justify-center flex-wrap">
                <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold">
                  📷 Imagem
                </span>
                <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-semibold">
                  📄 PDF
                </span>
                <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-semibold">
                  📝 DOCX
                </span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-secondary/30 border border-border rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-foreground">
                      {file.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(2)} KB •{" "}
                      {file.type.split("/")[1].toUpperCase()}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setFile(null);
                      setExtractedData({});
                      setRawText("");
                      setError("");
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Trocar documento
                  </button>
                </div>
              </div>

              {Object.keys(extractedData).filter((k) => k !== "foto").length >
                0 && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="text-sm font-bold text-green-800 mb-3">
                    ✅ Dados Extraídos do BI (edite se necessário)
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2">
                      <label className="text-xs font-semibold text-muted-foreground">
                        Nome Completo *
                      </label>
                      <input
                        value={extractedData.nome || ""}
                        onChange={(e) => handleEdit("nome", e.target.value)}
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                        placeholder="Nome do paciente"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs font-semibold text-muted-foreground">
                        Filiação
                      </label>
                      <input
                        value={extractedData.filiacao || ""}
                        onChange={(e) => handleEdit("filiacao", e.target.value)}
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                        placeholder="Nomes dos pais"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">
                        N.º BI
                      </label>
                      <input
                        value={extractedData.bi || ""}
                        onChange={(e) => handleEdit("bi", e.target.value)}
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                        placeholder="Número do BI"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">
                        Data de Nascimento
                      </label>
                      <input
                        value={extractedData.nasc || ""}
                        onChange={(e) => handleEdit("nasc", e.target.value)}
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                        placeholder="DD/MM/AAAA"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">
                        Sexo
                      </label>
                      <select
                        value={extractedData.sexo || ""}
                        onChange={(e) => handleEdit("sexo", e.target.value)}
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="">Seleccionar...</option>
                        <option value="M">Masculino</option>
                        <option value="F">Feminino</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">
                        Estado Civil
                      </label>
                      <input
                        value={extractedData.estadoCivil || ""}
                        onChange={(e) =>
                          handleEdit("estadoCivil", e.target.value)
                        }
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                        placeholder="Estado civil"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">
                        Natural de
                      </label>
                      <input
                        value={extractedData.naturalDe || ""}
                        onChange={(e) =>
                          handleEdit("naturalDe", e.target.value)
                        }
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                        placeholder="Local de nascimento"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">
                        Província
                      </label>
                      <input
                        value={extractedData.provincia || ""}
                        onChange={(e) =>
                          handleEdit("provincia", e.target.value)
                        }
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                        placeholder="Província"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">
                        Nacionalidade
                      </label>
                      <input
                        value={extractedData.nacionalidade || ""}
                        onChange={(e) =>
                          handleEdit("nacionalidade", e.target.value)
                        }
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                        placeholder="Nacionalidade"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">
                        Altura (m)
                      </label>
                      <input
                        value={extractedData.altura || ""}
                        onChange={(e) => handleEdit("altura", e.target.value)}
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                        placeholder="1.75"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">
                        Emitido em
                      </label>
                      <input
                        value={extractedData.emitidoEm || ""}
                        onChange={(e) =>
                          handleEdit("emitidoEm", e.target.value)
                        }
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                        placeholder="DD/MM/AAAA"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">
                        Válido até
                      </label>
                      <input
                        value={extractedData.validoAte || ""}
                        onChange={(e) =>
                          handleEdit("validoAte", e.target.value)
                        }
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                        placeholder="DD/MM/AAAA"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs font-semibold text-muted-foreground">
                        Residência / Endereço
                      </label>
                      <input
                        value={extractedData.endereco || ""}
                        onChange={(e) => handleEdit("endereco", e.target.value)}
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                        placeholder="Morada completa"
                      />
                    </div>
                  </div>
                </div>
              )}

              {rawText && (
                <details className="bg-secondary/30 border border-border rounded-xl p-3">
                  <summary className="text-xs font-semibold text-muted-foreground cursor-pointer">
                    {" "}
                    Ver texto extraído do documento
                  </summary>
                  <pre className="mt-2 text-xs text-foreground whitespace-pre-wrap bg-white p-3 rounded-lg border border-border max-h-40 overflow-y-auto">
                    {rawText}
                  </pre>
                </details>
              )}

              {processing && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="animate-spin text-2xl">⚙️</div>
                    <div className="text-sm font-semibold text-blue-800">
                      {status} {progress}%
                    </div>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <div className="text-sm font-semibold text-red-800">
                    ❌ {error}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-border bg-secondary/30 flex gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 bg-secondary text-secondary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:bg-accent transition"
          >
            Cancelar
          </button>
          {file &&
            !processing &&
            Object.keys(extractedData).filter((k) => k !== "foto").length ===
              0 && (
              <button
                onClick={processDocument}
                className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-bold hover:opacity-90 transition"
              >
                🔍 Extrair Dados
              </button>
            )}
          {Object.keys(extractedData).filter((k) => k !== "foto").length >
            0 && (
            <>
              <button
                onClick={processDocument}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-600 transition"
              >
                🔄 Re-processar
              </button>
              <button
                onClick={handleRegister}
                className="flex-1 bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-green-600 transition"
              >
                ✅ Cadastrar Paciente
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Scanner de Imagem Local
function DocumentScanner({
  onDataExtracted,
  onClose,
}: {
  onDataExtracted: (data: ExtractedData) => void;
  onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [extractedData, setExtractedData] = useState<ExtractedData>({});
  const [error, setError] = useState("");
  const [rawText, setRawText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    if (!selectedFile.type.startsWith("image/")) {
      setError("Por favor, carregue apenas imagens (JPG, PNG)");
      return;
    }
    setError("");
    setFile(selectedFile);
    setExtractedData({});
    setRawText("");
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type.startsWith("image/")) {
      setError("");
      setFile(droppedFile);
      setExtractedData({});
      setRawText("");
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(droppedFile);
    } else {
      setError("Por favor, carregue apenas imagens (JPG, PNG)");
    }
  };

  const processDocument = async () => {
    if (!file || !preview) return;
    setProcessing(true);
    setProgress(0);
    setError("");
    setStatus("A carregar motor OCR...");

    try {
      setProgress(5);
      const Tesseract = await loadTesseract();
      setProgress(15);

      setStatus("A melhorar qualidade da imagem...");
      const enhancedImage = await preprocessImage(preview);
      setProgress(25);

      setStatus("A extrair foto...");
      const foto = await extractPhoto(enhancedImage);

      setStatus("A reconhecer texto (isto pode demorar)...");
      setProgress(30);

      // CORREÇÃO: Usar português + inglês para melhor precisão
      const result = await Tesseract.recognize(enhancedImage, "por+eng", {
        logger: (m: any) => {
          if (m.status === "recognizing text") {
            setProgress(30 + Math.round(m.progress * 60));
          }
        },
      });

      const text = result?.data?.text || "";
      setRawText(text);
      console.log("Texto extraído:", text);

      if (!text || text.trim().length === 0) {
        setError(
          "Nenhum texto foi extraído. Tente com uma imagem mais clara e bem iluminada.",
        );
        setProgress(100);
        return;
      }

      const data = parseDocumentText(text);
      if (foto) data.foto = foto;
      setExtractedData(data);
      setStatus("");
      setProgress(100);

      if (Object.keys(data).filter((k) => k !== "foto").length === 0) {
        setError(
          "Não foi possível extrair dados. Tente com uma imagem mais clara.",
        );
      }
    } catch (err: any) {
      console.error("Erro ao processar documento:", err);
      const errorMessage = err?.message || "Erro desconhecido";
      setError(
        `Erro ao processar documento: ${errorMessage}. Verifique a qualidade da imagem.`,
      );
    } finally {
      setProcessing(false);
    }
  };

  const extractPhoto = (imageSource: string): Promise<string | undefined> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          const photoWidth = img.width * 0.25;
          const photoHeight = img.height * 0.4;
          const photoX = img.width * 0.02;
          const photoY = img.height * 0.05;
          canvas.width = photoWidth;
          canvas.height = photoHeight;
          ctx?.drawImage(
            img,
            photoX,
            photoY,
            photoWidth,
            photoHeight,
            0,
            0,
            photoWidth,
            photoHeight,
          );
          resolve(canvas.toDataURL("image/jpeg", 0.8));
        } catch {
          resolve(undefined);
        }
      };
      img.onerror = () => resolve(undefined);
      img.src = imageSource;
    });
  };

  const handleConfirm = () => {
    onDataExtracted(extractedData);
    onClose();
  };

  const handleEdit = (field: keyof ExtractedData, value: string) => {
    setExtractedData((prev) => ({ ...prev, [field]: value }));
  };

  const dataFieldsCount = Object.keys(extractedData).filter(
    (k) => k !== "foto",
  ).length;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col my-8">
        <div className="p-6 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-foreground">
                📄 Scanner de Documentos
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Carregue uma imagem do BI/Passaporte para extração automática
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground text-2xl leading-none"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!file ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-xl p-12 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
            >
              <div className="text-6xl mb-4">📷</div>
              <div className="text-lg font-bold text-foreground mb-2">
                Arraste a imagem aqui ou clique para selecionar
              </div>
              <div className="text-sm text-muted-foreground">
                Formatos aceites: JPG, PNG (máx. 10MB)
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="text-sm font-semibold text-foreground mb-2">
                    Documento Original
                  </div>
                  <div className="border border-border rounded-lg overflow-hidden bg-secondary/20">
                    <img
                      src={preview}
                      alt="Preview"
                      className="w-full h-96 object-contain"
                    />
                  </div>
                  <button
                    onClick={() => {
                      setFile(null);
                      setPreview("");
                      setExtractedData({});
                      setRawText("");
                      setError("");
                    }}
                    className="mt-2 text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Trocar imagem
                  </button>
                </div>
                {extractedData.foto && (
                  <div>
                    <div className="text-sm font-semibold text-foreground mb-2">
                      Foto Extraída
                    </div>
                    <div className="border border-border rounded-lg overflow-hidden bg-secondary/20 flex items-center justify-center h-96">
                      <img
                        src={extractedData.foto}
                        alt="Foto"
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                  </div>
                )}
              </div>

              {dataFieldsCount > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="text-sm font-bold text-green-800 mb-3">
                    ✅ Dados Extraídos (edite se necessário)
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2">
                      <label className="text-xs font-semibold text-muted-foreground">
                        Nome Completo
                      </label>
                      <input
                        value={extractedData.nome || ""}
                        onChange={(e) => handleEdit("nome", e.target.value)}
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                        placeholder="Nome"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs font-semibold text-muted-foreground">
                        Filiação
                      </label>
                      <input
                        value={extractedData.filiacao || ""}
                        onChange={(e) => handleEdit("filiacao", e.target.value)}
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                        placeholder="Nomes dos pais"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">
                        N.º BI
                      </label>
                      <input
                        value={extractedData.bi || ""}
                        onChange={(e) => handleEdit("bi", e.target.value)}
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                        placeholder="BI"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">
                        Data de Nascimento
                      </label>
                      <input
                        value={extractedData.nasc || ""}
                        onChange={(e) => handleEdit("nasc", e.target.value)}
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                        placeholder="DD/MM/AAAA"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">
                        Sexo
                      </label>
                      <select
                        value={extractedData.sexo || ""}
                        onChange={(e) => handleEdit("sexo", e.target.value)}
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="">Seleccionar...</option>
                        <option value="M">Masculino</option>
                        <option value="F">Feminino</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">
                        Estado Civil
                      </label>
                      <input
                        value={extractedData.estadoCivil || ""}
                        onChange={(e) =>
                          handleEdit("estadoCivil", e.target.value)
                        }
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                        placeholder="Estado civil"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">
                        Natural de
                      </label>
                      <input
                        value={extractedData.naturalDe || ""}
                        onChange={(e) =>
                          handleEdit("naturalDe", e.target.value)
                        }
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                        placeholder="Local"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">
                        Província
                      </label>
                      <input
                        value={extractedData.provincia || ""}
                        onChange={(e) =>
                          handleEdit("provincia", e.target.value)
                        }
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                        placeholder="Província"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">
                        Nacionalidade
                      </label>
                      <input
                        value={extractedData.nacionalidade || ""}
                        onChange={(e) =>
                          handleEdit("nacionalidade", e.target.value)
                        }
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                        placeholder="Nacionalidade"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">
                        Altura (m)
                      </label>
                      <input
                        value={extractedData.altura || ""}
                        onChange={(e) => handleEdit("altura", e.target.value)}
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                        placeholder="1.75"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">
                        Emitido em
                      </label>
                      <input
                        value={extractedData.emitidoEm || ""}
                        onChange={(e) =>
                          handleEdit("emitidoEm", e.target.value)
                        }
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                        placeholder="DD/MM/AAAA"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">
                        Válido até
                      </label>
                      <input
                        value={extractedData.validoAte || ""}
                        onChange={(e) =>
                          handleEdit("validoAte", e.target.value)
                        }
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                        placeholder="DD/MM/AAAA"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs font-semibold text-muted-foreground">
                        Residência / Endereço
                      </label>
                      <input
                        value={extractedData.endereco || ""}
                        onChange={(e) => handleEdit("endereco", e.target.value)}
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                        placeholder="Morada"
                      />
                    </div>
                  </div>
                </div>
              )}

              {rawText && (
                <details className="bg-secondary/30 border border-border rounded-xl p-3">
                  <summary className="text-xs font-semibold text-muted-foreground cursor-pointer">
                    📝 Ver texto bruto extraído
                  </summary>
                  <pre className="mt-2 text-xs text-foreground whitespace-pre-wrap bg-white p-3 rounded-lg border border-border max-h-40 overflow-y-auto">
                    {rawText}
                  </pre>
                </details>
              )}

              {processing && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="animate-spin text-2xl">⚙️</div>
                    <div className="text-sm font-semibold text-blue-800">
                      {status} {progress}%
                    </div>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <div className="text-sm font-semibold text-red-800">
                    ❌ {error}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-border bg-secondary/30 flex gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 bg-secondary text-secondary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:bg-accent transition"
          >
            Cancelar
          </button>
          {file && !processing && dataFieldsCount === 0 && (
            <button
              onClick={processDocument}
              className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-bold hover:opacity-90 transition"
            >
              🔍 Extrair Dados
            </button>
          )}
          {dataFieldsCount > 0 && (
            <>
              <button
                onClick={processDocument}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-600 transition"
              >
                🔄 Re-processar
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-green-600 transition"
              >
                ✅ Confirmar e Preencher
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function getInitials(nome: string) {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function getSexoColor(sexo: string) {
  if (sexo === "M")
    return { bg: "bg-blue-100", text: "text-blue-700", label: "Masculino" };
  if (sexo === "F")
    return { bg: "bg-pink-100", text: "text-pink-700", label: "Feminino" };
  return { bg: "bg-slate-100", text: "text-slate-600", label: "Indeterminado" };
}

function calcIdade(nasc: string): string {
  const date = parseBirthDate(nasc);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (!date || date > today) return "";
  let years = today.getFullYear() - date.getFullYear();
  if (
    today.getMonth() < date.getMonth() ||
    (today.getMonth() === date.getMonth() && today.getDate() < date.getDate())
  )
    years--;
  if (years > 0) return `${years} ${years === 1 ? "ano" : "anos"}`;
  let months =
    (today.getFullYear() - date.getFullYear()) * 12 +
    today.getMonth() -
    date.getMonth();
  if (today.getDate() < date.getDate()) months--;
  if (months > 0) return `${months} ${months === 1 ? "mês" : "meses"}`;
  const days = Math.round(
    (Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) -
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())) /
      86400000,
  );
  return `${days} ${days === 1 ? "dia" : "dias"}`;
}

// Classificação administrativa partilhada pela instituição e QR de identificação.
interface CadastroSession {
  funcao?: string;
  empresaId?: string;
  empresaNome?: string;
  username?: string;
}
const TIPOS_PACIENTE = [
  { value: "particular", label: "Particular" },
  { value: "assegurado", label: "Assegurado" },
  { value: "empresa", label: "Empresa" },
  { value: "convenio", label: "Convénio" },
  { value: "funcionario", label: "Funcionário" },
  { value: "isento", label: "Isento" },
] as const;
type TipoPaciente = (typeof TIPOS_PACIENTE)[number]["value"];
interface CadastroAdmin {
  tipo: TipoPaciente;
  entidade: string;
  seguradoraId: string;
  apolice: string;
  cartao: string;
  plano: string;
  inicio: string;
  fim: string;
  cobertura: string;
  autorizacao: string;
  observacoes: string;
}
type CadastroMap = Record<string, CadastroAdmin>;
interface InsurerChoice {
  id: string;
  nome: string;
  cobertura: number;
  activa: boolean;
}
const novoAdmin = (): CadastroAdmin => ({
  tipo: "particular",
  entidade: "",
  seguradoraId: "",
  apolice: "",
  cartao: "",
  plano: "",
  inicio: "",
  fim: "",
  cobertura: "100",
  autorizacao: "",
  observacoes: "",
});
const tipoLabel = (tipo?: string) =>
  TIPOS_PACIENTE.find((t) => t.value === tipo)?.label ?? "Não classificado";
const processKey = (processo: string) => `P:${processo.trim().toUpperCase()}`;
function parseBirthDate(value: string): Date | null {
  let year: number, month: number, day: number;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value))
    [year, month, day] = value.split("-").map(Number);
  else if (/^\d{1,2}[/.\-]\d{1,2}[/.\-]\d{4}$/.test(value))
    [day, month, year] = value.split(/[/.\-]/).map(Number);
  else return null;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date
    : null;
}
function localToday() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
// Formato textual observado no QR de um BI angolano. Outros formatos são rejeitados.
function parseAngolanBiQr(value: string) {
  const lines = value
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((x) => x.trim());
  if (
    lines.length !== 11 ||
    lines[10] !== "V01" ||
    !/^\d{9}[A-Z]{2}\d{3}$/.test(lines[2])
  )
    throw new Error("QR não reconhecido como BI no formato V01 suportado.");
  for (const index of [4, 7, 8]) {
    if (
      !/^\d{2}\/\d{2}\/\d{4}$/.test(lines[index]) ||
      !parseBirthDate(lines[index])
    )
      throw new Error("O QR contém datas inválidas.");
  }
  if (!lines[0] || !lines[1] || !["MASCULINO", "FEMININO"].includes(lines[5]))
    throw new Error("Identificação incompleta no QR.");
  const birth = parseBirthDate(lines[4])!;
  if (birth > new Date()) throw new Error("Data de nascimento futura no QR.");
  const civil: Record<string, string> = {
    SOLTEIRO: "Solteiro(a)",
    SOLTEIRA: "Solteiro(a)",
    CASADO: "Casado(a)",
    CASADA: "Casado(a)",
    DIVORCIADO: "Divorciado(a)",
    DIVORCIADA: "Divorciado(a)",
    VIÚVO: "Viúvo(a)",
    VIÚVA: "Viúvo(a)",
    "UNIÃO DE FACTO": "União de Facto",
  };
  return {
    nome: lines[0] + " " + lines[1],
    bi: lines[2],
    nasc: lines[4],
    sexo: lines[5] === "MASCULINO" ? "M" : "F",
    estadoCivil: civil[lines[6]] || "",
  };
}
function qrValue(pacienteId: number, empresaId: string) {
  return JSON.stringify({
    app: "hospital-paciente",
    v: 1,
    empresaId,
    pacienteId,
  });
}
function parsePatientQr(value: string, empresaId?: string): number {
  if (!empresaId) throw new Error("Seleccione a instituição antes de ler QR.");
  if (value.length > 1500) throw new Error("QR inválido.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Este QR não é um cartão de paciente desta aplicação.");
  }
  if (!parsed || typeof parsed !== "object") throw new Error("QR inválido.");
  const q = parsed as Record<string, unknown>;
  if (
    q.app !== "hospital-paciente" ||
    q.v !== 1 ||
    !Number.isSafeInteger(q.pacienteId) ||
    Number(q.pacienteId) < 0
  )
    throw new Error("Formato de QR não suportado.");
  if (q.empresaId !== empresaId)
    throw new Error("Este cartão pertence a outra instituição.");
  return q.pacienteId as number;
}
function CadastroAdministrativo({
  value,
  onChange,
  insurers,
  storageError,
}: {
  value: CadastroAdmin;
  onChange: (v: CadastroAdmin) => void;
  insurers: InsurerChoice[];
  storageError: string;
}) {
  const input =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
  const change = (key: keyof CadastroAdmin, v: string) =>
    onChange({ ...value, [key]: v });
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-bold text-primary">
          Tipo de paciente e entidade pagadora
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          A classificação administrativa é guardada no servidor da instituição.
          Não altera automaticamente preços, facturas ou a cobertura contratual.
        </p>
      </div>
      {storageError && (
        <p role="alert" className="text-sm text-red-700">
          {storageError}
        </p>
      )}
      <label className="block space-y-1 text-sm">
        <span>Tipo de paciente *</span>
        <select
          aria-label="Tipo de paciente"
          className={input}
          value={value.tipo}
          onChange={(e) =>
            onChange({ ...novoAdmin(), tipo: e.target.value as TipoPaciente })
          }
        >
          {TIPOS_PACIENTE.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      {value.tipo === "particular" && (
        <p className="rounded-lg bg-secondary/50 p-3 text-sm">
          Pagamento particular pelo próprio paciente ou responsável.
        </p>
      )}
      {value.tipo === "assegurado" && (
        <>
          <label className="block space-y-1 text-sm">
            <span>Seguradora cadastrada</span>
            <select
              className={input}
              value={value.seguradoraId}
              onChange={(e) => {
                const s = insurers.find((item) => item.id === e.target.value);
                onChange({
                  ...value,
                  seguradoraId: e.target.value,
                  entidade: s?.nome ?? "",
                  cobertura: String(s?.cobertura ?? 100),
                });
              }}
            >
              <option value="">Indicar manualmente</option>
              {insurers.map((s) => (
                <option key={s.id} value={s.id} disabled={!s.activa}>
                  {s.nome}
                  {s.activa ? "" : " (inactiva)"}
                </option>
              ))}
            </select>
          </label>
          {!insurers.length && (
            <p className="text-xs text-muted-foreground">
              Pode indicar o nome manualmente ou cadastrar a seguradora na
              página Seguradoras, com o mesmo utilizador e instituição.
            </p>
          )}
        </>
      )}
      {value.tipo !== "particular" && (
        <label className="block space-y-1 text-sm">
          <span>
            {value.tipo === "assegurado"
              ? "Nome da seguradora *"
              : value.tipo === "isento"
                ? "Entidade / motivo da isenção *"
                : "Empresa / entidade responsável *"}
          </span>
          <input
            aria-label="Entidade pagadora"
            maxLength={160}
            className={input}
            value={value.entidade}
            readOnly={!!value.seguradoraId && value.tipo === "assegurado"}
            onChange={(e) => change("entidade", e.target.value)}
          />
        </label>
      )}
      {value.tipo === "assegurado" && (
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ["cartao", "N.º do cartão *"],
              ["apolice", "N.º da apólice"],
              ["plano", "Plano"],
              ["autorizacao", "N.º de autorização"],
            ] as [keyof CadastroAdmin, string][]
          ).map(([key, label]) => (
            <label key={key} className="block space-y-1 text-sm">
              <span>{label}</span>
              <input
                maxLength={120}
                aria-label={label}
                className={input}
                value={value[key]}
                onChange={(e) => change(key, e.target.value)}
              />
            </label>
          ))}
          <label className="block space-y-1 text-sm">
            <span>Início da validade *</span>
            <input
              aria-label="Início da validade"
              type="date"
              className={input}
              value={value.inicio}
              onChange={(e) => change("inicio", e.target.value)}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span>Fim da validade *</span>
            <input
              aria-label="Fim da validade"
              type="date"
              min={value.inicio || undefined}
              className={input}
              value={value.fim}
              onChange={(e) => change("fim", e.target.value)}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span>Cobertura da seguradora (%) *</span>
            <input
              aria-label="Cobertura da seguradora"
              type="number"
              min={0}
              max={100}
              step={0.01}
              className={input}
              value={value.cobertura}
              onChange={(e) => change("cobertura", e.target.value)}
            />
          </label>
          <p className="self-center text-sm text-muted-foreground">
            Comparticipação do utente:{" "}
            {value.cobertura.trim() && Number.isFinite(Number(value.cobertura))
              ? `${(100 - Number(value.cobertura)).toFixed(2)}%`
              : "—"}
          </p>
          {!!value.fim && value.fim < localToday() && (
            <p className="text-sm text-amber-700">
              O cartão está expirado. Confirme a cobertura antes do atendimento.
            </p>
          )}
        </div>
      )}
      <label className="block space-y-1 text-sm">
        <span>Observações administrativas</span>
        <textarea
          maxLength={1000}
          rows={3}
          className={input}
          value={value.observacoes}
          onChange={(e) => change("observacoes", e.target.value)}
        />
      </label>
    </div>
  );
}
function PatientQrCard({
  patient,
  session,
  onClose,
}: {
  patient: Paciente;
  session?: CadastroSession;
  onClose: () => void;
}) {
  const [image, setImage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    if (!session?.empresaId) {
      setError("Seleccione uma instituição para emitir este cartão.");
      return;
    }
    QRCode.toDataURL(qrValue(patient.id, session.empresaId), {
      width: 360,
      margin: 4,
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (active) setImage(url);
      })
      .catch(() => {
        if (active) setError("Não foi possível gerar o QR.");
      });
    return () => {
      active = false;
    };
  }, [patient.id, session?.empresaId]);
  function printCard() {
    if (!image) return;
    const popup = window.open("", "_blank", "width=620,height=720");
    if (!popup) {
      setError("Permita a abertura da janela para imprimir o cartão.");
      return;
    }
    const doc = popup.document;
    doc.title = "Cartão do paciente";
    const style = doc.createElement("style");
    style.textContent =
      "body{font:16px system-ui;text-align:center;padding:30px}img{width:260px}small{display:block;margin:12px}";
    doc.head.append(style);
    for (const text of [
      session?.empresaNome || "Cartão do paciente",
      patient.nome,
      `Processo: ${patient.processo || patient.id}`,
    ]) {
      const p = doc.createElement("p");
      p.textContent = text;
      doc.body.append(p);
    }
    const img = doc.createElement("img");
    img.alt = "QR do paciente";
    img.onload = () => {
      popup.focus();
      popup.print();
    };
    img.src = image;
    doc.body.append(img);
    const note = doc.createElement("small");
    note.textContent =
      "Identificação para consulta interna. Não comprova cobertura nem autoriza acesso ao sistema.";
    doc.body.append(note);
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Cartão QR do paciente"
        className="max-h-[90vh] w-full max-w-sm overflow-auto rounded-xl bg-background p-5 text-center shadow-xl"
      >
        <h3 className="text-lg font-bold">Cartão QR do Paciente</h3>
        <p className="mt-2 font-semibold">{patient.nome}</p>
        <p className="text-sm text-muted-foreground">
          {session?.empresaNome} · Processo {patient.processo || patient.id}
        </p>
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {image && (
          <img
            src={image}
            alt="Código QR de identificação do paciente"
            className="mx-auto my-3 w-64 bg-white"
          />
        )}
        <p className="text-xs text-muted-foreground">
          O QR contém apenas a instituição e o identificador interno. Não contém
          nome, BI, resultados ou dados clínicos e não substitui a autenticação.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {image && (
            <a
              href={image}
              download={`paciente-${patient.id}-qr.png`}
              className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
            >
              Descarregar PNG
            </a>
          )}
          <button
            type="button"
            disabled={!image}
            onClick={printCard}
            className="rounded-lg border border-border px-3 py-2 text-sm"
          >
            Imprimir
          </button>
          <button
            autoFocus
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-2 text-sm"
          >
            Fechar
          </button>
        </div>
      </section>
    </div>
  );
}
function PatientQrScanner({
  onRead,
  onClose,
}: {
  onRead: (text: string) => void;
  onClose: () => void;
}) {
  const [cameraOn, setCameraOn] = useState(false);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (!cameraOn) return;
    let cancelled = false;
    let stream: MediaStream | undefined;
    let frame = 0;
    let last = 0;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const tick = (now: number) => {
      if (cancelled) return;
      const video = videoRef.current;
      if (ctx && video && video.readyState >= 2 && now - last > 250) {
        last = now;
        const scale = Math.min(1, 960 / video.videoWidth);
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(pixels.data, pixels.width, pixels.height, {
          inversionAttempts: "attemptBoth",
        });
        if (code) {
          setCameraOn(false);
          onRead(code.data);
          return;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error(
            "A câmara requer HTTPS ou localhost e um navegador compatível.",
          );
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          frame = requestAnimationFrame(tick);
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Não foi possível abrir a câmara.",
          );
          setCameraOn(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [cameraOn, onRead]);
  async function readFile(file?: File) {
    if (!file) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 10 * 1024 * 1024
    ) {
      setError("Seleccione uma imagem PNG, JPG ou WebP até 10 MB.");
      return;
    }
    setBusy(true);
    setError("");
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Imagem inválida."));
        image.src = url;
      });
      if (!alive.current) return;
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 1800 / Math.max(image.width, image.height));
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Leitura de imagem indisponível.");
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(pixels.data, pixels.width, pixels.height, {
        inversionAttempts: "attemptBoth",
      });
      if (!code)
        throw new Error("Não foi encontrado um QR legível nesta imagem.");
      onRead(code.data);
    } catch (e) {
      if (alive.current)
        setError(e instanceof Error ? e.message : "Falha ao ler a imagem.");
    } finally {
      URL.revokeObjectURL(url);
      if (alive.current) setBusy(false);
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Ler QR do paciente"
        className="max-h-[90vh] w-full max-w-lg space-y-3 overflow-auto rounded-xl bg-background p-5"
      >
        <h3 className="text-lg font-bold">Ler BI ou cartão do paciente</h3>
        <p className="text-xs text-muted-foreground">
          Leia o QR do BI angolano (formato V01) ou o cartão do paciente. Se o
          BI já existir, abre o perfil; caso contrário, permite preencher um
          novo cadastro para revisão. Não abre ligações externas.
        </p>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        {cameraOn && (
          <video
            ref={videoRef}
            muted
            playsInline
            className="w-full rounded-lg bg-black"
          />
        )}
        <button
          type="button"
          className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground"
          onClick={() => {
            setError("");
            setCameraOn((v) => !v);
          }}
        >
          {cameraOn ? "Parar câmara" : "Abrir câmara"}
        </button>
        <label className="block space-y-1 text-sm">
          <span>{busy ? "A ler imagem…" : "Ou carregar imagem do QR"}</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={busy}
            onChange={(e) => {
              void readFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span>Ou colar conteúdo do QR</span>
          <textarea
            aria-label="Conteúdo do QR"
            maxLength={1500}
            className="w-full rounded-lg border border-border bg-background p-2"
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={!text.trim()}
            onClick={() => onRead(text.trim())}
            className="rounded-lg border border-border px-3 py-2 text-sm"
          >
            Ler e pesquisar
          </button>
          <button
            autoFocus
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-2 text-sm"
          >
            Fechar
          </button>
        </div>
      </section>
    </div>
  );
}

export default function Pacientes({
  session,
}: { session?: CadastroSession } = {}) {
  const scope = session?.empresaId
    ? `${encodeURIComponent(session.empresaId)}:${encodeURIComponent(session.username ?? "utilizador")}`
    : "";
  return <PacientesWorkspace key={scope} session={session} scope={scope} />;
}

function PacientesWorkspace({
  session,
  scope,
}: {
  session?: CadastroSession;
  scope: string;
}) {
  const { data, reload, removePaciente } = useApp();
  const [view, setView] = useState<ViewMode>("lista");
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<number | null>(null);
  const [perfilId, setPerfilId] = useState<number | null>(null);
  const [geography,setGeography]=useState<PatientGeography>(emptyPatientGeography);
  const [geographyDirty,setGeographyDirty]=useState(false);
  const [geographyReady,setGeographyReady]=useState(true);
  const [geographyError,setGeographyError]=useState("");
  useEffect(()=>{let live=true;setGeographyDirty(false);setGeographyError("");if(view!=="form")return;
    setGeography(emptyPatientGeography());if(editId===null){setGeographyReady(true);return;}
    setGeographyReady(false);void hospitalApi<any>("GET","/geography/patients/"+editId).then(row=>{if(live){if(row?.data)setGeography(row.data);setGeographyReady(true);}}).catch(e=>{if(live)setGeographyError(e.message);});return()=>{live=false;};
  },[editId,view]);

  const [section, setSection] = useState<
    "identificacao" | "administrativo" | "clinico" | "laboratorial"
  >("identificacao");
  const [search, setSearch] = useState("");
  const [filtroSexo, setFiltroSexo] = useState("");
  const [viewStyle, setViewStyle] = useState<"cards" | "tabela">("cards");
  const [showScanner, setShowScanner] = useState(false);
  const [showAutoRegister, setShowAutoRegister] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const storageKey = scope ? `hospital:cadastro-paciente:v1:${scope}` : "";
  const [loadedAdmin, setLoadedAdmin] = useState<{
    data: CadastroMap;
    error: string;
  }>({ data: {}, error: "A carregar a classificação do servidor…" });
  const adminRevisions = useRef<Record<number, number>>({});
  const [adminMap, setAdminMap] = useState<CadastroMap>(loadedAdmin.data);
  const [adminForm, setAdminForm] = useState<CadastroAdmin>(novoAdmin);
  const [filtroTipo, setFiltroTipo] = useState("");
  const [qrPaciente, setQrPaciente] = useState<Paciente | null>(null);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [insurers, setInsurers] = useState<InsurerChoice[]>([]);
  useEffect(() => {
    let active = true;
    void Promise.all([
      hospitalApi<any[]>("GET", "/records/patient-admin"),
      hospitalApi<any[]>("GET", "/records/insurance"),
    ])
      .then(([rows, insurance]) => {
        if (!active) return;
        const map: CadastroMap = {};
        const revisions: Record<number, number> = {};
        for (const row of rows) {
          map[
            row.data.processo
              ? processKey(row.data.processo)
              : `ID:${row.data.patientId}`
          ] = row.data.administration;
          revisions[row.data.patientId] = row.revision;
        }
        adminRevisions.current = revisions;
        setAdminMap(map);
        setLoadedAdmin({ data: map, error: "" });
        setInsurers(insurance.flatMap((row) => row.data.seguradoras || []));
      })
      .catch((e) => {
        if (active) setLoadedAdmin({ data: {}, error: e.message });
      });
    return () => {
      active = false;
    };
  }, [scope]);
  const getAdmin = useCallback(
    (p: Paciente) =>
      adminMap[p.processo ? processKey(p.processo) : `ID:${p.id}`],
    [adminMap],
  );
  const readQr = useCallback(
    (value: string) => {
      try {
        if (value.trim().startsWith("{")) {
          const id = parsePatientQr(value, session?.empresaId);
          const patient = data.pacientes.find((p) => p.id === id);
          if (!patient)
            throw new Error(
              "Paciente não encontrado nos registos carregados desta instituição.",
            );
          setPerfilId(id);
          setView("perfil");
          setShowQrScanner(false);
          setToast(null);
          return;
        }
        const documentData = parseAngolanBiQr(value);
        const normalise = (text: string) =>
          text.replace(/\s/g, "").toUpperCase();
        const existing = data.pacientes.find(
          (p) => normalise(p.bi || "") === normalise(documentData.bi),
        );
        if (existing) {
          setPerfilId(existing.id);
          setView("perfil");
          setShowQrScanner(false);
          setToast({
            message:
              "Paciente localizado pelo BI. O cadastro existente foi preservado.",
            type: "success",
          });
          return;
        }
        if (
          !window.confirm(
            "BI ainda não cadastrado. Abrir um novo cadastro com os dados lidos? Os dados não serão gravados até confirmar no formulário.",
          )
        )
          return;
        if (
          view === "form" &&
          !window.confirm(
            "Existe um formulário aberto. Substituir os dados ainda não guardados por um novo cadastro?",
          )
        )
          return;
        setForm({
          ...emptyForm,
          ...documentData,
          idade: calcIdade(documentData.nasc),
        });
        setAdminForm(novoAdmin());
        setEditId(null);
        setSection("identificacao");
        setView("form");
        setShowQrScanner(false);
        setToast({
          message:
            "Dados do QR preenchidos. Confira o nome e as datas com o BI e escolha o tipo de paciente antes de guardar.",
          type: "info",
        });
      } catch (error) {
        setToast({
          message: error instanceof Error ? error.message : "QR inválido.",
          type: "error",
        });
        window.alert(error instanceof Error ? error.message : "QR inválido.");
      }
    },
    [data.pacientes, session?.empresaId, view],
  );
  const qrOverlays = (
    <>
      {qrPaciente && (
        <PatientQrCard
          patient={qrPaciente}
          session={session}
          onClose={() => setQrPaciente(null)}
        />
      )}
      {showQrScanner && (
        <PatientQrScanner
          onRead={readQr}
          onClose={() => setShowQrScanner(false)}
        />
      )}
    </>
  );
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function f(field: keyof typeof emptyForm, val: string) {
    setForm((prev) => ({ ...prev, [field]: val }));
  }

  function handleNovo() {
    setForm(emptyForm);
    setAdminForm(novoAdmin());
    setToast(null);
    setEditId(null);
    setSection("identificacao");
    setView("form");
  }

  function handleEdit(p: Paciente) {
    const { id, ...rest } = p;
    setForm({ ...emptyForm, ...rest });
    setAdminForm(getAdmin(p) ? { ...getAdmin(p)! } : novoAdmin());
    setToast(null);
    setEditId(id);
    setSection("identificacao");
    setView("form");
  }

  function handlePerfil(p: Paciente) {
    setPerfilId(p.id);
    setView("perfil");
  }

  function handleDocumentData(data: ExtractedData) {
    setForm((prev) => {
      const nasc = data.nasc || prev.nasc;
      const idade = nasc ? calcIdade(nasc) : prev.idade;
      return {
        ...prev,
        nome: data.nome || prev.nome,
        nasc,
        idade,
        sexo: data.sexo || prev.sexo,
        bi: data.bi || prev.bi,
        nif: data.nif || prev.nif,
        nacionalidade: data.nacionalidade || prev.nacionalidade,
        estadoCivil: data.estadoCivil || prev.estadoCivil,
        endereco: data.endereco || prev.endereco,
      };
    });
    setToast({
      message: "✅ Dados extraídos com sucesso! Revise e ajuste se necessário.",
      type: "success",
    });
  }

  function handleAutoRegister(pacienteData: Omit<Paciente, "id">) {
    setForm({ ...emptyForm, ...pacienteData });
    setAdminForm(novoAdmin());
    setEditId(null);
    setSection("identificacao");
    setView("form");
    setToast({
      message:
        "Dados extraídos. Revise a identificação e escolha o tipo de paciente antes de guardar.",
      type: "info",
    });
  }

  async function handleSubmit() {
    if (savingRef.current) return;
    const fail = (
      message: string,
      target: typeof section = "identificacao",
    ) => {
      setToast({ message, type: "error" });
      setSection(target);
    };
    if (!form.nome.trim()) {
      fail("O nome do paciente é obrigatório.");
      return;
    }
    const birth = form.nasc ? parseBirthDate(form.nasc) : null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (form.nasc && (!birth || birth > today)) {
      fail("Indique uma data de nascimento válida, sem data futura.");
      return;
    }
    const normalise = (value: string) => value.replace(/\s/g, "").toUpperCase();
    if (
      (form.bi || "").trim() &&
      data.pacientes.some(
        (p) =>
          p.id !== editId && normalise(p.bi || "") === normalise(form.bi || ""),
      )
    ) {
      fail(
        "Já existe um paciente com este documento. Pesquise o registo antes de cadastrar novamente.",
      );
      return;
    }
    if (
      (form.email || "").trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((form.email || "").trim())
    ) {
      fail("Verifique o endereço de email.");
      return;
    }
    if (loadedAdmin.error) {
      fail(loadedAdmin.error, "administrativo");
      return;
    }
    if (adminForm.tipo !== "particular" && !adminForm.entidade.trim()) {
      fail(
        "Indique a entidade pagadora ou o motivo da isenção.",
        "administrativo",
      );
      return;
    }
    if (adminForm.tipo === "assegurado") {
      if (
        !adminForm.cartao.trim() ||
        !adminForm.inicio ||
        !adminForm.fim ||
        !parseBirthDate(adminForm.inicio) ||
        !parseBirthDate(adminForm.fim) ||
        adminForm.fim < adminForm.inicio ||
        !adminForm.cobertura.trim() ||
        !Number.isFinite(Number(adminForm.cobertura)) ||
        Number(adminForm.cobertura) < 0 ||
        Number(adminForm.cobertura) > 100
      ) {
        fail(
          "Preencha o cartão, a validade correcta e uma cobertura entre 0 e 100%.",
          "administrativo",
        );
        return;
      }
      if (
        adminForm.seguradoraId &&
        !insurers.some((s) => s.id === adminForm.seguradoraId && s.activa)
      ) {
        fail(
          "A seguradora seleccionada não está activa. Confirme o cadastro da seguradora.",
          "administrativo",
        );
        return;
      }
    }
    const { processo: _processo, nAmostra: _amostra, ...patientFields } = form;
    const payload = {
      ...patientFields,
      nome: form.nome.trim(),
      bi: (form.bi || "").trim(),
      email: (form.email || "").trim(),
      idade: form.nasc ? calcIdade(form.nasc) : form.idade,
    };
    const previousPatient =
      editId !== null ? data.pacientes.find((p) => p.id === editId) : undefined;
    const previousKey = previousPatient
      ? previousPatient.processo
        ? processKey(previousPatient.processo)
        : `ID:${previousPatient.id}`
      : "";
    const administration = {
      ...adminForm,
      entidade: adminForm.entidade.trim(),
      cartao: adminForm.cartao.trim(),
      apolice: adminForm.apolice.trim(),
    };
    savingRef.current = true;
    setSaving(true);
    try {
      const saved = await hospitalApi<{
        patient: { id: number; processo: string };
        adminRevision: number;
      }>("POST", "/patient-registration", {
        id: editId,
        patient: payload,
        ...(geographyDirty ? {geography} : {}),
        administration,
        adminRevision:
          editId !== null ? adminRevisions.current[editId] || 0 : 0,
      });
      adminRevisions.current[saved.patient.id] = saved.adminRevision;
      const savedKey = saved.patient.processo ? processKey(saved.patient.processo) : `ID:${saved.patient.id}`;
      setAdminMap((current) => {
        const next = { ...current };
        if (previousKey && previousKey !== savedKey) delete next[previousKey];
        next[savedKey] = administration;
        return next;
      });
      await reload();
      setView("lista");
      setEditId(null);
      setForm(emptyForm);
      setAdminForm(novoAdmin());
      setToast({
        message:
          saved.patient.processo ? `Paciente guardado · Processo ${saved.patient.processo}.` : "Paciente e classificação administrativa confirmados no servidor.",
        type: "success",
      });
    } catch (error) {
      fail(
        error instanceof Error
          ? error.message
          : "Gravação não confirmada; o formulário foi preservado.",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function handleRemove(id: number, nome: string) {
    if (
      window.confirm(
        `Remover o paciente "${nome}"? Esta acção não pode ser desfeita.`,
      )
    ) {
      removePaciente(id);
      if (view === "perfil") setView("lista");
    }
  }

  const filtered = useMemo(() => {
    return data.pacientes.filter((p) => {
      const q = search.toLowerCase();
      const matchSearch =
        !search ||
        p.nome.toLowerCase().includes(q) ||
        (p.processo || "").toLowerCase().includes(q) ||
        (p.nAmostra || "").toLowerCase().includes(q) ||
        (p.bi || "").toLowerCase().includes(q) ||
        (p.telefone || "").includes(q) ||
        String(p.id).includes(q);
      const matchSexo = !filtroSexo || p.sexo === filtroSexo;
      const matchTipo =
        !filtroTipo ||
        (filtroTipo === "nao_classificado"
          ? !getAdmin(p)
          : getAdmin(p)?.tipo === filtroTipo);
      return matchSearch && matchSexo && matchTipo;
    });
  }, [data.pacientes, search, filtroSexo, filtroTipo, getAdmin]);

  const inp =
    "w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background";
  const sel = inp + " cursor-pointer";

  const perfilPaciente =
    perfilId !== null ? data.pacientes.find((p) => p.id === perfilId) : null;

  if (view === "perfil" && perfilPaciente) {
    const p = perfilPaciente;
    const sexoInfo = getSexoColor(p.sexo);
    const idadeCalc = calcIdade(p.nasc) || p.idade;
    const grupoCompleto = p.grupoSanguineo
      ? `${p.grupoSanguineo}${p.fatorRh?.includes("+") ? "+" : p.fatorRh?.includes("−") ? "−" : ""}`
      : null;
    const resultados =
      data.resultados?.filter((r) => r.pacienteId === p.id) || [];

    return (
      <div className="p-4 space-y-4 max-w-5xl mx-auto">
        {qrOverlays}
        {toast && (
          <div
            role="status"
            onClick={() => setToast(null)}
            className={`fixed top-4 right-4 z-[60] max-w-md text-white px-5 py-3 rounded-lg shadow-lg ${toast.type === "error" ? "bg-red-600" : toast.type === "info" ? "bg-blue-600" : "bg-green-600"}`}
          >
            {toast.message}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={() => setView("lista")}
            className="text-xs text-muted-foreground hover:text-foreground bg-secondary px-3 py-1.5 rounded-lg font-medium transition"
          >
            ← Voltar
          </button>
          <h2 className="text-lg font-bold text-primary">Perfil do Paciente</h2>
          <button
            type="button"
            onClick={() => setQrPaciente(p)}
            className="rounded-lg border border-border px-3 py-2 text-xs font-bold"
          >
            Cartão QR
          </button>
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => handleEdit(p)}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-xs font-bold hover:opacity-90 transition"
            >
              ✏️ Editar
            </button>
            <button
              onClick={() => handleRemove(p.id, p.nome)}
              className="border border-destructive text-destructive px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-50 transition"
            >
              🗑 Remover
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-background p-4 text-sm">
          <h3 className="font-bold text-primary">
            Classificação administrativa
          </h3>
          <div className="mt-2 flex flex-wrap gap-4">
            <span>
              Tipo: <strong>{tipoLabel(getAdmin(p)?.tipo)}</strong>
            </span>
            {getAdmin(p)?.entidade && (
              <span>
                Entidade: <strong>{getAdmin(p)?.entidade}</strong>
              </span>
            )}
            {getAdmin(p)?.tipo === "assegurado" && (
              <>
                <span>Cartão: {getAdmin(p)?.cartao}</span>
                <span>
                  Validade: {getAdmin(p)?.inicio} a {getAdmin(p)?.fim}
                </span>
                <span>Cobertura: {getAdmin(p)?.cobertura}%</span>
              </>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Classificação local. A elegibilidade deve ser confirmada para cada
            atendimento.
          </p>
        </div>
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="bg-gradient-to-r from-primary to-emerald-600 p-6">
            <div className="flex items-center gap-5">
              <div
                className={`w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-black text-white shadow-lg flex-shrink-0`}
                style={{ background: "rgba(255,255,255,0.25)" }}
              >
                {getInitials(p.nome)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-2xl font-black text-white truncate">
                  {p.nome}
                </h3>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  {p.sexo && (
                    <span className="bg-white/20 text-white text-xs px-2.5 py-1 rounded-full font-semibold">
                      {p.sexo === "M"
                        ? "♂ Masculino"
                        : p.sexo === "F"
                          ? "♀ Feminino"
                          : "Indeterminado"}
                    </span>
                  )}
                  {idadeCalc && (
                    <span className="bg-white/20 text-white text-xs px-2.5 py-1 rounded-full font-semibold">
                      {idadeCalc}
                    </span>
                  )}
                  {grupoCompleto && (
                    <span className="bg-red-500 text-white text-xs px-2.5 py-1 rounded-full font-black">
                      {grupoCompleto}
                    </span>
                  )}
                  {p.alergias && p.alergias !== "NKDA" && (
                    <span className="bg-amber-400 text-amber-900 text-xs px-2.5 py-1 rounded-full font-semibold">
                      ⚠️ Alergias
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-white/60 text-xs">ID do Paciente</div>
                <div className="text-white text-xl font-black" title={String(p.processo || p.id)}>{patientDisplayReference(p)}</div>
                {p.processo && (
                  <div className="text-white/80 text-xs mt-1">
                    Proc: {p.processo}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 border-b border-border divide-x divide-border sm:grid-cols-4">
            {[
              { label: "Resultados", value: resultados.length, icon: "🔬" },
              { label: "Telefone", value: p.telefone || "—", icon: "" },
              { label: "Nascimento", value: p.nasc || "—", icon: "📅" },
              { label: "Médico", value: p.medico || "—", icon: "👤" },
            ].map((s, i) => (
              <div key={i} className="p-4 text-center">
                <div className="text-xl mb-1">{s.icon}</div>
                <div className="text-sm font-bold text-foreground truncate">
                  {s.value}
                </div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-secondary/30 flex items-center gap-2">
              <span className="text-sm">🪪</span>
              <span className="text-sm font-bold text-foreground">
                Identificação
              </span>
            </div>
            <div className="p-4 space-y-2.5">
              {[
                ["BI / Passaporte", p.bi],
                ["NIF", p.nif],
                ["Nacionalidade", p.nacionalidade],
                ["Estado Civil", p.estadoCivil],
                ["Profissão", p.profissao],
                ["Morada", p.endereco],
              ].map(([label, val]) =>
                val ? (
                  <div key={label} className="flex gap-3">
                    <span className="text-xs text-muted-foreground w-32 flex-shrink-0 pt-0.5">
                      {label}
                    </span>
                    <span className="text-xs font-semibold text-foreground flex-1">
                      {val}
                    </span>
                  </div>
                ) : null,
              )}
            </div>
          </div>

          <div className="bg-white border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-secondary/30 flex items-center gap-2">
              <span className="text-sm">📞</span>
              <span className="text-sm font-bold text-foreground">
                Contactos
              </span>
            </div>
            <div className="p-4 space-y-2.5">
              {[
                ["Telemóvel", p.telefone],
                ["Telefone 2", p.telefone2],
                ["Email", p.email],
                ["Emergência", p.contactoEmergenciaNome],
                ["Tel. Emergência", p.contactoEmergenciaTel],
              ].map(([label, val]) =>
                val ? (
                  <div key={label} className="flex gap-3">
                    <span className="text-xs text-muted-foreground w-32 flex-shrink-0 pt-0.5">
                      {label}
                    </span>
                    <span className="text-xs font-semibold text-foreground flex-1">
                      {val}
                    </span>
                  </div>
                ) : null,
              )}
            </div>
          </div>

          <div className="bg-white border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-secondary/30 flex items-center gap-2">
              <span className="text-sm">🏥</span>
              <span className="text-sm font-bold text-foreground">
                Dados Clínicos
              </span>
            </div>
            <div className="p-4 space-y-3">
              {grupoCompleto && (
                <div className="flex items-center gap-3">
                  <span className="bg-red-100 text-red-700 px-3 py-1.5 rounded-full font-black text-base">
                    🩸 {grupoCompleto}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Grupo Sanguíneo
                  </span>
                </div>
              )}
              {p.alergias && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">
                    Alergias
                  </div>
                  <div
                    className={`text-xs font-semibold px-3 py-2 rounded-lg ${p.alergias === "NKDA" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-800 border border-amber-200"}`}
                  >
                    {p.alergias !== "NKDA" && "⚠️ "}
                    {p.alergias}
                  </div>
                </div>
              )}
              {p.patologiasCronicas && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">
                    Patologias Crónicas
                  </div>
                  <div className="text-xs font-semibold bg-blue-50 text-blue-800 px-3 py-2 rounded-lg">
                    {p.patologiasCronicas}
                  </div>
                </div>
              )}
              {p.medicacaoHabitual && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">
                    Medicação Habitual
                  </div>
                  <div className="text-xs bg-secondary/50 px-3 py-2 rounded-lg text-foreground">
                    {p.medicacaoHabitual}
                  </div>
                </div>
              )}
              {!grupoCompleto &&
                !p.alergias &&
                !p.patologiasCronicas &&
                !p.medicacaoHabitual && (
                  <p className="text-xs text-muted-foreground italic">
                    Sem dados clínicos registados.
                  </p>
                )}
            </div>
          </div>

          <div className="bg-white border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-secondary/30 flex items-center gap-2">
              <span className="text-sm">🔬</span>
              <span className="text-sm font-bold text-foreground">
                Dados Laboratoriais
              </span>
            </div>
            <div className="p-4 space-y-2.5">
              {[
                ["Empresa/Entidade", p.empresa],
                ["N.º Processo", p.processo],
                ["Médico Requisitante", p.medico],
                ["N.º Amostra", p.nAmostra],
                ["Local de Recolha", p.recolha],
              ].map(([label, val]) =>
                val ? (
                  <div key={label} className="flex gap-3">
                    <span className="text-xs text-muted-foreground w-36 flex-shrink-0 pt-0.5">
                      {label}
                    </span>
                    <span className="text-xs font-semibold text-foreground flex-1">
                      {val}
                    </span>
                  </div>
                ) : null,
              )}
              {resultados.length > 0 && (
                <div className="pt-2 border-t border-border">
                  <div className="text-xs text-muted-foreground mb-2">
                    Últimos Resultados
                  </div>
                  {resultados
                    .slice(-3)
                    .reverse()
                    .map((r, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-xs py-1"
                      >
                        <span className="font-semibold">
                          {(r as any).exameNome || "Exame"}
                        </span>
                        <span className="text-muted-foreground">{r.data}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === "form") {
    const sections = [
      { id: "identificacao" as const, label: "Identificação", icon: "🪪" },
      { id: "administrativo" as const, label: "Tipo / Pagamento", icon: "💳" },
      { id: "clinico" as const, label: "Dados Clínicos", icon: "🏥" },
      { id: "laboratorial" as const, label: "Laboratorial", icon: "🔬" },
    ];

    return (
      <div className="p-4 space-y-4 max-w-4xl mx-auto">
        {qrOverlays}
        {toast && (
          <div
            role="status"
            onClick={() => setToast(null)}
            className={`fixed top-4 right-4 z-[60] max-w-md text-white px-5 py-3 rounded-lg shadow-lg ${toast.type === "error" ? "bg-red-600" : toast.type === "info" ? "bg-blue-600" : "bg-green-600"}`}
          >
            {toast.message}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setView("lista");
              setForm(emptyForm);
              setEditId(null);
            }}
            className="text-xs text-muted-foreground hover:text-foreground bg-secondary px-3 py-1.5 rounded-lg font-medium transition"
          >
            ← Voltar
          </button>
          <h2 className="text-lg font-bold text-primary">
            {editId !== null ? "Editar Paciente" : "Novo Paciente"}
          </h2>
          {editId !== null && (
            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-semibold">
              ID #{editId}
            </span>
          )}
        </div>

        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="flex border-b border-border">
            {sections.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSection(s.id)}
                className={`flex-1 py-3 text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  section === s.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary/30 text-muted-foreground hover:bg-secondary"
                }`}
              >
                <span>{s.icon}</span>
                <span className="hidden sm:inline">{s.label}</span>
                <span className="sm:hidden">{i + 1}</span>
              </button>
            ))}
          </div>

          <div className="p-5">
            {section === "identificacao" && (
              <div className="space-y-5">
                <button
                  type="button"
                  onClick={() => setShowQrScanner(true)}
                  className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground"
                >
                  Ler QR do BI / pesquisar paciente
                </button>
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-xl p-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-purple-900 mb-1 flex items-center gap-2">
                        Preenchimento Automático por OCR
                      </div>
                      <div className="text-xs text-purple-700">
                        Carregue uma foto/scan do BI ou Passaporte — os dados e
                        a foto serão extraídos automaticamente
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowScanner(true)}
                      className="bg-purple-600 text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-purple-700 transition flex items-center gap-2 shadow-md"
                    >
                      Scanner
                    </button>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold text-primary uppercase tracking-wide mb-3 pb-2 border-b border-border flex items-center gap-2">
                    <span>👤</span> Dados Pessoais
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-1 lg:col-span-2">
                      <label className="text-xs font-semibold text-muted-foreground">
                        Nome Completo *
                      </label>
                      <input
                        value={form.nome}
                        onChange={(e) => f("nome", e.target.value)}
                        className={inp}
                        placeholder="Nome completo do paciente"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">
                        Data de Nascimento
                      </label>
                      <input
                        type="date"
                        value={(() => {
                          const date = parseBirthDate(form.nasc);
                          if (!date) return "";
                          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
                        })()}
                        onChange={(e) => {
                          const iso = e.target.value;
                          if (!iso) {
                            setForm((prev) => ({
                              ...prev,
                              nasc: "",
                              idade: "",
                            }));
                            return;
                          }
                          const [y, m, d] = iso.split("-");
                          const display = `${d}/${m}/${y}`;
                          const idadeCalc = calcIdade(display);
                          setForm((prev) => ({
                            ...prev,
                            nasc: display,
                            idade: idadeCalc,
                          }));
                        }}
                        className={inp}
                        max={localToday()}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">
                        Sexo
                      </label>
                      <select
                        value={form.sexo}
                        onChange={(e) => f("sexo", e.target.value)}
                        className={sel}
                      >
                        <option value="">Seleccionar...</option>
                        <option value="M">♂ Masculino</option>
                        <option value="F">♀ Feminino</option>
                        <option value="I">Indeterminado</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">
                        Idade (calculada automaticamente)
                      </label>
                      <input
                        value={form.idade}
                        readOnly
                        className={inp + " bg-secondary/40 cursor-default"}
                        placeholder="Preenchida automaticamente"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">
                        Estado Civil
                      </label>
                      <select
                        value={form.estadoCivil}
                        onChange={(e) => f("estadoCivil", e.target.value)}
                        className={sel}
                      >
                        <option value="">Seleccionar...</option>
                        {ESTADOS_CIVIS.map((ec) => (
                          <option key={ec} value={ec}>
                            {ec}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold text-primary uppercase tracking-wide mb-3 pb-2 border-b border-border flex items-center gap-2">
                    <span>🪪</span> Documentos
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">
                        Bilhete de Identidade (BI)
                      </label>
                      <input
                        value={form.bi}
                        onChange={(e) => f("bi", e.target.value)}
                        className={inp}
                        placeholder="N.º de BI"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">
                        NIF
                      </label>
                      <input
                        value={form.nif}
                        onChange={(e) => f("nif", e.target.value)}
                        className={inp}
                        placeholder="NIF (faturação)"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">
                        Nacionalidade
                      </label>
                      <input
                        value={form.nacionalidade}
                        onChange={(e) => f("nacionalidade", e.target.value)}
                        className={inp}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">
                        Profissão
                      </label>
                      <input
                        value={form.profissao}
                        onChange={(e) => f("profissao", e.target.value)}
                        className={inp}
                        placeholder="Ex: Professor"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold text-primary uppercase tracking-wide mb-3 pb-2 border-b border-border flex items-center gap-2">
                    <span>📱</span> Contactos
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">
                        Telemóvel Principal
                      </label>
                      <input
                        value={form.telefone}
                        onChange={(e) => f("telefone", e.target.value)}
                        className={inp}
                        placeholder="9XX XXX XXX"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">
                        Telefone Alternativo
                      </label>
                      <input
                        value={form.telefone2}
                        onChange={(e) => f("telefone2", e.target.value)}
                        className={inp}
                        placeholder="9XX XXX XXX"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">
                        Email
                      </label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => f("email", e.target.value)}
                        className={inp}
                        placeholder="email@exemplo.com"
                      />
                    </div>
                    <div className="space-y-1 lg:col-span-3">
                      <div className="mb-4">{geographyError?<p role="alert" className="text-red-600 text-sm">{geographyError} — a morada anterior permanece disponível.</p>:!geographyReady?<p className="text-sm">A carregar endereço estruturado…</p>:<PatientGeographyFields value={geography} canApprove={["admin","gestor"].includes(session?.funcao || "")} onChange={(next,addressChanged)=>{setGeography(next);setGeographyDirty(true);}}/>}
                      {geographyReady&&<button type="button" className="text-xs underline mt-2" onClick={()=>f("endereco",addressLabel(geography.residence))}>Aplicar endereço estruturado à morada completa</button>}</div>
                      <label className="text-xs font-semibold text-muted-foreground">
                        Morada Completa
                      </label>
                      <input
                        value={form.endereco}
                        onChange={(e) => f("endereco", e.target.value)}
                        className={inp}
                        placeholder="Rua, bairro, município, província"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">
                        Contacto de Emergência
                      </label>
                      <input
                        value={form.contactoEmergenciaNome}
                        onChange={(e) =>
                          f("contactoEmergenciaNome", e.target.value)
                        }
                        className={inp}
                        placeholder="Nome do responsável"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">
                        Tel. Emergência
                      </label>
                      <input
                        value={form.contactoEmergenciaTel}
                        onChange={(e) =>
                          f("contactoEmergenciaTel", e.target.value)
                        }
                        className={inp}
                        placeholder="9XX XXX XXX"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {section === "administrativo" && (
              <CadastroAdministrativo
                value={adminForm}
                onChange={setAdminForm}
                insurers={insurers}
                storageError={loadedAdmin.error}
              />
            )}

            {section === "clinico" && (
              <div className="space-y-5">
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-800">
                  <strong>ℹ️ MINSA/OMS:</strong> Campos obrigatórios pela ficha
                  clínica do MINSA e boas práticas laboratoriais da OMS.
                </div>

                <div>
                  <div className="text-xs font-bold text-primary uppercase tracking-wide mb-3 pb-2 border-b border-border">
                    🩸 Grupo Sanguíneo
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">
                        Grupo ABO
                      </label>
                      <select
                        value={form.grupoSanguineo}
                        onChange={(e) => f("grupoSanguineo", e.target.value)}
                        className={sel}
                      >
                        <option value="">Desconhecido</option>
                        {GRUPOS_SANGUINEOS.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">
                        Fator Rh
                      </label>
                      <select
                        value={form.fatorRh}
                        onChange={(e) => f("fatorRh", e.target.value)}
                        className={sel}
                      >
                        <option value="">Desconhecido</option>
                        {FATORES_RH.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>
                    {form.grupoSanguineo && (
                      <div className="col-span-2 flex items-center">
                        <span className="bg-red-100 text-red-700 px-4 py-2 rounded-xl font-black text-lg">
                          {form.grupoSanguineo}
                          {form.fatorRh?.includes("+")
                            ? "+"
                            : form.fatorRh?.includes("−")
                              ? "−"
                              : ""}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold text-primary uppercase tracking-wide mb-3 pb-2 border-b border-border">
                    Antecedentes Clínicos
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">
                        Alergias Conhecidas
                      </label>
                      <textarea
                        value={form.alergias}
                        onChange={(e) => f("alergias", e.target.value)}
                        className={inp + " resize-none"}
                        rows={3}
                        placeholder="Ex: Penicilina, látex..."
                      />
                      <p className="text-xs text-muted-foreground">
                        Escreva "NKDA" se sem alergias conhecidas.
                      </p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">
                        Patologias Crónicas
                      </label>
                      <textarea
                        value={form.patologiasCronicas}
                        onChange={(e) =>
                          f("patologiasCronicas", e.target.value)
                        }
                        className={inp + " resize-none"}
                        rows={3}
                        placeholder="Ex: HTA, DM2, Asma..."
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-xs font-semibold text-muted-foreground">
                        Medicação Habitual
                      </label>
                      <textarea
                        value={form.medicacaoHabitual}
                        onChange={(e) => f("medicacaoHabitual", e.target.value)}
                        className={inp + " resize-none"}
                        rows={2}
                        placeholder="Ex: Metformina 850mg 2x/dia..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {section === "laboratorial" && (
              <div className="space-y-5">
                <div>
                  <div className="text-xs font-bold text-primary uppercase tracking-wide mb-3 pb-2 border-b border-border">
                    Entidade Requisitante
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-1 lg:col-span-2">
                      <label className="text-xs font-semibold text-muted-foreground">
                        Empresa / Hospital / Clínica
                      </label>
                      <input
                        value={form.empresa}
                        onChange={(e) => f("empresa", e.target.value)}
                        className={inp}
                        placeholder="Ex: Hospital Josina Machel"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">
                        Médico Requisitante
                      </label>
                      <input
                        value={form.medico}
                        onChange={(e) => f("medico", e.target.value)}
                        className={inp}
                        placeholder="Nome do médico"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold text-primary uppercase tracking-wide mb-3 pb-2 border-b border-border">
                    🧪 Identificação da Amostra
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">
                        N.º Processo
                      </label>
                      <input
                        value={form.processo}
                        readOnly
                        aria-label="Número de processo"
                        className={inp}
                        placeholder={editId === null ? "Atribuído ao guardar" : "Sem número histórico"}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">
                        N.º Amostra / Espécime
                      </label>
                      <input
                        value={form.nAmostra}
                        readOnly
                        aria-label="Referência de amostra histórica"
                        className={inp}
                        placeholder="Criada no pedido de laboratório"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">
                        Local de Recolha
                      </label>
                      <input
                        value={form.recolha}
                        onChange={(e) => f("recolha", e.target.value)}
                        className={inp}
                        placeholder="Ex: Lab. Central"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-6 pt-4 border-t border-border">
              {section !== "identificacao" && (
                <button
                  type="button"
                  onClick={() =>
                    setSection(
                      section === "laboratorial"
                        ? "clinico"
                        : section === "clinico"
                          ? "administrativo"
                          : "identificacao",
                    )
                  }
                  className="bg-secondary text-secondary-foreground px-5 py-2 rounded-lg text-sm font-semibold hover:bg-accent transition"
                >
                  ← Anterior
                </button>
              )}
              <div className="flex gap-1 mx-auto">
                {sections.map((s, i) => (
                  <div
                    key={s.id}
                    className={`w-2 h-2 rounded-full transition-all ${section === s.id ? "bg-primary w-6" : "bg-border"}`}
                  />
                ))}
              </div>
              {section !== "laboratorial" ? (
                <button
                  type="button"
                  onClick={() =>
                    setSection(
                      section === "identificacao"
                        ? "administrativo"
                        : section === "administrativo"
                          ? "clinico"
                          : "laboratorial",
                    )
                  }
                  className="bg-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition ml-auto"
                >
                  Próximo →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={saving}
                  className="bg-primary text-primary-foreground px-6 py-2 rounded-lg text-sm font-bold hover:opacity-90 transition ml-auto"
                >
                  {saving
                    ? "A guardar…"
                    : editId !== null
                      ? "💾 Guardar Alterações"
                      : "✅ Registar Paciente"}
                </button>
              )}
            </div>
          </div>
        </div>

        {showScanner && (
          <DocumentScanner
            onDataExtracted={handleDocumentData}
            onClose={() => setShowScanner(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {qrOverlays}
      {toast && (
        <div
          role="status"
          onClick={() => setToast(null)}
          className={`fixed top-4 right-4 z-[60] max-w-md text-white px-5 py-3 rounded-lg shadow-lg ${toast.type === "error" ? "bg-red-600" : toast.type === "info" ? "bg-blue-600" : "bg-green-600"}`}
        >
          {toast.message}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-primary">Pacientes</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {data.pacientes.length} registado
            {data.pacientes.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowQrScanner(true)}
            className="rounded-lg border border-border px-4 py-2 text-sm font-bold"
          >
            Ler BI / QR
          </button>
          <button
            onClick={() => setShowAutoRegister(true)}
            className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-5 py-2 rounded-lg text-sm font-bold hover:opacity-90 transition flex items-center gap-2 shadow-md"
          >
            🤖 Cadastro Automático
          </button>
          <button
            onClick={handleNovo}
            className="bg-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-bold hover:opacity-90 transition flex items-center gap-2"
          >
            <span className="text-lg leading-none">+</span> Novo Paciente
          </button>
        </div>
      </div>

      <div className="bg-white border border-border rounded-xl p-3 flex flex-wrap gap-3 items-center">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍  Nome, processo, BI ou telefone..."
          className="border border-border rounded-lg px-3 py-2 text-xs w-60 focus:outline-none focus:ring-2 focus:ring-primary/30"
        />

        <select
          aria-label="Filtrar por tipo de paciente"
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-xs"
        >
          <option value="">Todos os tipos</option>
          {TIPOS_PACIENTE.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
          <option value="nao_classificado">Não classificados</option>
        </select>
        <div className="flex gap-1">
          {[
            { val: "", label: "Todos" },
            { val: "M", label: " Masc." },
            { val: "F", label: "♀ Fem." },
          ].map((o) => (
            <button
              key={o.val}
              onClick={() => setFiltroSexo(o.val)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${filtroSexo === o.val ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent"}`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1 ml-auto">
          <button
            onClick={() => setViewStyle("cards")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${viewStyle === "cards" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent"}`}
          >
            Cartões
          </button>
          <button
            onClick={() => setViewStyle("tabela")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${viewStyle === "tabela" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent"}`}
          >
            Tabela
          </button>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="bg-white border border-border rounded-xl py-20 text-center">
          <div className="text-5xl mb-4">👥</div>
          <div className="text-sm font-semibold text-muted-foreground">
            {data.pacientes.length === 0
              ? "Nenhum paciente registado."
              : "Nenhum resultado para a pesquisa."}
          </div>
          {data.pacientes.length === 0 && (
            <button
              onClick={handleNovo}
              className="mt-4 bg-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-bold hover:opacity-90 transition"
            >
              Registar primeiro paciente
            </button>
          )}
        </div>
      )}

      {viewStyle === "cards" && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => {
            const sexoInfo = getSexoColor(p.sexo);
            const grupoCompleto = p.grupoSanguineo
              ? `${p.grupoSanguineo}${p.fatorRh?.includes("+") ? "+" : p.fatorRh?.includes("−") ? "−" : ""}`
              : null;
            const idadeStr =
              calcIdade(p.nasc) ||
              (p.idade
                ? /\D/.test(p.idade)
                  ? p.idade
                  : `${p.idade} anos`
                : "");
            return (
              <div
                key={p.id}
                className="bg-white border border-border rounded-xl overflow-hidden hover:shadow-md transition-all cursor-pointer group"
                onClick={() => handlePerfil(p)}
              >
                <div className="bg-gradient-to-r from-primary/10 to-emerald-50 px-4 pt-4 pb-3 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-black text-lg flex-shrink-0 group-hover:scale-105 transition-transform">
                      {getInitials(p.nome)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-foreground truncate">
                        {p.nome}
                      </div>
                      <span className="text-xs font-semibold text-primary">
                        {tipoLabel(getAdmin(p)?.tipo)}
                      </span>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {p.sexo && (
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-semibold ${sexoInfo.bg} ${sexoInfo.text}`}
                          >
                            {p.sexo === "M" ? "♂" : p.sexo === "F" ? "♀" : "?"}{" "}
                            {p.sexo === "M"
                              ? "Masc."
                              : p.sexo === "F"
                                ? "Fem."
                                : ""}
                          </span>
                        )}
                        {idadeStr && (
                          <span className="text-xs text-muted-foreground">
                            {idadeStr}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs text-muted-foreground">ID</div>
                      <div className="text-lg font-black text-primary">
                        {patientDisplayReference(p)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-4 py-3 space-y-1.5">
                  {p.telefone && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>📞</span>
                      <span className="font-semibold text-foreground">
                        {p.telefone}
                      </span>
                    </div>
                  )}
                  {p.processo && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>📋</span>
                      <span>
                        Proc:{" "}
                        <strong className="text-foreground">
                          {p.processo}
                        </strong>
                      </span>
                    </div>
                  )}
                  {p.medico && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>👨‍⚕️</span>
                      <span className="truncate">{p.medico}</span>
                    </div>
                  )}
                </div>

                <div className="px-4 pb-3 flex items-center justify-between gap-2">
                  <div className="flex gap-1.5 flex-wrap">
                    {grupoCompleto && (
                      <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-black">
                        🩸 {grupoCompleto}
                      </span>
                    )}
                    {p.alergias && p.alergias !== "NKDA" && (
                      <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full font-semibold">
                        ⚠️ Alergias
                      </span>
                    )}
                  </div>
                  <div
                    className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => handleEdit(p)}
                      className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-lg font-semibold hover:bg-primary/20 transition"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleRemove(p.id, p.nome)}
                      className="text-xs bg-red-50 text-destructive px-2.5 py-1 rounded-lg font-semibold hover:bg-red-100 transition"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewStyle === "tabela" && filtered.length > 0 && (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">
                    ID
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">
                    Nome
                  </th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground">
                    Nasc.
                  </th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-muted-foreground">
                    Sexo
                  </th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground hidden md:table-cell">
                    BI
                  </th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground">
                    Telefone
                  </th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-muted-foreground">
                    Grupo
                  </th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground hidden lg:table-cell">
                    Processo
                  </th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-muted-foreground">
                    Acções
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const sexoInfo = getSexoColor(p.sexo);
                  const grupoCompleto = p.grupoSanguineo
                    ? `${p.grupoSanguineo}${p.fatorRh?.includes("+") ? "+" : p.fatorRh?.includes("−") ? "−" : ""}`
                    : null;
                  return (
                    <tr
                      key={p.id}
                      className="border-t border-border hover:bg-accent/20 transition-colors cursor-pointer"
                      onClick={() => handlePerfil(p)}
                    >
                      <td className="px-4 py-3">
                        <span className="text-xs font-bold text-primary">
                          {patientDisplayReference(p)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-xs font-black flex-shrink-0">
                            {getInitials(p.nome)}
                          </div>
                          <div>
                            <div className="text-xs font-bold">{p.nome}</div>
                            <span className="text-xs text-primary">
                              {tipoLabel(getAdmin(p)?.tipo)}
                            </span>
                            {p.alergias && p.alergias !== "NKDA" && (
                              <span className="text-xs text-amber-600">
                                ⚠️ Alergias
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {p.nasc || "—"}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {p.sexo && (
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-semibold ${sexoInfo.bg} ${sexoInfo.text}`}
                          >
                            {p.sexo === "M" ? "♂" : "♀"}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground hidden md:table-cell">
                        {p.bi || "—"}
                      </td>
                      <td className="px-3 py-3 text-xs">{p.telefone || "—"}</td>
                      <td className="px-3 py-3 text-center">
                        {grupoCompleto ? (
                          <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-black text-xs">
                            {grupoCompleto}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                        {p.processo || "—"}
                      </td>
                      <td
                        className="px-3 py-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => setQrPaciente(p)}
                            className="text-primary font-semibold hover:underline"
                          >
                            QR
                          </button>
                          <button
                            onClick={() => handleEdit(p)}
                            className="text-primary font-semibold hover:underline"
                          >
                            Editar
                          </button>
                          <span className="text-border">|</span>
                          <button
                            onClick={() => handleRemove(p.id, p.nome)}
                            className="text-destructive font-semibold hover:underline"
                          >
                            Remover
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAutoRegister && (
        <AutoRegisterModal
          onRegister={handleAutoRegister}
          onClose={() => setShowAutoRegister(false)}
        />
      )}
    </div>
  );
}
