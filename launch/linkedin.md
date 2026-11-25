# LinkedIn

Attach `social-preview.png` (or the 9:16 video when it exists) to the long version. Put the repository link in the first comment, not in the post. Tag no company page: Humanity Ledger is not affiliated with Aztec Labs, the Aztec Foundation or XMTP Labs.

## Long (English)

```
For a year I have been building one thing: a messenger where a payment is as private as the message next to it.

It is called Ledger Chat, and today the code is open.

How it works, in three steps:

1. Talk. Messages are end-to-end encrypted over XMTP, which implements MLS (RFC 9420). Our server never sees their content.

2. Verify. Before the first payment, your device checks a signature that binds the contact's chat identity to their Aztec address. You never type or paste where the money goes.

3. Pay. Your browser builds a zero-knowledge proof of the transfer and sends only that proof to Aztec. The network learns that a transaction happened and its fee. Not who paid, not who was paid, not how much.

Where it stands, plainly:
• private payments run in a closed technical beta on Aztec Alpha, in cUSDC, for at most 100 invited people, with a cap per payment
• an external audit began on 25 November; the report will be published in full
• every payment recorded so far was between accounts I run
• Humanity Ledger is not affiliated with Aztec Labs or XMTP Labs

I wrote the repository so that an engineer can check every claim against the code in about fifteen minutes. There is even a check that fails the build if the documentation claims something the code does not do.

If private payments inside messaging are something you want to exist, the most useful thing you can do is read the code, open an issue, or star the repository so other engineers find it. Link in the first comment.

#privacy #zeroknowledge #ethereum #opensource #cryptography
```

**First comment:**

```
Code: https://github.com/humanityledger/humanity-ledger
Beta requests: https://ledgerchat.org/beta
How it works and what is public: https://github.com/humanityledger/humanity-ledger/blob/main/docs/TRUST.md
```

## Medium (English)

```
Ledger Chat is now open source: end-to-end encrypted messaging (XMTP, MLS) with private payments inside the conversation, proved on your device and settled on Aztec.

On chain, a payment shows that it happened and its fee. Not the amount, not the people.

Status: closed cUSDC beta on Aztec Alpha, capped per payment. External audit began 25 November, report pending. Not affiliated with Aztec Labs or XMTP Labs.

Code and every claim with its source: link in the first comment. A star on the repository helps other engineers find it.
```

## Short (English)

```
Ledger Chat is open source: encrypted messages and private payments in one conversation, built on XMTP and Aztec. Closed beta, audit underway. Code in the first comment.
```

## Larga (español)

```
Durante un año he construido una sola cosa: un mensajero en el que un pago es tan privado como el mensaje que tiene al lado.

Se llama Ledger Chat y hoy su código es abierto.

Cómo funciona:
1. Hablas. Los mensajes van cifrados de extremo a extremo por XMTP (MLS, RFC 9420). Nuestro servidor no ve su contenido.
2. Verificas. Antes del primer pago, tu dispositivo comprueba una firma que une la identidad del contacto en el chat con su dirección en Aztec. Nunca escribes ni pegas a dónde va el dinero.
3. Pagas. Tu navegador genera una prueba de conocimiento cero y solo envía esa prueba a Aztec. La red sabe que hubo una transacción y su comisión. No quién pagó, ni a quién, ni cuánto.

Dónde está, sin adornos:
• los pagos privados funcionan en una beta técnica cerrada en Aztec Alpha, en cUSDC, para un máximo de 100 personas invitadas y con tope por pago
• una auditoría externa empezó el 25 de noviembre; el informe se publicará completo
• todos los pagos registrados hasta hoy fueron entre cuentas que gestiono yo
• Humanity Ledger no está afiliado a Aztec Labs ni a XMTP Labs

Si quieres que los pagos privados dentro de la mensajería existan, lo más útil es leer el código, abrir un issue o dar una estrella al repositorio para que otros ingenieros lo encuentren. Enlace en el primer comentario.
```

## Corta (español)

```
Ledger Chat ya es código abierto: mensajes cifrados y pagos privados en la misma conversación, sobre XMTP y Aztec. Beta cerrada, auditoría en curso. Código en el primer comentario.
```
