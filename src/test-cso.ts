import { processEvent } from './engines/cso';
import { Event } from './types';

async function testCSOEngine() {
  console.log('🧪 Testando CSO Engine...\n');
  
  // Criar um evento de teste: TASK_COMPLETED
  const testEvent: Event = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    tenant_id: '123e4567-e89b-12d3-a456-426614174000',
    patient_id: '789e4567-e89b-12d3-a456-426614174000',
    event_type: 'TASK_COMPLETED',
    payload: {
      task_id: 'task-001',
      completion_quality: 8
    },
    source: 'test',
    related_entity_id: null,
    created_at: new Date()
  };
  
  console.log('📥 Evento de entrada:', {
    type: testEvent.event_type,
    patient_id: testEvent.patient_id
  });
  
  // Processar o evento
  const newCSO = await processEvent(testEvent);
  
  if (newCSO) {
    console.log('\n✅ CSO criado com sucesso!');
    console.log('📊 Estado clínico atualizado:');
    console.log('   - Task Adherence:', newCSO.task_adherence);
    console.log('   - System Confidence:', newCSO.system_confidence);
    console.log('   - Source Event:', newCSO.source_event);
  } else {
    console.log('\n⚠️  Nenhum CSO criado (GATE DE SILÊNCIO aplicado)');
  }
  
  process.exit(0);
}

testCSOEngine();
