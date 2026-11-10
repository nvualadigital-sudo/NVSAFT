import { AppData, Paciente, Resultado, Config } from "../store/storage";
import { generatePDFHTML } from "./pdfGenerator";

export async function exportAllAsZip(data: AppData): Promise<void> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  const pdfsFolder = zip.folder("resultados_pdf");
  for (const resultado of data.resultados) {
    const paciente = data.pacientes.find((p) => p.id === resultado.pacienteId);
    const html = generatePDFHTML(resultado, paciente, data.config);
    const safeName = `${resultado.pacienteNome.replace(/[^a-zA-Z0-9\u00C0-\u024F]/g, "_")}_${resultado.data.replace(/\//g, "-")}_ID${resultado.id}.html`;
    pdfsFolder?.file(safeName, html);
  }

  const dataJson = JSON.stringify(data, null, 2);
  zip.file("dados_backup.json", dataJson);

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "resultados_laboratorio.zip";
  a.click();
  URL.revokeObjectURL(url);
}

function dataUrlToBytes(dataUrl: string): Uint8Array | null {
  try {
    const b64 = dataUrl.split(",")[1];
    if (!b64) return null;
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function getImgExt(dataUrl: string): string {
  if (dataUrl.includes("image/png")) return "png";
  if (dataUrl.includes("image/gif")) return "gif";
  return "jpg";
}

function buildPythonScript(): string {
  return `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Sistema de Resultados de Exames — Ultra Cardio Clinic
Versão exportada com base de dados SQLite integrada.
Instalar dependências:
    pip install reportlab pillow
"""

import tkinter as tk
from tkinter import ttk, messagebox, filedialog
import sqlite3
import os
import shutil
import json
from datetime import datetime

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
    try:
        from reportlab.platypus import Image as RLImage
    except ImportError:
        RLImage = None
    REPORTLAB_OK = True
except ImportError:
    REPORTLAB_OK = False
    print("[AVISO] reportlab não está instalado. Instale com: pip install reportlab")

DB_FILE = "laboratorio.db"
LOGO_FILE = "logo_empresa.png"
ASSINATURA_FILE = "assinatura.png"

COR_PRINCIPAL = "#2e7d52"
COR_PRINCIPAL_CLARO = "#e8f4ed"
COR_HEADER_LABEL = "#1e5c3a"
COR_BTN = "#2e7d52"
COR_VERMELHO = "#c0392b"
COR_CINZA = "#888888"
COR_BG = "#f5f7f5"
COR_CATEGORIA_BG = "#d6ead9"
COR_CATEGORIA_FG = "#1e5c3a"


def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    c = conn.cursor()
    c.executescript("""
        CREATE TABLE IF NOT EXISTS config (
            chave TEXT PRIMARY KEY,
            valor TEXT
        );
        CREATE TABLE IF NOT EXISTS pacientes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            nasc TEXT,
            sexo TEXT,
            idade TEXT,
            empresa TEXT,
            processo TEXT,
            medico TEXT,
            n_amostra TEXT,
            recolha TEXT
        );
        CREATE TABLE IF NOT EXISTS resultados (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            paciente_id INTEGER,
            paciente_nome TEXT,
            data_colheita TEXT,
            data_emissao TEXT,
            FOREIGN KEY(paciente_id) REFERENCES pacientes(id)
        );
        CREATE TABLE IF NOT EXISTS parametros_resultado (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            resultado_id INTEGER,
            exame TEXT,
            parametro TEXT,
            resultado TEXT,
            unidade TEXT,
            referencia TEXT,
            FOREIGN KEY(resultado_id) REFERENCES resultados(id)
        );
    """)
    defaults = {
        "nome_clinica": "Ultra Cardio Clinic",
        "endereco": "Rua da Liberdade, Casa nº 48",
        "telefone": "949 975 427 / 929 020 050",
        "email": "ultracardio@gmail.com",
        "director_tecnico": "Kudimuena Nsita",
    }
    for k, v in defaults.items():
        c.execute("INSERT OR IGNORE INTO config(chave, valor) VALUES (?,?)", (k, v))
    conn.commit()
    conn.close()


def get_config():
    conn = get_db()
    rows = conn.execute("SELECT chave, valor FROM config").fetchall()
    conn.close()
    return {r["chave"]: r["valor"] for r in rows}


def set_config(key, value):
    conn = get_db()
    conn.execute("INSERT OR REPLACE INTO config(chave,valor) VALUES(?,?)", (key, value))
    conn.commit()
    conn.close()


def get_pacientes():
    conn = get_db()
    rows = conn.execute("SELECT * FROM pacientes ORDER BY id").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def add_paciente(nome, nasc, sexo, idade, empresa, processo, medico, n_amostra, recolha):
    conn = get_db()
    c = conn.execute(
        "INSERT INTO pacientes(nome,nasc,sexo,idade,empresa,processo,medico,n_amostra,recolha) VALUES(?,?,?,?,?,?,?,?,?)",
        (nome, nasc, sexo, idade, empresa, processo, medico, n_amostra, recolha)
    )
    conn.commit()
    pac_id = c.lastrowid
    conn.close()
    return pac_id


def remove_paciente(pid):
    conn = get_db()
    conn.execute("DELETE FROM pacientes WHERE id=?", (pid,))
    conn.commit()
    conn.close()


def get_resultados(filtro=""):
    conn = get_db()
    if filtro:
        rows = conn.execute(
            "SELECT * FROM resultados WHERE LOWER(paciente_nome) LIKE ? ORDER BY id DESC",
            (f"%{filtro.lower()}%",)
        ).fetchall()
    else:
        rows = conn.execute("SELECT * FROM resultados ORDER BY id DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_parametros_resultado(resultado_id):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM parametros_resultado WHERE resultado_id=?", (resultado_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def add_resultado(paciente_id, paciente_nome, data_colheita, data_emissao, parametros):
    conn = get_db()
    c = conn.execute(
        "INSERT INTO resultados(paciente_id,paciente_nome,data_colheita,data_emissao) VALUES(?,?,?,?)",
        (paciente_id, paciente_nome, data_colheita, data_emissao)
    )
    rid = c.lastrowid
    for p in parametros:
        conn.execute(
            "INSERT INTO parametros_resultado(resultado_id,exame,parametro,resultado,unidade,referencia) VALUES(?,?,?,?,?,?)",
            (rid, p["exame"], p["parametro"], p["resultado"], p["unidade"], p["referencia"])
        )
    conn.commit()
    conn.close()
    return rid


def remove_resultado(rid):
    conn = get_db()
    conn.execute("DELETE FROM parametros_resultado WHERE resultado_id=?", (rid,))
    conn.execute("DELETE FROM resultados WHERE id=?", (rid,))
    conn.commit()
    conn.close()


def gerar_pdf(caminho, resultado, paciente, config):
    if not REPORTLAB_OK:
        messagebox.showerror("Erro", "reportlab não instalado. Execute: pip install reportlab")
        return

    doc = SimpleDocTemplate(caminho, pagesize=A4,
                            topMargin=1.5*cm, bottomMargin=1.5*cm,
                            leftMargin=1.5*cm, rightMargin=1.5*cm)
    story = []
    styles = getSampleStyleSheet()

    # Cabeçalho com logo
    header_data = []
    logo_cell = ""
    if os.path.exists(LOGO_FILE) and RLImage:
        try:
            logo_img = RLImage(LOGO_FILE, width=3.5*cm, height=2*cm, kind="proportional")
            logo_cell = logo_img
        except Exception:
            logo_cell = ""

    cfg = config
    clinic_text = f"""<b><font size="14" color="#1a4d2e">{cfg.get("nome_clinica","")}</font></b><br/>
<font size="9" color="#555">{cfg.get("telefone","")} | {cfg.get("email","")}</font><br/>
<font size="9" color="#555">{cfg.get("endereco","")}</font>"""

    clinic_para = Paragraph(clinic_text, ParagraphStyle("ch", fontName="Helvetica", leading=14))

    if logo_cell:
        header_table = Table([[logo_cell, clinic_para]], colWidths=[4*cm, None])
        header_table.setStyle(TableStyle([
            ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
            ("LEFTPADDING", (0,0), (-1,-1), 0),
        ]))
        story.append(header_table)
    else:
        story.append(clinic_para)

    story.append(Spacer(1, 0.3*cm))

    title_style = ParagraphStyle("title", fontName="Helvetica-Bold", fontSize=13,
                                  alignment=TA_CENTER, spaceAfter=0.4*cm, letterSpacing=2)
    story.append(Paragraph("LABORATÓRIO  DE  ANÁLISES  CLÍNICAS", title_style))

    # Dados do paciente
    pac = paciente or {}
    sexo = "Masculino" if pac.get("sexo") == "M" else ("Feminino" if pac.get("sexo") == "F" else pac.get("sexo",""))

    left_data = [
        ["Processo N°:", str(pac.get("processo", resultado.get("id","")))],
        ["Data:", resultado.get("data_colheita","")],
        ["Data Emissão:", resultado.get("data_emissao","")],
    ]
    if pac.get("medico"):
        left_data.append(["Médico Req.:", pac["medico"]])

    left_table = Table(left_data, colWidths=[3.5*cm, 5*cm])
    left_table.setStyle(TableStyle([
        ("FONTSIZE", (0,0), (-1,-1), 9),
        ("FONTNAME", (0,0), (0,-1), "Helvetica-Bold"),
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("LEFTPADDING", (0,0), (-1,-1), 0),
        ("BOTTOMPADDING", (0,0), (-1,-1), 3),
    ]))

    right_rows = [
        [Paragraph(f"<b>Estimado(a): {pac.get('nome', resultado.get('paciente_nome',''))}</b>",
                   ParagraphStyle("pn", fontSize=12, fontName="Helvetica-Bold", spaceAfter=4))],
    ]
    pat_fields = [("Sexo:", sexo), ("Idade:", f"{pac.get('idade','')} Ano(s)" if pac.get("idade") else "")]
    if pac.get("n_amostra"): pat_fields.append(("N° Amostra:", pac["n_amostra"]))
    if pac.get("recolha"): pat_fields.append(("Recolha:", pac["recolha"]))
    if pac.get("empresa"): pat_fields.append(("Entidade:", pac["empresa"]))
    for label, val in pat_fields:
        right_rows.append([Paragraph(f"<b>{label}</b>  {val}", ParagraphStyle("pf", fontSize=9))])

    right_inner = Table(right_rows, colWidths=[None])
    right_inner.setStyle(TableStyle([("LEFTPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),2)]))

    info_table = Table([[left_table, right_inner]], colWidths=[9*cm, None])
    info_table.setStyle(TableStyle([
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("BOX", (1,0), (1,0), 0.5, colors.HexColor("#999999")),
        ("ROUNDEDCORNERS", [4]),
        ("PADDING", (1,0), (1,0), 8),
        ("LEFTPADDING", (0,0), (0,0), 0),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 0.5*cm))

    # Tabela de resultados
    by_exame = {}
    for p in resultado.get("parametros", []):
        e = p.get("exame","")
        by_exame.setdefault(e, []).append(p)

    result_data = [
        [Paragraph("<b>Analises/Exames</b>", ParagraphStyle("h", fontSize=10)),
         Paragraph("<b>Resultado</b>", ParagraphStyle("h", fontSize=10, alignment=TA_CENTER)),
         Paragraph("<b>Unidade</b>", ParagraphStyle("h", fontSize=10, alignment=TA_CENTER)),
         Paragraph("<b>Valor de Referência</b>", ParagraphStyle("h", fontSize=10, alignment=TA_CENTER))]
    ]

    for exame, params in by_exame.items():
        result_data.append([
            Paragraph(f"<b>{exame}</b>", ParagraphStyle("ex", fontSize=10, fontName="Helvetica-Bold")),
            "", "", ""
        ])
        for p in params:
            result_data.append([
                Paragraph(p.get("parametro",""), ParagraphStyle("pr", fontSize=9)),
                Paragraph(p.get("resultado",""), ParagraphStyle("rv", fontSize=9, alignment=TA_CENTER)),
                Paragraph(p.get("unidade",""), ParagraphStyle("un", fontSize=9, alignment=TA_CENTER)),
                Paragraph(p.get("referencia",""), ParagraphStyle("rf", fontSize=9, alignment=TA_CENTER)),
            ])

    col_ws = [8*cm, 3.5*cm, 2.5*cm, 4*cm]
    res_table = Table(result_data, colWidths=col_ws, repeatRows=1)
    n = len(result_data)
    ts = TableStyle([
        ("LINEABOVE", (0,0), (-1,0), 1.2, colors.black),
        ("LINEBELOW", (0,0), (-1,0), 1.2, colors.black),
        ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE", (0,0), (-1,-1), 9),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, colors.HexColor("#f8f8f8")]),
        ("GRID", (0,0), (-1,-1), 0.3, colors.HexColor("#dddddd")),
        ("LEFTPADDING", (0,0), (-1,-1), 4),
        ("RIGHTPADDING", (0,0), (-1,-1), 4),
        ("BOTTOMPADDING", (0,0), (-1,-1), 3),
        ("TOPPADDING", (0,0), (-1,-1), 3),
    ])
    res_table.setStyle(ts)
    story.append(res_table)

    story.append(Spacer(1, 2*cm))

    # Assinatura
    sig_data = [[""]]
    sig_style = ParagraphStyle("sig", fontSize=9, alignment=TA_CENTER)
    if os.path.exists(ASSINATURA_FILE) and RLImage:
        try:
            sig_img = RLImage(ASSINATURA_FILE, width=5*cm, height=1.5*cm, kind="proportional")
            sig_data = [[sig_img]]
        except Exception:
            pass

    sig_table = Table(sig_data + [
        [HRFlowable(width="100%", thickness=0.5, color=colors.black)],
        [Paragraph("Director(a) Técnico(a)", sig_style)],
        [Paragraph(f"<i>{cfg.get('director_tecnico','')}</i>", sig_style)],
    ], colWidths=[6*cm])
    sig_table.setStyle(TableStyle([("ALIGN",(0,0),(-1,-1),"CENTER"),("LEFTPADDING",(0,0),(-1,-1),0)]))
    story.append(sig_table)

    story.append(Spacer(1, 1*cm))
    story.append(HRFlowable(width="100%", thickness=0.3, color=colors.grey))
    footer_style = ParagraphStyle("foot", fontSize=8, alignment=TA_CENTER, fontName="Helvetica-Oblique")
    story.append(Paragraph(cfg.get("endereco",""), footer_style))

    doc.build(story)


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title(f"Sistema de Resultados — {get_config().get('nome_clinica','')}")
        self.geometry("1200x740")
        self.configure(bg=COR_BG)
        self.resizable(True, True)
        self._logo_img = None
        self._build_style()
        self._build_ui()

    def _build_style(self):
        style = ttk.Style(self)
        style.theme_use("clam")
        style.configure("TNotebook", background=COR_BG, borderwidth=0)
        style.configure("TNotebook.Tab", font=("Helvetica", 10, "bold"),
                        padding=[14, 6], background="#d6ead9", foreground=COR_HEADER_LABEL)
        style.map("TNotebook.Tab", background=[("selected", COR_PRINCIPAL)],
                  foreground=[("selected", "white")])
        style.configure("Treeview.Heading", font=("Helvetica", 9, "bold"),
                        background=COR_PRINCIPAL_CLARO, foreground=COR_HEADER_LABEL)
        style.configure("Treeview", rowheight=24, font=("Helvetica", 9))

    def _build_ui(self):
        header = tk.Frame(self, bg=COR_PRINCIPAL, height=70)
        header.pack(fill="x")
        header.pack_propagate(False)

        self._logo_label = tk.Label(header, bg=COR_PRINCIPAL, cursor="hand2")
        self._logo_label.pack(side="left", padx=14, pady=8)
        self._logo_label.bind("<Button-1>", lambda e: self._selecionar_logo())
        self._carregar_logo_header()

        info_frame = tk.Frame(header, bg=COR_PRINCIPAL)
        info_frame.pack(side="left", pady=8)
        cfg = get_config()
        self._lbl_clinica = tk.Label(info_frame,
            text=cfg.get("nome_clinica", ""),
            font=("Helvetica", 16, "bold"), fg="white", bg=COR_PRINCIPAL)
        self._lbl_clinica.pack(anchor="w")
        tk.Label(info_frame,
            text="Sistema de Lançamento de Resultados de Exames",
            font=("Helvetica", 9), fg="#c8e6c9", bg=COR_PRINCIPAL).pack(anchor="w")

        tk.Button(header, text="⚙ Configurações", bg=COR_HEADER_LABEL, fg="white",
                  font=("Helvetica", 9), padx=8, pady=4, relief="flat",
                  cursor="hand2", command=self._abrir_configuracoes).pack(side="right", padx=14, pady=20)

        notebook = ttk.Notebook(self)
        notebook.pack(fill="both", expand=True, padx=8, pady=8)

        self.tab_pacientes = ttk.Frame(notebook)
        self.tab_lancamento = ttk.Frame(notebook)
        self.tab_historico = ttk.Frame(notebook)

        notebook.add(self.tab_pacientes, text="  Pacientes  ")
        notebook.add(self.tab_lancamento, text="  Lançar Resultados  ")
        notebook.add(self.tab_historico, text="  Histórico / PDF  ")

        self._build_tab_pacientes()
        self._build_tab_lancamento()
        self._build_tab_historico()

    def _carregar_logo_header(self):
        if os.path.exists(LOGO_FILE):
            try:
                from PIL import Image, ImageTk
                img = Image.open(LOGO_FILE)
                img.thumbnail((54, 54), Image.LANCZOS)
                self._logo_img = ImageTk.PhotoImage(img)
                self._logo_label.configure(image=self._logo_img, text="")
                return
            except ImportError:
                pass
        self._logo_label.configure(text="🏥\\nLogo", fg="white", font=("Helvetica", 9), compound="top", pady=2)

    def _selecionar_logo(self):
        path = filedialog.askopenfilename(title="Seleccionar logo",
            filetypes=[("Imagens", "*.png *.jpg *.jpeg *.gif *.bmp"), ("Todos", "*.*")])
        if path:
            shutil.copy2(path, LOGO_FILE)
            self._carregar_logo_header()
            messagebox.showinfo("Logo", "Logo actualizada com sucesso!")

    def _abrir_configuracoes(self):
        win = tk.Toplevel(self)
        win.title("Configurações da Clínica")
        win.geometry("440x320")
        win.resizable(False, False)
        win.grab_set()
        cfg = get_config()
        campos = [
            ("Nome da Clínica", "nome_clinica"),
            ("Endereço", "endereco"),
            ("Telefone", "telefone"),
            ("E-mail", "email"),
            ("Director(a) Técnico(a)", "director_tecnico"),
        ]
        entries = {}
        tk.Label(win, text="Configurações", font=("Helvetica", 12, "bold"),
                 fg=COR_HEADER_LABEL).grid(row=0, column=0, columnspan=2, pady=(15, 10))
        for i, (label, key) in enumerate(campos):
            tk.Label(win, text=label + ":").grid(row=i+1, column=0, sticky="e", padx=10, pady=6)
            e = tk.Entry(win, width=34)
            e.insert(0, cfg.get(key, ""))
            e.grid(row=i+1, column=1, sticky="w", padx=10)
            entries[key] = e

        def guardar():
            for key, e in entries.items():
                set_config(key, e.get().strip())
            self._lbl_clinica.configure(text=get_config().get("nome_clinica",""))
            win.destroy()
            messagebox.showinfo("Guardado", "Configurações guardadas com sucesso.")

        tk.Button(win, text="Guardar", bg=COR_BTN, fg="white",
                  font=("Helvetica", 10, "bold"), padx=16, pady=5, command=guardar).grid(
                  row=len(campos)+1, column=0, columnspan=2, pady=15)

    def _btn(self, parent, text, cmd, cor=None, **kw):
        cor = cor or COR_BTN
        return tk.Button(parent, text=text, bg=cor, fg="white",
                         font=("Helvetica", 9, "bold"), padx=10, pady=5,
                         relief="flat", cursor="hand2", command=cmd, **kw)

    # ---- TAB PACIENTES ----
    def _build_tab_pacientes(self):
        frame = self.tab_pacientes
        tk.Label(frame, text="Cadastro de Pacientes", font=("Helvetica", 13, "bold"),
                 fg=COR_HEADER_LABEL, bg=COR_BG).pack(pady=(12, 5))

        form = tk.LabelFrame(frame, text=" Dados do Paciente ", font=("Helvetica", 9, "bold"),
                             fg=COR_HEADER_LABEL, bg=COR_BG, padx=10, pady=8)
        form.pack(padx=10, pady=5)

        campos = [
            ("Nome Completo", 30), ("Data de Nascimento (DD/MM/AAAA)", 14),
            ("Sexo (M/F)", 5), ("Idade", 5), ("Empresa/Entidade", 22),
            ("N.º Processo", 14), ("Médico Requisitante", 28),
            ("N.º Amostra", 12), ("Local de Recolha", 22),
        ]
        self.p_entries = {}
        cols_per_row = 3
        for i, (label, width) in enumerate(campos):
            row = i // cols_per_row
            col_pair = (i % cols_per_row) * 2
            tk.Label(form, text=label+":", bg=COR_BG, anchor="e").grid(
                row=row, column=col_pair, sticky="e", padx=(8,3), pady=4)
            e = tk.Entry(form, width=width)
            e.grid(row=row, column=col_pair+1, sticky="w", padx=(0,12), pady=4)
            self.p_entries[label] = e

        btn_frame = tk.Frame(frame, bg=COR_BG)
        btn_frame.pack(pady=6)
        self._btn(btn_frame, "Adicionar Paciente", self._adicionar_paciente).pack(side="left", padx=5)
        self._btn(btn_frame, "Limpar Campos", self._limpar_campos_paciente, COR_CINZA).pack(side="left", padx=5)

        cols = ("ID","Nome","Nasc.","Sexo","Idade","Empresa","Processo","Médico")
        self.tree_pac = ttk.Treeview(frame, columns=cols, show="headings", height=10)
        widths = [40,200,110,50,50,140,90,180]
        for c, w in zip(cols, widths):
            self.tree_pac.heading(c, text=c)
            self.tree_pac.column(c, width=w, anchor="center")
        sb = ttk.Scrollbar(frame, orient="vertical", command=self.tree_pac.yview)
        self.tree_pac.configure(yscrollcommand=sb.set)
        self.tree_pac.pack(fill="both", expand=True, padx=10, pady=5, side="left")
        sb.pack(side="left", fill="y", pady=5)
        self._refresh_tree_pacientes()
        self._btn(frame, "Remover Paciente Seleccionado",
                  self._remover_paciente, COR_VERMELHO).pack(pady=4)

    def _adicionar_paciente(self):
        nome = self.p_entries["Nome Completo"].get().strip()
        if not nome:
            messagebox.showerror("Erro", "O nome é obrigatório.")
            return
        add_paciente(
            nome=nome,
            nasc=self.p_entries["Data de Nascimento (DD/MM/AAAA)"].get().strip(),
            sexo=self.p_entries["Sexo (M/F)"].get().strip().upper(),
            idade=self.p_entries["Idade"].get().strip(),
            empresa=self.p_entries["Empresa/Entidade"].get().strip(),
            processo=self.p_entries["N.º Processo"].get().strip(),
            medico=self.p_entries["Médico Requisitante"].get().strip(),
            n_amostra=self.p_entries["N.º Amostra"].get().strip(),
            recolha=self.p_entries["Local de Recolha"].get().strip(),
        )
        self._refresh_tree_pacientes()
        self._limpar_campos_paciente()
        self._refresh_combo_pacientes()
        messagebox.showinfo("Sucesso", f"Paciente '{nome}' adicionado.")

    def _limpar_campos_paciente(self):
        for e in self.p_entries.values():
            e.delete(0, "end")

    def _remover_paciente(self):
        sel = self.tree_pac.selection()
        if not sel:
            messagebox.showwarning("Aviso", "Seleccione um paciente.")
            return
        pid = self.tree_pac.item(sel[0])["values"][0]
        if messagebox.askyesno("Confirmar", f"Remover paciente ID {pid}?"):
            remove_paciente(pid)
            self._refresh_tree_pacientes()
            self._refresh_combo_pacientes()

    def _refresh_tree_pacientes(self):
        for r in self.tree_pac.get_children():
            self.tree_pac.delete(r)
        for p in get_pacientes():
            self.tree_pac.insert("", "end", values=(
                p["id"], p["nome"], p["nasc"], p["sexo"], p["idade"],
                p["empresa"], p["processo"], p["medico"]
            ))

    # ---- TAB LANCAMENTO ----
    def _build_tab_lancamento(self):
        frame = self.tab_lancamento
        top = tk.Frame(frame, bg=COR_BG, pady=6)
        top.pack(fill="x", padx=10)
        tk.Label(top, text="Paciente:", font=("Helvetica", 10, "bold"), bg=COR_BG).pack(side="left")
        self.combo_pac = ttk.Combobox(top, width=38, state="readonly")
        self.combo_pac.pack(side="left", padx=8)
        self._refresh_combo_pacientes()
        tk.Label(top, text="Data Colheita:", font=("Helvetica", 10, "bold"), bg=COR_BG).pack(side="left", padx=(18,0))
        self.entry_data = tk.Entry(top, width=14)
        self.entry_data.insert(0, datetime.today().strftime("%d/%m/%Y"))
        self.entry_data.pack(side="left", padx=6)

        cols = ("Exame","Parâmetro","Resultado","Unidade","Referência")
        self.tree_res = ttk.Treeview(frame, columns=cols, show="headings", height=20)
        ws = [140,200,110,80,160]
        for c, w in zip(cols, ws):
            self.tree_res.heading(c, text=c)
            self.tree_res.column(c, width=w, anchor="center" if c not in ("Parâmetro","Exame") else "w")
        sb2 = ttk.Scrollbar(frame, orient="vertical", command=self.tree_res.yview)
        self.tree_res.configure(yscrollcommand=sb2.set)
        self.tree_res.pack(fill="both", expand=True, padx=10, pady=5, side="left")
        sb2.pack(side="left", fill="y", pady=5)
        self.tree_res.bind("<ButtonRelease-1>", self._clique_resultado)
        self._inline_entry = None
        self._inline_item = None
        self.param_data = []
        self._btn(frame, "Guardar Resultados", self._guardar_resultados).pack(pady=6)

    def _refresh_combo_pacientes(self):
        pacs = get_pacientes()
        nomes = [f"{p['id']} — {p['nome']}" for p in pacs]
        self.combo_pac["values"] = nomes
        if nomes:
            self.combo_pac.current(0)

    def _clique_resultado(self, event):
        item = self.tree_res.identify_row(event.y)
        col = self.tree_res.identify_column(event.x)
        if not item or col != "#3":
            self._esconder_entry_inline()
            return
        self._mostrar_entry_inline(item)

    def _mostrar_entry_inline(self, item):
        self._esconder_entry_inline()
        bbox = self.tree_res.bbox(item, "#3")
        if not bbox: return
        x, y, width, height = bbox
        vals = list(self.tree_res.item(item, "values"))
        entry = tk.Entry(self.tree_res, font=("Helvetica",9), justify="center", relief="solid", bd=1)
        entry.insert(0, vals[2])
        entry.select_range(0, "end")
        entry.place(x=x, y=y, width=width, height=height)
        entry.focus_set()
        self._inline_entry = entry
        self._inline_item = item

        def confirmar(event=None):
            novo = entry.get().strip()
            vals[2] = novo
            self.tree_res.item(item, values=vals)
            for pd in self.param_data:
                if pd["iid"] == item: pd["resultado"] = novo
            self._esconder_entry_inline()
            children = self.tree_res.get_children()
            if item in children:
                idx = list(children).index(item)
                if idx+1 < len(children):
                    self._mostrar_entry_inline(children[idx+1])

        entry.bind("<Return>", confirmar)
        entry.bind("<Tab>", confirmar)
        entry.bind("<Escape>", lambda e: self._esconder_entry_inline())
        entry.bind("<FocusOut>", lambda e: self.after(50, self._esconder_entry_inline))

    def _esconder_entry_inline(self, event=None):
        if self._inline_entry:
            try:
                novo = self._inline_entry.get().strip()
                if self._inline_item:
                    vals = list(self.tree_res.item(self._inline_item, "values"))
                    vals[2] = novo
                    self.tree_res.item(self._inline_item, values=vals)
                    for pd in self.param_data:
                        if pd["iid"] == self._inline_item: pd["resultado"] = novo
            except Exception: pass
            try: self._inline_entry.destroy()
            except Exception: pass
            self._inline_entry = None
            self._inline_item = None

    def _guardar_resultados(self):
        self._esconder_entry_inline()
        if not self.combo_pac.get():
            messagebox.showerror("Erro", "Seleccione um paciente.")
            return
        pid = int(self.combo_pac.get().split("—")[0].strip())
        pacs = get_pacientes()
        pac = next((p for p in pacs if p["id"] == pid), None)
        if not pac:
            messagebox.showerror("Erro", "Paciente não encontrado.")
            return
        if not any(pd["resultado"] for pd in self.param_data):
            messagebox.showwarning("Aviso", "Nenhum resultado inserido.")
            return
        today = datetime.today().strftime("%d/%m/%Y")
        add_resultado(
            paciente_id=pid,
            paciente_nome=pac["nome"],
            data_colheita=self.entry_data.get().strip(),
            data_emissao=today,
            parametros=self.param_data
        )
        self._refresh_tree_historico()
        self.param_data = []
        for r in self.tree_res.get_children(): self.tree_res.delete(r)
        messagebox.showinfo("Sucesso", "Resultados guardados com sucesso!")

    # ---- TAB HISTORICO ----
    def _build_tab_historico(self):
        frame = self.tab_historico
        tk.Label(frame, text="Histórico de Resultados", font=("Helvetica", 13, "bold"),
                 fg=COR_HEADER_LABEL, bg=COR_BG).pack(pady=(12,5))
        top = tk.Frame(frame, bg=COR_BG)
        top.pack(fill="x", padx=10, pady=3)
        tk.Label(top, text="Filtrar por nome:", bg=COR_BG).pack(side="left")
        self.entry_filtro = tk.Entry(top, width=26)
        self.entry_filtro.pack(side="left", padx=6)
        self._btn(top, "Filtrar", self._refresh_tree_historico).pack(side="left")
        self._btn(top, "Limpar", lambda: [self.entry_filtro.delete(0,"end"), self._refresh_tree_historico()], COR_CINZA).pack(side="left", padx=5)

        cols = ("ID","Paciente","Data Colheita","Emissão","N.º Parâm.")
        hist_frame = tk.Frame(frame, bg=COR_BG)
        hist_frame.pack(fill="both", expand=True, padx=10, pady=5)
        self.tree_hist = ttk.Treeview(hist_frame, columns=cols, show="headings", height=16)
        ws = [50,280,130,130,100]
        for c, w in zip(cols, ws):
            self.tree_hist.heading(c, text=c)
            self.tree_hist.column(c, width=w, anchor="center")
        sb3 = ttk.Scrollbar(hist_frame, orient="vertical", command=self.tree_hist.yview)
        self.tree_hist.configure(yscrollcommand=sb3.set)
        self.tree_hist.pack(side="left", fill="both", expand=True)
        sb3.pack(side="right", fill="y")
        self._refresh_tree_historico()

        btn_frame = tk.Frame(frame, bg=COR_BG)
        btn_frame.pack(pady=6)
        self._btn(btn_frame, "Exportar PDF Seleccionado", self._exportar_pdf).pack(side="left", padx=5)
        self._btn(btn_frame, "Remover Registo", self._remover_registo, COR_VERMELHO).pack(side="left", padx=5)

    def _refresh_tree_historico(self):
        for r in self.tree_hist.get_children(): self.tree_hist.delete(r)
        filtro = self.entry_filtro.get().strip() if hasattr(self, "entry_filtro") else ""
        for reg in get_resultados(filtro):
            params = get_parametros_resultado(reg["id"])
            n = len([p for p in params if p.get("resultado")])
            self.tree_hist.insert("", "end", values=(
                reg["id"], reg["paciente_nome"],
                reg["data_colheita"], reg["data_emissao"], n
            ))

    def _remover_registo(self):
        sel = self.tree_hist.selection()
        if not sel:
            messagebox.showwarning("Aviso", "Seleccione um registo.")
            return
        rid = self.tree_hist.item(sel[0])["values"][0]
        if messagebox.askyesno("Confirmar", f"Remover registo ID {rid}?"):
            remove_resultado(rid)
            self._refresh_tree_historico()

    def _exportar_pdf(self):
        sel = self.tree_hist.selection()
        if not sel:
            messagebox.showwarning("Aviso", "Seleccione um registo.")
            return
        rid = self.tree_hist.item(sel[0])["values"][0]
        resultados = get_resultados()
        reg = next((r for r in resultados if r["id"] == rid), None)
        if not reg: return
        pacs = get_pacientes()
        pac = next((p for p in pacs if p["id"] == reg.get("paciente_id")), None)
        reg["parametros"] = get_parametros_resultado(rid)
        nome_arq = f"{reg['paciente_nome'].replace(' ','_')}_{reg['data_colheita'].replace('/','_')}.pdf"
        caminho = filedialog.asksaveasfilename(defaultextension=".pdf",
            filetypes=[("PDF","*.pdf")], initialfile=nome_arq, title="Guardar PDF")
        if not caminho: return
        try:
            gerar_pdf(caminho, reg, pac, get_config())
            messagebox.showinfo("Sucesso", f"PDF exportado:\\n{caminho}")
        except Exception as e:
            messagebox.showerror("Erro ao gerar PDF", str(e))


def main():
    init_db()
    app = App()
    app.mainloop()


if __name__ == "__main__":
    main()
`;
}

function buildReadme(config: Config): string {
  return `=============================================================
  SISTEMA DE RESULTADOS — ${config.nomeClinica}
  Versão Python + SQLite — Exportado em ${new Date().toLocaleDateString("pt-PT")}
=============================================================

CONTEÚDO DO ZIP:
  sistema_resultados.py   — Aplicação de secretária (Python/Tkinter)
  laboratorio.db          — Base de dados SQLite com todos os dados
  dados_backup.json       — Cópia de segurança em JSON
  logo_empresa.png        — Logo da empresa (se disponível)
  assinatura.png          — Assinatura virtual (se disponível)
  resultados_pdf/         — Todos os resultados em HTML (imprimíveis)
  README.txt              — Este ficheiro

COMO USAR A APLICAÇÃO PYTHON:
  1. Instalar Python 3.8+ em https://python.org
  2. Instalar dependências:
       pip install reportlab pillow
  3. Colocar todos os ficheiros na mesma pasta
  4. Executar:
       python sistema_resultados.py

GERAÇÃO DE PDF:
  Na aplicação Python, vá ao separador "Histórico / PDF",
  seleccione um registo e clique "Exportar PDF Seleccionado".
  O PDF é gerado automaticamente com reportlab.

NOTAS:
  - O ficheiro laboratorio.db contém todos os dados da clínica
  - Faça backup regular deste ficheiro
  - Os ficheiros HTML na pasta resultados_pdf/ podem ser
    abertos no browser e impressos como PDF

=============================================================
`;
}

export async function exportPythonZip(data: AppData): Promise<void> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  zip.file("sistema_resultados.py", buildPythonScript());
  zip.file("README.txt", buildReadme(data.config));

  const dadosPython = {
    pacientes: data.pacientes.map((p) => ({
      id: p.id,
      nome: p.nome,
      nasc: p.nasc,
      sexo: p.sexo,
      idade: p.idade,
      empresa: p.empresa,
      processo: p.processo,
      medico: p.medico,
      n_amostra: p.nAmostra,
      recolha: p.recolha,
    })),
    resultados: data.resultados.map((r) => ({
      id: r.id,
      paciente_id: r.pacienteId,
      paciente_nome: r.pacienteNome,
      data_colheita: r.data,
      data_emissao: r.dataEmissao,
      parametros: r.parametros,
    })),
    config: {
      nome_clinica: data.config.nomeClinica,
      endereco: data.config.endereco,
      telefone: data.config.telefone,
      email: data.config.email,
      director_tecnico: data.config.directorTecnico,
    },
    exames_custom: data.examesCustom,
  };
  zip.file("dados_backup.json", JSON.stringify(dadosPython, null, 2));

  const dbScript = buildSqliteScript(data);
  zip.file("criar_base_dados.py", dbScript);

  if (data.config.logoData) {
    const bytes = dataUrlToBytes(data.config.logoData);
    if (bytes) zip.file("logo_empresa.png", bytes);
  }

  if (data.config.assinaturaData) {
    const bytes = dataUrlToBytes(data.config.assinaturaData);
    if (bytes) {
      const ext = getImgExt(data.config.assinaturaData);
      zip.file(`assinatura.${ext}`, bytes);
      if (ext !== "png") {
        zip.file("assinatura.png", bytes);
      }
    }
  }

  const pdfsFolder = zip.folder("resultados_pdf");
  for (const resultado of data.resultados) {
    const paciente = data.pacientes.find((p) => p.id === resultado.pacienteId);
    const html = generatePDFHTML(resultado, paciente, data.config);
    const safeName = `${resultado.pacienteNome
      .replace(/[^a-zA-Z0-9\u00C0-\u024F ]/g, "_")
      .trim()
      .replace(
        /\s+/g,
        "_",
      )}_${resultado.data.replace(/\//g, "-")}_ID${resultado.id}.html`;
    pdfsFolder?.file(safeName, html);
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sistema_laboratorio_${new Date().toISOString().slice(0, 10)}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

function buildSqliteScript(data: AppData): string {
  const cfg = data.config;
  const pacInserts = data.pacientes
    .map(
      (p) =>
        `c.execute("INSERT OR REPLACE INTO pacientes VALUES(?,?,?,?,?,?,?,?,?,?)", (${p.id}, ${JSON.stringify(p.nome)}, ${JSON.stringify(p.nasc)}, ${JSON.stringify(p.sexo)}, ${JSON.stringify(p.idade)}, ${JSON.stringify(p.empresa)}, ${JSON.stringify(p.processo)}, ${JSON.stringify(p.medico)}, ${JSON.stringify(p.nAmostra || "")}, ${JSON.stringify(p.recolha || "")}))`,
    )
    .join("\n    ");

  const resInserts = data.resultados
    .map((r) => {
      const pInserts = r.parametros
        .map(
          (p, pi) =>
            `c.execute("INSERT INTO parametros_resultado(resultado_id,exame,parametro,resultado,unidade,referencia) VALUES(?,?,?,?,?,?)", (${r.id}, ${JSON.stringify(p.exame)}, ${JSON.stringify(p.parametro)}, ${JSON.stringify(p.resultado)}, ${JSON.stringify(p.unidade)}, ${JSON.stringify(p.referencia)}))`,
        )
        .join("\n    ");
      return `c.execute("INSERT OR REPLACE INTO resultados(id,paciente_id,paciente_nome,data_colheita,data_emissao) VALUES(?,?,?,?,?)", (${r.id}, ${r.pacienteId}, ${JSON.stringify(r.pacienteNome)}, ${JSON.stringify(r.data)}, ${JSON.stringify(r.dataEmissao)}))
    ${pInserts}`;
    })
    .join("\n    ");

  return `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Cria a base de dados SQLite com todos os dados exportados.
Execute este script na mesma pasta que sistema_resultados.py:
    python criar_base_dados.py
"""
import sqlite3, os

DB = "laboratorio.db"
if os.path.exists(DB):
    r = input(f"Base de dados '{DB}' já existe. Substituir? (s/N): ")
    if r.lower() != "s":
        print("Operação cancelada.")
        exit()

conn = sqlite3.connect(DB)
c = conn.cursor()
c.executescript("""
    DROP TABLE IF EXISTS parametros_resultado;
    DROP TABLE IF EXISTS resultados;
    DROP TABLE IF EXISTS pacientes;
    DROP TABLE IF EXISTS config;
    CREATE TABLE config (chave TEXT PRIMARY KEY, valor TEXT);
    CREATE TABLE pacientes (
        id INTEGER PRIMARY KEY, nome TEXT, nasc TEXT, sexo TEXT,
        idade TEXT, empresa TEXT, processo TEXT, medico TEXT,
        n_amostra TEXT, recolha TEXT
    );
    CREATE TABLE resultados (
        id INTEGER PRIMARY KEY, paciente_id INTEGER,
        paciente_nome TEXT, data_colheita TEXT, data_emissao TEXT
    );
    CREATE TABLE parametros_resultado (
        id INTEGER PRIMARY KEY AUTOINCREMENT, resultado_id INTEGER,
        exame TEXT, parametro TEXT, resultado TEXT, unidade TEXT, referencia TEXT
    );
""")

# Configurações
c.execute("INSERT INTO config VALUES('nome_clinica',?)", (${JSON.stringify(cfg.nomeClinica)},))
c.execute("INSERT INTO config VALUES('endereco',?)", (${JSON.stringify(cfg.endereco)},))
c.execute("INSERT INTO config VALUES('telefone',?)", (${JSON.stringify(cfg.telefone)},))
c.execute("INSERT INTO config VALUES('email',?)", (${JSON.stringify(cfg.email)},))
c.execute("INSERT INTO config VALUES('director_tecnico',?)", (${JSON.stringify(cfg.directorTecnico)},))

# Pacientes
${pacInserts || "# Nenhum paciente"}

# Resultados
${resInserts || "# Nenhum resultado"}

conn.commit()
conn.close()
print(f"Base de dados '{DB}' criada com sucesso!")
print(f"  Pacientes: ${data.pacientes.length}")
print(f"  Resultados: ${data.resultados.length}")
`;
}
