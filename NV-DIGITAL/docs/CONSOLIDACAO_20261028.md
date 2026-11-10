# Consolidação — 28/10/2026

## Fontes utilizadas

Base: projecto completo `NVUALASOFT_Integrado`, conservando os módulos existentes. Foram reunidas as actualizações de App.tsx, biblioteca/histórico e laboratório desta conversa e os quatro pacotes de comunicação recuperados, por ordem:

| Ordem | Pacote | Recebido em 27/10/2026 (UTC) | Conteúdo |
|---|---|---|---|
| 1 | `NVUALASOFT_Chat_DB.zip` | 16:38 | Chat persistente, grupos, anexos, voz e preferências. |
| 2 | `NVUALASOFT_Chamadas.zip` | 18:01 | WebRTC, serviço global, estados/canais/comunidades e exemplo TURN. |
| 3 | `NVUALASOFT_Alertas_Chamadas.zip` | 18:36 | Interface de chamada, volume, silêncio, alertas e minimização. |
| 4 | `NVUALASOFT_Notificacoes.zip` | 19:01 | Toque em ciclo, teste de 12 segundos e sino com leitura persistente. |

Os manifestos dos quatro pacotes foram conferidos. Os hashes dos ZIP de origem estão em `ORIGEM_PACOTES_20261028.json`. Os textos originais em `atualizacoes-chat` são históricos; os comandos para instalar esses patches **já não são necessários** neste projecto completo.

O laboratório usa os ficheiros reais `LancarResultados.tsx` e `CadastrarExames.tsx` recebidos. Os originais estão em `referencias-laboratorio`; as páginas executadas, adaptadas à sessão/API/validação, estão em `artifacts/lab-results/src/pages/laboratorio`.

## Integração

- Router existente conservado; chat-live, chat-calls, chat-social e notifications-v2 depois da autenticação e do isolamento institucional.
- App.tsx conserva menus, cores, agente e três botões flutuantes. Serviço de chamadas uma vez no Shell por conta/instituição. Sino novo com feed partilhado entre cabeçalhos da mesma sessão.
- Notificações adaptadas às versões manuais do laboratório: pendente não aparece pronta; libertada aparece “Resultado pronto”; nova correcção libertada volta a não lida. Foi acrescentado o teste desta ligação sem modificar SQL recebido.
- Biblioteca/Histórico conservam as funções e o download privado. A leitura do sino não altera resultados, confirma críticos ou substitui vistos do chat.
- `allowBuilds` substitui os placeholders inválidos da configuração de instalação, com a mesma lista de dependências permitidas. `install:app` usa o lockfile e dispensa o gerador opcional `orval`, conservando os seus fontes.
- `db:migrate` usa o helper directo do pacote de chamadas, verificando o mesmo host/base. Não altera Secrets nem migra o banco durante a preparação deste ZIP.

## Persistência e limites

Mensagens, participação, preferências, estados/canais/comunidades, sinalização e leitura de notificações persistem no servidor. Chamadas de áudio/vídeo não são gravadas. Anexos/documentos exigem sessão e autorização institucional. O feed de resultados não inclui pacientes/medições; avisos do sistema operativo usam texto genérico.

Chat usa consulta periódica, sinalização a cada 1,5 segundos e sino a cada cinco segundos. A primeira carga mostra o histórico sem tocar avisos antigos. Não há push com a aplicação fechada, SMS ou e-mail por este módulo.

Os controlos da API testados não equivalem a auditoria de intrusão. Administração de credenciais e acesso directo ao PostgreSQL continuam necessários. MEDLIK mantém partilha escolhida/revogável.

Use o README e INSTALACAO_E_EXECUCAO.md. Os 66 testes, instalação limpa e compilação passaram. Som real, dois dispositivos e TURN entre redes exigem confirmação local. Nenhuma nova migração/publicação foi executada no Neon/Replit. O âmbito clínico/fiscal dos outros módulos permanece em ESTADO_DOS_MODULOS.md.
