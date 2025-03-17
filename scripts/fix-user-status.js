// Script para adicionar o campo status aos usuários existentes
// Este script corrige o problema do usuário que não tem o campo status definido

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

async function fixUserStatus() {
  console.log('Verificando e corrigindo status dos usuários...');
  
  try {
    // 1. Buscar todos os usuários sem o campo status definido
    const { data: users, error: fetchError } = await supabase
      .from('users')
      .select('*');

    if (fetchError) {
      throw fetchError;
    }

    console.log(`Encontrados ${users.length} usuários no total.`);
    
    // 2. Filtrar usuários sem status definido
    const usersWithoutStatus = users.filter(user => !user.status);
    console.log(`Encontrados ${usersWithoutStatus.length} usuários sem status definido.`);
    
    // 3. Atualizar cada usuário sem status
    if (usersWithoutStatus.length > 0) {
      for (const user of usersWithoutStatus) {
        const { data, error } = await supabase
          .from('users')
          .update({ status: 'active' })
          .eq('id', user.id)
          .select()
          .single();
        
        if (error) {
          console.error(`Erro ao atualizar usuário ${user.id}:`, error.message);
          continue;
        }
        
        console.log(`✅ Usuário atualizado: ${data.id} - ${data.email} - Status: ${data.status}`);
      }
      
      console.log(`\n✅ ${usersWithoutStatus.length} usuários foram atualizados com status 'active'.`);
    } else {
      console.log('Nenhum usuário precisa ser atualizado. Todos já possuem status definido.');
    }
    
  } catch (error) {
    console.error('❌ Erro ao corrigir status dos usuários:', error.message);
    process.exit(1);
  }
}

fixUserStatus(); 