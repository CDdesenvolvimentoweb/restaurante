// Script para atualizar dados do usuário no frontend
// Este script atualiza o banco de dados e sugere modificações no código

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

async function updateUserData() {
  console.log('Analisando dados do usuário e estrutura do sistema...');
  
  try {
    // 1. Verificar a estrutura da tabela users
    console.log('Verificando a estrutura da tabela de usuários...');
    
    // Obter dados do usuário super_admin para confirmar valores
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
    } else {
      console.log('✅ Usuário super_admin encontrado:');
      console.log(users[0]);
      
      // 2. Adicionar restaurantId se estiver faltando
      if (!users[0].restaurantId) {
        console.log('\nO usuário não possui restaurantId definido.');
        console.log('Adicionando restaurantId para o super_admin...');
        
        // Criar um restaurante padrão se necessário
        const { data: restaurant, error: restaurantError } = await supabase
          .from('restaurants')
          .select('id')
          .limit(1);
        
        let restaurantId;
        
        if (restaurantError || restaurant.length === 0) {
          // Criar um restaurante padrão
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
          restaurantId = restaurant[0].id;
          console.log(`✅ Usando restaurante existente com ID: ${restaurantId}`);
        }
        
        if (restaurantId) {
          // Atualizar usuário com restaurantId
          const { data: updatedUser, error: updateError } = await supabase
            .from('users')
            .update({ restaurantId })
            .eq('id', users[0].id)
            .select()
            .single();
          
          if (updateError) {
            console.error('❌ Erro ao atualizar restaurantId do usuário:', updateError.message);
          } else {
            console.log('✅ Usuário atualizado com restaurantId!');
            console.log(updatedUser);
          }
        }
      }
    }
    
    // 3. Mostrar sugestões para correção do código
    console.log('\n============================================');
    console.log('SUGESTÕES PARA CORREÇÃO DO FRONTEND:');
    console.log('============================================');
    console.log('1. Verifique se o componente DashboardLayout.tsx está usando corretamente o campo status do usuário.');
    console.log('2. Se o campo status não existir na tabela, adicione com o seguinte SQL:');
    console.log('   ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT \'active\';');
    console.log('3. Alternativamente, modifique o código para tratar usuários sem o campo status:');
    console.log('   - Em DashboardLayout.tsx, adicione uma verificação:');
    console.log('     const userWithStatus = { ...data, status: data.status || \'active\' };');
    console.log('     setUser(userWithStatus as User);');
    console.log('4. Se o erro persistir, considere modificar a interface User em src/types/index.ts:');
    console.log('   - Certifique-se de que o campo status seja opcional: status?: string;');
    console.log('============================================');
    
  } catch (error) {
    console.error('❌ Erro ao atualizar dados do usuário:', error.message);
    process.exit(1);
  }
}

updateUserData(); 