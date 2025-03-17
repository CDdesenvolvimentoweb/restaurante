'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Restaurant } from '@/types';
import toast, { Toaster } from 'react-hot-toast';

export default function NewUser() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'admin',
    restaurant_id: '',
    status: 'active',
    password: ''
  });

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }

      // Verificar se o usuário é super_admin
      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!profile || profile.role !== 'super_admin') {
        toast.error('Você não tem permissão para acessar esta página');
        router.push('/login');
        return;
      }

      // Carregar restaurantes
      fetchRestaurants();
      setLoading(false);
    };

    checkAuth();
  }, [router]);

  const fetchRestaurants = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .order('name');

      if (error) {
        throw error;
      }

      setRestaurants(data || []);
      // Definir o primeiro restaurante como padrão se existir
      if (data && data.length > 0) {
        setFormData(prev => ({ ...prev, restaurant_id: data[0].id }));
      }
    } catch (error: any) {
      toast.error(`Erro ao carregar restaurantes: ${error.message}`);
      console.error('Erro ao carregar restaurantes:', error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Validar dados
      if (!formData.name.trim()) {
        toast.error('Nome é obrigatório');
        setSubmitting(false);
        return;
      }

      if (!formData.email.trim()) {
        toast.error('Email é obrigatório');
        setSubmitting(false);
        return;
      }

      if (!formData.password || formData.password.length < 6) {
        toast.error('Senha deve ter no mínimo 6 caracteres');
        setSubmitting(false);
        return;
      }

      // Se não for super_admin, restaurante é obrigatório
      if (formData.role !== 'super_admin' && !formData.restaurant_id) {
        toast.error('Selecione um restaurante');
        setSubmitting(false);
        return;
      }

      const supabase = createClient();

      // 1. Criar usuário no Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`
        }
      });

      if (authError) {
        throw authError;
      }

      if (!authData.user) {
        throw new Error('Erro ao criar usuário');
      }

      // 2. Inserir dados no perfil
      const userData = {
        id: authData.user.id,
        email: formData.email,
        name: formData.name,
        role: formData.role,
        restaurant_id: formData.role === 'super_admin' ? null : formData.restaurant_id,
        restaurantId: formData.role === 'super_admin' ? null : formData.restaurant_id,
        status: formData.status
      };

      const { error: profileError } = await supabase
        .from('users')
        .insert(userData);

      if (profileError) {
        // Tentar excluir o usuário do Auth se falhar
        await supabase.auth.admin.deleteUser(authData.user.id);
        throw profileError;
      }

      toast.success('Usuário criado com sucesso!');
      router.push('/super-admin/users');
    } catch (error: any) {
      toast.error(`Erro ao criar usuário: ${error.message}`);
      console.error('Erro ao criar usuário:', error);
    } finally {
      setSubmitting(false);
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
      
      <div className="flex items-center mb-6">
        <Link href="/super-admin/users">
          <button className="text-blue-500 hover:text-blue-700 mr-4">
            &larr; Voltar
          </button>
        </Link>
        <h1 className="text-2xl font-bold text-gray-800">Novo Usuário</h1>
      </div>

      <div className="bg-white shadow-md rounded-md p-6">
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="name">
              Nome *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nome completo"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">
              Email *
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="email@exemplo.com"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
              Senha *
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Mínimo 6 caracteres"
              required
              minLength={6}
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="role">
              Papel *
            </label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="super_admin">Super Admin</option>
              <option value="admin">Administrador</option>
              <option value="manager">Gerente</option>
              <option value="waiter">Garçom</option>
            </select>
          </div>

          {formData.role !== 'super_admin' && (
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="restaurant_id">
                Restaurante *
              </label>
              <select
                id="restaurant_id"
                name="restaurant_id"
                value={formData.restaurant_id}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required={formData.role !== 'super_admin'}
              >
                <option value="">Selecione um restaurante</option>
                {restaurants.map(restaurant => (
                  <option key={restaurant.id} value={restaurant.id}>
                    {restaurant.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="status">
              Status *
            </label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
              <option value="pending">Pendente</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <button
              type="submit"
              disabled={submitting}
              className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {submitting ? 'Salvando...' : 'Criar Usuário'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 