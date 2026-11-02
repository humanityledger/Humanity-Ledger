# Ejercicios Prácticos para Estudiantes: Auditoría y Criptografía Soberana

Este laboratorio contiene 4 ejercicios con pruebas unitarias que inicialmente fallan, junto con sus soluciones explicadas.

---

## Ejercicio 1: Eliminación de Suplantación por Cabeceras (Spoofing)

### Enunciado:
El endpoint `/api/user/profile` aceptaba un encabezado `x-web3-address` suministrado por el cliente. Si un atacante enviaba la dirección de otra persona, el sistema le devolvía los datos de la víctima.

### Prueba que falla:
```typescript
test('Debe rechazar la identidad enviada en cabeceras y usar solo la sesión', async () => {
  const req = new NextRequest('http://localhost:3000/api/user/profile', {
    headers: { 'x-web3-address': '0xVictim0000000000000000000000000000000000' }
  });
  // Si requireWallet lee la cabecera, fallará la prueba devolviendo la cartera de la víctima
  const caller = await requireWallet(req);
  expect(caller.walletAddress).not.toBe('0xVictim0000000000000000000000000000000000');
});
```

### Solución:
Utilizar exclusivamente `requireWallet(req)` que extrae y valida el JWT firmado desde la cookie HttpOnly `hl_session`.

---

## Ejercicio 2: Comparación de Secretos en Tiempo Constante

### Enunciado:
Comparar dos tokens o secretos con `===` permite a un atacante inferir byte a byte mediante ataques de análisis de tiempo diferencial.

### Prueba que falla:
```typescript
test('Comparación de tokens no debe usar operadores vulnerables a timing attacks', () => {
  const tokenA = Buffer.from('token_secreto_valido_123456');
  const tokenB = Buffer.from('token_secreto_inval_987654');
  expect(crypto.timingSafeEqual(tokenA, tokenB)).toBe(false);
});
```

### Solución:
Usar siempre `crypto.timingSafeEqual(bufferA, bufferB)`. Si las longitudes difieren, realizar un hash SHA-256 de ambos antes de la comparación para mantener tiempo uniforme.

---

## Ejercicio 3: Hashing Robusto de PIN con Sal Criptográfica y Pimienta

### Enunciado:
Un PIN de 6 dígitos tiene solo 1.000.000 de combinaciones. Un simple hash SHA-256 se rompe en milisegundos mediante tablas arcoíris.

### Prueba que falla:
```typescript
test('El hash del PIN debe ser Argon2id y variar con la sal y la pimienta', async () => {
  const pin = '123456';
  const salt = crypto.randomBytes(16);
  const pepper = 'server_pepper_secret_value';
  const hash = await hashPinArgon2(pin, salt, pepper);
  expect(hash.startsWith('$argon2id$')).toBe(true);
});
```

### Solución:
Implementar Argon2id (`t=2, m=19456, p=1`) con sal aleatoria de 16 bytes generada con `crypto.randomBytes` y pimienta almacenada fuera de la base de datos (`ENCLAVE_PIN_PEPPER`).

---

## Ejercicio 4: Validación de Comprobantes de Puente L1 -> L2

### Enunciado:
Un atacante inventa un hash de transacción de Ethereum L1 para intentar que el puente de Aztec L2 le acredite saldo sin haber depositado.

### Prueba que falla:
```typescript
test('El puente debe rechazar recibos L1 no confirmados o inexistentes', async () => {
  const fakeL1TxHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  await expect(validateL1DepositReceipt(fakeL1TxHash, 100n)).rejects.toThrow('Invalid L1 receipt');
});
```

### Solución:
Consultar el proveedor RPC de Ethereum L1, validar que la transacción esté confirmada (mínimo 12 bloques), que el destino sea el contrato oficial `TokenPortal` y que los parámetros del evento coincidan con el solicitante.
