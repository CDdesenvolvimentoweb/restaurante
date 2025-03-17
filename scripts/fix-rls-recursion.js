// Script para resolver o problema de recursão infinita nas políticas RLS
// Este script desativa temporariamente o RLS para a tabela users

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Configurações do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Verifique se as variáveis de ambiente estão configuradas
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Erro: Variáveis de ambiente NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias.');
  console.error('Adicione-as ao arquivo .env.local e tente novamente.');
  process.exit(1);
}

// Cliente Supabase com chave de serviço
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixRlsRecursion() {
  console.log('Iniciando correção de problemas de recursão RLS...');
  
  try {
    // 1. Executar consulta SQL para desativar RLS e remover políticas
    console.log('Desabilitando RLS e removendo políticas para a tabela users...');
    
    const sqlCommands = `
      -- Desativa RLS para a tabela users
      ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

      -- Remove todas as políticas existentes para a tabela users
      DROP POLICY IF EXISTS "Enable read access for all users" ON public.users;
      DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.users;
      DROP POLICY IF EXISTS "Enable update for users based on id" ON public.users;
      DROP POLICY IF EXISTS "Enable delete for users based on id" ON public.users;
      DROP POLICY IF EXISTS "Usuários podem ver seus próprios dados" ON public.users;
      DROP POLICY IF EXISTS "Admins podem ver todos os usuários" ON public.users;
      DROP POLICY IF EXISTS "Admins podem editar todos os usuários" ON public.users;
      DROP POLICY IF EXISTS "Users can view own user" ON public.users;
      DROP POLICY IF EXISTS "Users can update own user" ON public.users;
      DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
      DROP POLICY IF EXISTS "Admins can update all users" ON public.users;
    `;
    
    const { error } = await supabase.rpc('exec_sql', { sql: sqlCommands });
    
    if (error) {
      // Tentar método alternativo se o RPC não funcionar
      console.error('Erro ao executar comando RPC:', error.message);
      console.log('Tentando método alternativo...');
      
      // Lista de comandos SQL para executar individualmente
      const commands = sqlCommands.split(';').filter(cmd => cmd.trim());
      
      for (const cmd of commands) {
        if (cmd.trim()) {
          const { error: cmdError } = await supabase.rpc('execute_sql', { query: cmd.trim() });
          if (cmdError) {
            console.error(`Erro ao executar: ${cmd.trim()}\nErro: ${cmdError.message}`);
          } else {
            console.log(`Comando executado com sucesso: ${cmd.trim()}`);
          }
        }
      }
    } else {
      console.log('Comandos SQL executados com sucesso!');
    }
    
    // 2. Verificar usuários existentes
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, role');
    
    if (usersError) {
      console.error('Erro ao buscar usuários:', usersError.message);
    } else {
      console.log('Usuários encontrados na tabela users:');
      console.log(users);
    }
    
    // 3. Exibir instruções para restaurar segurança posteriormente
    console.log('\n============================================');
    console.log('ATENÇÃO: SEGURANÇA TEMPORARIAMENTE REDUZIDA');
    console.log('============================================');
    console.log('RLS para a tabela "users" foi desativado para resolver o problema de recursão.');
    console.log('Isso significa que os dados estão menos protegidos, mas o sistema deve funcionar.');
    console.log('\nPara restaurar a segurança no futuro, execute:');
    console.log(`
    -- Primeiro implemente políticas sem recursão
    CREATE POLICY "Usuários podem ler seus próprios dados" ON public.users
    FOR SELECT USING (auth.uid() = id);
    
    CREATE POLICY "Usuários podem atualizar seus próprios dados" ON public.users
    FOR UPDATE USING (auth.uid() = id);
    
    CREATE POLICY "Admins podem ler todos os dados" ON public.users
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM auth.users
        WHERE auth.users.id = auth.uid()
        AND auth.users.email IN (
          SELECT email FROM public.users WHERE role IN ('super_admin', 'admin')
        )
      )
    );
    
    -- Depois reative o RLS
    ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
    `);
    console.log('============================================');
    
  } catch (error) {
    console.error('❌ Erro ao corrigir problemas de RLS:', error.message);
    process.exit(1);
  }
}

fixRlsRecursion(); 