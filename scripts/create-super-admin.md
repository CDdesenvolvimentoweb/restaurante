# Como Criar um Super Admin

Este documento explica como executar o script para criar um Super Administrador no sistema de gerenciamento de restaurantes.

## Pré-requisitos

1. Node.js instalado na sua máquina
2. Acesso ao projeto do Supabase
3. Arquivo `.env.local` configurado corretamente

## Configuração do Ambiente

Antes de executar o script, você precisa obter a chave de serviço (Service Role Key) do Supabase:

1. Acesse o dashboard do Supabase (https://app.supabase.com)
2. Selecione seu projeto
3. Vá em "Configurações" > "API"
4. Na seção "Project API keys", copie a "service_role key"

Adicione as seguintes variáveis ao seu arquivo `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=sua_url_do_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon
SUPABASE_SERVICE_ROLE_KEY=sua_chave_de_servico
```

## Executando o Script

1. Instale as dependências necessárias:
```bash
npm install dotenv @supabase/supabase-js
```

2. Abra o terminal na pasta raiz do projeto
3. Execute o script com Node.js:

```bash
node scripts/create-super-admin.js [email] [senha] [nome]
```

### Exemplos:

Com parâmetros personalizados:
```bash
node scripts/create-super-admin.js admin@meurestaurante.com minhasenha "João Silva"
```

Com valores padrão (não recomendado para produção):
```bash
node scripts/create-super-admin.js
```

## Estrutura da Tabela Users

O script insere um registro na tabela `users` com os seguintes campos:
- `id`: UUID do usuário gerado pelo Supabase Auth
- `email`: Endereço de e-mail do usuário
- `name`: Nome completo do usuário
- `role`: Papel/função do usuário (definido como 'super_admin')

## Notas Importantes

- Este script deve ser executado apenas uma vez para criar o Super Admin inicial.
- A senha deve ter pelo menos 6 caracteres.
- É altamente recomendado alterar a senha padrão após o primeiro login.
- Nunca compartilhe sua chave de serviço (Service Role Key) ou a inclua em repositórios públicos.
- O Super Admin terá acesso total ao sistema, incluindo a capacidade de criar outros administradores.

## Solução de Problemas

Se você encontrar erros como:

- **"User already registered"**: O email já está registrado no Supabase.
- **"Invalid email"**: O formato do email é inválido.
- **"Password should be at least 6 characters"**: A senha é muito curta.
- **"Could not find the 'X' column of 'users'"**: A estrutura da tabela 'users' não contém a coluna mencionada.

Para qualquer outro problema, verifique os logs de erro do script para obter mais detalhes. 