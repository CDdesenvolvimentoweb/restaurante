'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User, Command, Product } from '@/types';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import Link from 'next/link';

// Interfaces adicionais para os relatórios
interface SalesData {
  date: string;
  total: number;
  commandsCount: number;
}

interface ProductSalesData {
  product: Product;
  quantity: number;
  total: number;
}

interface StaffPerformance {
  id: string;
  name: string;
  commandsCount: number;
  total: number;
}

interface CommandItem {
  id: string;
  command_id: string;
  product_id: string;
  product: Product;
  quantity: number;
  price: number;
  notes?: string;
}

export default function Reports() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('week');
  
  // Dados dos relatórios
  const [totalSales, setTotalSales] = useState(0);
  const [totalCommands, setTotalCommands] = useState(0);
  const [averageTicket, setAverageTicket] = useState(0);
  const [dailySales, setDailySales] = useState<SalesData[]>([]);
  const [topProducts, setTopProducts] = useState<ProductSalesData[]>([]);
  const [staffPerformance, setStaffPerformance] = useState<StaffPerformance[]>([]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
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
        
        // Carregar dados do relatório
        await fetchReportData(profile.restaurant_id || profile.restaurantId);
      } catch (error: any) {
        console.error('Erro ao verificar autenticação:', error);
        toast.error(`Erro ao carregar página: ${error.message || 'Verifique o console para mais detalhes'}`);
      }
    };

    checkAuth();
  }, [router]);

  // Efeito para recarregar dados quando o período mudar
  useEffect(() => {
    if (user && (user.restaurant_id || user.restaurantId)) {
      fetchReportData(user.restaurant_id || user.restaurantId as string);
    }
  }, [dateRange, user]);

  const fetchReportData = async (restaurantId: string) => {
    try {
      setLoading(true);
      const supabase = createClient();
      
      // Calcular período de datas conforme seleção
      const endDate = new Date();
      let startDate = new Date();
      
      switch(dateRange) {
        case 'today':
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(startDate.getMonth() - 1);
          break;
      }
      
      const startDateStr = startDate.toISOString();
      const endDateStr = endDate.toISOString();

      console.log('Consultando comandas de', startDateStr, 'até', endDateStr, 'para restaurante', restaurantId);

      // Verificar se o restaurante existe
      const { data: restaurant, error: restaurantError } = await supabase
        .from('restaurants')
        .select('id, name')
        .eq('id', restaurantId)
        .single();

      if (restaurantError) {
        console.error('Erro ao verificar restaurante:', restaurantError);
        throw new Error(`Restaurante não encontrado: ${restaurantError.message}`);
      }

      // Verificar se a tabela de comandas existe e sua estrutura
      let { data: commandsCheck, error: commandsCheckError } = await supabase
        .from('commands')
        .select('*')
        .limit(1);

      if (commandsCheckError) {
        console.error('Erro ao verificar tabela de comandas:', commandsCheckError);
        throw new Error(`Erro ao acessar tabela de comandas: ${commandsCheckError.message}`);
      }

      // Verificar quais colunas existem na tabela commands
      console.log('Estrutura da comanda:', Object.keys(commandsCheck?.[0] || {}));
      
      // Determinar o nome da coluna para o restaurante
      let restaurantColumnName = null;
      if (commandsCheck && commandsCheck.length > 0) {
        const columns = Object.keys(commandsCheck[0]);
        if (columns.includes('restaurant_id')) {
          restaurantColumnName = 'restaurant_id';
        } else if (columns.includes('restaurantId')) {
          restaurantColumnName = 'restaurantId';
        } else if (columns.includes('restaurant')) {
          restaurantColumnName = 'restaurant';
        }
      }
      
      if (!restaurantColumnName) {
        console.warn('Não foi possível determinar o nome da coluna do restaurante, tentando queries alternativas');
      } else {
        console.log(`Coluna do restaurante encontrada: ${restaurantColumnName}`);
      }
      
      // Determinar o nome da coluna para data de fechamento
      let closedAtColumnName = null;
      if (commandsCheck && commandsCheck.length > 0) {
        const columns = Object.keys(commandsCheck[0]);
        if (columns.includes('closed_at')) {
          closedAtColumnName = 'closed_at';
        } else if (columns.includes('closedAt')) {
          closedAtColumnName = 'closedAt';
        } else if (columns.includes('fechado_em')) {
          closedAtColumnName = 'fechado_em';
        }
      }
      
      if (!closedAtColumnName) {
        console.warn('Não foi possível determinar o nome da coluna de data de fechamento, omitindo filtro de data');
      } else {
        console.log(`Coluna de data de fechamento encontrada: ${closedAtColumnName}`);
      }

      // 1. Buscar comandas fechadas no período
      let commandsQuery = supabase
        .from('commands')
        .select(`
          *,
          items:command_products(
            *,
            product:product_id(
              id,
              name,
              price,
              category
            )
          ),
          user:user_id(
            id,
            name
          )
        `)
        .eq('status', 'closed');

      // Adicionar filtros de data se a coluna foi encontrada
      if (closedAtColumnName) {
        commandsQuery = commandsQuery
          .gte(closedAtColumnName, startDateStr)
          .lte(closedAtColumnName, endDateStr);
      }

      // Tentar diferentes abordagens para encontrar as comandas do restaurante
      let commands = null;
      let commandsError = null;
      
      if (restaurantColumnName) {
        // Se encontramos a coluna, tentamos usar diretamente
        const result = await commandsQuery.eq(restaurantColumnName, restaurantId);
        commands = result.data;
        commandsError = result.error;
        
        if (commandsError) {
          console.error(`Erro ao buscar comandas usando ${restaurantColumnName}:`, commandsError);
        }
      }
      
      // Se não encontrou a coluna ou deu erro, tenta outras abordagens
      if (!commands) {
        // Tenta obter todas as comandas e filtrar no cliente
        console.log('Tentando obter todas as comandas sem filtro de restaurante');
        const result = await commandsQuery;
        const allCommands = result.data;
        commandsError = result.error;
        
        if (!commandsError && allCommands) {
          // Vamos procurar alguma relação com o restaurante nas comandas
          commands = allCommands.filter(cmd => {
            // Tenta diferentes propriedades possíveis
            return (
              (cmd.restaurant_id && cmd.restaurant_id === restaurantId) ||
              (cmd.restaurantId && cmd.restaurantId === restaurantId) ||
              // Talvez esteja em uma tabela relacionada
              (cmd.table && cmd.table.restaurant_id === restaurantId) ||
              (cmd.table && cmd.table.restaurantId === restaurantId)
            );
          });
          
          console.log(`Filtradas ${commands.length} comandas do restaurante de um total de ${allCommands.length}`);
        }
      }

      if (commandsError && (!commands || commands.length === 0)) {
        console.error('Erro ao buscar comandas:', commandsError);
        throw new Error(`Erro ao buscar comandas: ${commandsError.message || 'Erro desconhecido na consulta'}`);
      }
      
      // Tratamento para caso não tenha comandas ou não tenha dado erro mas também não encontrou comandas
      commands = commands || [];
      console.log(`Encontradas ${commands.length} comandas para análise`);

      // 2. Calcular métricas de vendas
      const total = commands.reduce((sum, cmd) => sum + cmd.total, 0);
      const count = commands.length;
      const average = count > 0 ? total / count : 0;
      
      setTotalSales(total);
      setTotalCommands(count);
      setAverageTicket(average);

      // 3. Agrupar vendas por dia
      const salesByDay = new Map<string, {total: number, count: number}>();
      
      commands.forEach(cmd => {
        // Determinar qual campo usar para data de fechamento
        let closedDate = null;
        if (cmd.closed_at) {
          closedDate = cmd.closed_at;
        } else if (cmd.closedAt) {
          closedDate = cmd.closedAt;
        } else if (cmd.fechado_em) {
          closedDate = cmd.fechado_em;
        }
        
        if (!closedDate) {
          console.log('Comanda sem data de fechamento:', cmd.id);
          return;
        }
        
        const date = new Date(closedDate).toISOString().split('T')[0];
        const current = salesByDay.get(date) || { total: 0, count: 0 };
        
        salesByDay.set(date, {
          total: current.total + cmd.total,
          count: current.count + 1
        });
      });
      
      const dailySalesData: SalesData[] = Array.from(salesByDay).map(([date, data]) => ({
        date,
        total: data.total,
        commandsCount: data.count
      })).sort((a, b) => a.date.localeCompare(b.date));
      
      setDailySales(dailySalesData);

      // 4. Verificar se a tabela de produtos da comanda existe
      const { error: productItemsCheckError } = await supabase
        .from('command_products')
        .select('id')
        .limit(1);
      
      if (productItemsCheckError) {
        console.error('Erro ao verificar tabela de itens da comanda:', productItemsCheckError);
        // Continue mesmo com erro, só não teremos os dados de produtos
        setTopProducts([]);
      } else {
        // Calcular produtos mais vendidos
        const productSales = new Map<string, {product: Product, quantity: number, total: number}>();
        
        commands.forEach(cmd => {
          // Verificar se items existe e é um array
          const items = cmd.items || cmd.command_products || [];
          if (!Array.isArray(items) || items.length === 0) {
            console.log('Comanda sem itens válidos:', cmd.id);
            return;
          }
          
          items.forEach((item: any) => {
            // O produto pode estar em diferentes propriedades
            const product = item.product || item.produto;
            if (!product) {
              console.log('Item sem produto:', item.id);
              return;
            }
            
            const productId = product.id;
            const quantity = item.quantity || item.quantidade || 0;
            const price = item.price || item.preco || 0;
            
            const current = productSales.get(productId) || {
              product,
              quantity: 0,
              total: 0
            };
            
            productSales.set(productId, {
              product,
              quantity: current.quantity + quantity,
              total: current.total + (price * quantity)
            });
          });
        });
        
        const topProductsData = Array.from(productSales.values())
          .sort((a, b) => b.total - a.total)
          .slice(0, 5);
        
        setTopProducts(topProductsData);
      }

      // 5. Calcular desempenho dos garçons
      const staffData = new Map<string, {id: string, name: string, commandsCount: number, total: number}>();
      
      commands.forEach(cmd => {
        // O usuário pode estar em diferentes propriedades
        const cmdUser = cmd.user || cmd.usuario || cmd.garcom;
        if (!cmdUser) {
          console.log('Comanda sem usuário associado:', cmd.id);
          return;
        }
        
        const userId = cmdUser.id;
        const userName = cmdUser.name || cmdUser.nome || userId;
        
        const current = staffData.get(userId) || {
          id: userId,
          name: userName,
          commandsCount: 0,
          total: 0
        };
        
        staffData.set(userId, {
          ...current,
          commandsCount: current.commandsCount + 1,
          total: current.total + cmd.total
        });
      });
      
      const staffPerformanceData = Array.from(staffData.values())
        .sort((a, b) => b.total - a.total);
      
      setStaffPerformance(staffPerformanceData);
      console.log('Relatório gerado com sucesso');
      
    } catch (error: any) {
      console.error('Erro ao carregar dados do relatório:', error);
      let errorMessage = 'Erro desconhecido';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        errorMessage = JSON.stringify(error);
      }
      
      toast.error(`Erro ao carregar relatório: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  // Formatar valores monetários
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Formatar data
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  return (
    <div>
      <Toaster position="top-right" />
      
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Relatórios</h1>
          <p className="text-gray-600">Acompanhe o desempenho do seu restaurante</p>
        </div>
        
        <div className="flex space-x-2">
          <button 
            onClick={() => setDateRange('today')}
            className={`px-4 py-2 rounded-md ${dateRange === 'today' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
          >
            Hoje
          </button>
          <button 
            onClick={() => setDateRange('week')}
            className={`px-4 py-2 rounded-md ${dateRange === 'week' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
          >
            Última Semana
          </button>
          <button 
            onClick={() => setDateRange('month')}
            className={`px-4 py-2 rounded-md ${dateRange === 'month' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
          >
            Último Mês
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-500">Carregando relatórios...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Resumo de métricas */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-blue-500 rounded-md p-3">
                    <svg className="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total de Vendas</dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900">{formatCurrency(totalSales)}</div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
                    <svg className="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Comandas Fechadas</dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900">{totalCommands}</div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-purple-500 rounded-md p-3">
                    <svg className="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Ticket Médio</dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900">{formatCurrency(averageTicket)}</div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Vendas diárias */}
          <div className="bg-white shadow sm:rounded-lg overflow-hidden">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Vendas por Dia</h3>
            </div>
            <div className="border-t border-gray-200">
              {dailySales.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-gray-500">Sem dados de vendas no período selecionado</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Data
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Comandas
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {dailySales.map((day, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {formatDate(day.date)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {day.commandsCount}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(day.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Produtos mais vendidos e Desempenho dos garçons */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Produtos mais vendidos */}
            <div className="bg-white shadow sm:rounded-lg overflow-hidden">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Produtos Mais Vendidos</h3>
              </div>
              <div className="border-t border-gray-200">
                {topProducts.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-gray-500">Sem dados de produtos no período selecionado</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Produto
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Quantidade
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {topProducts.map((product, index) => (
                          <tr key={index}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {product.product.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {product.quantity}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatCurrency(product.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Desempenho dos garçons */}
            <div className="bg-white shadow sm:rounded-lg overflow-hidden">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Desempenho dos Garçons</h3>
              </div>
              <div className="border-t border-gray-200">
                {staffPerformance.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-gray-500">Sem dados de desempenho no período selecionado</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Funcionário
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Comandas
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Total
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Média
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {staffPerformance.map((staff, index) => (
                          <tr key={index}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {staff.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {staff.commandsCount}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatCurrency(staff.total)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatCurrency(staff.commandsCount > 0 ? staff.total / staff.commandsCount : 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 