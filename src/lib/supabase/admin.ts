import { createClient } from './server';
import { Restaurant, User } from '@/types';

/**
 * Cadastra um novo restaurante (apenas super admin)
 */
export async function createRestaurant(
  restaurantData: Omit<Restaurant, 'id' | 'created_at' | 'updated_at'>,
  adminUserData: Omit<User, 'id' | 'created_at' | 'updated_at' | 'role' | 'restaurantId'>
): Promise<{ restaurant: Restaurant | null; error: Error | null }> {
  const supabase = createClient();
  
  try {
    // Verificar se o usuário atual é super admin
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { restaurant: null, error: new Error('Usuário não autenticado') };
    }

    // Obter o perfil do usuário para verificar o papel
    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userProfile || userProfile.role !== 'super_admin') {
      return { restaurant: null, error: new Error('Permissão negada: apenas super admin pode cadastrar restaurantes') };
    }

    // Iniciar uma transação
    // Em produção, isso pode ser feito usando funções do Supabase
    
    // 1. Criar o restaurante
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .insert(restaurantData)
      .select()
      .single();

    if (restaurantError) {
      throw restaurantError;
    }

    // 2. Criar um usuário admin para o restaurante
    // Primeiro, criar uma conta no Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: adminUserData.email,
      password: 'senha-temporaria', // Em produção, gerar senha aleatória ou usar magic link
      email_confirm: true,
    });

    if (authError) {
      // Tentar excluir o restaurante para reverter a transação
      await supabase.from('restaurants').delete().eq('id', restaurant.id);
      throw authError;
    }

    // 3. Criar o perfil do admin vinculado ao restaurante
    const { error: profileError } = await supabase.from('users').insert({
      id: authData.user.id,
      email: adminUserData.email,
      name: adminUserData.name,
      role: 'admin',
      restaurantId: restaurant.id,
      restaurant_id: restaurant.id,
    });

    if (profileError) {
      // Reverter transação
      await supabase.auth.admin.deleteUser(authData.user.id);
      await supabase.from('restaurants').delete().eq('id', restaurant.id);
      throw profileError;
    }

    return { restaurant, error: null };
  } catch (error) {
    console.error('Erro ao cadastrar restaurante:', error);
    return { restaurant: null, error: error as Error };
  }
} 