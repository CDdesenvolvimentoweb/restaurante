'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { User, Restaurant } from '@/types';
import toast, { Toaster } from 'react-hot-toast';
import { useParams } from 'next/navigation';

interface EditUserProps {
  params: {
    id: string;
  };
}

export default function EditUser({ params }: EditUserProps) {
  const router = useRouter();
  const routeParams = useParams<{ id: string }>();
  const id = routeParams.id;
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [userData, setUserData] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: '',
    restaurant_id: '',
    status: ''
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

      // Carregar restaurantes e usuário
      await fetchRestaurants();
      await fetchUser();
    };

    checkAuth();
  }, [router, id]);

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
    } catch (error: any) {
      toast.error(`Erro ao carregar restaurantes: ${error.message}`);
      console.error('Erro ao carregar restaurantes:', error);
    }
  };

  const fetchUser = async () => {
    try {
      const supabase = createClient();
      
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          restaurant:restaurant_id (
            id,
            name
          )
        `)
        .eq('id', id)
        .single();

      if (error) {
        throw error;
      }

      if (!data) {
        toast.error('Usuário não encontrado');
        router.push('/super-admin/users');
        return;
      }

      setUserData(data);
      setFormData({
        name: data.name,
        email: data.email,
        role: data.role,
        restaurant_id: data.restaurant_id || '',
        status: data.status || 'active'
      });
      setLoading(false);
    } catch (error: any) {
      toast.error(`Erro ao carregar usuário: ${error.message}`);
      console.error('Erro ao carregar usuário:', error);
      router.push('/super-admin/users');
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

      // Email não pode ser alterado no Supabase Auth
      // Se não for super_admin, restaurante é obrigatório
      if (formData.role !== 'super_admin' && !formData.restaurant_id) {
        toast.error('Selecione um restaurante');
        setSubmitting(false);
        return;
      }

      const supabase = createClient();

      // Atualizar perfil no banco de dados
      const updateData = {
        name: formData.name.trim(),
        role: formData.role,
        restaurant_id: formData.role === 'super_admin' ? null : formData.restaurant_id,
        status: formData.status,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', id);

      if (error) {
        throw error;
      }

      toast.success('Usuário atualizado com sucesso!');
      router.push('/super-admin/users');
    } catch (error: any) {
      toast.error(`Erro ao atualizar usuário: ${error.message}`);
      console.error('Erro ao atualizar usuário:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!userData?.email) {
      toast.error('Email do usuário não disponível');
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(userData.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        throw error;
      }

      toast.success('Email de redefinição de senha enviado');
    } catch (error: any) {
      toast.error(`Erro ao enviar email de redefinição: ${error.message}`);
      console.error('Erro ao resetar senha:', error);
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
        <h1 className="text-2xl font-bold text-gray-800">Editar Usuário</h1>
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
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
              disabled
            />
            <p className="text-xs text-gray-500 mt-1">O email não pode ser alterado.</p>
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

          <div className="flex items-center justify-between mb-4">
            <button
              type="submit"
              disabled={submitting}
              className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {submitting ? 'Salvando...' : 'Atualizar Usuário'}
            </button>
          </div>
        </form>

        <div className="pt-4 border-t border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Redefinir Senha</h3>
          <p className="mb-4 text-sm text-gray-600">
            Enviar um email para o usuário redefinir sua senha.
          </p>
          <button 
            onClick={handleResetPassword}
            className="bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Enviar Link de Redefinição
          </button>
        </div>
      </div>
    </div>
  );
} 