// Script para criar uma conta de super admin no sistema
// Deve ser executado com Node.js

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Configurações do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Esta é uma chave com privilégios elevados

// Verifique se as variáveis de ambiente estão configuradas
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Erro: Variáveis de ambiente NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias.');
  console.error('Adicione-as ao arquivo .env.local e tente novamente.');
  process.exit(1);
}

// Informações do super admin a ser criado
// Você pode alterar estes valores ou passar como argumentos da linha de comando
const superAdminEmail = process.argv[2] || 'admin@sistema.com';
const superAdminPassword = process.argv[3] || '@DG450159753';
const superAdminName = process.argv[4] || 'Super Administrador';

// Cliente Supabase com chave de serviço (permite operações administrativas)
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createSuperAdmin() {
  console.log('Criando conta de Super Admin...');
  
  try {
    // 1. Criar a conta no Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: superAdminEmail,
      password: superAdminPassword,
      email_confirm: true // Confirma automaticamente o email
    });

    if (authError) {
      throw authError;
    }

    console.log('✅ Usuário criado no Auth com sucesso');
    
    // 2. Adicionar dados do usuário na tabela users
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email: superAdminEmail,
        name: superAdminName,
        role: 'super_admin'
      })
      .select()
      .single();

    if (userError) {
      throw userError;
    }

    console.log('✅ Perfil de Super Admin criado com sucesso:');
    console.log({
      id: userData.id,
      email: userData.email,
      name: userData.name,
      role: userData.role
    });
    
    console.log('\n🔑 Login:');
    console.log(`Email: ${superAdminEmail}`);
    console.log(`Senha: ${superAdminPassword}`);
    
  } catch (error) {
    console.error('❌ Erro ao criar Super Admin:', error.message);
    process.exit(1);
  }
}

createSuperAdmin();

// Instruções para uso:
// 1. Certifique-se de ter as variáveis no .env.local:
//    NEXT_PUBLIC_SUPABASE_URL=sua_url
//    SUPABASE_SERVICE_ROLE_KEY=sua_chave_de_servico (obtenha no dashboard do Supabase)
//
// 2. Execute:
//    node scripts/create-super-admin.js [email] [senha] [nome]
//    
// Exemplo:
//    node scripts/create-super-admin.js admin@sistema.com @DG450159753 "Douglas R" 