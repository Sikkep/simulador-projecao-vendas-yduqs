# Simulador de Projeção de Vendas

Simulador comercial em modo escuro, com identidade visual em tons de azul da YDUQS. O projeto possui simulações separadas para os perfis **Consultor** e **Gerente**, cada um com Graduação, Pós-Graduação e Curso Técnico.

## Funcionalidades

- Seis combinações independentes de perfil e curso.
- Projeção em tempo real por quantidade de vendas, meta e data.
- Painel de Administração protegido por senha.
- Edição de valor por venda, quantidade da meta, bônus e data de fechamento.
- Persistência local no navegador por `localStorage`.
- Projeto estático pronto para publicação na Vercel.

## Executar localmente

O projeto não exige compilação. Abra `index.html` diretamente no navegador ou use a Vercel CLI:

```bash
npm install -g vercel
npm run dev
```

## Publicar na Vercel

1. Importe este repositório no painel da Vercel.
2. Mantenha o preset de framework como **Other**.
3. Não informe comando de build.
4. Publique o projeto.

Também é possível publicar pela linha de comando:

```bash
npm run deploy:prod
```

## Administração

A opção **Administração** fica no menu lateral. Dentro dela é possível selecionar o perfil e o curso antes de editar os parâmetros.

> Atenção: esta versão é um protótipo estático. A senha e os parâmetros ficam no navegador e não constituem controle de acesso seguro para produção. Para dados compartilhados ou acesso administrativo real, conecte o simulador a uma API com autenticação e armazenamento no servidor.

## Estrutura

```text
.
├── index.html
├── package.json
├── vercel.json
├── .gitignore
└── README.md
```
