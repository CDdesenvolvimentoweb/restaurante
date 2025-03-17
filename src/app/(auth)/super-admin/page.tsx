'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Restaurant } from '@/types';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';

export default function SuperAdminDashboard() {
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [formVisible, setFormVisible] = useState(false);
  const [newRestaurant, setNewRestaurant] = useState({
    name: '',
    address: '',
    phone: '',
  });
  const [newAdmin, setNewAdmin] = useState({
    name: '',
    email: '',
  });

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }

      // Verificar se o usuário é super admin
      const { data } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!data || data.role !== 'super_admin') {
        toast.error('Acesso negado: você não é um super admin');
        router.push('/login');
        return;
      }

      fetchRestaurants();
    };

    checkAuth();
  }, [router]);

  const fetchRestaurants = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setRestaurants(data || []);
    } catch (error: any) {
      toast.error('Erro ao carregar restaurantes: ' + error.message);
      console.error('Erro ao carregar restaurantes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRestaurant = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      const supabase = createClient();

      // 1. Criar o restaurante
      const { data: restaurant, error: restaurantError } = await supabase
        .from('restaurants')
        .insert({
          name: newRestaurant.name,
          address: newRestaurant.address,
          phone: newRestaurant.phone,
        })
        .select()
        .single();

      if (restaurantError) {
        throw restaurantError;
      }

      // 2. Criar um usuário admin para o restaurante
      // Gerar senha temporária
      const tempPassword = Math.random().toString(36).slice(-8);

      // Criar usuário no Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newAdmin.email,
        password: tempPassword,
      });

      if (authError) {
        throw authError;
      }

      // 3. Criar o perfil do admin vinculado ao restaurante
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: authData.user!.id,
          email: newAdmin.email,
          name: newAdmin.name,
          role: 'admin',
          restaurant_id: restaurant.id,
        });

      if (profileError) {
        throw profileError;
      }

      toast.success('Restaurante e admin criados com sucesso!');
      setFormVisible(false);
      setNewRestaurant({ name: '', address: '', phone: '' });
      setNewAdmin({ name: '', email: '' });
      fetchRestaurants();
    } catch (error: any) {
      toast.error('Erro ao criar restaurante: ' + error.message);
      console.error('Erro ao criar restaurante:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRestaurant = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este restaurante? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      setLoading(true);
      const supabase = createClient();
      const { error } = await supabase
        .from('restaurants')
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }

      toast.success('Restaurante excluído com sucesso!');
      fetchRestaurants();
    } catch (error: any) {
      toast.error('Erro ao excluir restaurante: ' + error.message);
      console.error('Erro ao excluir restaurante:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <Toaster position="top-right" />
      
      <div className="px-4 py-6 sm:px-0">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Gestão de Restaurantes</h1>
          <button
            onClick={() => setFormVisible(!formVisible)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            {formVisible ? 'Cancelar' : 'Adicionar Restaurante'}
          </button>
        </div>

        {formVisible && (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Novo Restaurante e Admin
              </h3>
              <form onSubmit={handleCreateRestaurant} className="mt-5 grid grid-cols-1 gap-y-6 sm:grid-cols-2 sm:gap-x-4">
                <div>
                  <h4 className="text-md font-medium text-gray-700 mb-4">Dados do Restaurante</h4>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                        Nome
                      </label>
                      <input
                        type="text"
                        name="name"
                        id="name"
                        required
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        value={newRestaurant.name}
                        onChange={(e) => setNewRestaurant({ ...newRestaurant, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                        Endereço
                      </label>
                      <input
                        type="text"
                        name="address"
                        id="address"
                        required
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        value={newRestaurant.address}
                        onChange={(e) => setNewRestaurant({ ...newRestaurant, address: e.target.value })}
                      />
                    </div>
                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                        Telefone
                      </label>
                      <input
                        type="text"
                        name="phone"
                        id="phone"
                        required
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        value={newRestaurant.phone}
                        onChange={(e) => setNewRestaurant({ ...newRestaurant, phone: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-md font-medium text-gray-700 mb-4">Dados do Administrador</h4>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="adminName" className="block text-sm font-medium text-gray-700">
                        Nome
                      </label>
                      <input
                        type="text"
                        name="adminName"
                        id="adminName"
                        required
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        value={newAdmin.name}
                        onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label htmlFor="adminEmail" className="block text-sm font-medium text-gray-700">
                        Email
                      </label>
                      <input
                        type="email"
                        name="adminEmail"
                        id="adminEmail"
                        required
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        value={newAdmin.email}
                        onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="sm:col-span-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setFormVisible(false)}
                    className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 mr-3"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {loading ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {loading && !formVisible ? (
          <div className="text-center py-10">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-500">Carregando restaurantes...</p>
          </div>
        ) : (
          <>
            {restaurants.length === 0 ? (
              <div className="text-center py-10 bg-white shadow overflow-hidden sm:rounded-lg">
                <p className="text-gray-500">Nenhum restaurante cadastrado.</p>
              </div>
            ) : (
              <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Nome
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Endereço
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Telefone
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Data de Criação
                      </th>
                      <th scope="col" className="relative px-6 py-3">
                        <span className="sr-only">Ações</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {restaurants.map((restaurant) => (
                      <tr key={restaurant.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{restaurant.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{restaurant.address}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{restaurant.phone}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">
                            {new Date(restaurant.created_at).toLocaleDateString('pt-BR')}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => router.push(`/super-admin/restaurants/${restaurant.id}`)}
                            className="text-blue-600 hover:text-blue-900 mr-4"
                          >
                            Ver
                          </button>
                          <button
                            onClick={() => handleDeleteRestaurant(restaurant.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Excluir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
} 