// ignition/modules/LedgerDeadmanSwitch.ts
//
// Script de despliegue Hardhat Ignition para LedgerDeadmanSwitch.sol.
//
// IMPORTANTE: Este módulo solo se ejecuta por Stefan en testnet.
// Nunca por un agente automatizado.
//
// Constructor de LedgerDeadmanSwitch:
//   constructor(address _initialOwner, address _backupWallet, uint256 _timeoutDays)
//   → _timeoutDays mínimo: 90 (MIN_TIMEOUT = 90 days)
//   → _backupWallet no puede ser _initialOwner ni address(0)
//
// Uso:
//   npx hardhat ignition deploy ignition/modules/LedgerDeadmanSwitch.ts \
//     --network <red> \
//     --parameters '{"LedgerDeadmanSwitchModule": {"initialOwner": "0x...", "backupWallet": "0x...", "timeoutDays": 90}}'
//
// La primera vez que se despliega en testnet, registrar la dirección resultante en:
//   deployments/l1-testnet.json
//   docs/MAINNET_READINESS.md → solo cuando Stefan lo apruebe.
//
// Referencia: docs/l1/AUDIT_READY.md § 3 — Hardhat Ignition scripts.
// Creado: 15 noviembre 2026 por Antigravity (Fase 3).

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * LedgerDeadmanSwitchModule
 *
 * Despliega LedgerDeadmanSwitch con los tres parámetros obligatorios de su
 * constructor. Los valores se pasan como parámetros de Ignition (no hardcodeados)
 * para que el auditor pueda reproducir cualquier despliegue con los parámetros
 * exactos registrados en el deployment log.
 *
 * Parámetros:
 *   initialOwner  — La primary wallet del owner (la que hace ping periódico).
 *   backupWallet  — La wallet que recibe todos los assets al dispararse.
 *   timeoutDays   — Días de inactividad antes de que el trigger se desbloquee (mínimo 90).
 */
const LedgerDeadmanSwitchModule = buildModule(
  "LedgerDeadmanSwitchModule",
  (m) => {
    // Parámetros sin valor por defecto: Ignition exige pasarlos explícitamente.
    // Esto previene despliegues accidentales con valores incorrectos.
    const initialOwner = m.getParameter<string>("initialOwner");
    const backupWallet  = m.getParameter<string>("backupWallet");
    const timeoutDays   = m.getParameter<bigint>("timeoutDays");

    const deadmanSwitch = m.contract("LedgerDeadmanSwitch", [
      initialOwner,
      backupWallet,
      timeoutDays,
    ]);

    return { deadmanSwitch };
  }
);

export default LedgerDeadmanSwitchModule;
