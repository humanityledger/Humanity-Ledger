# Notas del Ensayo General y Ajustes de Profesores

> **Sesión de Revisión Académica y Técnica**
> **Asistentes:** Catedráticos de Criptografía Aplicada, Sistemas Distribuidos y Equipo de Core Engineering.

---

## Observaciones y Cambios Incorporados

### 1. Terminología Precisa
- **Feedback:** "Eviten usar la palabra 'cuántico' o 'postcuántico' para referirse a Aztec o a curvas elípticas estándar BN254."
- **Acción aplicada:** Se eliminó cualquier referencia engañosa en toda la documentación técnica. Se especifica con claridad que Aztec usa UltraHonk con dureza clásica y que el único componente postcuántico es el protocolo de bienvenida de XMTP MLS con ML-KEM-768.

### 2. Énfasis en el Modelo de Amenazas (STRIDE)
- **Feedback:** "La presentación de 1 hora debe iniciar mostrando el vector de ataque más común en Web3: la confianza indebida en el cliente."
- **Acción aplicada:** Diapositiva 2 y 3 rediseñadas para contrastar directamente el código vulnerable antes de la auditoría y la remediación final.

### 3. Demostración Práctica
- **Feedback:** "Asegurar que la demo no dependa de conexión a Internet externa de alta latencia."
- **Acción aplicada:** Se estructuró el script de demo y el video de respaldo pregrabado (< 5 minutos) en `docs/conferences/demo-script.md`.

### 4. Material para Estudiantes
- **Feedback:** "Los ejercicios de laboratorio deben tener casos de prueba reproducibles en Vitest."
- **Acción aplicada:** Creados los 4 casos de estudio con tests en `docs/conferences/student-exercises.md`.
