import { hospitalApi } from "../../store/hospital";
import { api } from "../../store/api";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AnexoEnf,
  AnexoTempEnf,
  AtendEnfermagem,
  FORMATOS_PERMITIDOS,
  NotificacaoEnf,
  NursingSession,
  RISCO_CONFIG,
  TAMANHO_MAX_MB,
  TIPOS_ANEXO_ENF,
  todayLocal,
  useNursingStore,
} from "./shared";

export function useEnfermagem({
  session,
  scope,
}: {
  session: NursingSession;
  scope: string;
}) {
  const [activeTab, setActiveTab] = useState("enfermaria");
  const [showNovoAtendimento, setShowNovoAtendimento] = useState(false);
  const [showDetalhes, setShowDetalhes] = useState(false);
  const [showEditar, setShowEditar] = useState(false);
  const [showConfirmarExclusao, setShowConfirmarExclusao] = useState(false);
  const [showNotificacoes, setShowNotificacoes] = useState(false);
  const [showCalendario, setShowCalendario] = useState(false);
  const [showAnexos, setShowAnexos] = useState(false);
  const [showNovoAnexo, setShowNovoAnexo] = useState(false);
  const [showVisualizarAnexo, setShowVisualizarAnexo] = useState(false);
  const [showConfirmarExclusaoAnexo, setShowConfirmarExclusaoAnexo] =
    useState(false);
  const [selectedAtend, setSelectedAtend] = useState<AtendEnfermagem | null>(
    null,
  );
  const [atendParaExcluir, setAtendParaExcluir] =
    useState<AtendEnfermagem | null>(null);
  const [anexoParaExcluir, setAnexoParaExcluir] = useState<AnexoEnf | null>(
    null,
  );
  const [anexoVisualizado, setAnexoVisualizado] = useState<AnexoEnf | null>(
    null,
  );
  const [atendimentos, setAtendimentos, storageError] = useNursingStore<
    AtendEnfermagem[]
  >(scope + ":atendimentos", []);
  const [anexos, setAnexos] = useState<AnexoEnf[]>([]);
  const attachmentFile = useRef<File | null>(null);
  useEffect(() => {
    let active = true;
    void hospitalApi<any>("GET", "/library")
      .then((result) => {
        if (active)
          setAnexos(
            result.files
              .filter((f: any) => !f.deleted_at && /^\[ENF:\d+\]/.test(f.name))
              .map((f: any, index: number) => ({
                id: index + 1,
                libraryId: f.id,
                idAtendimento: Number(f.name.match(/^\[ENF:(\d+)\]/)[1]),
                tipo: "outro",
                nome: f.name.replace(/^\[ENF:\d+\]\s*/, ""),
                descricao: "Documento guardado na biblioteca da instituição",
                data: f.created_at.slice(0, 10),
                tamanho: Math.ceil(f.size_bytes / 1024) + " KB",
                formato: f.mime,
              })),
          );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [scope]);
  async function uploadAttachment(file: File, patientId: number, name: string) {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const saved = await hospitalApi<{ id: string }>("POST", "/library/files", {
      name: `[ENF:${patientId}] ${name}`,
      mime: file.type || "application/octet-stream",
      base64,
    });
    return saved.id;
  }

  const [notificacoes, setNotificacoes] = useState<NotificacaoEnf[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRisco, setFilterRisco] = useState("todos");
  const [filterTurno, setFilterTurno] = useState("todos");
  const [filterAnexoTipo, setFilterAnexoTipo] = useState<string>("todos");
  const [searchAnexo, setSearchAnexo] = useState("");
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [dragOverNovo, setDragOverNovo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputNovoRef = useRef<HTMLInputElement>(null);
  const [anexosNovoAtend, setAnexosNovoAtend] = useState<AnexoTempEnf[]>([]);
  const [anexoTempEditando, setAnexoTempEditando] = useState<number | null>(
    null,
  );
  const [formNovo, setFormNovo] = useState<Partial<AtendEnfermagem>>({
    nomePaciente: "",
    contacto: "",
    dataNascimento: "",
    idade: 0,
    sexo: "Masculino",
    quarto: "",
    leito: "",
    diagnosticoPrincipal: "",
    motivoAtendimento: "",
    pressaoArterial: "",
    frequenciaCardiaca: 0,
    frequenciaRespiratoria: 0,
    temperatura: 0,
    saturacaoO2: 0,
    glicemia: 0,
    dorEVA: 0,
    peso: 0,
    altura: 0,
    consciencia: "Alerta e orientado",
    hidratacao: "Adequada",
    diurese: "Presente",
    debitoDrenos: "N/A",
    alergias: "Não informado — confirmar com o paciente",
    medicacoes: "",
    procedimentos: "",
    observacoes: "",
    planoCuidados: "",
    dataAtendimento: todayLocal(),
    horaAtendimento: new Date().toTimeString().slice(0, 5),
    codigoEnfermeiro: 0,
    nomeEnfermeiro: session.username || "",
    turno: "Manhã",
    followUp: "",
    risco: "baixo",
  });
  const [formAnexo, setFormAnexo] = useState<Partial<AnexoEnf>>({
    tipo: "evolucao",
    nome: "",
    descricao: "",
    data: todayLocal(),
    tamanho: "",
    formato: "PDF",
    instituicao: "",
    profissional: "",
    observacoes: "",
  });
  const showToast = (
    message: string,
    type: "success" | "error" | "info" = "success",
  ) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  const atendimentosFiltrados = useMemo(() => {
    return atendimentos.filter((a) => {
      const matchesSearch =
        a.nomePaciente.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.diagnosticoPrincipal
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        a.quarto.includes(searchTerm);
      const matchesRisco = filterRisco === "todos" || a.risco === filterRisco;
      const matchesTurno = filterTurno === "todos" || a.turno === filterTurno;
      return matchesSearch && matchesRisco && matchesTurno;
    });
  }, [atendimentos, searchTerm, filterRisco, filterTurno]);
  const anexosAtendimento = useMemo(() => {
    if (!selectedAtend) return [];
    let filtered = anexos.filter(
      (a) => a.idAtendimento === selectedAtend.idEnf,
    );
    if (filterAnexoTipo !== "todos")
      filtered = filtered.filter((a) => a.tipo === filterAnexoTipo);
    if (searchAnexo) {
      filtered = filtered.filter(
        (a) =>
          a.nome.toLowerCase().includes(searchAnexo.toLowerCase()) ||
          a.descricao.toLowerCase().includes(searchAnexo.toLowerCase()),
      );
    }
    return filtered.sort(
      (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime(),
    );
  }, [anexos, selectedAtend, filterAnexoTipo, searchAnexo]);
  const getAnexosCount = (idAtend: number) =>
    anexos.filter((a) => a.idAtendimento === idAtend).length;
  const notificacoesNaoLidas = useMemo(
    () => notificacoes.filter((n) => !n.lida).length,
    [notificacoes],
  );
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("pt-PT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };
  const getRiscoBadge = (risco: AtendEnfermagem["risco"]) => {
    const cfg = RISCO_CONFIG[risco];
    return <Badge className={cn("border", cfg.cor)}>{cfg.label}</Badge>;
  };
  const getClassificarPA = (pa: string) => {
    const [sist, diast] = pa.split("/").map(Number);
    if (!sist || !diast) return { label: "—", cor: "text-slate-500" };
    if (sist >= 180 || diast >= 120)
      return { label: "Crise HTA", cor: "text-red-600 font-bold" };
    if (sist >= 140 || diast >= 90)
      return { label: "Elevada", cor: "text-orange-600 font-semibold" };
    if (sist < 90 || diast < 60)
      return { label: "Hipotensão", cor: "text-blue-600 font-semibold" };
    return { label: "Normal", cor: "text-emerald-600" };
  };
  const getClassificarSatO2 = (sat: number) => {
    if (!sat) return { label: "Não medido", cor: "text-slate-500" };
    if (sat < 90) return { label: "Crítico", cor: "text-red-600 font-bold" };
    if (sat < 94)
      return { label: "Baixa", cor: "text-orange-600 font-semibold" };
    return { label: "Normal", cor: "text-emerald-600" };
  };
  const getClassificarTemp = (temp: number) => {
    if (!temp) return { label: "Não medido", cor: "text-slate-500" };
    if (temp >= 38.5)
      return { label: "Febre alta", cor: "text-red-600 font-bold" };
    if (temp >= 37.8)
      return { label: "Febril", cor: "text-orange-600 font-semibold" };
    if (temp < 35.5)
      return { label: "Hipotermia", cor: "text-blue-600 font-semibold" };
    return { label: "Normal", cor: "text-emerald-600" };
  };
  const getClassificarGlicemia = (glic: number) => {
    if (!glic) return { label: "Não medido", cor: "text-slate-500" };
    if (glic > 300)
      return { label: "Muito alta", cor: "text-red-600 font-bold" };
    if (glic > 180)
      return { label: "Elevada", cor: "text-orange-600 font-semibold" };
    if (glic < 70)
      return { label: "Hipoglicemia", cor: "text-blue-600 font-semibold" };
    return { label: "Normal", cor: "text-emerald-600" };
  };
  const navegarParaInternamento = () => {
    window.location.href = "/internamento";
  };
  const detectarTipoAnexo = (
    fileName: string,
    ext: string,
  ): AnexoEnf["tipo"] => {
    const nomeLower = fileName.toLowerCase();
    if (nomeLower.includes("prescr") || nomeLower.includes("medic"))
      return "prescricao";
    if (nomeLower.includes("evolu") || nomeLower.includes("enferm"))
      return "evolucao";
    if (nomeLower.includes("proced") || nomeLower.includes("cirurg"))
      return "procedimento";
    if (
      nomeLower.includes("exame") ||
      nomeLower.includes("análise") ||
      nomeLower.includes("laborat") ||
      nomeLower.includes("raio") ||
      nomeLower.includes("ecg") ||
      nomeLower.includes("tc")
    )
      return "exame";
    if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext.toLowerCase()))
      return "imagem";
    return "outro";
  };
  const handleFilesNovoAtend = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const novos: AnexoTempEnf[] = [];
    const invalidos: string[] = [];
    Array.from(files).forEach((file) => {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      if (!FORMATOS_PERMITIDOS.includes(ext)) {
        invalidos.push(file.name);
        return;
      }
      const tamanhoMB = file.size / (1024 * 1024);
      if (tamanhoMB > TAMANHO_MAX_MB) {
        invalidos.push(`${file.name} (excede ${TAMANHO_MAX_MB}MB)`);
        return;
      }
      const isImage = ["jpg", "jpeg", "png", "gif", "webp"].includes(ext);
      const novoTemp: AnexoTempEnf = {
        id: Date.now() + Math.random(),
        file,
        nome: file.name.replace(/\.[^/.]+$/, ""),
        tamanho:
          tamanhoMB >= 1
            ? `${tamanhoMB.toFixed(2)} MB`
            : `${(file.size / 1024).toFixed(0)} KB`,
        formato: ext.toUpperCase(),
        tipo: detectarTipoAnexo(file.name, ext),
        descricao: "",
        instituicao: "",
        profissional: "",
        observacoes: "",
        data: todayLocal(),
      };
      if (isImage) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setAnexosNovoAtend((prev) =>
            prev.map((a) =>
              a.id === novoTemp.id
                ? { ...a, previewUrl: e.target?.result as string }
                : a,
            ),
          );
        };
        reader.readAsDataURL(file);
      }
      novos.push(novoTemp);
    });
    if (invalidos.length > 0)
      showToast(`Ficheiros não aceites: ${invalidos.join(", ")}`, "error");
    setAnexosNovoAtend((prev) => [...prev, ...novos]);
    if (novos.length > 0)
      showToast(`${novos.length} ficheiro(s) adicionado(s)`, "success");
  };
  const handleDropNovoAtend = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverNovo(false);
    handleFilesNovoAtend(e.dataTransfer.files);
  };
  const removerAnexoTemp = (id: number) =>
    setAnexosNovoAtend((prev) => prev.filter((a) => a.id !== id));
  const atualizarAnexoTemp = (id: number, updates: Partial<AnexoTempEnf>) => {
    setAnexosNovoAtend((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    );
  };
  const handleNovoAtendimento = async () => {
    try {
      if (!formNovo.nomePaciente || !formNovo.motivoAtendimento) {
        showToast("Preencha os campos obrigatórios", "error");
        return;
      }
      const novoId = Math.max(0, ...atendimentos.map((a) => a.idEnf)) + 1;
      const novoAtend: AtendEnfermagem = {
        ...formNovo,
        idEnf: novoId,
        codigoAtendimento:
          Math.max(0, ...atendimentos.map((a) => a.codigoAtendimento)) + 1,
        idade: formNovo.idade || 0,
        frequenciaCardiaca: formNovo.frequenciaCardiaca || 0,
        frequenciaRespiratoria: formNovo.frequenciaRespiratoria || 0,
        temperatura: formNovo.temperatura || 0,
        saturacaoO2: formNovo.saturacaoO2 || 0,
        glicemia: formNovo.glicemia || 0,
        dorEVA: formNovo.dorEVA || 0,
        peso: formNovo.peso || 0,
        altura: formNovo.altura || 0,
        codigoEnfermeiro: formNovo.codigoEnfermeiro || 0,
        nomeEnfermeiro: formNovo.nomeEnfermeiro || session.username || "",
      } as AtendEnfermagem;
      await setAtendimentos([novoAtend, ...atendimentos]);
      const uploadedAttachmentIds = new Map<number, string>();
      for (const attachment of anexosNovoAtend)
        uploadedAttachmentIds.set(
          attachment.id,
          await uploadAttachment(attachment.file, novoId, attachment.file.name),
        );
      if (anexosNovoAtend.length > 0) {
        const novosAnexos: AnexoEnf[] = anexosNovoAtend.map((temp, idx) => ({
          id: Date.now() + idx,
          libraryId: uploadedAttachmentIds.get(temp.id),
          idAtendimento: novoId,
          tipo: temp.tipo,
          nome: temp.nome,
          descricao: temp.descricao,
          data: temp.data,
          tamanho: temp.tamanho,
          formato: temp.formato,
          instituicao: temp.instituicao || undefined,
          profissional: temp.profissional || undefined,
          observacoes: temp.observacoes || undefined,
          previewUrl: temp.previewUrl,
        }));
        setAnexos((prev) => [...novosAnexos, ...prev]);
      }
      setShowNovoAtendimento(false);
      resetFormNovo();
      showToast(
        `Atendimento registado${anexosNovoAtend.length > 0 ? ` com ${anexosNovoAtend.length} anexo(s)` : ""}!`,
      );
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : "Gravação não confirmada.",
        "error",
      );
    }
  };
  const resetFormNovo = () => {
    setFormNovo({
      nomePaciente: "",
      contacto: "",
      dataNascimento: "",
      idade: 0,
      sexo: "Masculino",
      quarto: "",
      leito: "",
      diagnosticoPrincipal: "",
      motivoAtendimento: "",
      pressaoArterial: "",
      frequenciaCardiaca: 0,
      frequenciaRespiratoria: 0,
      temperatura: 0,
      saturacaoO2: 0,
      glicemia: 0,
      dorEVA: 0,
      peso: 0,
      altura: 0,
      consciencia: "Alerta e orientado",
      hidratacao: "Adequada",
      diurese: "Presente",
      debitoDrenos: "N/A",
      alergias: "Não informado — confirmar com o paciente",
      medicacoes: "",
      procedimentos: "",
      observacoes: "",
      planoCuidados: "",
      dataAtendimento: todayLocal(),
      horaAtendimento: new Date().toTimeString().slice(0, 5),
      codigoEnfermeiro: 0,
      nomeEnfermeiro: session.username || "",
      turno: "Manhã",
      followUp: "",
      risco: "baixo",
    });
    setAnexosNovoAtend([]);
    setAnexoTempEditando(null);
  };
  const handleEditarAtendimento = async () => {
    try {
      if (!selectedAtend) return;
      await setAtendimentos(
        atendimentos.map((a) =>
          a.idEnf === selectedAtend.idEnf ? selectedAtend : a,
        ),
      );
      setShowEditar(false);
      showToast("Atendimento atualizado!");
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : "Gravação não confirmada.",
        "error",
      );
    }
  };
  const handleExcluirAtendimento = () => {
    if (!atendParaExcluir) return;
    showToast(
      "Para preservar o histórico, use Alta ou Transferência no painel da enfermaria.",
      "info",
    );
    setShowConfirmarExclusao(false);
    return;
  };
  const handleMarcarNotificacaoLida = (id: number) => {
    setNotificacoes(
      notificacoes.map((n) => (n.id === id ? { ...n, lida: true } : n)),
    );
  };
  const handleExportarCSV = () => {
    const headers = [
      "ID",
      "Paciente",
      "Quarto",
      "Leito",
      "Diagnóstico",
      "PA",
      "FC",
      "Temp",
      "SatO2",
      "Risco",
      "Enfermeiro",
    ];
    const rows = atendimentos.map((a) => [
      a.idEnf,
      a.nomePaciente,
      a.quarto,
      a.leito,
      a.diagnosticoPrincipal,
      a.pressaoArterial,
      a.frequenciaCardiaca,
      a.temperatura,
      a.saturacaoO2,
      a.risco,
      a.nomeEnfermeiro,
    ]);
    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `atendimentos_enfermagem_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    showToast("Dados exportados!");
  };
  const handleImprimir = () => window.print();
  const handleFileSelect = (files: FileList | null) => {
    attachmentFile.current = files?.[0] || null;
    if (!files || files.length === 0) return;
    const file = files[0];
    const tamanhoMB = (file.size / (1024 * 1024)).toFixed(2);
    const ext = file.name.split(".").pop()?.toUpperCase() || "PDF";
    setFormAnexo({
      ...formAnexo,
      nome: file.name.replace(/\.[^/.]+$/, ""),
      tamanho: `${tamanhoMB} MB`,
      formato: ext,
    });
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };
  const handleSalvarAnexo = async () => {
    if (!selectedAtend || !attachmentFile.current) {
      showToast("Seleccione o paciente e o ficheiro a carregar.", "error");
      return;
    }
    try {
      const file = attachmentFile.current;
      const libraryId = await uploadAttachment(
        file,
        selectedAtend.idEnf,
        file.name,
      );
      setAnexos((previous) => [
        ...previous,
        {
          id: Math.max(0, ...previous.map((x) => x.id)) + 1,
          libraryId,
          idAtendimento: selectedAtend.idEnf,
          tipo: "outro",
          nome: file.name,
          descricao: formAnexo.descricao || "",
          data: todayLocal(),
          tamanho: Math.ceil(file.size / 1024) + " KB",
          formato: file.type,
        },
      ]);
      setShowNovoAnexo(false);
      attachmentFile.current = null;
      showToast("Ficheiro confirmado na biblioteca da instituição.");
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : "Carregamento não confirmado.",
        "error",
      );
    }
  };
  const handleExcluirAnexo = async () => {
    if (!anexoParaExcluir?.libraryId) {
      showToast("Consulte a biblioteca para gerir este documento.", "info");
      return;
    }
    try {
      await hospitalApi(
        "PATCH",
        "/library/files/" + anexoParaExcluir.libraryId,
        { action: "trash" },
      );
      setAnexos((previous) =>
        previous.filter((x) => x.libraryId !== anexoParaExcluir.libraryId),
      );
      setShowConfirmarExclusaoAnexo(false);
      showToast("Documento movido para a lixeira.");
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : "Operação não confirmada.",
        "error",
      );
    }
  };
  const handleDownloadAnexo = async (anexo: AnexoEnf) => {
    if (!anexo.libraryId) {
      showToast(
        "Este anexo não tem ficheiro confirmado no servidor. Abra a biblioteca.",
        "error",
      );
      return;
    }
    try {
      const base =
        (import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "") +
        "/api/hospital/library/files/" +
        anexo.libraryId;
      const response = await fetch(base, {
        headers: { Authorization: `Bearer ${api.getToken()}` },
      });
      if (!response.ok) throw new Error("Documento indisponível.");
      const url = URL.createObjectURL(await response.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = anexo.nome;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Download falhou.", "error");
    }
  };

  const dadosRisco = useMemo(() => {
    const cont = { baixo: 0, moderado: 0, alto: 0, emergencia: 0 };
    atendimentos.forEach((a) => {
      cont[a.risco]++;
    });
    return [
      { name: "Baixo", value: cont.baixo },
      { name: "Moderado", value: cont.moderado },
      { name: "Alto", value: cont.alto },
      { name: "Emergência", value: cont.emergencia },
    ];
  }, [atendimentos]);
  const dadosTurno = useMemo(() => {
    const cont: Record<string, number> = {};
    atendimentos.forEach((a) => {
      cont[a.turno] = (cont[a.turno] || 0) + 1;
    });
    return Object.entries(cont).map(([name, value]) => ({ name, value }));
  }, [atendimentos]);
  const dadosSinaisVitais = useMemo(() => {
    return atendimentos.map((a) => ({
      nome: a.nomePaciente
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join(""),
      FC: a.frequenciaCardiaca,
      FR: a.frequenciaRespiratoria,
      SatO2: a.saturacaoO2,
    }));
  }, [atendimentos]);
  const dadosDor = useMemo(() => {
    const faixas = {
      "Sem dor (0)": 0,
      "Leve (1-3)": 0,
      "Moderada (4-6)": 0,
      "Intensa (7-10)": 0,
    };
    atendimentos.forEach((a) => {
      if (a.dorEVA === 0) faixas["Sem dor (0)"]++;
      else if (a.dorEVA <= 3) faixas["Leve (1-3)"]++;
      else if (a.dorEVA <= 6) faixas["Moderada (4-6)"]++;
      else faixas["Intensa (7-10)"]++;
    });
    return Object.entries(faixas).map(([name, value]) => ({ name, value }));
  }, [atendimentos]);
  const dadosAnexosTipo = useMemo(() => {
    const tipos: Record<string, number> = {};
    anexos.forEach((a) => {
      tipos[TIPOS_ANEXO_ENF[a.tipo].label] =
        (tipos[TIPOS_ANEXO_ENF[a.tipo].label] || 0) + 1;
    });
    return Object.entries(tipos).map(([name, value]) => ({ name, value }));
  }, [anexos]);
  const CORES = [
    "#10b981",
    "#f59e0b",
    "#f97316",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
    "#3b82f6",
    "#14b8a6",
  ];
  const followUpsOrdenados = useMemo(() => {
    return atendimentos
      .filter((a) => a.followUp)
      .map((a) => ({ ...a, followUpDate: new Date(a.followUp!) }))
      .sort((a, b) => a.followUpDate.getTime() - b.followUpDate.getTime());
  }, [atendimentos]);
  return {
    session,
    scope,
    activeTab,
    setActiveTab,
    showNovoAtendimento,
    setShowNovoAtendimento,
    showDetalhes,
    setShowDetalhes,
    showEditar,
    setShowEditar,
    showConfirmarExclusao,
    setShowConfirmarExclusao,
    showNotificacoes,
    setShowNotificacoes,
    showCalendario,
    setShowCalendario,
    showAnexos,
    setShowAnexos,
    showNovoAnexo,
    setShowNovoAnexo,
    showVisualizarAnexo,
    setShowVisualizarAnexo,
    showConfirmarExclusaoAnexo,
    setShowConfirmarExclusaoAnexo,
    selectedAtend,
    setSelectedAtend,
    atendParaExcluir,
    setAtendParaExcluir,
    anexoParaExcluir,
    setAnexoParaExcluir,
    anexoVisualizado,
    setAnexoVisualizado,
    atendimentos,
    setAtendimentos,
    storageError,
    anexos,
    setAnexos,
    notificacoes,
    setNotificacoes,
    searchTerm,
    setSearchTerm,
    filterRisco,
    setFilterRisco,
    filterTurno,
    setFilterTurno,
    filterAnexoTipo,
    setFilterAnexoTipo,
    searchAnexo,
    setSearchAnexo,
    toast,
    setToast,
    dragOver,
    setDragOver,
    dragOverNovo,
    setDragOverNovo,
    fileInputRef,
    fileInputNovoRef,
    anexosNovoAtend,
    setAnexosNovoAtend,
    anexoTempEditando,
    setAnexoTempEditando,
    formNovo,
    setFormNovo,
    formAnexo,
    setFormAnexo,
    showToast,
    atendimentosFiltrados,
    anexosAtendimento,
    getAnexosCount,
    notificacoesNaoLidas,
    formatDate,
    getRiscoBadge,
    getClassificarPA,
    getClassificarSatO2,
    getClassificarTemp,
    getClassificarGlicemia,
    navegarParaInternamento,
    detectarTipoAnexo,
    handleFilesNovoAtend,
    handleDropNovoAtend,
    removerAnexoTemp,
    atualizarAnexoTemp,
    handleNovoAtendimento,
    resetFormNovo,
    handleEditarAtendimento,
    handleExcluirAtendimento,
    handleMarcarNotificacaoLida,
    handleExportarCSV,
    handleImprimir,
    handleFileSelect,
    handleDrop,
    handleSalvarAnexo,
    handleExcluirAnexo,
    handleDownloadAnexo,
    dadosRisco,
    dadosTurno,
    dadosSinaisVitais,
    dadosDor,
    dadosAnexosTipo,
    CORES,
    followUpsOrdenados,
  };
}
