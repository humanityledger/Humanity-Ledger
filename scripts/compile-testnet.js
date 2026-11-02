const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🤖 Inicializando compilación Testnet de Aztec (Máxima Capacidad Cuántica)...');

// Project root directory
const projectRoot = path.resolve(__dirname, '../');

// Define contracts to compile
const contracts = [
  'registry-contract',
  'paymaster-contract',
  'account-contract'
];

let hasErrors = false;

for (const contract of contracts) {
  const contractPath = path.join(projectRoot, 'noir-projects', 'contracts', contract);
  
  if (!fs.existsSync(contractPath)) {
    console.error(`❌ Contrato no encontrado: ${contract}`);
    continue;
  }

  console.log(`\n⏳ Compilando ${contract} vía contenedor Docker (aislamiento absoluto)...`);
  
  // Cross-platform Docker spawn
  const dockerArgs = [
    'run',
    '--rm',
    '-v',
    `${contractPath}:/usr/src/project`,
    '-w',
    '/usr/src/project',
    'azteclabs/aztec:5.0.0',
    'compile'
  ];

  const result = spawnSync('docker', dockerArgs, {
    stdio: 'inherit',
    shell: true
  });

  if (result.error || result.status !== 0) {
    console.error(`\n❌ Error al compilar ${contract}.`);
    hasErrors = true;
  } else {
    console.log(`\n✅ ${contract} compilado con éxito para la Testnet.`);
  }
}

if (hasErrors) {
  console.log('\n⚠️ La compilación finalizó con algunos errores. Asegúrate de que Docker Desktop esté en ejecución (Docker daemon activado).');
  process.exit(1);
} else {
  console.log('\n🚀 ¡Todas las secuencias de compilación ZK finalizadas! Infraestructura lista para despliegue en Testnet.');
}
