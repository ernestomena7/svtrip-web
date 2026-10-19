import type { LegalDocument } from './types.js';

/**
 * Terminos de servicio (feature 022).
 *
 * **BORRADOR EXACTO, NO DOCUMENTO LEGAL.** Un revisor calificado debe leerlo antes de que alguien
 * dependa de el; esa revision esta fuera de esta feature y queda nombrada, no salteada.
 *
 * Las dos reglas que gobiernan lo que NO puede decir este texto:
 *
 *   1. **Una reserva es una solicitud, nunca una mesa o un cuarto asegurado** (FR-034 de la feature
 *      020). El boton dice "Reservar", que promete mas de lo que el producto entrega, asi que estos
 *      terminos corrigen la palabra en lugar de repetirla.
 *
 *   2. **Ningun cobro real ocurre hoy.** La constitucion (v3.0.0) sigue tratando el cobro en vivo —
 *      una pasarela de pago, metodos de pago guardados, cargos recurrentes — como un cambio de
 *      gobierno con enmienda y revision de seguridad, y no hay pasarela integrada (medido: ningun
 *      cliente de pagos en `server/` ni en `shared/`). Prometer facturacion aqui seria describir
 *      una practica que el producto no sigue (FR-010).
 */
export const termsEs: LegalDocument = {
  id: 'terms',
  language: 'es',
  title: 'Términos de servicio',
  updatedAt: '2026-10-19',
  sections: [
    {
      id: 'what-svtrip-is',
      heading: 'Qué es SVTrip',
      source: 'docs/ y specs/001-svtrip-travel-companion/spec.md.',
      body: [
        'SVTrip es una aplicación para descubrir lugares y servicios en El Salvador, armar planes de viaje y, para quienes tienen un negocio, mostrar ese negocio a los viajeros.',
        'La información de los lugares viene de nuestro catálogo y de los propios negocios. Hacemos lo posible por que sea correcta, pero puede cambiar sin aviso: horarios, precios y disponibilidad pueden ser distintos de lo que la aplicación muestra, así que conviene confirmarlos con el negocio.',
      ],
    },
    {
      id: 'your-account',
      heading: 'Tu cuenta',
      source:
        'shared/src/profile.ts (MIN_AGE = 13); docs/privacy-data-inventory.md, sección 6 (punto 5).',
      body: [
        'Para usar la mayor parte de la aplicación necesitás una cuenta. Vos sos responsable de lo que se haga con ella.',
        'SVTrip está pensado para personas de 13 años o más.',
        'Los datos que nos des al registrarte tienen que ser verdaderos. Podés editarlos cuando quieras desde tu perfil.',
        'Qué hacemos con tus datos está explicado en la política de privacidad.',
      ],
    },
    {
      id: 'what-merchants-publish',
      heading: 'Lo que publican los negocios',
      source:
        'specs/006-comercio-funcional (reclamar un negocio es una solicitud que aprueba una persona, no una concesión automática); firestore.rules, bloques listings y deals.',
      body: [
        'Un negocio administra su propio perfil: la descripción, las fotos, los horarios, los contactos y las promociones. Es responsable de que lo que publica sea verdadero y de que tenga derecho a publicarlo, incluidas las fotos.',
        'Para administrar un negocio que ya está en el catálogo hay que pedirlo y esperar a que una persona del equipo de SVTrip lo apruebe. Pedirlo no te da el negocio.',
        'Nos reservamos el derecho de ocultar o quitar contenido que sea falso, engañoso, ofensivo o que no le corresponda a quien lo publicó. Hoy no hay un proceso automático de revisión: lo hace una persona del equipo cuando se entera.',
        'Las reseñas las escriben los viajeros. Un negocio puede responderlas, pero no modificarlas ni borrarlas.',
        'La visibilidad de un negocio puede depender del estado de su suscripción.',
      ],
    },
    {
      id: 'reservations-are-requests',
      heading: 'Las reservas son solicitudes',
      source:
        'specs/020-reservations/spec.md, FR-034 ("Solicitud, no reserva instantánea").',
      body: [
        'Cuando pedís una reserva a través de SVTrip, enviás una solicitud al negocio. No es una reserva confirmada: queda pendiente hasta que el negocio la confirme, y puede rechazarla.',
        'SVTrip no asegura una mesa, un cuarto ni ningún lugar, no maneja la disponibilidad de los negocios y no cobra nada por una reserva. Lo que pase entre vos y el negocio es entre ustedes.',
        'Si tu plan cambia, cancelá la solicitud desde la aplicación para avisarle al negocio.',
      ],
    },
    {
      id: 'what-we-do-not-promise',
      heading: 'Lo que no prometemos',
      source:
        'Constitución del proyecto v3.0.0 (el cobro en vivo está fuera de alcance); shared/src/features.ts (AI_GUIDE_ENABLED = false).',
      body: [
        'SVTrip se ofrece tal como está. No garantizamos que funcione sin interrupciones ni sin errores.',
        'No somos responsables de lo que ocurra en un lugar, con un negocio o durante un viaje. Usás la aplicación para informarte, y las decisiones son tuyas.',
        'Por ahora la aplicación no procesa pagos: no cobramos ni guardamos medios de pago. Si eso cambia, vamos a actualizar estos términos y la política de privacidad antes de que ocurra.',
        'Podemos cambiar, pausar o quitar funciones. Algunas, como el guía de inteligencia artificial, pueden estar apagadas.',
      ],
    },
    {
      id: 'changes',
      heading: 'Cambios en estos términos',
      body: [
        'Si cambiamos estos términos, vamos a actualizar este texto y la fecha de arriba.',
        'Esta es la versión vigente. La fecha de la última actualización figura al comienzo.',
      ],
    },
  ],
};
