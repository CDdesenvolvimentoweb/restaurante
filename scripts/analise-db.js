// Script para analisar a estrutura do banco de dados e gerar um relatório
// Rode este script com "node scripts/analise-db.js"

const { createClient } = require('@supabase/supabase-js');

// Configuração do cliente Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Verificar se as variáveis de ambiente estão definidas
if (!supabaseUrl || !supabaseKey) {
  console.error('Erro: As variáveis de ambiente NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY devem estar definidas.');
  console.log('Você pode defini-las temporariamente usando:');
  console.log('NEXT_PUBLIC_SUPABASE_URL=sua_url NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave node scripts/analise-db.js');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function analisarEstruturaBD() {
  console.log('\n======= ANÁLISE DA ESTRUTURA DO BANCO DE DADOS =======\n');
  
  // Lista de tabelas importantes para verificar
  const tabelas = [
    'users',
    'restaurants',
    'tables',
    'commands',
    'command_products',
    'command_items',
    'products',
    'categories'
  ];
  
  // Verificar cada tabela
  for (const tabela of tabelas) {
    try {
      console.log(`\n----- Analisando tabela: ${tabela} -----`);
      
      // Tentar selecionar um registro
      const { data, error } = await supabase
        .from(tabela)
        .select('*')
        .limit(1);
      
      if (error) {
        console.log(`A tabela ${tabela} não existe ou ocorreu um erro: ${error.message}`);
        continue;
      }
      
      if (!data || data.length === 0) {
        console.log(`A tabela ${tabela} existe, mas não contém dados.`);
        // Tentar obter apenas a estrutura
        try {
          const { error: structError } = await supabase
            .from(tabela)
            .select()
            .limit(0);
          
          if (structError) {
            console.log(`Erro ao verificar estrutura: ${structError.message}`);
          } else {
            console.log(`A tabela ${tabela} existe, mas está vazia.`);
          }
        } catch (e) {
          console.log(`Erro ao verificar estrutura vazia: ${e.message}`);
        }
      } else {
        // Exibir um exemplo de registro e sua estrutura
        const colunas = Object.keys(data[0]);
        console.log(`Colunas encontradas (${colunas.length}): ${colunas.join(', ')}`);
        
        // Analisar o padrão de nomenclatura (snake_case vs. camelCase)
        const snakeCaseCount = colunas.filter(col => col.includes('_')).length;
        const camelCaseCount = colunas.filter(col => /[a-z][A-Z]/.test(col)).length;
        
        console.log(`Padrão de nomenclatura: ${snakeCaseCount > camelCaseCount ? 'snake_case predominante' : 'camelCase predominante'}`);
        
        // Mostrar relacionamentos potenciais
        const foreignKeys = colunas.filter(col => 
          col.endsWith('_id') || 
          col.endsWith('Id') ||
          col === 'id' && (col.startsWith('user') || col.startsWith('product') || col.startsWith('restaurant') || col.startsWith('table'))
        );
        
        if (foreignKeys.length > 0) {
          console.log(`Possíveis chaves estrangeiras: ${foreignKeys.join(', ')}`);
        }
      }
    } catch (error) {
      console.log(`Erro ao analisar tabela ${tabela}: ${error.message}`);
    }
  }
  
  console.log('\n======= CONCLUSÃO DA ANÁLISE =======\n');
  console.log('O relatório acima mostra a estrutura das tabelas principais do banco de dados.');
  console.log('Use essas informações para corrigir discrepâncias nas convenções de nomenclatura do seu código.');
}

// Executar a análise
analisarEstruturaBD()
  .catch(error => {
    console.error(`Erro geral: ${error.message}`);
  })
  .finally(() => {
    console.log('\nAnálise concluída.');
  }); 