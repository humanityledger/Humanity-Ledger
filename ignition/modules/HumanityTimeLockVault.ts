// ignition/modules/HumanityTimeLockVault.ts
//
// Script de despliegue Hardhat Ignition para HumanityTimeLockVault.sol.
//
// IMPORTANTE: Este módulo solo se ejecuta por Stefan en testnet.
// Nunca por un agente automatizado.
//
// Constructor de HumanityTimeLockVault: constructor() Ownable(msg.sender) {}
// → Sin parámetros. El owner es el deployer automáticamente.
//
// Uso:
//   npx hardhat ignition deploy ignition/modules/HumanityTimeLockVault.ts \
//     --network <red> \
//     [--deployment-id humanity-timelockVault-<fecha>]
//
// La primera vez que se despliega en testnet, registrar la dirección resultante en:
//   deployments/aztec-testnet.json  (o deployments/l1-testnet.json)
//   docs/MAINNET_READINESS.md → solo cuando Stefan lo apruebe.
//
// Referencia: docs/l1/AUDIT_READY.md § 3 — Hardhat Ignition scripts.
// Creado: 15 noviembre 2026 por Antigravity (Fase 3).

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * HumanityTimeLockVaultModule
 *
 * Despliega HumanityTimeLockVault. El contrato no tiene parámetros de
 * constructor: el deployer (msg.sender) se convierte en owner automáticamente
 * mediante Ownable(msg.sender).
 *
 * Después del despliegue, el owner debe llamar a setupVault(timeoutSeconds, backupWallet)
 * para configurar su vault individual. Esto NO se hace en el script de despliegue
 * porque los parámetros de cada usuario son distintos.
 */
const HumanityTimeLockVaultModule = buildModule(
  "HumanityTimeLockVaultModule",
  (m) => {
    // HumanityTimeLockVault no tiene parámetros de constructor.
    // El owner es el deployer (msg.sender → Ownable).
    const vault = m.contract("HumanityTimeLockVault", []);

    return { vault };
  }
);

export default HumanityTimeLockVaultModule;
