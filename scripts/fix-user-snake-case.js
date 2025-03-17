// Script para normalizar as colunas da tabela users para snake_case
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

async function fixColumnNames() {
  console.log('Analisando e corrigindo nomes de colunas na tabela users...');
  
  try {
    // 1. Verificar estrutura da tabela
    let userTableHasCorrectStructure = true;
    
    // 2. Buscar super admin
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'super_admin')
      .limit(1);
    
    if (usersError) {
      throw usersError;
    }
    
    if (users.length === 0) {
      console.log('❌ Nenhum usuário super_admin encontrado.');
      return;
    }
    
    const user = users[0];
    console.log('✅ Usuário encontrado:');
    console.log(user);
    
    // 3. Verificar se o restaurante existe ou criar um novo
    const { data: restaurants, error: restaurantsError } = await supabase
      .from('restaurants')
      .select('id')
      .limit(1);
    
    let restaurantId;
    
    if (restaurantsError || restaurants.length === 0) {
      // Criar um restaurante padrão
      console.log('Criando restaurante padrão...');
      const { data: newRestaurant, error: newRestaurantError } = await supabase
        .from('restaurants')
        .insert({
          name: 'Restaurante Principal',
          address: 'Endereço Principal',
          phone: '(00) 00000-0000'
        })
        .select()
        .single();
      
      if (newRestaurantError) {
        console.error('❌ Erro ao criar restaurante padrão:', newRestaurantError.message);
      } else {
        restaurantId = newRestaurant.id;
        console.log(`✅ Restaurante padrão criado com ID: ${restaurantId}`);
      }
    } else {
      restaurantId = restaurants[0].id;
      console.log(`✅ Usando restaurante existente com ID: ${restaurantId}`);
    }
    
    // 4. Atualizar campo restaurant_id do usuário (se já não estiver definido)
    if (restaurantId && !user.restaurant_id) {
      console.log('Atualizando restaurant_id do usuário...');
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({ restaurant_id: restaurantId })
        .eq('id', user.id)
        .select()
        .single();
      
      if (updateError) {
        console.error('❌ Erro ao atualizar restaurant_id do usuário:', updateError.message);
      } else {
        console.log('✅ Usuário atualizado com restaurant_id!');
        console.log(updatedUser);
      }
    }
    
    // 5. Verificar/adicionar coluna status
    console.log('\nVerificando coluna status...');
    if (!('status' in user)) {
      console.log('A coluna status não existe na tabela users.');
      console.log('⚠️ Execute o seguinte SQL no painel do Supabase:');
      console.log('ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT \'active\';');
    } else {
      console.log('✅ Coluna status já existe na tabela users.');
    }
    
    // 6. Sugestões para corrigir o código
    console.log('\n============================================');
    console.log('INSTRUÇÕES PARA CORRIGIR O CÓDIGO FRONTEND:');
    console.log('============================================');
    console.log('1. A tabela users no banco de dados usa snake_case (restaurant_id):');
    console.log('   - Mantenha o uso de snake_case nas consultas SQL e atualizações de banco de dados');
    console.log('   - No frontend, use camelCase (restaurantId)');
    console.log('   - Converta snake_case para camelCase após buscar dados do banco');
    console.log('   - Converta camelCase para snake_case antes de salvar no banco');
    console.log('\n2. No arquivo DashboardLayout.tsx:');
    console.log('   - Use a abordagem já implementada de compatibilidade:');
    console.log('     const userWithStatus = {');
    console.log('       ...data,');
    console.log('       status: data.status || \'active\',');
    console.log('       restaurantId: data.restaurantId || data.restaurant_id');
    console.log('     };');
    console.log('     setUser(userWithStatus as User);');
    console.log('\n3. No arquivo index.ts de tipos:');
    console.log('   - Mantenha ambas as propriedades na interface para compatibilidade:');
    console.log('     restaurantId?: string;');
    console.log('     restaurant_id?: string;');
    console.log('============================================');
    
  } catch (error) {
    console.error('❌ Erro ao analisar e corrigir nomes de colunas:', error.message);
    process.exit(1);
  }
}

fixColumnNames(); 