# aztec-nr v6.0.0: notas de API para R-08, R-09 y R-10

Resumen de una investigación del 3 de noviembre de 2026 sobre documentación oficial de Aztec (docs v6.0.0, referencia de la API de aztec-nr, notas de versión y de migración). Lo marcado **[sin confirmar]** no se ha comprobado contra el código del tag v6.0.0 y hay que verificarlo en `aztec-labs-eng/aztec-nr@v6.0.0` antes de escribir los contratos. Nada de esto se ha compilado todavía en este repositorio.

## Versiones y dónde vive el código

- Aztec v6.0.0 se publicó el 22 de octubre de 2026 ([notas de aztec-node v6.0.0](https://github.com/aztec-labs-eng/aztec-node/releases/tag/v6.0.0)); trae Noir `1.0.0-rc.3` para contratos.
- aztec-nr se publica desde `aztec-labs-eng/aztec-nr`, no desde aztec-packages. `AztecProtocol/aztec-nr` no tiene tags v6.
- Herramientas: `aztec compile`, `aztec test` (no `nargo test`), `aztec codegen target --outdir artifacts`. Paquetes npm: `@aztec-labs/*@6.0.0`.

```toml
[dependencies]
aztec = { git = "https://github.com/aztec-labs-eng/aztec-nr", tag = "v6.0.0", directory = "aztec" }
```

Mezclar crates de otro repositorio (aztec-node o aztec-packages) mete una segunda copia de `aztec` y falla con `No matching impl found`.

## Piezas que usaremos

| Necesidad | v6 | Nota |
|---|---|---|
| Contrato | `use aztec::macros::aztec; #[aztec] pub contract X { ... }` | |
| Funciones | `#[external("private")]`, `#[external("public")]`, `#[external("utility")]`, `#[internal("private")]`, `#[initializer]`, `#[only_self]`, `#[view]`, `#[authorize_once("from", "authwit_nonce")]` | `self.internal.f(..)` para internas |
| Estado privado por usuario | `Owned<PrivateSet<Nota, Context>, Context>` y `.at(owner)` | El prompt maestro decía `Map<_, PrivateSet>`; en v6 es `Owned` |
| Nota | `#[derive(Eq, Packable)] #[note] pub struct Nota { ... }` | Sin campos `owner` ni `randomness`: los añade la macro |
| Insertar y entregar | `.insert(nota).deliver(MessageDelivery::onchain_constrained())` | `deliver_to` es para eventos, no notas |
| Leer y consumir | `pop_notes(NoteGetterOptions::new().select(..).set_limit(..))` | Máx. 16 notas por llamada |
| Leer sin consumir | `get_notes(..)` + `assert_note_exists`; o `Owned<PrivateImmutable<..>>` | `PrivateMutable::get_note()` anula y recrea |
| Nulificador propio | `self.context.push_nullifier_unsafe(n)` | Renombrado; antes `push_nullifier`. Exige separación de dominio propia |
| Clave de nulificador | `context.request_nhk_app(get_public_keys(owner).npk_m_hash)` | En v6 es `nhk` (antes `nsk`) |
| Una vez por usuario y ámbito | `Map<Scope, Owned<SingleUseClaim<Context>, Context>, Context>` y `.claim()` | Patrón oficial de votación; sustituye al nulificador manual de identidad |
| Hash | `aztec::protocol::hash::poseidon2_hash_with_separator` | `DOM_SEP__NOTE_HASH` y `DOM_SEP__NOTE_NULLIFIER` son públicas; otras `DOM_SEP__*` pasaron a `pub(crate)` |
| Cota superior de tiempo | `self.context.set_expiration_timestamp(u64)` | Máximo 24 h tras el bloque ancla; si varias funciones lo fijan, vale el mínimo |
| Cota inferior de tiempo | `self.context.get_anchor_block_header()` | El campo exacto del timestamp **[sin confirmar]** (antes `global_variables.timestamp`) |
| Llamadas | `self.call(Token::at(t).transfer_in_private(from, to, amount, authwit_nonce))` | `.call(&mut context)` ya no existe |
| Importes | `u128` | |
| Contrato con claves (custodia privada) | `deploy(...)` con `publicKeys` en las opciones | `deployWithPublicKeys` se eliminó en 5.0.0 |
| Tests (TXE) | `TestEnvironment::new()`, `create_light_account`, `deploy(..).with_private_initializer(..)`, `call_private`, `mine_block_at(ts)` | `advance_timestamp_by` no existe; `#[test(should_fail_with = "...")]` |

## Consecuencias para el diseño del prompt maestro

- **Escrow (R-08):** notas de cobro y de devolución en `Owned<PrivateSet<EscrowNote>>`; nulificador de liquidación con `push_nullifier_unsafe(poseidon2_hash_with_separator([escrow_id], SEP_PROPIO))`. Custodia privada: contrato con claves, como el estándar Escrow de aztec-standards (autorización por el `salt` de la instancia). No hay `escrow_contract` en `noir-contracts` v6 **[sin confirmar]**.
- **Streams (R-09):** `StreamNote { sender, rate, start, end, withdrawn }` en el `PrivateSet` del receptor; cada retiro hace `pop_notes` y reinserta. El devengo usa la hora del bloque ancla y la transacción fija `set_expiration_timestamp`.
- **Identidad (R-10):** credencial `Owned<PrivateImmutable<CredentialNote>>` emitida por el emisor y `Map<Scope, Owned<SingleUseClaim>>` por ámbito, en lugar de un nulificador manual.
- **Token:** `transfer_in_private(from, to, amount: u128, authwit_nonce)` confirmado. `transfer_private_to_private` aparece en AIP-20 (aztec-standards) y no está confirmado en el `token_contract` de referencia **[sin confirmar]**.

## Pendiente de confirmar en el código

1. Ruta del timestamp en `BlockHeader`.
2. Nombres exactos de las transferencias privadas en el `token_contract` de v6.
3. Si existe un contrato de escrow de ejemplo en v6.
4. Cómo depender del token sin duplicar el crate `aztec`.
5. Getter utility de `SingleUseClaim`.

## Fuentes

- [Notas de migración](https://docs.aztec.network/developers/docs/resources/migration_notes)
- [Notas personalizadas](https://docs.aztec.network/developers/v6.0.0-rc.1/docs/aztec-nr/framework-description/custom_notes)
- [Recuperar y filtrar notas](https://docs.aztec.network/developers/docs/aztec-nr/framework-description/advanced/how_to_retrieve_filter_notes)
- [SingleUseClaim](https://docs.aztec.network/aztec-nr-api/nightly/noir_aztec/state_vars/struct.singleuseclaim)
- [Estándar Escrow](https://docs.aztec.network/developers/docs/aztec-nr/standards/escrow)
- [Contexto de funciones](https://docs.aztec.network/developers/v6.0.0-rc.1/docs/aztec-nr/framework-description/functions/context)
- [Tutorial de votación privada](https://docs.aztec.network/tutorials/contract_tutorials/private_voting_contract)
