import { BarretenbergBackend } from '@noir-lang/backend_barretenberg';
import { Noir } from '@noir-lang/noir_js';
import { CompiledCircuit } from '@noir-lang/types';

/**
 * TRUE ZERO-KNOWLEDGE PROVER (CLIENT-SIDE)
 * Executes strictly on the local machine (browser WebAssembly).
 * The server never sees the plaintext inputs, only the resulting cryptographic proof.
 */
export class ClientNoirProver {
    private backend: BarretenbergBackend;
    private noir: Noir;

    constructor(circuit: CompiledCircuit) {
        this.backend = new BarretenbergBackend(circuit);
        this.noir = new Noir(circuit, this.backend);
    }

    /**
     * Initializes the WASM prover and performs proving purely client-side.
     * @param inputs The secret plaintext inputs to prove
     */
    async generateProof(inputs: any) {
        try {
            await this.noir.init();
            
            // 1. Generate the witness (execution trace) locally
            const { witness } = await this.noir.execute(inputs);
            
            // 2. Generate the SNARK proof using Barretenberg WASM
            const proofData = await this.backend.generateProof(witness);

            return {
                proof: proofData.proof,
                publicInputs: proofData.publicInputs
            };
        } catch (error) {
            console.error("ZK Proving Failed Client-Side:", error);
            throw error;
        }
    }

    /**
     * Optional local verification before dispatching to sequencer
     */
    async verifyProof(proofData: any) {
        return await this.backend.verifyProof(proofData);
    }
}
