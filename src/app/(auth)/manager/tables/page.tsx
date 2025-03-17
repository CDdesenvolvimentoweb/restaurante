'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User, Table } from '@/types';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import Link from 'next/link';

export default function ManagerTables() {
  const router = useRouter();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [submitting, setSubmitting] = useState(false);
  const [restaurant, setRestaurant] = useState<any>(null);

  useEffect(() => {
    const fetchTables = async () => {
      try {
        setLoading(true);
        const supabase = createClient();
        
        // Verificar autenticação
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          router.push('/login');
          return;
        }

        // Obter perfil e verificar se é gerente
        const { data: profile } = await supabase
          .from('users')
          .select('*, restaurant:restaurant_id(*)')
          .eq('id', authUser.id)
          .single();

        if (!profile || profile.role !== 'manager') {
          toast.error('Você não tem permissão para acessar esta página');
          router.push('/login');
          return;
        }

        setRestaurant(profile.restaurant);
        const restaurantId = profile.restaurant_id || profile.restaurantId;

        // Buscar mesas do restaurante
        const { data: tablesData, error: tablesError } = await supabase
          .from('tables')
          .select('*')
          .eq('restaurant_id', restaurantId)
          .order('number', { ascending: true });

        if (tablesError) {
          console.error('Erro ao buscar mesas:', tablesError);
          toast.error(`Erro ao buscar mesas: ${tablesError.message}`);
          return;
        }

        setTables(tablesData || []);
      } catch (error: any) {
        console.error('Erro ao carregar mesas:', error);
        toast.error('Erro ao carregar dados: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTables();
  }, [router]);

  const handleChangeTableStatus = async (table: Table, newStatus: 'available' | 'occupied' | 'reserved') => {
    try {
      setSubmitting(true);
      const supabase = createClient();
      
      const { error } = await supabase
        .from('tables')
        .update({ status: newStatus })
        .eq('id', table.id);
        
      if (error) {
        console.error('Erro ao atualizar status da mesa:', error);
        toast.error(`Erro ao atualizar status: ${error.message}`);
        return;
      }
      
      toast.success(`Mesa ${table.number} alterada para ${getStatusText(newStatus)}`);
      
      // Atualizar lista de mesas localmente
      setTables(tables.map(t => 
        t.id === table.id ? { ...t, status: newStatus } : t
      ));
    } catch (error: any) {
      console.error('Erro ao atualizar mesa:', error);
      toast.error('Erro ao atualizar: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Filtrar mesas baseado nos critérios
  const filteredTables = tables.filter(table => {
    // Filtrar por status
    if (filterStatus !== 'all' && table.status !== filterStatus) {
      return false;
    }
    
    // Filtrar por termo de busca (número da mesa)
    if (searchTerm.trim()) {
      return table.number.toString().includes(searchTerm);
    }
    
    return true;
  });

  const getStatusText = (status: string) => {
    switch (status) {
      case 'available':
        return 'Disponível';
      case 'occupied':
        return 'Ocupada';
      case 'reserved':
        return 'Reservada';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-800';
      case 'occupied':
        return 'bg-red-100 text-red-800';
      case 'reserved':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div>
      <Toaster position="top-right" />
      
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Gerenciamento de Mesas</h1>
        <div>
          <Link 
            href="/manager" 
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-sm hover:bg-gray-300"
          >
            Voltar para Dashboard
          </Link>
        </div>
      </div>
      
      {/* Filtros */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow space-y-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
            <div>
              <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                id="status-filter"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                <option value="all">Todos</option>
                <option value="available">Disponíveis</option>
                <option value="occupied">Ocupadas</option>
                <option value="reserved">Reservadas</option>
              </select>
            </div>
            <div>
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">Buscar mesa</label>
              <input
                id="search"
                type="text"
                placeholder="Número da mesa"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : filteredTables.length === 0 ? (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg p-6 text-center">
          <p className="text-gray-500">Nenhuma mesa encontrada.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredTables.map(table => (
            <div 
              key={table.id}
              className="bg-white rounded-lg shadow p-4 border-t-4"
              style={{ 
                borderTopColor: 
                  table.status === 'available' ? '#10B981' : 
                  table.status === 'occupied' ? '#EF4444' : 
                  '#3B82F6' 
              }}
            >
              <div className="flex justify-between items-start">
                <h3 className="text-lg font-semibold">Mesa {table.number}</h3>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(table.status)}`}>
                  {getStatusText(table.status)}
                </span>
              </div>
              <p className="text-sm text-gray-600 my-2">
                Capacidade: {table.capacity} pessoas
              </p>
              <div className="mt-3 space-y-2">
                {table.status !== 'available' && (
                  <button
                    onClick={() => handleChangeTableStatus(table, 'available')}
                    disabled={submitting}
                    className="w-full text-sm py-1 px-2 bg-green-100 text-green-800 rounded hover:bg-green-200 text-center"
                  >
                    Marcar como Disponível
                  </button>
                )}
                {table.status !== 'occupied' && (
                  <button
                    onClick={() => handleChangeTableStatus(table, 'occupied')}
                    disabled={submitting}
                    className="w-full text-sm py-1 px-2 bg-red-100 text-red-800 rounded hover:bg-red-200 text-center"
                  >
                    Marcar como Ocupada
                  </button>
                )}
                {table.status !== 'reserved' && (
                  <button
                    onClick={() => handleChangeTableStatus(table, 'reserved')}
                    disabled={submitting}
                    className="w-full text-sm py-1 px-2 bg-blue-100 text-blue-800 rounded hover:bg-blue-200 text-center"
                  >
                    Marcar como Reservada
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 