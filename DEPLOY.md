# Instruções para Deploy na Vercel

Este documento contém instruções detalhadas para realizar o deploy do projeto na Vercel.

## Preparação do Projeto

O projeto já foi configurado para deploy na Vercel com as seguintes modificações:

1. **Arquivo `vercel.json`**: Configurações específicas para a Vercel, incluindo redirecionamentos e cabeçalhos HTTP.
2. **Arquivo `next.config.ts`**: Configurado com suporte para imagens remotas, redirecionamentos e otimizações para produção.
3. **Arquivo `.env.production`**: Contém as variáveis de ambiente necessárias para o ambiente de produção.
4. **Arquivo `.eslintrc.json`**: Configurado para desativar regras que poderiam bloquear o build.
5. **Scripts de build e deploy**: Adicionados ao `package.json`.
6. **Dockerfile**: Para quem preferir usar contêineres Docker.
7. **Script de produção**: `scripts/start-production.sh` para iniciar a aplicação em ambiente de produção.

## Opções de Deploy

### 1. Deploy Direto pela Vercel (Recomendado)

1. Crie uma conta na [Vercel](https://vercel.com) se ainda não tiver.
2. Instale a CLI da Vercel (opcional):
   ```bash
   npm install -g vercel
   ```
3. Faça login na sua conta Vercel:
   ```bash
   vercel login
   ```
4. No diretório do projeto, execute:
   ```bash
   npm run vercel-deploy
   ```
   Ou simplesmente:
   ```bash
   vercel
   ```
5. Siga as instruções na linha de comando.

### 2. Deploy via Dashboard da Vercel

1. Acesse o [Dashboard da Vercel](https://vercel.com/dashboard).
2. Clique em "New Project".
3. Importe o repositório do projeto (GitHub, GitLab ou Bitbucket).
4. Configure as variáveis de ambiente:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Clique em "Deploy".

### 3. Deploy via Docker (Opcional)

Se preferir usar Docker:

1. Construa a imagem:
   ```bash
   docker build -t empresa-app \
     --build-arg NEXT_PUBLIC_SUPABASE_URL=sua_url \
     --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave \
     --build-arg SUPABASE_SERVICE_ROLE_KEY=sua_chave_service .
   ```
2. Execute o contêiner:
   ```bash
   docker run -p 3000:3000 empresa-app
   ```

## Variáveis de Ambiente

Certifique-se de configurar as seguintes variáveis de ambiente no dashboard da Vercel:

```
NEXT_PUBLIC_SUPABASE_URL=sua_url_do_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon_do_supabase
SUPABASE_SERVICE_ROLE_KEY=sua_chave_service_role_do_supabase
```

## Verificação Pós-Deploy

Após o deploy, verifique:

1. Se a aplicação está acessível pela URL fornecida pela Vercel.
2. Se a autenticação com o Supabase está funcionando.
3. Se todas as funcionalidades estão operando corretamente.
4. Se as imagens e outros recursos estáticos estão sendo carregados.

## Domínio Personalizado

Para configurar um domínio personalizado:

1. Acesse as configurações do seu projeto no dashboard da Vercel.
2. Vá para a seção "Domains".
3. Adicione seu domínio personalizado.
4. Siga as instruções para configurar os registros DNS.

## Monitoramento e Logs

A Vercel oferece ferramentas de monitoramento e logs:

1. Acesse o dashboard do seu projeto.
2. Vá para a seção "Analytics" para ver métricas de desempenho.
3. Vá para a seção "Logs" para ver logs de execução.

## Solução de Problemas

Se encontrar problemas durante o deploy:

1. Verifique os logs de build e deploy na Vercel.
2. Certifique-se de que todas as variáveis de ambiente estão configuradas corretamente.
3. Verifique se o Supabase está acessível e funcionando corretamente.
4. Consulte a [documentação da Vercel](https://vercel.com/docs) para problemas específicos da plataforma.

## Recursos Adicionais

- [Documentação do Next.js](https://nextjs.org/docs)
- [Documentação da Vercel](https://vercel.com/docs)
- [Documentação do Supabase](https://supabase.io/docs) 