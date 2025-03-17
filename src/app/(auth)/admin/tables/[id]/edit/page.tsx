'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User, Table } from '@/types';
import { useRouter, useParams } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import Link from 'next/link';

interface EditTablePageProps {
  params: {
    id: string;
  };
}

export default function EditTable({ params }: EditTablePageProps) {
  const router = useRouter();
  const routeParams = useParams<{ id: string }>();
  const id = routeParams.id;
  
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    number: '',
    capacity: '',
    status: ''
  });
  const [originalTable, setOriginalTable] = useState<Table | null>(null);

  useEffect(() => {
    const fetchTableData = async () => {
      try {
        setLoading(true);
        const supabase = createClient();
        
        // Verificar autenticação
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          router.push('/login');
          return;
        }

        // Obter perfil e verificar se é admin
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single();

        if (!profile || profile.role !== 'admin') {
          toast.error('Você não tem permissão para acessar esta página');
          router.push('/login');
          return;
        }

        setUser(profile as User);

        // Primeiro buscar a mesa para verificar se existe
        const { data: table, error: tableError } = await supabase
          .from('tables')
          .select('*')
          .eq('id', id)
          .single();

        if (tableError) {
          console.error('Erro ao buscar mesa:', tableError);
          toast.error('Erro ao buscar mesa: ' + tableError.message);
          setLoading(false);
          return;
        }

        // Verificar se a mesa pertence ao restaurante do usuário
        if (table.restaurant_id !== user?.restaurant_id && 
            table.restaurantId !== user?.restaurantId) {
          toast.error('Você não tem permissão para editar esta mesa');
          router.push('/admin/tables');
          setLoading(false);
          return;
        }

        setOriginalTable(table as Table);
        setFormData({
          number: table.number.toString(),
          capacity: table.capacity.toString(),
          status: table.status
        });
      } catch (error: any) {
        console.error('Erro ao carregar mesa:', error);
        toast.error('Erro ao carregar dados: ' + error.message);
        router.push('/admin/tables');
      } finally {
        setLoading(false);
      }
    };

    fetchTableData();
  }, [id, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formSubmitting) return;
    
    // Validação básica
    if (!formData.number.trim() || isNaN(parseInt(formData.number))) {
      toast.error('O número da mesa deve ser um valor numérico válido');
      return;
    }
    
    if (!formData.capacity || isNaN(parseInt(formData.capacity)) || parseInt(formData.capacity) <= 0) {
      toast.error('A capacidade deve ser um valor numérico maior que zero');
      return;
    }
    
    try {
      setFormSubmitting(true);
      const supabase = createClient();
      
      // Verificar se já existe outra mesa com o mesmo número (excluindo a mesa atual)
      if (parseInt(formData.number) !== originalTable?.number) {
        const restaurantId = user?.restaurant_id || user?.restaurantId;
        
        let existingTable = null;
        
        // Tentar com restaurant_id
        try {
          const { data: existingData, error } = await supabase
            .from('tables')
            .select('id')
            .eq('number', parseInt(formData.number))
            .eq('restaurant_id', restaurantId)
            .neq('id', id)
            .single();
            
          if (!error) {
            existingTable = existingData;
          } else {
            // Se falhar, tentar com restaurantId
            console.log('Verificando existência com restaurantId (camelCase)');
            const { data: altData, error: altError } = await supabase
              .from('tables')
              .select('id')
              .eq('number', parseInt(formData.number))
              .eq('restaurantId', restaurantId)
              .neq('id', id)
              .single();
              
            if (!altError) {
              existingTable = altData;
            }
          }
        } catch (e) {
          console.error('Erro ao verificar mesas existentes:', e);
        }

        if (existingTable) {
          toast.error('Já existe outra mesa com este número');
          setFormSubmitting(false);
          return;
        }
      }
      
      // Atualizar a mesa
      const { error } = await supabase
        .from('tables')
        .update({
          number: parseInt(formData.number),
          capacity: parseInt(formData.capacity),
          status: formData.status
        })
        .eq('id', id);

      if (error) {
        console.error('Erro ao atualizar mesa:', error);
        console.error('Detalhes do erro:', JSON.stringify(error));
        throw error;
      }

      toast.success('Mesa atualizada com sucesso!');
      
      // Redirecionar para a lista de mesas
      setTimeout(() => {
        router.push('/admin/tables');
      }, 1500);
    } catch (error: any) {
      console.error('Erro ao atualizar mesa:', error);
      toast.error('Erro ao atualizar mesa: ' + error.message);
    } finally {
      setFormSubmitting(false);
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
    <div>
      <Toaster position="top-right" />
      
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Editar Mesa #{formData.number}</h1>
        <p className="text-gray-600">Atualize as informações da mesa</p>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="number" className="block text-sm font-medium text-gray-700">
                Número da Mesa *
              </label>
              <div className="mt-1">
                <input
                  type="number"
                  name="number"
                  id="number"
                  required
                  min="1"
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={formData.number}
                  onChange={handleChange}
                />
              </div>
              <p className="mt-2 text-sm text-gray-500">Número identificador da mesa no restaurante</p>
            </div>

            <div>
              <label htmlFor="capacity" className="block text-sm font-medium text-gray-700">
                Capacidade *
              </label>
              <div className="mt-1">
                <input
                  type="number"
                  name="capacity"
                  id="capacity"
                  required
                  min="1"
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={formData.capacity}
                  onChange={handleChange}
                />
              </div>
              <p className="mt-2 text-sm text-gray-500">Quantidade máxima de pessoas que a mesa comporta</p>
            </div>

            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                Status *
              </label>
              <div className="mt-1">
                <select
                  name="status"
                  id="status"
                  required
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={formData.status}
                  onChange={handleChange}
                  disabled={formData.status === 'occupied'}
                >
                  <option value="available">Disponível</option>
                  <option value="reserved">Reservada</option>
                  <option value="occupied">Ocupada</option>
                </select>
              </div>
              {formData.status === 'occupied' && (
                <p className="mt-2 text-sm text-red-500">
                  Uma mesa ocupada não pode ter seu status alterado diretamente. É necessário fechar a comanda primeiro.
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <Link
              href="/admin/tables"
              className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={formSubmitting}
              className="bg-blue-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {formSubmitting ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 