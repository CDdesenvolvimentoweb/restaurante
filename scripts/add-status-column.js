// Script para adicionar a coluna status à tabela users
// Deve ser executado com Node.js

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

async function addStatusColumn() {
  console.log('Adicionando coluna status à tabela users...');
  
  try {
    // Usar uma consulta SQL bruta para adicionar a coluna
    const { error } = await supabase.rpc('execute_sql', {
      query: `
        ALTER TABLE IF EXISTS public.users 
        ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
      `
    });

    if (error) {
      throw error;
    }

    console.log('✅ Coluna status adicionada com sucesso à tabela users!');
    console.log('O valor padrão para novos usuários será "active"');
    
  } catch (error) {
    console.error('❌ Erro ao adicionar coluna status:', error.message);
    
    // Solução alternativa se rpc não funcionar
    console.log('\nTentando método alternativo...');
    try {
      const { error: sqlError } = await supabase.rpc('add_column_to_users', { 
        column_name: 'status', 
        column_type: 'text',
        default_value: 'active'
      });
      
      if (sqlError) {
        console.error('❌ Método alternativo também falhou:', sqlError.message);
        console.log('\n============================================');
        console.log('IMPORTANTE: Execute o seguinte SQL diretamente no painel SQL do Supabase:');
        console.log('ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT \'active\';');
        console.log('============================================');
      } else {
        console.log('✅ Coluna adicionada com sucesso usando método alternativo!');
      }
    } catch (altError) {
      console.error('❌ Erro ao usar método alternativo:', altError.message);
      console.log('\n============================================');
      console.log('IMPORTANTE: Execute o seguinte SQL diretamente no painel SQL do Supabase:');
      console.log('ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT \'active\';');
      console.log('============================================');
    }
    
    process.exit(1);
  }
}

addStatusColumn(); 