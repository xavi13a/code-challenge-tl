# Challenge 1: Payment Settlement Pipeline

## Alcance elegido
Este repositorio implementa **solo el Challenge 1** del reto: pipeline distribuido de settlement de pagos con consistencia eventual explícita.

Elegí este challenge porque evalúa directamente decisiones de arquitectura orientadas a confiabilidad (outbox transaccional, relay separado, idempotencia en consumidores, DLT y estados observables).

## Arquitectura propuesta
Procesos (contenedores) separados:
1. `payment-api`: expone `POST /payments` y `GET /payments/:id`.
2. `outbox-relay`: lee `outbox_events` y publica a Kafka.
3. `fraud-worker`: consume `payment.created.v1`, aplica lógica de fraude e idempotencia.
4. `ledger-worker`: consume `payment.created.v1`, crea asientos e idempotencia.
5. `postgres`: persistencia única para simplificar el challenge.
6. `kafka` (+ `kafka-ui` opcional).

Flujo:
1. API crea `payments` + `outbox_events` en **una sola transacción SQL**.
2. Relay publica evento pendiente a Kafka y marca `published`.
3. Workers consumen el evento y aplican side effects con deduplicación por `eventId`.
4. Si ambos estados downstream completan, el pago pasa a `settled`.
5. Si un worker agota reintentos, marca `payment` como `failed` y publica `payment.failed.v1`.

## Decisiones clave y trade-offs
1. **Transactional outbox local**: garantiza que no haya pagos sin evento o eventos sin pago (en DB local).
2. **Relay separado**: evita invocar Kafka dentro de la transacción SQL y respeta frontera de proceso.
3. **Idempotencia en consumidor por `eventId`**: la deduplicación vive donde debe vivir (downstream), usando PK compuesta en `processed_events`.
4. **Una sola base PostgreSQL**: menos complejidad operativa para este reto, sacrificando aislamiento por bounded context.
5. **Kafka local en Docker Compose**: reproducibilidad local sin dependencias cloud.
6. **Simplicidad sobre abstracción**: código pequeño, directo y defendible.

## Por qué monorepo con múltiples procesos
1. Permite compartir contratos y utilidades sin duplicación.
2. Mantiene despliegue y versionado coordinado para el challenge.
3. Conserva separación real de procesos (API, relay, workers) sin caer en monolito runtime.

## Por qué Kafka local con Docker
1. Permite probar semántica asíncrona real en local.
2. Evita dependencias externas o credenciales cloud.
3. Mantiene setup reproducible para revisión técnica.

## Por qué Prisma + una sola base
1. Prisma acelera modelado y acceso consistente con TypeScript strict.
2. Una sola base minimiza fricción para demostrar el patrón core.
3. El reto pide solidez mínima, no despliegue enterprise multi-DB.

## Qué se dejó fuera deliberadamente
1. Debezium CDC.
2. Temporal/Saga externa.
3. Redis.
4. Schema Registry.
5. Confluent Cloud.
6. Multi-country namespace real (solo considerado como mejora futura).

## Estructura
Se implementó exactamente el layout solicitado en el prompt bajo `apps/` y `packages/`.

## Contratos y topics
Envelope:
```ts
export type EventEnvelope<T> = {
  eventId: string;
  eventType: string;
  occurredAt: string;
  aggregateId: string;
  traceId: string;
  payload: T;
};
```

Eventos y topics versionados:
1. `payment.created.v1`
2. `payment.failed.v1` (DLT)
3. `payment.settled.v1`

## Modelo de datos implementado
En `packages/db/prisma/schema.prisma` se implementan:
1. `payments`
2. `outbox_events`
3. `processed_events`
4. `fraud_results`
5. `ledger_entries`

## API
### POST `/payments`
Ejemplo request:
```json
{
  "countryCode": "PE",
  "amount": 120.50,
  "currency": "PEN"
}
```

Respuesta mínima:
```json
{
  "paymentId": "uuid",
  "status": "pending",
  "consistency": {
    "model": "eventual",
    "message": "Payment accepted. Final status depends on downstream consumers."
  }
}
```

### GET `/payments/:id`
Ejemplo:
```json
{
  "paymentId": "uuid",
  "status": "pending",
  "fraudStatus": "completed",
  "ledgerStatus": "pending",
  "consistency": {
    "model": "eventual",
    "message": "This resource may remain pending until downstream consumers complete."
  }
}
```

## Ejecución local
Prerequisitos:
1. Docker y Docker Compose.
2. Node 20+ y pnpm.

Pasos:
1. Instalar dependencias:
```bash
pnpm install
```
2. Generar cliente Prisma:
```bash
pnpm prisma:generate
```
3. Levantar todo:
```bash
docker compose up --build
```

Servicios:
1. API: `http://localhost:3000`
2. Kafka UI: `http://localhost:8080`

## Probar el flujo
1. Crear pago:
```bash
curl -X POST http://localhost:3000/payments \
  -H "Content-Type: application/json" \
  -d '{"countryCode":"PE","amount":120.5,"currency":"PEN"}'
```
2. Consultar estado:
```bash
curl http://localhost:3000/payments/<paymentId>
```
3. Observar transición de `pending` a `settled` cuando ambos workers completen.
4. Para forzar fallo en ledger y probar DLT: usar `currency: "ERR"`.

## Probar endpoints con Postman (`payment-api`)
Archivos incluidos:
1. `apps/payment-api/postman/payment-api.postman_collection.json`
2. `apps/payment-api/postman/payment-api.local.postman_environment.json`

Pasos:
1. Levantar stack (`docker compose up --build`) y confirmar API en `http://localhost:3000`.
2. En Postman, importar colección y environment.
3. Seleccionar environment `payment-api local`.
4. Ejecutar la colección en este orden (o con Collection Runner):
   1. `POST /payments - create (valid)`
   2. `POST /payments - validation error (countryCode)`
   3. `POST /payments - validation error (amount)`
   4. `GET /payments/:id - status (existing payment)`
   5. `GET /payments/:id - not found`

Notas:
1. La primera request guarda `paymentId` automáticamente como variable de colección para la consulta de estado.
2. `GET /payments/:id - status (existing payment)` puede devolver `pending`, `settled` o `failed` por consistencia eventual.

## Tests mínimos incluidos
1. `PaymentService`: creación payment+outbox en transacción local.
2. `PaymentService`: guardrail de no broker dentro del flujo.
3. `FraudConsumer`: mismo `eventId` no duplica side effects.
4. `LedgerConsumer`: mismo `eventId` no duplica ledger entries.
5. Status query: puede permanecer `pending` con downstream incompleto.

Ejecutar:
```bash
pnpm test
pnpm typecheck
pnpm lint
```

## Limitaciones conocidas
1. `payment.settled.v1` se emite best-effort desde workers (sin outbox adicional downstream).
2. Retry policy es simple (constante) para mantener implementación mínima.
3. No hay particionamiento por país ni strategy de rebalancing avanzada.
4. No se implementa observabilidad avanzada (métricas distribuidas), solo logging útil.

## Mejoras con más tiempo
1. Outbox también para eventos downstream (`payment.settled.v1`, `payment.failed.v1`) para entrega más robusta.
2. Backoff exponencial con jitter y circuit breakers.
3. Pruebas de integración end-to-end con Testcontainers.
4. Métricas y trazabilidad OpenTelemetry.
5. Namespacing por país como extensión no-core.
