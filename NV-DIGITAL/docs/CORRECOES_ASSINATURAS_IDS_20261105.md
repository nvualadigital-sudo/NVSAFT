# Assinaturas e referências legíveis — actualização de 05/11/2026

## Configurações → Assinaturas clínicas

- Seleccionar o médico ou enfermeiro da **mesma empresa**.
- Importar PNG, JPG ou WebP até 10 MB. O navegador converte a imagem para PNG/JPEG até 195 KB antes de enviar à API, que mantém a validação de 200 KB.
- Se a ficha profissional ainda não estiver verificada, **Guardar imagens em rascunho**. O ficheiro fica ligado ao profissional, mas não é utilizado como assinatura autorizada nos documentos.
- Em **Administração → Instituição e acessos → Profissionais**, um responsável autorizado verifica a cédula, a validade e a evidência institucional. A auto-verificação não é permitida.
- Voltar a **Configurações → Assinaturas clínicas** para atribuir oficialmente o responsável por Medicina ou Chefia de Enfermagem.
- As alterações são isoladas por empresa, sujeitas a controlo de revisão e registadas em auditoria. Os documentos já emitidos conservam a identificação da data de emissão.

## IDs, números de processo e documentos

- O laboratório continua a usar numeração institucional `LAB/001`, `ULTRA/001` etc. para **processo**, **pedido** e **amostra**, conforme `LABORATORIO_NUMERACAO.md`.
- A recepção, a pesquisa de pacientes, os serviços e o circuito laboratorial exibem primeiro o **número de processo**; não repetem o ID interno quando existe processo.
- As referências técnicas compridas de eventos de enfermagem, prescrições e MedLik são abreviadas apenas no ecrã; o identificador completo continua no registo e disponível no atributo de informação da referência.
- Nunca cortar IDs técnicos guardados no Postgres, tokens, chaves externas, URLs, códigos QR, notas fiscais ou números de factura. Uma abreviação visual não é uma numeração oficial nova.
- Registos antigos preservam o seu número original. A mudança do prefixo do laboratório só afeta referências ainda não emitidas.

## Verificação

- Testes de autorização por empresa, rascunho sem validação, rejeição de SVG, persistência de imagem e não atribuição automática de assinatura.
- Verificação TypeScript da API e do frontend.
- A publicação do novo código no servidor/Netlify continua necessária. Actualizar apenas a Neon não altera o formulário.
