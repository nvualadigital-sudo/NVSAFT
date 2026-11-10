export type Parametro = [string, string, string];
export type SubExames = Record<string, Parametro[]>;
export type ExamesMap = Record<string, SubExames>;

export const EXAMES_BUILTIN: ExamesMap = {
  Hematologia: {
    "Hemograma Completo": [
      ["Leucócitos", "10⁹/L", "4.0–10.0"],
      ["Linfócitos %", "%", "20–40"],
      ["Monócitos %", "%", "2–10"],
      ["Granulócitos (Neutrófilos) %", "%", "50–70"],
      ["Eosinófilos %", "%", "1–6"],
      ["Basófilos %", "%", "0–1"],
      ["Linfócitos #", "10⁹/L", "1.0–4.0"],
      ["Monócitos #", "10⁹/L", "0.2–1.0"],
      ["Granulócitos #", "10⁹/L", "2.0–7.0"],
      ["Eritrócitos (H)", "10¹²/L", "4.5–5.9"],
      ["Eritrócitos (M)", "10¹²/L", "3.8–5.2"],
      ["Hemoglobina (H)", "g/dL", "13.5–17.5"],
      ["Hemoglobina (M)", "g/dL", "12.0–16.0"],
      ["Hematócrito (H)", "%", "41–53"],
      ["Hematócrito (M)", "%", "36–46"],
      ["VCM (MCV)", "fL", "80–100"],
      ["HCM (MCH)", "pg", "27–34"],
      ["CHCM (MCHC)", "g/dL", "32–36"],
      ["RDW-CV", "%", "11.5–14.5"],
      ["RDW-SD", "fL", "35–56"],
      ["Plaquetas", "10⁹/L", "150–400"],
      ["VPM (MPV)", "fL", "7.5–12.5"],
      ["PDW", "%", "9–17"],
      ["PCT", "%", "0.10–0.35"],
    ],
    Reticulócitos: [
      ["Reticulócitos %", "%", "0.5–2.0"],
      ["Reticulócitos #", "10⁹/L", "25–100"],
    ],
    "Esfregaço de Sangue Periférico": [
      ["Morfologia Eritrocitária", "", "Normal"],
      ["Morfologia Leucocitária", "", "Normal"],
      ["Morfologia Plaquetária", "", "Normal"],
      ["Células Blásticas", "", "Ausentes"],
    ],
    "Velocidade de Sedimentação (VS)": [
      ["VS 1ª Hora (H)", "mm/h", "0–15"],
      ["VS 1ª Hora (M)", "mm/h", "0–20"],
    ],
    "Grupo Sanguíneo e Fator Rh": [
      ["Grupo ABO", "", "A / B / AB / O"],
      ["Fator Rh", "", "Positivo / Negativo"],
    ],
  },

  "Bioquímica Geral": {
    "Glicemia em Jejum": [["Glucose (Jejum)", "mg/dL", "70–100"]],
    "Glicemia Pós-Prandial": [["Glucose (2h após refeição)", "mg/dL", "<140"]],
    "Glicemia Aleatória": [["Glucose (Aleatória)", "mg/dL", "<200"]],
    "Proteínas Totais e Fracções": [
      ["Proteínas Totais", "g/dL", "6.4–8.3"],
      ["Albumina", "g/dL", "3.5–5.0"],
      ["Globulinas", "g/dL", "2.3–3.5"],
      ["Relação Alb/Glob", "", "1.2–2.2"],
    ],
    Eletrólitos: [
      ["Sódio (Na⁺)", "mEq/L", "136–145"],
      ["Potássio (K⁺)", "mEq/L", "3.5–5.0"],
      ["Cloretos (Cl⁻)", "mEq/L", "98–107"],
      ["Bicarbonato (HCO₃⁻)", "mEq/L", "22–29"],
      ["Cálcio Total", "mg/dL", "8.5–10.5"],
      ["Fósforo", "mg/dL", "2.5–4.5"],
      ["Magnésio", "mg/dL", "1.7–2.4"],
    ],
    "Ferro e Metabolismo": [
      ["Ferro Sérico (H)", "μg/dL", "70–180"],
      ["Ferro Sérico (M)", "μg/dL", "60–160"],
      ["TIBC (Capacidade Total de Fixação do Ferro)", "μg/dL", "250–370"],
      ["Ferritina (H)", "ng/mL", "30–300"],
      ["Ferritina (M)", "ng/mL", "15–120"],
      ["Saturação de Transferrina", "%", "20–50"],
    ],
    "Ácido Úrico": [
      ["Ácido Úrico (H)", "mg/dL", "3.5–7.2"],
      ["Ácido Úrico (M)", "mg/dL", "2.6–6.0"],
    ],
    "Lactato Desidrogenase (LDH)": [["LDH", "U/L", "140–280"]],
    "Amilase e Lípase": [
      ["Amilase", "U/L", "28–100"],
      ["Lípase", "U/L", "13–60"],
    ],
  },

  "Função Renal": {
    "Ureia e Creatinina": [
      ["Ureia", "mg/dL", "15–45"],
      ["Creatinina (H)", "mg/dL", "0.7–1.4"],
      ["Creatinina (M)", "mg/dL", "0.5–1.1"],
      ["TFG estimada (CKD-EPI)", "mL/min/1.73m²", ">60"],
    ],
    "Ácido Úrico": [
      ["Ácido Úrico (H)", "mg/dL", "3.5–7.2"],
      ["Ácido Úrico (M)", "mg/dL", "2.6–6.0"],
    ],
    Microalbuminúria: [
      ["Microalbumina na Urina", "mg/24h", "<30"],
      ["Relação Alb/Creatinina na Urina", "mg/g", "<30"],
    ],
    "Clearance de Creatinina": [
      ["Clearance de Creatinina (24h)", "mL/min", "88–128"],
    ],
  },

  "Perfil Lipídico": {
    "Perfil Lipídico Completo": [
      ["Colesterol Total", "mg/dL", "<200 (desejável)"],
      ["Colesterol LDL", "mg/dL", "<130 (ótimo: <100)"],
      ["Colesterol HDL (H)", "mg/dL", ">40"],
      ["Colesterol HDL (M)", "mg/dL", ">50"],
      ["Triglicerídeos", "mg/dL", "<150"],
      ["VLDL", "mg/dL", "<30"],
      ["Relação CT/HDL", "", "<5.0"],
    ],
    "Lipoproteína (a)": [["Lipoproteína (a) – Lp(a)", "mg/dL", "<30"]],
    Apolipoproteínas: [
      ["Apolipoproteína A-I", "mg/dL", "M: 119–240 / H: 101–199"],
      ["Apolipoproteína B", "mg/dL", "M: 60–117 / H: 63–133"],
    ],
  },

  "Função Hepática": {
    "Enzimas Hepáticas": [
      ["TGO (AST)", "U/L", "10–40"],
      ["TGP (ALT)", "U/L", "7–56"],
      ["Fosfatase Alcalina (ALP)", "U/L", "44–147"],
      ["GGT (Gama-GT)", "U/L", "H: 8–61 / M: 5–36"],
    ],
    Bilirrubinas: [
      ["Bilirrubina Total", "mg/dL", "0.2–1.2"],
      ["Bilirrubina Directa (Conjugada)", "mg/dL", "0.0–0.4"],
      ["Bilirrubina Indirecta", "mg/dL", "0.1–0.8"],
    ],
    "Proteínas Hepáticas": [
      ["Albumina", "g/dL", "3.5–5.0"],
      ["Tempo de Protrombina (TP)", "seg", "11–14"],
      ["INR", "", "0.8–1.2"],
    ],
    "Perfil Hepático Completo": [
      ["TGO (AST)", "U/L", "10–40"],
      ["TGP (ALT)", "U/L", "7–56"],
      ["GGT", "U/L", "H: 8–61 / M: 5–36"],
      ["Fosfatase Alcalina", "U/L", "44–147"],
      ["Bilirrubina Total", "mg/dL", "0.2–1.2"],
      ["Bilirrubina Directa", "mg/dL", "0.0–0.4"],
      ["Albumina", "g/dL", "3.5–5.0"],
      ["Proteínas Totais", "g/dL", "6.4–8.3"],
    ],
  },

  "Coagulação / Hemostase": {
    "Hemostase Básica": [
      ["Tempo de Protrombina (TP)", "seg", "11–14"],
      ["INR (Razão Normalizada Internacional)", "", "0.8–1.2"],
      ["TTPa (Tempo de Tromboplastina Parcial Activada)", "seg", "25–40"],
      ["Fibrinogénio", "mg/dL", "200–400"],
      ["Tempo de Trombina (TT)", "seg", "14–21"],
    ],
    "D-Dímero": [["D-Dímero", "μg/mL FEU", "<0.5"]],
    "Contagem de Plaquetas": [["Plaquetas", "10⁹/L", "150–400"]],
    "Anticoagulantes Naturais": [
      ["Antitrombina III", "%", "80–120"],
      ["Proteína C", "%", "70–130"],
      ["Proteína S", "%", "60–140"],
    ],
  },

  "Marcadores Cardíacos": {
    "Enzimas Cardíacas": [
      ["CK-MB (Creatinina-Quinase MB)", "U/L", "<25"],
      ["CK Total", "U/L", "H: 38–174 / M: 26–140"],
      ["LDH", "U/L", "140–280"],
    ],
    Troponinas: [
      ["Troponina I", "ng/mL", "<0.04"],
      ["Troponina T", "ng/mL", "<0.014"],
      ["Troponina T (Alta Sensibilidade)", "ng/L", "<19"],
    ],
    "BNP / NT-proBNP": [
      ["BNP (Péptido Natriurético)", "pg/mL", "<100"],
      ["NT-proBNP", "pg/mL", "<125"],
    ],
    "PCR e Marcadores Inflamatórios": [
      ["PCR (Proteína C-Reactiva)", "mg/dL", "<0.5"],
      ["PCR de Alta Sensibilidade (hs-CRP)", "mg/L", "<1.0 (baixo risco)"],
      ["Homocisteína", "μmol/L", "H: 5–15 / M: 5–12"],
    ],
    Mioglobina: [["Mioglobina", "ng/mL", "H: 28–72 / M: 25–58"]],
  },

  "Diabetes / Metabolismo Glicémico": {
    Glicemia: [
      ["Glucose em Jejum", "mg/dL", "70–100"],
      ["Glucose Pós-Prandial (2h)", "mg/dL", "<140"],
    ],
    "Hemoglobina Glicada": [
      ["HbA1c (%)", "%", "<5.7 (normal)"],
      ["HbA1c (mmol/mol)", "mmol/mol", "<39 (normal)"],
    ],
    "Teste de Tolerância à Glucose Oral (TTGO)": [
      ["Glucose em Jejum", "mg/dL", "70–100"],
      ["Glucose 30 min", "mg/dL", "<200"],
      ["Glucose 1h", "mg/dL", "<200"],
      ["Glucose 2h", "mg/dL", "<140"],
    ],
    "Insulina e Resistência": [
      ["Insulina em Jejum", "μUI/mL", "2.6–24.9"],
      ["Peptídeo C", "ng/mL", "0.5–2.0"],
      ["HOMA-IR", "", "<2.5"],
    ],
    Fructosamina: [["Fructosamina", "μmol/L", "205–285"]],
  },

  "Hormonas / Endocrinologia": {
    "Hormonas Reprodutivas (Femininas)": [
      ["FSH (Fase Folicular)", "mUI/mL", "3.5–12.5"],
      ["LH (Fase Folicular)", "mUI/mL", "2.4–12.6"],
      ["Estradiol (E2) – Fase Folicular", "pg/mL", "20–160"],
      ["Progesterona (Fase Lútea)", "ng/mL", "2.0–25.0"],
      ["Prolactina (M)", "ng/mL", "3.0–14.7"],
      ["AMH (Hormona Anti-Mülleriana)", "ng/mL", "1.0–3.5"],
    ],
    "Hormonas Reprodutivas (Masculinas)": [
      ["Testosterona Total (H)", "ng/mL", "2.8–8.0"],
      ["Testosterona Livre (H)", "pg/mL", "47–244"],
      ["DHEA-S (H)", "μg/dL", "80–560"],
      ["Prolactina (H)", "ng/mL", "3.0–14.7"],
      ["FSH (H)", "mUI/mL", "1.5–12.4"],
      ["LH (H)", "mUI/mL", "1.7–8.6"],
    ],
    "Glândula Supra-Renal": [
      ["Cortisol (Matinal – 8h)", "μg/dL", "6.0–23.0"],
      ["ACTH", "pg/mL", "7–63"],
      ["Aldosterona", "ng/dL", "1–16 (deitado)"],
      ["DHEA-S", "μg/dL", "H: 80–560 / M: 35–430"],
    ],
    "Hormona do Crescimento": [
      ["GH (Hormona do Crescimento)", "ng/mL", "H: <2.0 / M: <10.0"],
      ["IGF-1 (Somatomedina C)", "ng/mL", "Variável por idade"],
    ],
    "PSA (Próstata)": [
      ["PSA Total", "ng/mL", "<4.0"],
      ["PSA Livre", "ng/mL", "Variável"],
      ["Relação PSA Livre/Total", "%", ">25 (menor risco)"],
    ],
  },

  "Função Tiroideia": {
    "Perfil Tiroideu Completo": [
      ["TSH", "μUI/mL", "0.4–4.0"],
      ["T4 Livre (FT4)", "ng/dL", "0.8–1.8"],
      ["T3 Livre (FT3)", "pg/mL", "2.3–4.2"],
      ["T4 Total", "μg/dL", "5.0–12.0"],
      ["T3 Total", "ng/dL", "80–200"],
    ],
    "Anticorpos Tiroideus": [
      ["Anti-TPO (Anti-peroxidase tiroideia)", "UI/mL", "<34"],
      ["Anti-Tireoglobulina (Anti-TG)", "UI/mL", "<115"],
      ["Anti-receptor TSH (TRAb)", "UI/L", "<1.75"],
    ],
    Tireoglobulina: [["Tireoglobulina", "ng/mL", "2–35"]],
    Calcitonina: [["Calcitonina", "pg/mL", "H: <11.5 / M: <4.6"]],
  },

  "Marcadores Tumorais": {
    "Marcadores Gerais": [
      ["PSA Total", "ng/mL", "<4.0"],
      ["CEA (Antigénio Carcinoembrionário)", "ng/mL", "<3.4 (não fumador)"],
      ["AFP (Alfa-Fetoproteína)", "ng/mL", "<8.1"],
      ["CA 125", "U/mL", "<35"],
      ["CA 15-3", "U/mL", "<31"],
      ["CA 19-9", "U/mL", "<37"],
      ["CA 72-4", "U/mL", "<6.9"],
      ["Beta-HCG", "mUI/mL", "<5 (não grávida)"],
      ["LDH", "U/L", "140–280"],
    ],
    "Marcadores Específicos": [
      ["NSE (Enolase Neuroespecífica)", "ng/mL", "<12.5"],
      ["SCC (Antigénio de Células Escamosas)", "ng/mL", "<1.5"],
      ["Citoqueratina CYFRA 21-1", "ng/mL", "<3.3"],
      ["Cromogranina A", "ng/mL", "<100"],
      ["Beta-2 Microglobulina", "mg/L", "0.8–2.2"],
    ],
  },

  "Imunologia / Serologia": {
    "Serologia Infecciosa": [
      ["HIV 1/2 (Ag/Ac)", "", "Não Reactivo"],
      ["VDRL (Sífilis)", "", "Não Reactivo / Reactivo"],
      ["RPR (Sífilis)", "", "Não Reactivo / Reactivo"],
      ["TPHA (confirmação Sífilis)", "", "Não Reactivo / Reactivo"],
      ["HTLV I/II", "", "Não Reactivo"],
    ],
    "H. Pylori": [
      ["H. Pylori IgG", "", "Negativo / Positivo"],
      ["H. Pylori Ag nas fezes", "", "Negativo / Positivo"],
    ],
    Toxoplasmose: [
      ["Toxoplasma IgG", "UI/mL", "<6 (negativo)"],
      ["Toxoplasma IgM", "", "Negativo / Positivo"],
    ],
    Rubéola: [
      ["Rubéola IgG", "UI/mL", ">10 (imune)"],
      ["Rubéola IgM", "", "Negativo / Positivo"],
    ],
    "CMV (Citomegalovírus)": [
      ["CMV IgG", "", "Negativo / Positivo"],
      ["CMV IgM", "", "Negativo / Positivo"],
    ],
    "Herpes Simplex": [
      ["HSV-1 IgG", "", "Negativo / Positivo"],
      ["HSV-2 IgG", "", "Negativo / Positivo"],
      ["HSV IgM", "", "Negativo / Positivo"],
    ],
    "EBV (Vírus Epstein-Barr)": [
      ["EBV VCA IgM", "", "Negativo / Positivo"],
      ["EBV VCA IgG", "", "Negativo / Positivo"],
      ["EBV EA IgG", "", "Negativo / Positivo"],
    ],
  },

  Hepatites: {
    "Hepatite A": [
      ["Anti-VHA IgM (Hepatite A Aguda)", "", "Não Reactivo / Reactivo"],
      ["Anti-VHA Total (Imunidade)", "", "Não Reactivo / Reactivo"],
    ],
    "Hepatite B": [
      ["HBs Ag (Antigénio de Superfície)", "", "Não Reactivo / Reactivo"],
      ["Anti-HBs (Anticorpo de Superfície)", "mUI/mL", ">10 (imune)"],
      ["HBe Ag", "", "Não Reactivo / Reactivo"],
      ["Anti-HBe", "", "Não Reactivo / Reactivo"],
      ["Anti-HBc IgM (Infecção Aguda)", "", "Não Reactivo / Reactivo"],
      ["Anti-HBc Total", "", "Não Reactivo / Reactivo"],
    ],
    "Hepatite C": [
      ["Anti-VHC (Anticorpos HCV)", "", "Não Reactivo / Reactivo"],
      ["HCV RNA (PCR Qualitativo)", "", "Não Detectado"],
    ],
    "Hepatite D": [["Anti-HDV", "", "Não Reactivo / Reactivo"]],
    "Hepatite E": [
      ["Anti-VHE IgM", "", "Não Reactivo / Reactivo"],
      ["Anti-VHE IgG", "", "Não Reactivo / Reactivo"],
    ],
  },

  "IST / DST": {
    HIV: [
      ["HIV 1/2 (4ª Geração Ag/Ac)", "", "Não Reactivo"],
      ["HIV 1/2 (Teste Rápido)", "", "Não Reactivo / Reactivo"],
    ],
    Sífilis: [
      ["VDRL (Triagem)", "", "Não Reactivo / Reactivo (título)"],
      ["RPR (Triagem)", "", "Não Reactivo / Reactivo"],
      ["TPHA (Confirmação)", "", "Não Reactivo / Reactivo"],
    ],
    "Gonorreia / Clamídia": [
      ["Neisseria gonorrhoeae (PCR)", "", "Não Detectado / Detectado"],
      ["Chlamydia trachomatis (PCR)", "", "Não Detectado / Detectado"],
    ],
    HPV: [
      ["HPV (PCR – Rastreio)", "", "Não Detectado / Detectado"],
      ["HPV Genotipagem (HR tipos 16, 18...)", "", "Não Detectado / Detectado"],
    ],
    "Herpes Genital": [
      ["HSV-2 IgG", "", "Negativo / Positivo"],
      ["HSV-2 IgM", "", "Negativo / Positivo"],
    ],
    Tricomoníase: [
      ["Trichomonas vaginalis (PCR/Cultura)", "", "Negativo / Positivo"],
    ],
  },

  Urinálise: {
    "Urina Sumária (Tipo II)": [
      ["Cor", "", "Amarelo claro a âmbar"],
      ["Aspecto", "", "Límpida"],
      ["pH", "", "5.0–7.5"],
      ["Densidade", "", "1.005–1.030"],
      ["Glucose", "", "Negativo"],
      ["Bilirrubina", "", "Negativo"],
      ["Corpos Cetónicos", "", "Negativo"],
      ["Proteínas", "", "Negativo (<10 mg/dL)"],
      ["Urobilinogénio", "μmol/L", "0.2–1.0"],
      ["Sangue / Hemoglobina", "", "Negativo"],
      ["Nitritos", "", "Negativo"],
      ["Leucócitos (Esterase)", "", "Negativo"],
      ["Ácido Ascórbico", "", "Negativo"],
    ],
    "Exame Microscópico do Sedimento": [
      ["Leucócitos (células/μL)", "cél/μL", "0–10"],
      ["Eritrócitos (células/μL)", "cél/μL", "0–5"],
      ["Células Epiteliais", "/campo", "0–3"],
      ["Cilindros Hialinos", "/campo", "0–2"],
      ["Cilindros Granulosos", "/campo", "Ausentes"],
      ["Bactérias", "", "Ausentes / Raras"],
      ["Cristais de Oxalato", "", "Raros (inespecífico)"],
      ["Cristais de Ácido Úrico", "", "Ausentes"],
      ["Leveduras / Fungos", "", "Ausentes"],
      ["Parasitas", "", "Ausentes"],
    ],
    "Microalbuminúria (Urina)": [
      ["Albumina na Urina (24h)", "mg/24h", "<30"],
      ["Relação Albuminúria/Creatininúria", "mg/g", "<30"],
    ],
    "Proteinúria (24h)": [["Proteínas na Urina (24h)", "mg/24h", "<150"]],
    "Clearance de Creatinina (24h)": [
      ["Creatinina na Urina", "mg/dL", "Variável"],
      ["Volume de Urina 24h", "mL", "800–2000"],
      ["Clearance Creatinina", "mL/min", "88–128"],
    ],
  },

  "Fezes / Coproparasitologia": {
    "Exame Parasitológico das Fezes": [
      ["Aspecto Macroscópico", "", "Pastoso / Sólido / Normal"],
      ["Cor", "", "Castanho"],
      ["Consistência", "", "Normal"],
      ["Muco / Sangue", "", "Ausente"],
      ["Ovos de Parasitas", "", "Ausentes"],
      ["Quistos", "", "Ausentes"],
      ["Trofozoítos", "", "Ausentes"],
      ["Larvas", "", "Ausentes"],
    ],
    "Sangue Oculto nas Fezes": [["Sangue Oculto (SOF)", "", "Negativo"]],
    "Antígeno de H. Pylori nas Fezes": [
      ["H. Pylori Ag nas Fezes", "", "Negativo / Positivo"],
    ],
    "Rotavírus / Adenovírus (Fezes)": [
      ["Rotavírus Ag", "", "Negativo / Positivo"],
      ["Adenovírus Ag", "", "Negativo / Positivo"],
    ],
    "Leucócitos Fecais": [["Leucócitos Fecais", "", "Ausentes / Presentes"]],
  },

  "Microbiologia (Culturas)": {
    Urocultura: [
      ["Resultado da Cultura", "", "Negativo / Positivo"],
      ["Agente Identificado", "", "—"],
      ["Contagem de Colónias", "UFC/mL", ">100.000 (significativo)"],
      ["Antibiograma", "", "Ver relatório"],
    ],
    Hemocultura: [
      ["Resultado (48–72h)", "", "Negativo / Positivo"],
      ["Agente Identificado", "", "—"],
      ["Antibiograma", "", "Ver relatório"],
    ],
    "Cultura de Exsudado Vaginal": [
      ["Flora Microbiana", "", "Flora normal / Alterada"],
      ["Agente Patogénico Identificado", "", "—"],
      ["Leveduras (Candida sp.)", "", "Ausentes / Presentes"],
      ["Antibiograma", "", "Ver relatório"],
    ],
    "Cultura de Exsudado Uretral": [
      ["Agente Identificado", "", "—"],
      ["Diplococos Gram-negativos", "", "Ausentes / Presentes"],
      ["Antibiograma", "", "Ver relatório"],
    ],
    "Cultura de Expectoração": [
      ["Agente Identificado", "", "—"],
      ["Antibiograma", "", "Ver relatório"],
    ],
    Coprocultura: [
      ["Agente Enteropatogénico Identificado", "", "—"],
      ["Antibiograma", "", "Ver relatório"],
    ],
    "Cultura de Líquido Céfalorraquidiano (LCR)": [
      ["Agente Identificado", "", "—"],
      ["Antibiograma", "", "Ver relatório"],
    ],
    "Cultura de Ferida / Secreção": [
      ["Agente Identificado", "", "—"],
      ["Antibiograma", "", "Ver relatório"],
    ],
  },

  "Microbiologia (Esfregaços)": {
    "Exsudado Vaginal (Esfregaço)": [
      ["Leucorreia", "", "Normal / Aumentada"],
      ["Cor da Secreção", "", "Branca leitosa"],
      ["Cheiro", "", "Normal / Anormal"],
      ["Células Epiteliais", "", "Poucas / Algumas / Numerosas"],
      ["Leucócitos", "/campo", "<10 (normal)"],
      ["Hemácias", "/campo", "Ausentes"],
      ["Leveduras / Hifas (Candida)", "", "Ausentes / Presentes"],
      ["Trichomonas vaginalis", "", "Ausentes / Presentes"],
      ["Clue Cells (Gardnerella)", "", "Ausentes / Presentes"],
      ["Bactérias", "", "Raras / Algumas / Muitas"],
      [
        "Flora de Döderlein (Lactobacilos)",
        "",
        "Presente / Reduzida / Ausente",
      ],
    ],
    "Exsudado Uretral (Esfregaço)": [
      ["Leucócitos", "/campo (x1000)", ">5 (uretrite)"],
      ["Diplococos Gram-negativos intracelulares", "", "Ausentes / Presentes"],
      ["Bactérias", "", "Raras / Algumas / Muitas"],
    ],
    "Coloração de Gram": [["Resultado Coloração Gram", "", "—"]],
    "Coloração de Ziehl-Neelsen (BK)": [
      ["Bacilos Álcool-Ácido Resistentes (BAAR)", "", "Negativo / Positivo"],
    ],
  },

  Parasitologia: {
    Malária: [
      ["Gota Espessa / Esfregaço (Malária)", "", "Negativo / Positivo"],
      ["Plasmodium sp. identificado", "", "—"],
      ["Densidade Parasitária", "%", "—"],
      ["Teste Rápido de Malária (RDT)", "", "Negativo / Positivo"],
    ],
    "Reacção de Widal (Febre Tifóide)": [
      ["Salmonella typhi O (T:O)", "", "Negativo (<1/80)"],
      ["Salmonella typhi H (T:H)", "", "Negativo (<1/160)"],
      ["Salmonella paratyphi A:O (PA:O)", "", "Negativo (<1/80)"],
      ["Salmonella paratyphi B:O (PB:O)", "", "Negativo (<1/80)"],
      ["Salmonella paratyphi H (P:H)", "", "Negativo (<1/160)"],
    ],
    Tripanossomíase: [
      ["Esfregaço – Trypanosoma brucei", "", "Negativo / Positivo"],
      ["Serologia (CATT)", "", "Negativo / Positivo"],
    ],
    Filariose: [
      ["Gota Espessa Nocturna (Microfilárias)", "", "Negativo / Positivo"],
    ],
    "Calazar / Leishmaniose": [
      ["Serologia Leishmania (DAT)", "", "Negativo / Positivo"],
      ["rK39 Rápido", "", "Negativo / Positivo"],
    ],
  },

  "Vitaminas e Minerais": {
    Vitaminas: [
      ["Vitamina D (25-OH-Vitamina D)", "ng/mL", "30–100 (suficiente)"],
      ["Vitamina B12 (Cobalamina)", "pg/mL", "200–900"],
      ["Ácido Fólico (Vitamina B9)", "ng/mL", "4.6–18.7"],
      ["Vitamina B1 (Tiamina)", "nmol/L", "70–180"],
      ["Vitamina C (Ácido Ascórbico)", "mg/dL", "0.4–2.0"],
      ["Vitamina A (Retinol)", "μg/dL", "30–100"],
      ["Vitamina E (Alfa-tocoferol)", "mg/dL", "0.5–1.8"],
      ["Vitamina K1", "ng/mL", "0.13–1.19"],
    ],
    "Minerais e Oligoelementos": [
      ["Zinco", "μg/dL", "60–120"],
      ["Selénio", "μg/L", "70–150"],
      ["Cobre", "μg/dL", "70–140"],
      ["Manganês", "μg/L", "4–14"],
      ["Iodo", "μg/L", "52–109"],
    ],
    "Cálcio e Metabolismo": [
      ["Cálcio Total", "mg/dL", "8.5–10.5"],
      ["Cálcio Ionizado", "mmol/L", "1.15–1.35"],
      ["Fósforo", "mg/dL", "2.5–4.5"],
      ["Magnésio", "mg/dL", "1.7–2.4"],
    ],
  },

  "Metabolismo Ósseo": {
    "Marcadores Ósseos": [
      ["Cálcio Total", "mg/dL", "8.5–10.5"],
      ["Fósforo", "mg/dL", "2.5–4.5"],
      ["Fosfatase Alcalina Total", "U/L", "44–147"],
      [
        "Fosfatase Alcalina Óssea",
        "μg/L",
        "H: 15–41.3 / M pré-meno: 11.6–30.6",
      ],
      ["Vitamina D (25-OH)", "ng/mL", "30–100"],
      ["PTH (Paratormona)", "pg/mL", "15–65"],
      ["Osteocalcina", "ng/mL", "H: 24–70 / M pré-meno: 11–48"],
      [
        "CTX (Telopéptido C-terminal do Colagénio I)",
        "ng/mL",
        "H: 0.016–0.584",
      ],
    ],
    "Densitometria Óssea (Marcadores)": [
      ["NTX (Telopéptido N-terminal)", "BCE nmol/L", "H: 5–65 / M: 6.2–19.0"],
    ],
  },

  "Reumatologia / Autoimunidade": {
    "Marcadores Reumatológicos": [
      ["PCR (Proteína C-Reactiva)", "mg/dL", "<0.5"],
      ["VS (Velocidade de Sedimentação) H", "mm/h", "0–15"],
      ["VS (Velocidade de Sedimentação) M", "mm/h", "0–20"],
      ["FR (Factor Reumatóide)", "UI/mL", "<14 (negativo)"],
      [
        "Anti-CCP (Anti-Peptídeo Citrulinado Cíclico)",
        "U/mL",
        "<20 (negativo)",
      ],
    ],
    "Anticorpos Antinucleares": [
      ["ANA (Anticorpos Antinucleares)", "", "Negativo (<1:80)"],
      ["Anti-dsDNA (DNA dupla cadeia)", "UI/mL", "<10 (negativo)"],
      ["Anti-Sm", "", "Negativo / Positivo"],
      ["Anti-SSA (Ro)", "", "Negativo / Positivo"],
      ["Anti-SSB (La)", "", "Negativo / Positivo"],
      ["Anti-Scl-70", "", "Negativo / Positivo"],
      ["Anti-Jo-1", "", "Negativo / Positivo"],
      ["Anti-Centrómero (ACA)", "", "Negativo / Positivo"],
    ],
    Complemento: [
      ["C3", "mg/dL", "90–180"],
      ["C4", "mg/dL", "16–47"],
      ["CH50 (Complemento Total)", "U/mL", "41–90"],
    ],
    "Ácido Úrico": [
      ["Ácido Úrico (H)", "mg/dL", "3.5–7.2"],
      ["Ácido Úrico (M)", "mg/dL", "2.6–6.0"],
    ],
    ANCA: [
      ["c-ANCA (anti-PR3)", "", "Negativo / Positivo"],
      ["p-ANCA (anti-MPO)", "", "Negativo / Positivo"],
    ],
  },

  Espermatograma: {
    "Análise do Esperma (OMS 2021)": [
      ["Volume de Ejaculado", "mL", "≥1.4"],
      ["pH", "", "≥7.2"],
      ["Concentração de Espermatozóides", "10⁶/mL", "≥16"],
      ["Número Total de Espermatozóides", "10⁶/ejaculado", "≥39"],
      ["Mobilidade Total (a+b+c)", "%", "≥42"],
      ["Mobilidade Progressiva (a+b)", "%", "≥30"],
      ["Motilidade Progressiva Rápida (a)", "%", "≥0"],
      ["Morfologia (Critérios de Kruger)", "%", "≥4"],
      ["Vitalidade (Espermatozóides Vivos)", "%", "≥54"],
      ["Leucócitos", "10⁶/mL", "<1.0"],
      ["Células Imaturas (Germinativas)", "/campo", "Raras"],
      ["Aglutinação", "", "Ausente / Presente"],
      ["Liquefacção", "", "20–60 min"],
      ["Viscosidade", "", "Normal"],
      ["Cor", "", "Branco-acinzentado"],
      ["Aspecto", "", "Homogéneo"],
    ],
  },

  "Líquido Céfalorraquidiano (LCR)": {
    "Análise Citoquímica do LCR": [
      ["Aspecto", "", "Límpido, incolor (água de rocha)"],
      ["Cor", "", "Incolor"],
      ["Pressão de Abertura", "cmH₂O", "7–18"],
      ["Leucócitos", "cél/μL", "0–5"],
      ["Polimorfonucleares (PMN)", "%", "0"],
      ["Mononucleares", "%", "100"],
      ["Eritrócitos", "cél/μL", "0"],
      ["Glucose", "mg/dL", "50–80 (2/3 da glicemia)"],
      ["Proteínas Totais", "mg/dL", "15–45"],
      ["Cloretos", "mEq/L", "120–130"],
      ["LDH", "U/L", "<40"],
    ],
    "Cultura / Coloração LCR": [
      ["Coloração de Gram (LCR)", "", "Negativo / Positivo"],
      ["Coloração Índia (Criptococo)", "", "Negativo / Positivo"],
      ["Cultura LCR", "", "Negativo / Positivo"],
      ["Ag Criptocócico (CRAG)", "", "Negativo / Positivo"],
    ],
  },

  "Gravidez e Pré-natal": {
    "Teste de Gravidez": [
      ["Beta-HCG Qualitativo (Urina ou Soro)", "", "Negativo / Positivo"],
      [
        "Beta-HCG Quantitativo (Soro)",
        "mUI/mL",
        "Variável por semana gestacional",
      ],
    ],
    "Perfil TORCH": [
      ["Toxoplasma IgG", "", "Negativo / Positivo"],
      ["Toxoplasma IgM", "", "Negativo / Positivo"],
      ["Rubéola IgG", "UI/mL", ">10 (imune)"],
      ["Rubéola IgM", "", "Negativo / Positivo"],
      ["CMV IgG", "", "Negativo / Positivo"],
      ["CMV IgM", "", "Negativo / Positivo"],
      ["HSV-1/2 IgG", "", "Negativo / Positivo"],
      ["HSV IgM", "", "Negativo / Positivo"],
    ],
    "Rastreio Pré-natal 1º Trimestre": [
      ["PAPP-A", "mUI/mL", "Variável por semana"],
      ["Beta-HCG Livre", "ng/mL", "Variável por semana"],
      ["Translucência da Nuca (NT)", "mm", "<2.5 (11–13sem)"],
    ],
    "Diabetes Gestacional (TTGO 75g)": [
      ["Glucose Jejum", "mg/dL", "<92"],
      ["Glucose 1h", "mg/dL", "<180"],
      ["Glucose 2h", "mg/dL", "<153"],
    ],
    "Grupo Sanguíneo e Coombs": [
      ["Grupo ABO e Rh", "", "A/B/AB/O; Pos/Neg"],
      ["Coombs Indirecto (PAI)", "", "Negativo / Positivo"],
    ],
  },

  "Toxicologia / Drogas": {
    "Drogas de Abuso (Urina)": [
      ["Cannabis (THC)", "", "Negativo / Positivo"],
      ["Cocaína (COC)", "", "Negativo / Positivo"],
      ["Opiáceos (OPI)", "", "Negativo / Positivo"],
      ["Anfetaminas (AMP)", "", "Negativo / Positivo"],
      ["Metanfetaminas (MET)", "", "Negativo / Positivo"],
      ["Benzodiazepinas (BZO)", "", "Negativo / Positivo"],
      ["Álcool (ETG)", "", "Negativo / Positivo"],
    ],
    "Metais Pesados (Sangue)": [
      ["Chumbo (Pb)", "μg/dL", "<5"],
      ["Mercúrio (Hg)", "μg/L", "<10"],
      ["Arsénio (As)", "μg/L", "<50"],
      ["Cádmio (Cd)", "μg/L", "<1"],
    ],
  },

  // ── Perfis iChroma (Boditech POC Analyzer) ──────────────────────────────
  "iChroma I — Tiróide (Básico)": {
    "TSH (Hormona Estimulante da Tiróide)": [["TSH", "μUI/mL", "0.4–4.0"]],
    "T4 Livre (FT4)": [["T4 Livre (FT4)", "ng/dL", "0.8–1.8"]],
    "T3 Livre (FT3)": [["T3 Livre (FT3)", "pg/mL", "2.3–4.2"]],
    "T4 Total": [["T4 Total", "μg/dL", "5.0–12.0"]],
    "T3 Total": [["T3 Total", "ng/dL", "80–200"]],
    "Perfil Tiroideu iChroma I (TSH + FT3 + FT4)": [
      ["TSH", "μUI/mL", "0.4–4.0"],
      ["T3 Livre (FT3)", "pg/mL", "2.3–4.2"],
      ["T4 Livre (FT4)", "ng/dL", "0.8–1.8"],
    ],
    "Perfil Tiroideu Completo iChroma I": [
      ["TSH", "μUI/mL", "0.4–4.0"],
      ["T3 Livre (FT3)", "pg/mL", "2.3–4.2"],
      ["T4 Livre (FT4)", "ng/dL", "0.8–1.8"],
      ["T3 Total", "ng/dL", "80–200"],
      ["T4 Total", "μg/dL", "5.0–12.0"],
    ],
  },

  "iChroma II — Tiróide + Cardíaco + Anemia": {
    "Perfil Tiroideu iChroma II": [
      ["TSH", "μUI/mL", "0.4–4.0"],
      ["T3 Livre (FT3)", "pg/mL", "2.3–4.2"],
      ["T4 Livre (FT4)", "ng/dL", "0.8–1.8"],
    ],
    "Painel Cardíaco iChroma II": [
      ["Troponina I (cTnI)", "ng/mL", "<0.04"],
      ["CK-MB", "ng/mL", "<5.0"],
      ["Mioglobina", "ng/mL", "H: 28–72 / M: 25–58"],
    ],
    "Painel Cardíaco Rápido iChroma II (3 em 1)": [
      ["Troponina I (cTnI)", "ng/mL", "<0.04"],
      ["CK-MB", "ng/mL", "<5.0"],
      ["Mioglobina", "ng/mL", "H: 28–72 / M: 25–58"],
    ],
    "BNP / NT-proBNP iChroma II": [
      ["NT-proBNP", "pg/mL", "<125 (< 75 anos)"],
      ["BNP", "pg/mL", "<100"],
    ],
    "D-Dímero iChroma II": [["D-Dímero", "μg/mL FEU", "<0.5 (normal)"]],
    "Ferritina iChroma II": [
      ["Ferritina (H)", "ng/mL", "30–300"],
      ["Ferritina (M)", "ng/mL", "15–120"],
    ],
    "HbA1c iChroma II": [
      ["HbA1c (%)", "%", "<5.7 (normal); 5.7–6.4 (pré-DM); ≥6.5 (DM)"],
      ["HbA1c (mmol/mol)", "mmol/mol", "<39 (normal)"],
    ],
    "PCR Ultra-Sensível iChroma II": [
      [
        "PCR (Proteína C-Reactiva)",
        "mg/L",
        "<1.0 (baixo risco); 1–3 (moderado); >3 (alto)",
      ],
    ],
    "Painel Completo iChroma II (Tiróide + Cardíaco + Anemia)": [
      ["TSH", "μUI/mL", "0.4–4.0"],
      ["T3 Livre (FT3)", "pg/mL", "2.3–4.2"],
      ["T4 Livre (FT4)", "ng/dL", "0.8–1.8"],
      ["Troponina I (cTnI)", "ng/mL", "<0.04"],
      ["CK-MB", "ng/mL", "<5.0"],
      ["Mioglobina", "ng/mL", "H: 28–72 / M: 25–58"],
      ["Ferritina", "ng/mL", "H: 30–300 / M: 15–120"],
      ["HbA1c (%)", "%", "<5.7 (normal)"],
      ["D-Dímero", "μg/mL FEU", "<0.5"],
      ["PCR (hs-CRP)", "mg/L", "<1.0 (baixo risco)"],
    ],
  },

  "iChroma III — Hormonal + Fertilidade + Infeccioso": {
    "Hormona LH iChroma III": [
      ["LH — Fase Folicular (M)", "mUI/mL", "2.4–12.6"],
      ["LH — Pico Ovulatório (M)", "mUI/mL", "14–96"],
      ["LH — Fase Lútea (M)", "mUI/mL", "1.0–11.4"],
      ["LH (H)", "mUI/mL", "1.7–8.6"],
    ],
    "Hormona FSH iChroma III": [
      ["FSH — Fase Folicular (M)", "mUI/mL", "3.5–12.5"],
      ["FSH — Pico Ovulatório (M)", "mUI/mL", "4.7–21.5"],
      ["FSH — Menopausa (M)", "mUI/mL", "25.8–134.8"],
      ["FSH (H)", "mUI/mL", "1.5–12.4"],
    ],
    "Beta-hCG iChroma III": [
      [
        "β-hCG Quantitativo",
        "mUI/mL",
        "<5 (não grávida); Variável por semana gestacional",
      ],
    ],
    "Progesterona iChroma III": [
      ["Progesterona — Fase Folicular", "ng/mL", "0.1–0.9"],
      ["Progesterona — Fase Lútea", "ng/mL", "2.0–25.0"],
      ["Progesterona — 1º Trimestre", "ng/mL", "11.2–90.0"],
    ],
    "Prolactina iChroma III": [
      ["Prolactina (M)", "ng/mL", "3.0–14.7"],
      ["Prolactina (H)", "ng/mL", "3.0–14.7"],
      ["Prolactina (Grávida)", "ng/mL", "10.0–209.0"],
    ],
    "Testosterona iChroma III": [
      ["Testosterona Total (H)", "ng/mL", "2.8–8.0"],
      ["Testosterona Total (M)", "ng/mL", "0.06–0.82"],
      ["Testosterona Livre (H)", "pg/mL", "47–244"],
    ],
    "PSA iChroma III": [
      [
        "PSA Total",
        "ng/mL",
        "<4.0 (normal); 4–10 (zona cinzenta); >10 (alto risco)",
      ],
      ["PSA Livre", "ng/mL", "Variável"],
      ["Relação PSA Livre/Total", "%", ">25 (menor risco de Ca próstata)"],
    ],
    "Painel Fertilidade iChroma III (FSH + LH + Prog + Prol)": [
      ["FSH", "mUI/mL", "3.5–12.5 (fase folicular)"],
      ["LH", "mUI/mL", "2.4–12.6 (fase folicular)"],
      ["Progesterona", "ng/mL", "2.0–25.0 (fase lútea)"],
      ["Prolactina", "ng/mL", "3.0–14.7"],
      ["β-hCG", "mUI/mL", "<5 (não grávida)"],
    ],
    "HBs Ag (Hepatite B) iChroma III": [
      ["HBs Ag (Antigénio de Superfície)", "", "Não Reactivo / Reactivo"],
    ],
    "Anti-HCV iChroma III": [
      ["Anti-HCV (Anticorpos Hepatite C)", "", "Não Reactivo / Reactivo"],
    ],
    "H. Pylori IgG iChroma III": [["H. Pylori IgG", "", "Negativo / Positivo"]],
    "Procalcitonina (PCT) iChroma III": [
      [
        "Procalcitonina (PCT)",
        "ng/mL",
        "<0.10 (baixo risco sépsis); 0.10–0.25 (risco ligeiro); >0.25 (sépsis)",
      ],
    ],
    "Painel Infeccioso iChroma III (HBsAg + HCV + H.Pylori)": [
      ["HBs Ag (Hepatite B)", "", "Não Reactivo / Reactivo"],
      ["Anti-HCV (Hepatite C)", "", "Não Reactivo / Reactivo"],
      ["H. Pylori IgG", "", "Negativo / Positivo"],
    ],
    "Painel Completo iChroma III (Hormonal + Infeccioso)": [
      ["FSH", "mUI/mL", "3.5–12.5 (fase folicular)"],
      ["LH", "mUI/mL", "2.4–12.6 (fase folicular)"],
      ["Progesterona", "ng/mL", "2.0–25.0 (fase lútea)"],
      ["Prolactina", "ng/mL", "3.0–14.7"],
      ["β-hCG", "mUI/mL", "<5 (não grávida)"],
      ["Testosterona Total (H)", "ng/mL", "2.8–8.0"],
      ["PSA Total", "ng/mL", "<4.0"],
      ["HBs Ag", "", "Não Reactivo / Reactivo"],
      ["Anti-HCV", "", "Não Reactivo / Reactivo"],
      ["Procalcitonina (PCT)", "ng/mL", "<0.10"],
    ],
  },

  Cardiologia: {
    "ECG de Repouso (12 Derivações)": [
      ["Ritmo", "", "Sinusal"],
      ["Frequência Cardíaca", "bpm", "60–100"],
      ["Intervalo PR", "ms", "120–200"],
      ["Duração QRS", "ms", "60–100"],
      ["Intervalo QTc", "ms", "<450 (H) / <460 (M)"],
      ["Eixo Eléctrico", "°", "-30 a +90"],
      ["Conclusão", "", "Normal"],
    ],
    "Holter 24 horas (ECG Ambulatório)": [
      ["Ritmo Dominante", "", "Sinusal"],
      ["FC Média (24h)", "bpm", "60–100"],
      ["FC Mínima", "bpm", "40–60 (noite)"],
      ["FC Máxima", "bpm", "<150 (repouso)"],
      ["Total de Batimentos", "n", "80 000–140 000"],
      ["ESV (Extrassístoles Ventriculares)", "n", "<200/24h"],
      ["ESVS (Pares/Salvas)", "n", "0"],
      ["ESA (Extrassístoles Auriculares)", "n", "<100/24h"],
      ["Pausa Máxima", "s", "<2.5"],
      ["Bloqueios ou Pausas Significativas", "", "Ausentes"],
      ["Episódios de Taquicardia", "", "Ausentes"],
      ["Conclusão", "", ""],
    ],
    "MAPA — Pressão Arterial 24 Horas": [
      ["PA Média Global — Sistólica", "mmHg", "<130"],
      ["PA Média Global — Diastólica", "mmHg", "<80"],
      ["PA Média Diurna — Sistólica", "mmHg", "<135"],
      ["PA Média Diurna — Diastólica", "mmHg", "<85"],
      ["PA Média Nocturna — Sistólica", "mmHg", "<120"],
      ["PA Média Nocturna — Diastólica", "mmHg", "<70"],
      ["Carga Sistólica Diurna (SIS >135)", "%", "<40%"],
      ["Carga Diastólica Diurna (DIA >85)", "%", "<40%"],
      ["Carga Sistólica Nocturna (SIS >120)", "%", "<50%"],
      ["Carga Diastólica Nocturna (DIA >70)", "%", "<50%"],
      ["SIS Máxima", "mmHg", ""],
      ["SIS Mínima", "mmHg", ""],
      ["DIA Máxima", "mmHg", ""],
      ["DIA Mínima", "mmHg", ""],
      ["FC Média (24h)", "bpm", "60–100"],
      ["Ritmo Circadiano (Dipping)", "", "Normal (queda ≥10% noite)"],
      ["Conclusão / Diagnóstico", "", ""],
    ],
    "Ecocardiograma Transtorácico": [
      ["Fracção de Ejecção (FE)", "%", "≥55"],
      ["Diâmetro Diastólico VE (DDVE)", "mm", "42–58 (H) / 38–52 (M)"],
      ["Diâmetro Sistólico VE (DSVE)", "mm", "25–40"],
      ["Septo Interventricular (SIV)", "mm", "6–11"],
      ["Parede Posterior VE (PPVE)", "mm", "6–11"],
      ["Índice de Massa VE", "g/m²", "<115 (H) / <95 (M)"],
      ["Aorta Ascendente", "mm", "<37"],
      ["Aurícula Esquerda (AE)", "mm", "<40"],
      ["Valva Mitral", "", "Normal"],
      ["Valva Aórtica", "", "Normal"],
      ["Valva Tricúspide", "", "Normal"],
      ["Valva Pulmonar", "", "Normal"],
      ["Derrame Pericárdico", "", "Ausente"],
      ["Conclusão", "", ""],
    ],
    "Prova de Esforço (ECG de Esforço)": [
      ["Protocolo", "", "Bruce"],
      ["Duração do Exercício", "min", ""],
      ["FC Máxima Atingida", "bpm", ""],
      ["% FC Máxima Prevista", "%", "≥85%"],
      ["PA Máxima Sistólica", "mmHg", ""],
      ["Capacidade Funcional", "METs", ""],
      ["Alterações ST", "", "Ausentes"],
      ["Arritmias Induzidas", "", "Ausentes"],
      ["Sintomas Durante Esforço", "", "Ausentes"],
      ["Conclusão", "", ""],
    ],
    "Troponina I (Alta Sensibilidade)": [
      ["Troponina I hs", "ng/L", "<26 (H) / <16 (M)"],
    ],
    "BNP / NT-proBNP": [
      ["NT-proBNP", "pg/mL", "<125 (<75 anos) / <450 (>75 anos)"],
    ],
    "D-Dímero": [["D-Dímero", "mg/L FEU", "<0.50"]],
    "CK-MB (Fracção MB da CK)": [
      ["CK-MB", "U/L", "<25"],
      ["CK-MB %", "%", "<6% da CK Total"],
    ],
    Mioglobina: [["Mioglobina", "μg/L", "<90 (H) / <65 (M)"]],
  },

  Imagiologia: {
    "Radiografia do Tórax (PA + Perfil)": [
      ["Índice Cardiotorácico", "", "<0.50"],
      ["Parênquima Pulmonar", "", "Normal"],
      ["Hilos Pulmonares", "", "Normais"],
      ["Seios Costo-Frénicos", "", "Livres"],
      ["Mediastino", "", "Normal"],
      ["Caixa Torácica", "", "Normal"],
      ["Conclusão", "", ""],
    ],
    "Radiografia do Abdómen": [
      ["Distribuição Gasosa", "", "Normal"],
      ["Calcificações", "", "Ausentes"],
      ["Estruturas Ósseas", "", "Normais"],
      ["Conclusão", "", ""],
    ],
    "Radiografia Osteoarticular": [
      ["Espaço Articular", "", "Preservado"],
      ["Densidade Óssea", "", "Normal"],
      ["Alinhamento", "", "Normal"],
      ["Calcificações / Osteófitos", "", "Ausentes"],
      ["Conclusão", "", ""],
    ],
    "Ecografia Abdominal e Pélvica": [
      ["Fígado", "", "Dimensões e ecoestrutura normais"],
      ["Vesícula Biliar", "", "Normal, sem cálculos"],
      ["Vias Biliares", "", "Não dilatadas"],
      ["Pâncreas", "", "Normal"],
      ["Baço", "", "Normal"],
      ["Rins (Direito)", "", "Normal"],
      ["Rins (Esquerdo)", "", "Normal"],
      ["Bexiga", "", "Normal"],
      ["Útero / Próstata", "", "Normal"],
      ["Ovários / Vesículas Seminais", "", "Normal"],
      ["Líquido Livre", "", "Ausente"],
      ["Conclusão", "", ""],
    ],
    "Ecografia da Tiróide": [
      ["Volume Lobo Direito", "mL", "2–10"],
      ["Volume Lobo Esquerdo", "mL", "2–10"],
      ["Volume Total", "mL", "4–20"],
      ["Ecoestrutura", "", "Homogénea"],
      ["Nódulos", "", "Ausentes"],
      ["Vascularização", "", "Normal"],
      ["Conclusão", "", ""],
    ],
    "Ecografia Pélvica (Ginecológica)": [
      ["Útero — Dimensões", "mm", "Normal"],
      ["Endométrio", "mm", "<12 (fase secretória)"],
      ["Ovário Direito", "", "Normal"],
      ["Ovário Esquerdo", "", "Normal"],
      ["Líquido no Douglas", "", "Ausente / Fisiológico"],
      ["Conclusão", "", ""],
    ],
    "Ecografia Obstétrica (Morfológica)": [
      ["Idade Gestacional estimada", "semanas", ""],
      ["Biometria Fetal (BPD/HC/AC/FL)", "", "Adequada à IG"],
      ["Frequência Cardíaca Fetal", "bpm", "120–160"],
      ["Placenta", "", "Normal — Grau I"],
      ["Índice de Líquido Amniótico (ILA)", "cm", "8–25"],
      ["Apresentação Fetal", "", "Cefálica"],
      ["Translucência da Nuca (TN)", "mm", "<3.0 (11–14 sem)"],
      ["Conclusão", "", ""],
    ],
    "Mamografia Bilateral": [
      ["Densidade Mamária (ACR)", "", "B — Densidades dispersas"],
      ["Mama Direita", "", "Sem lesão"],
      ["Mama Esquerda", "", "Sem lesão"],
      ["Nódulos / Microcalcificações", "", "Ausentes"],
      ["Adenopatias Axilares", "", "Ausentes"],
      ["Classificação BI-RADS", "", "BI-RADS 1 (normal)"],
      ["Conclusão", "", ""],
    ],
    "Densitometria Óssea (DEXA)": [
      ["Coluna Lombar L1-L4 — T-score", "", "≥-1.0 (Normal)"],
      ["Colo do Fémur — T-score", "", "≥-1.0 (Normal)"],
      ["Fémur Total — T-score", "", "≥-1.0 (Normal)"],
      ["Z-score (pré-menopausa)", "", "≥-2.0"],
      ["Conclusão", "", "Normal / Osteopenia / Osteoporose"],
    ],
    "TAC (Tomografia Axial Computorizada) — Crânio": [
      ["Parênquima Cerebral", "", "Normal"],
      ["Sistema Ventricular", "", "Normal"],
      ["Espaços Subaracnoideus", "", "Normais"],
      ["Estruturas da Linha Média", "", "Centradas"],
      ["Estruturas Ósseas", "", "Normais"],
      ["Conclusão", "", ""],
    ],
    "TAC Tórax": [
      ["Parênquima Pulmonar", "", "Normal"],
      ["Mediastino", "", "Normal"],
      ["Pericárdio", "", "Normal"],
      ["Estruturas Vasculares", "", "Normais"],
      ["Conclusão", "", ""],
    ],
    "TAC Abdómen e Pélvis": [
      ["Fígado", "", "Normal"],
      ["Pâncreas", "", "Normal"],
      ["Rins e Suprarrenais", "", "Normais"],
      ["Retroperitoneu", "", "Normal"],
      ["Bexiga", "", "Normal"],
      ["Adenopatias", "", "Ausentes"],
      ["Conclusão", "", ""],
    ],
    "Ressonância Magnética — Coluna": [
      ["Alinhamento", "", "Normal"],
      ["Altura Discos Intervertebrais", "", "Mantida"],
      ["Hérnias Discais", "", "Ausentes"],
      ["Canal Raquidiano", "", "Permeável"],
      ["Estruturas Nervosas", "", "Normais"],
      ["Conclusão", "", ""],
    ],
    "Ressonância Magnética — Crânio": [
      ["Parênquima Cerebral", "", "Normal"],
      ["Substância Branca", "", "Normal"],
      ["Estruturas da Linha Média", "", "Centradas"],
      ["Sistema Ventricular", "", "Normal"],
      ["Fossa Posterior", "", "Normal"],
      ["Realce com Gadolínio", "", "Sem lesão captante"],
      ["Conclusão", "", ""],
    ],
    "Endoscopia Digestiva Alta (EDA)": [
      ["Esófago", "", "Normal"],
      ["Cárdia / Junção Esófago-gástrica", "", "Normal"],
      ["Estômago — Mucosa", "", "Normal"],
      ["Antro Gástrico", "", "Normal"],
      ["Piloro", "", "Normal / Pérvio"],
      ["Duodeno D1/D2", "", "Normal"],
      ["Biópsia (H. Pylori)", "", "Negativo"],
      ["Conclusão", "", ""],
    ],
    Colonoscopia: [
      ["Recto", "", "Normal"],
      ["Sigmóide", "", "Normal"],
      ["Cólon Descendente", "", "Normal"],
      ["Cólon Transverso", "", "Normal"],
      ["Cólon Ascendente", "", "Normal"],
      ["Válvula Ileocecal / Cego", "", "Normal"],
      ["Pólipos", "", "Ausentes"],
      ["Conclusão", "", ""],
    ],
  },
};
