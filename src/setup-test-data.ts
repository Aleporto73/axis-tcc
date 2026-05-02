import pool from './database/db';

async function setupTestData() {
  console.log('🔧 Configurando dados de teste...\n');
  
  const tenantId = '123e4567-e89b-12d3-a456-426614174000';
  const patientId = '789e4567-e89b-12d3-a456-426614174000';
  
  try {
    // Criar tenant de teste
    await pool.query(`
      INSERT INTO tenants (id, name, plan)
      VALUES ($1, 'Clínica Teste', 'standard')
      ON CONFLICT (id) DO NOTHING
    `, [tenantId]);
    console.log('✅ Tenant criado');
    
    // Criar patient de teste
    await pool.query(`
      INSERT INTO patients (id, tenant_id, external_ref, treatment_phase)
      VALUES ($1, $2, 'PACIENTE-001', 'avaliacao')
      ON CONFLICT (id) DO NOTHING
    `, [patientId, tenantId]);
    console.log('✅ Paciente criado');
    
    console.log('\n🎉 Dados de teste prontos!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao criar dados:', error);
    process.exit(1);
  }
}

setupTestData();
