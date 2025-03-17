'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Restaurant } from '@/types';
import toast, { Toaster } from 'react-hot-toast';
import { useParams } from 'next/navigation';

interface EditRestaurantProps {
  params: {
    id: string;
  };
}

export default function EditRestaurant({ params }: EditRestaurantProps) {
  const router = useRouter();
  const routeParams = useParams<{ id: string }>();
  const id = routeParams.id;
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: ''
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

      // Carregar dados do restaurante
      fetchRestaurant();
    };

    checkAuth();
  }, [router, id]);

  const fetchRestaurant = async () => {
    try {
      const supabase = createClient();
      
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        throw error;
      }

      if (!data) {
        toast.error('Restaurante não encontrado');
        router.push('/super-admin/restaurants');
        return;
      }

      setRestaurant(data);
      setFormData({
        name: data.name,
        address: data.address,
        phone: data.phone
      });
      setLoading(false);
    } catch (error: any) {
      toast.error(`Erro ao carregar restaurante: ${error.message}`);
      console.error('Erro ao carregar restaurante:', error);
      router.push('/super-admin/restaurants');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
        toast.error('O nome do restaurante é obrigatório');
        setSubmitting(false);
        return;
      }

      if (!formData.address.trim()) {
        toast.error('O endereço é obrigatório');
        setSubmitting(false);
        return;
      }

      if (!formData.phone.trim()) {
        toast.error('O telefone é obrigatório');
        setSubmitting(false);
        return;
      }

      // Atualizar dados
      const supabase = createClient();
      const { data, error } = await supabase
        .from('restaurants')
        .update({
          name: formData.name.trim(),
          address: formData.address.trim(),
          phone: formData.phone.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      toast.success('Restaurante atualizado com sucesso!');
      router.push('/super-admin/restaurants');
    } catch (error: any) {
      toast.error(`Erro ao atualizar restaurante: ${error.message}`);
      console.error('Erro ao atualizar restaurante:', error);
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
        <Link href="/super-admin/restaurants">
          <button className="text-blue-500 hover:text-blue-700 mr-4">
            &larr; Voltar
          </button>
        </Link>
        <h1 className="text-2xl font-bold text-gray-800">Editar Restaurante</h1>
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
              placeholder="Nome do restaurante"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="address">
              Endereço *
            </label>
            <input
              type="text"
              id="address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Endereço completo"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="phone">
              Telefone *
            </label>
            <input
              type="text"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="(00) 00000-0000"
              required
            />
          </div>

          <div className="flex items-center justify-between">
            <button
              type="submit"
              disabled={submitting}
              className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {submitting ? 'Salvando...' : 'Atualizar Restaurante'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 