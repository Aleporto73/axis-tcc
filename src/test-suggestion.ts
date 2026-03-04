import pool from './database/db';
import { generateSuggestions } from './engines/suggestion';

async function testSuggestionEngine() {
  console.log('🧪 Testando Suggestion Engine...\n');
  
  // Buscar o último CSO criado no banco
  const result = await pool.query(`
    SELECT * FROM clinical_states 
    WHERE patient_id = '789e4567-e89b-12d3-a456-426614174000'
    ORDER BY created_at DESC 
    LIMIT 1
  `);
  
  if (result.rows.length === 0) {
    console.log('❌ Nenhum CSO encontrado. Execute "npm run test:cso" primeiro!');
    process.exit(1);
  }
  
  const cso = result.rows[0];
  
  // Atualizar alguns valores para forçar uma sugestão
  cso.task_adherence = 0.2; // Baixa aderência
  cso.emotional_load = 0.65; // Carga emocional média-alta
  
  console.log('📊 CSO de entrada:', {
    id: cso.id,
    task_adherence: cso.task_adherence,
    emotional_load: cso.emotional_load
  });
  
  // Gerar sugestão
  const suggestion = await generateSuggestions(cso);
  
  if (suggestion) {
    console.log('\n✅ Sugestão gerada com sucesso!');
    console.log('📋 Detalhes da sugestão:');
    console.log('   - ID:', suggestion.id);
    console.log('   - Tipo:', suggestion.type);
    console.log('   - Título:', suggestion.title);
    console.log('   - Motivos:', suggestion.reason);
    console.log('   - Confiança:', suggestion.confidence);
  } else {
    console.log('\n⚠️  Nenhuma sugestão gerada');
  }
  
  process.exit(0);
}

testSuggestionEngine();
