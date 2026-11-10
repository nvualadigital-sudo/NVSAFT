# Nomeação excepcional do técnico único — NVUALASOFT

Edição `2026.11.05-netlify.6`. Trata-se de uma opção de delegação institucional auditável, **não de dispensa geral de controlo técnico**.

## Como activar

1. Em **Administração → Instituição e acessos → Profissionais e credenciais**, cadastrar ou confirmar cédula, serviço, data de validade e verificação independente do técnico.
2. Em **Autorizações e sessões**, a gestão selecciona a **conta individual** do técnico e a competência **Director Técnico / substituto autorizado (técnico único)**.
3. Registar a decisão institucional, serviço, motivo, documento de referência e prazo de até 90 dias. O autor da delegação não pode ser o próprio técnico beneficiário.
4. No Laboratório, o técnico pode usar **Validar e libertar — substituto autorizado** para uma versão que ele próprio lançou, descrevendo o contexto e confirmando a avaliação de risco. Emite-se o documento definitivo após a API verificar credencial, autorização, estado do exame e actualizar a versão transaccionalmente.
5. A gestão pode revogar a nomeação, que deixa de produzir efeito imediatamente. Os documentos já libertados mantêm o histórico dos responsáveis.

## Regras de segurança

- A autorização pertence à combinação `empresa_id + username`; outra empresa não a herda.
- Apenas `funcao=tecnico` com perfil profissional validado/vigente recebe a competência `lab.validate.solo`. A validade máxima é de 90 dias.
- São obrigatórias nota de pelo menos 25 caracteres e confirmação do carácter não crítico.
- Para exames rastreados no circuito de amostras, a API **recusa expressamente** resultado crítico, validação clínica obrigatória ou revisão técnica já iniciada. O controlo de qualidade, equipamento e lote continua obrigatório onde configurado.
- Para lançamentos manuais legados, sem classificação crítica estruturada, a decisão não substitui avaliação clínica: a gestão deve delimitar formalmente no acto de nomeação quais exames são elegíveis, e o profissional confirma essa avaliação ao libertar. Antes de uso real, parametrizar o catálogo para classificar os riscos destes exames.
- As rotas normais continuam a exigir revisores independentes. A autorização `lab.validate.release` isolada não contorna a separação de funções.
- Todas as nomeações, revogações e libertações excepcionais geram eventos de auditoria. A exceção não elimina o histórico nem o PDF interno provisório para os casos pendentes.

## Escopo fiscal / AGT

As alterações deste documento dizem respeito à libertação de **resultados clínicos**, não à emissão fiscal. O código da facturação/POS, modelos A4/térmico, controlo de caixa, preparação FE e SAF-T mantém-se do pacote consolidado. A homologação formal do software junto da AGT **não foi concluída por este ZIP**. Não activar emissão fiscal real com credenciais de ensaio.

## Banco e publicação

Esta melhoria reutiliza `nv_grants`, `nv_professionals`, as versões laboratoriais e `nv_audit`; **não adiciona migração SQL**. Para produção, deve publicar a API Node e a interface Netlify da mesma versão, configurar a origem HTTPS real da API e testar com contas de ensaio antes de usar informação clínica real.
