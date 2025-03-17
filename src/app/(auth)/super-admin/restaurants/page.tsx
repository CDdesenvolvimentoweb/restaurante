'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Restaurant } from '@/types';
import toast, { Toaster } from 'react-hot-toast';

export default function RestaurantsList() {
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [filteredRestaurants, setFilteredRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }

      // Verificar se o usuário é um super_admin
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!profile || profile.role !== 'super_admin') {
        toast.error('Você não tem permissão para acessar esta página');
        router.push('/login');
        return;
      }

      // Carregar restaurantes
      fetchRestaurants();
    };

    checkAuth();
  }, [router]);

  useEffect(() => {
    if (searchTerm) {
      const filtered = restaurants.filter(
        restaurant => 
          restaurant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          restaurant.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
          restaurant.phone.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredRestaurants(filtered);
    } else {
      setFilteredRestaurants(restaurants);
    }
  }, [searchTerm, restaurants]);

  const fetchRestaurants = async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .order('name');

      if (error) {
        throw error;
      }

      setRestaurants(data || []);
      setFilteredRestaurants(data || []);
    } catch (error: any) {
      toast.error(`Erro ao carregar restaurantes: ${error.message}`);
      console.error('Erro ao carregar restaurantes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRestaurant = async (id: string) => {
    // Verificar se existem usuários vinculados a este restaurante
    const supabase = createClient();
    const { data: usersInRestaurant, error: usersError } = await supabase
      .from('users')
      .select('id')
      .eq('restaurant_id', id);

    if (usersError) {
      toast.error(`Erro ao verificar usuários: ${usersError.message}`);
      return;
    }

    if (usersInRestaurant && usersInRestaurant.length > 0) {
      toast.error(`Este restaurante possui ${usersInRestaurant.length} usuários vinculados. Remova-os primeiro.`);
      return;
    }

    // Confirmar exclusão
    if (confirm('Tem certeza que deseja excluir este restaurante? Esta ação não pode ser desfeita.')) {
      try {
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
        toast.error(`Erro ao excluir restaurante: ${error.message}`);
        console.error('Erro ao excluir restaurante:', error);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Toaster position="top-right" />
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Gerenciar Restaurantes</h1>
        <Link href="/super-admin/restaurants/new">
          <button className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Novo Restaurante
          </button>
        </Link>
      </div>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Buscar restaurantes..."
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {filteredRestaurants.length === 0 ? (
        <div className="bg-white shadow-md rounded-md p-6 text-center">
          <p className="text-gray-500">
            {searchTerm ? 'Nenhum restaurante encontrado com esses termos de busca.' : 'Nenhum restaurante cadastrado.'}
          </p>
        </div>
      ) : (
        <div className="bg-white shadow-md rounded-md overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Endereço</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Telefone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data de Criação</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRestaurants.map((restaurant) => (
                <tr key={restaurant.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{restaurant.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{restaurant.address}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{restaurant.phone}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(restaurant.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <Link href={`/super-admin/restaurants/${restaurant.id}/edit`}>
                        <button className="text-blue-600 hover:text-blue-900">
                          Editar
                        </button>
                      </Link>
                      <button
                        onClick={() => handleDeleteRestaurant(restaurant.id)}
                        className="text-red-600 hover:text-red-900 ml-4"
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
} 