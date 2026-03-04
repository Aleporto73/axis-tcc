import { testConnection } from './database/db';

async function main() {
  console.log('🚀 Testando AXIS TCC Backend...\n');
  await testConnection();
  process.exit(0);
}

main();
