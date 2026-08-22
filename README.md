# Simulador de Remuneração Variável

Aplicação estática de produção para Consultores e Gerentes, com identidade YDUQS, cálculo mensal/semestral, acompanhamento do funil e anotações locais.

## Rotas

- `/projecao`: entradas, remuneração estimada, tabela editável e ritmo.
- `/resultados`: consolidação mensal/semestral e distribuições.
- `/oportunidades`: diferenças do funil e atalhos para o próximo passo.
- `/anotacoes`: bloco de contatos com cópia de telefone e exportação CSV.

Perfil, mês e produção podem ser compartilhados pela query string. Exemplo: `?mes=2026-08&perfil=consultor&ead=18,10,8` (Inscritos, Matrícula Financeira e Matrícula Acadêmica).

## Desenvolvimento

O projeto não usa dependências de runtime nem CSS por CDN. O build local copia os módulos ES e cria os pontos de entrada das quatro rotas.

```bash
npm run dev
npm run check
```

O segundo comando executa testes de regras de negócio, auditoria estática de tokens/contraste e o build de produção em `dist/`.

## Regras principais

- Meta de Matrícula Financeira: mensal.
- Meta de Matrícula Acadêmica: semestral.
- Faixa considerada: menor atingimento entre as duas metas.
- Consultor: valor por Matrícula Financeira e modalidade, conforme a faixa.
- Gerente: percentual da faixa aplicado ao salário-base.
- Pagamento: 60% liberado no mês e 40% retido para o fechamento semestral.
- Persistência: `localStorage`, com migração dos dados das versões anteriores.

## Administração

A opção **Administração** permanece no rodapé da sidebar e abre um modal acessível. O logo não possui comportamento administrativo. Datas, metas e matriz vertical de valores podem ser atualizadas por perfil.

A credencial não existe no bundle. A função `/api/admin-auth` calcula o SHA-256 da senha somente no servidor e o compara, em tempo constante, com `process.env.ADMIN_PASSWORD_HASH`; o hash não é aceito como credencial do cliente. Para executar localmente, copie `.env.example` para `.env`, substitua o placeholder por um hash SHA-256 e nunca versione esse arquivo. Na Vercel, configure a mesma variável nos ambientes de Preview e Production.

## Estrutura

```text
.
├── index.html
├── favicon.svg
├── api/
│   └── admin-auth.js
├── src/
│   ├── app.js
│   ├── config.js
│   ├── model.js
│   ├── store.js
│   └── styles.css
├── scripts/
│   ├── audit.mjs
│   ├── build.mjs
│   └── serve.mjs
├── tests/
├── package.json
└── vercel.json
```
