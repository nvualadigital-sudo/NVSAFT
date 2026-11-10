# NV-DIGITAL — Nomeação para validação e libertação laboratorial

Versão: `2026.11.05-netlify.7` · 05/11/2026

## Utilização pela administração da instituição

1. Em **Administração → Funcionários**, crie ou edite um profissional com perfil de Técnico de Laboratório ou Médico e preencha categoria, cédula/registo, validade e restantes dados profissionais.
2. Na secção **Permissões laboratoriais**, consulte cinco opções: **Lançar e editar resultados** (incluída no perfil técnico, não é delegação), **Validar tecnicamente** (nomeável), **Libertar resultados finais** (nomeável), **Gerar PDF definitivo** (indicador vinculado à libertação, apenas após a confirmação do servidor), e **Autorizar resultados críticos** (nomeável separadamente). Marque as opções pretendidas e clique em **Guardar**.
3. Se a credencial profissional **já estiver verificada**, o próprio acto de guardar cria ou revoga as autorizações seleccionadas. O servidor regista a instituição, o responsável pela concessão e a expiração, limitada a 365 dias ou à data da credencial, se anterior. Não há outro botão de activação.
4. Num **funcionário novo**, sem habilitação verificada, as selecções ficam pendentes. Em **Instituição e acessos → Profissionais e credenciais**, outro responsável verifica a habilitação e a situação profissional. No momento da aprovação, as permissões seleccionadas ficam activas automaticamente, sem retornar ao cadastro.
5. Para revogar uma autorização, desmarque a caixa na ficha e clique em **Guardar**. O histórico da concessão e da revogação permanece auditável. Suspensão/expiração da credencial ou desactivação da conta bloqueiam o uso das autorizações.

## Resultado e PDF

- O técnico lança a versão. A edição não implica libertação.
- A validação técnica e a libertação final exigem autorizações vigentes, credencial activa e verificações independentes já impostas pela API. O profissional que introduziu o resultado não o autovalida.
- **Resultados críticos no circuito rastreado**: exigem uma autorização adicional `lab.critical.release` para quem os liberta. A unidade deve nomear pelo menos um profissional habilitado antes de usar esse circuito. Esta autorização não dispensa as verificações independentes nem a comunicação clínica do achado crítico.
- No circuito manual, **Libertar resultado e abrir PDF definitivo** faz a validação no servidor e, só depois do sucesso, abre a impressão final no navegador. Se a janela estiver bloqueada, o documento pode ser aberto no botão **PDF / Imprimir**.
- O PDF final identifica o utilizador que libertou a versão. A configuração gráfica da assinatura institucional existente é conservada; a administração deve rever a política de assinaturas e a autorização do respectivo titular antes da utilização em produção.
- Resultados ainda em revisão mantêm histórico e PDF interno explicitamente provisório, mas não são publicados para paciente ou parceiro.
- O circuito de amostras rastreadas conserva as suas etapas e exige CQ válido sempre que configurado; a sua impressão final continua acessível após libertação em **Resultados Prontos / Histórico**.

## Não incluído

- Não foi implementada autoverificação de resultados nem auto-libertação ao guardar: exigiriam regras específicas por exame, ensaio e aprovação clínica prévia.
- Não foram alteradas as migrações nem a Neon real, o GitHub ou a Netlify. A aplicação em produção requer instalar este pacote no projecto correcto e testar as permissões por instituição.
