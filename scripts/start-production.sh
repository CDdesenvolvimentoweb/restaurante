#!/bin/bash

# Definir variáveis de ambiente
export NODE_ENV=production

# Verificar se as variáveis de ambiente necessárias estão definidas
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
  echo "Erro: Variáveis de ambiente NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY devem estar definidas."
  exit 1
fi

# Instalar dependências (se necessário)
if [ ! -d "node_modules" ]; then
  echo "Instalando dependências..."
  npm install --production
fi

# Construir o projeto (se necessário)
if [ ! -d ".next" ]; then
  echo "Construindo o projeto..."
  npm run build
fi

# Iniciar o servidor
echo "Iniciando o servidor em modo de produção..."
npm run start