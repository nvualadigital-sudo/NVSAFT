# NV-ASSISTENTE — integração técnica de 05/11/2026

**Versão do projecto:** `2026.11.05-netlify.10`. Inclui todo o NV-DIGITAL da edição consolidada `.9`, Chat, MedLink e módulos clínicos/financeiros. Executa a interface e a API no mesmo endereço e porta **3000** quando iniciado com `pnpm dev`.

## Componentes efectivamente implementados

1. **Janela de assistência** acessível pelo botão flutuante já existente, sem duplicar lançadores. Título institucional dinâmico, tema moderno, esfera luminosa com estados de escuta, raciocínio, resposta, erro e confirmação; conversação em texto.
2. **Reconhecimento de voz do navegador**, quando disponível, apenas após autorização de microfone. O botão «Olá NV» inicia uma sessão explícita de escuta da palavra de activação, limitada a 15 minutos; fechar o painel, terminar a escuta ou terminar a sessão desactiva o microfone. Leitura da resposta em voz por síntese de fala do navegador, mediante botão próprio. Não existe escuta permanente em segundo plano.
3. **Comandos locais e delimitados:** abrir módulo autorizado de Chat, Laboratório, Medicina, Enfermagem, Farmácia, Facturação, MedLink, Pacientes ou Configurações. A interface recusa navegar para módulos ausentes do perfil.
4. **Acção real com confirmação:** escrever «enviar mensagem para a equipa: [texto]» prepara uma mensagem no Chat interno **da empresa actual**. O servidor congela a operação por dois minutos, apresenta o texto e só efectua a inserção após um clique em **Confirmar envio**. Cancelamento, expiração, utilizador diferente e instituição diferente impedem a execução. Uma segunda confirmação não duplica a mensagem. A auditoria regista a operação sem copiar o texto para o evento de auditoria; o pedido elimina o texto após conclusão/cancelamento.
5. **Conversação aberta opcional** via fornecedor já configurado: OpenAI ou Neon AI Gateway, activada com `AI_ASSISTANT_ENABLED=true` e autorização individual para envio de perguntas **sem dados identificáveis de pacientes**. O modelo não recebe credenciais nem acesso à base; não recebe capacidade para chamar ferramentas ou executar alterações.
6. **Migração versionada:** `migrations/20261105_nv_assistente_actions.sql` cria o registo institucional de pedidos, confirmação e expiração. As tabelas anteriores e o histórico fiscal/clínico não são alterados.

## Limites e segurança

- O NV-ASSISTENTE **não emite facturas, não prescreve, não liberta resultados, não altera registos clínicos e não concede permissões**. Esses actos continuam sujeitos aos fluxos e verificações dos módulos profissionais.
- A apresentação em voz depende das vozes instaladas no equipamento. Alguns navegadores não disponibilizam `SpeechRecognition` ou interrompem a captura após silêncio; nesses casos use o texto. O reconhecimento de áudio pode usar os serviços do fornecedor do navegador, pelo que o utilizador deve consentir e **não ditar dados de pacientes**.
- Não foi implementada uma ligação Realtime/WebRTC dedicada à IA com streaming de áudio nem selecção de voz premium. Esta integração **não deve ser anunciada como equivalência total a Siri/Alexa/ChatGPT Voice**.
- A comunicação de voz/vídeo **entre empresas no MedLink** também continua pendente; os seus pedidos, mensagens institucionais e fluxos actuais estão preservados.
- O servidor valida a sessão e o âmbito da empresa antes de preparar, cancelar ou confirmar a operação. A própria interface aplica os módulos permitidos na navegação. O modelo externo não é tratado como fonte de permissões.
- Dados enviados voluntariamente ao fornecedor de IA têm as condições de tratamento desse fornecedor; não existe neste pacote uma avaliação institucional de privacidade ou contrato de processamento externo.

## Instalação

Para uma instalação nova, use a pasta `NV-DIGITAL` dentro do ZIP completo. Para actualizar um projecto existente, use **`actualizar.py`**, primeiro com `--check`, para não substituir modificações desconhecidas. Faça um backup e ensaie uma branch/base Neon de teste antes de migrar produção.

```bash
python3 /caminho/do/pacote/actualizar.py /workspaces/NVDIGITAL --check
python3 /caminho/do/pacote/actualizar.py /workspaces/NVDIGITAL
cd /workspaces/NVDIGITAL
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm test
pnpm build
pnpm dev
```

A versão de desenvolvimento publica **`http://localhost:3000`** e API **`http://localhost:3000/api`**. Na Netlify, o site permanece estático e a API Node precisa de alojamento próprio com acesso à Neon, como explicado em `docs/ACTUALIZAR_NETLIFY.md`. O pacote por si só **não publica** na Netlify, **não migra** a sua Neon e **não homologa** o módulo AGT.

### Configuração opcional da IA

No ambiente seguro do **backend**, configure `AI_ASSISTANT_ENABLED=true` e **uma** destas opções:

- `OPENAI_API_KEY` e, opcionalmente, `OPENAI_MODEL`; **ou**
- `NEON_AI_GATEWAY_TOKEN`, `NEON_AI_GATEWAY_BASE_URL` e, opcionalmente, `NEON_AI_MODEL`.

Não configure estas chaves no frontend (`VITE_*`). Sem elas, a esfera, o texto, os comandos locais e a confirmação da mensagem continuam disponíveis; somente a conversação livre por IA não estará activa.

## Verificações automatizadas

Os testes `tests/nv-assistente.test.ts` validam interpretação conservadora de comandos, isolamento por sessão e instituição, confirmação única, conteúdo imutável, auditoria, cancelamento e expiração. Antes de uso real, faça também a aceitação manual em dois browsers/dispositivos, com microfone autorizado e recusado, e teste a conversa de equipa em contas da mesma instituição.

### Próxima fase, dependente de decisão

Para voz natural contínua com transporte dedicado são necessários fornecedor de tempo real, orçamento, regras de residência/tratamento de dados, política de gravação/retensão e ensaios em redes hospitalares. Para permitir consultas a dados clínicos ou novas acções, cada ferramenta deve ser especificada com perfil, âmbito, confirmação, auditoria e testes de segurança antes da activação.
