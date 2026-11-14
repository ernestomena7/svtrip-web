import type { LegalDocument } from './types.js';

/**
 * Politica de privacidad (feature 022).
 *
 * **ESTO ES UN BORRADOR EXACTO, NO UN DOCUMENTO LEGAL.** `docs/privacy-data-inventory.md` lo dice en
 * sus propias palabras — "escribir la politica es un documento legal y le corresponde a alguien
 * calificado" — y el spec lo recoge como Supuesto. Un revisor calificado debe leer este texto antes
 * de que alguien dependa de el. Esa revision esta fuera de esta feature y queda nombrada, no salteada.
 *
 * Cada seccion cita su `source`: de donde sale cada afirmacion, para que el proximo editor la
 * compruebe contra el codigo en vez de confiar. Una politica es tan verdadera como su fuente, y la
 * fuente de esta (el inventario) llego a estar tres features atrasada.
 *
 * **Nada aqui promete algo que el producto no hace (FR-010).** En particular: no se promete plazo de
 * respuesta para borrar datos (no hay proceso detras que lo respalde), no se dice que se guarde un
 * token de dispositivo sin decir cuándo se borra (feature 020 US4: al cerrar sesión, o cuando deja de funcionar), y el guia se describe en presente — la feature 021 lo
 * apago — sin dejar de avisar que las conversaciones pasadas se conservan.
 */
export const privacyEs: LegalDocument = {
  id: 'privacy',
  language: 'es',
  title: 'Política de privacidad',
  updatedAt: '2026-11-14',
  sections: [
    {
      id: 'data-collected',
      heading: 'Qué datos guardamos',
      source:
        'docs/privacy-data-inventory.md, secciones 1 y 2; shared/src/types.ts (UserProfile, Trip, BusinessClaim); firestore.rules (24 colecciones, verificadas por shared/tests/legal.test.ts).',
      body: [
        'SVTrip guarda la información que vos nos das y la que se genera cuando usás la aplicación. Esta sección enumera cada tipo.',
        'De tu cuenta: tu correo electrónico, tu nombre y apellido, tu edad (no tu fecha de nacimiento), tu género, tu país de residencia y, si querés, tu estado civil. Si entrás con Google, también la foto de tu perfil. Si hacés una reserva y dejás un teléfono, lo guardamos en tu perfil para la próxima vez.',
        'De lo que hacés: los lugares que guardás como favoritos; los Trips que armás, con sus fechas y los lugares que pensás visitar; tus preferencias de moods; y un registro de qué lugares te mostró el guía, que sirve para que no te repita lo mismo.',
        'Si tenés un negocio: los datos de tu negocio y de tu suscripción (el plan, sus fechas y si el pago está al día), y las solicitudes que hacés para administrar un negocio, que incluyen tu nombre y un mensaje opcional que escribas.',
        'Cuando alguien denuncia una reseña, guardamos quién la denunció y el motivo si lo escribió. Ese registro lo ve únicamente el equipo de SVTrip y ninguna pantalla de la aplicación lo muestra.',
        'Si activás los avisos en el teléfono, guardamos junto a tu cuenta el identificador que Google usa para entregarle notificaciones a ese teléfono. Lo usamos solo para avisarte de tus reservas. Se borra cuando cerrás sesión en ese teléfono, y también cuando deja de funcionar. Si no activás los avisos, no guardamos nada.',
        'Tus datos de cuenta, favoritos, Trips y conversaciones están guardados bajo tu cuenta y solo se pueden leer desde ella.',
      ],
    },
    {
      id: 'reservations-shared',
      heading: 'Lo que ve un negocio cuando pedís una reserva',
      source:
        'firestore.rules, bloque reservations (lectura con dos uids); shared/src/types.ts, Reservation. Es el único lugar del producto donde los datos de contacto de una persona los lee otro cliente.',
      body: [
        'Cuando pedís una reserva, el negocio al que se la pedís ve tu nombre, tu correo y, si lo dejaste, tu teléfono, además de la fecha, la hora, la cantidad de personas y la nota que escribas.',
        'Lo hacemos así porque el negocio necesita poder contestarte. Copiamos esos datos en la solicitud tal como los escribiste en ese momento, de modo que si después cambiás tu nombre o borrás tu teléfono, la solicitud que ya contestó el negocio no cambia.',
        'Una reserva es una solicitud, no una mesa o un cuarto asegurado: queda pendiente hasta que el negocio la confirme.',
        'Es la única situación en que otra persona ve tus datos de contacto. En el resto de la aplicación, lo que guardamos de vos es privado de tu cuenta.',
      ],
    },
    {
      id: 'reviews-public',
      heading: 'Las reseñas son públicas',
      source:
        'server/src/services/reviewService.ts (authorName = displayName; deleteOwnReview; upsertReply); server/src/routes/reviews.ts (DELETE /reviews/:targetId, POST/DELETE /reviews/:reviewId/reply); firestore.rules, bloque reviews (lectura pública, sin escrituras de cliente). CORREGIDO durante la redacción: un borrador anterior decía que nadie podía borrar una reseña, y el autor sí puede.',
      body: [
        'Las reseñas son el único contenido de SVTrip que puede leer cualquiera. Cuando escribís una, se publica junto con tu nombre.',
        'Podés borrar tus propias reseñas desde la aplicación cuando quieras. Un negocio no puede modificar ni borrar una reseña que le hicieron.',
        'El dueño de un negocio sí puede publicar una respuesta pública a una reseña, y esa respuesta se ve junto a ella.',
      ],
    },
    {
      id: 'location',
      heading: 'Tu ubicación',
      source:
        'client/src/lib/useTravelerLocation.ts (enableHighAccuracy: false); docs/privacy-data-inventory.md, sección 3.',
      body: [
        'Si lo permitís, la aplicación lee tu ubicación aproximada para ordenar los lugares por distancia.',
        'No la guardamos, no la enviamos a nuestros servidores y no la compartimos. Se mantiene en la memoria del dispositivo mientras usás la aplicación y la distancia se calcula ahí mismo.',
        'Si no querés compartirla, podés negarte: perdés el orden por distancia, pero no perdés ningún lugar.',
      ],
    },
    {
      id: 'third-parties',
      heading: 'Con quién compartimos datos',
      source:
        'docs/privacy-data-inventory.md, sección 4 (orígenes externos extraídos del código de las cuatro superficies); landing/src/styles, web/src/styles y client/src/styles (@import de Google Fonts).',
      body: [
        'Supabase guarda todo lo que describe la sección "Qué datos guardamos", incluidas las fotos de los negocios, en servidores ubicados en el este de Estados Unidos. Es nuestra base de datos y nuestro sistema de cuentas, y no hay forma de usar la aplicación sin ella.',
        'Nuestro servidor funciona en Google Cloud, también en Estados Unidos: las solicitudes que la aplicación le hace (por ejemplo, al pedir una reserva o publicar una reseña) pasan por ahí. Si entrás con tu cuenta de Google, Google confirma tu identidad y nos entrega tu nombre y tu correo.',
        'Si activás los avisos, cada notificación de una reserva se entrega a través de Firebase Cloud Messaging, el servicio de Google para notificaciones en Android. Google recibe el identificador de tu teléfono y el texto del aviso: por ejemplo, el nombre del negocio, la fecha de tu reserva y, si el negocio te escribió un mensaje al rechazarla, ese mensaje.',
        'Las fuentes tipográficas de la aplicación se cargan desde Google Fonts. Eso significa que tu dirección IP llega a Google cada vez que se carga una página, antes de que se dibuje nada, y también en la página pública donde todavía no existe una cuenta. Lo declaramos porque no es algo que puedas elegir.',
        'Los mapas se cargan desde OpenFreeMap, que recibe tu dirección IP y la zona aproximada que estás viendo cada vez que se muestra un mapa.',
        'Si un negocio busca una dirección para ubicarse, el texto de esa búsqueda se envía a MapTiler a través de nuestro servidor.',
        'Cuando tocás "Cómo llegar", las coordenadas del destino se abren en Google Maps. Cuando tocás para contactar a un negocio por WhatsApp, se abre WhatsApp con el número de ese negocio. En ambos casos salís de SVTrip por una acción tuya.',
        'No vendemos tus datos ni los usamos para publicidad.',
      ],
    },
    {
      id: 'retention',
      heading: 'Cuánto tiempo guardamos tus datos',
      source:
        'docs/privacy-data-inventory.md, secciones 1 y 6 (punto 3: no hay límite de retención); shared/src/features.ts (AI_GUIDE_ENABLED = false, feature 021).',
      body: [
        'No tenemos un plazo automático de borrado. Guardamos tus datos mientras tu cuenta exista.',
        'Esto incluye las conversaciones que tuviste con el guía de inteligencia artificial: se guardan mensaje por mensaje y no se borran solas. El guía está apagado en este momento, pero las conversaciones que ya existen se conservan, y si el guía vuelve a activarse, el texto que escribas se enviará a Google, nuestro proveedor del modelo, para generar cada respuesta.',
        'También se conserva el registro de qué lugares te mostró el guía.',
      ],
    },
    {
      id: 'anonymous-analytics',
      heading: 'Estadísticas de los negocios',
      source:
        'firestore.rules, bloques engagementEvents y metricsDaily; docs/privacy-data-inventory.md, sección 2 (anónimas a propósito).',
      body: [
        'Los negocios ven cuántas personas miraron su perfil, lo guardaron como favorito o tocaron "Cómo llegar".',
        'Esas estadísticas son anónimas: registran qué negocio y qué tipo de interacción, y no guardan quién fue. Un negocio sabe que alguien lo vio, nunca quién.',
      ],
    },
    {
      id: 'your-choices',
      heading: 'Tus opciones y cómo pedir que borremos tus datos',
      source:
        'Decisión del dueño del producto, 2026-10-19 (feature 022, T014). Medido ese día: no existe ningún camino de borrado en client/, web/, core/ ni server/.',
      body: [
        'Podés editar tu perfil, tus favoritos, tus Trips y tus moods desde la aplicación en cualquier momento.',
        'Para pedir que borremos tu cuenta y tus datos, escribí a ernesto@svtrip.com. Una persona lo atiende a mano: no existe todavía un botón para hacerlo desde la aplicación.',
        'No fijamos un plazo de respuesta porque no hay un proceso detrás que podamos medir. Preferimos decírtelo así antes que prometerte un número que no podemos cumplir.',
        'No ofrecemos todavía una forma de descargar una copia de tus datos.',
      ],
    },
    {
      id: 'contact',
      heading: 'Contacto',
      source: 'Decisión del dueño del producto, 2026-10-19 (feature 022, T014).',
      body: [
        'Para cualquier consulta sobre esta política o sobre tus datos, escribí a ernesto@svtrip.com.',
        'SVTrip está pensado para personas de 13 años o más.',
      ],
    },
    {
      id: 'changes',
      heading: 'Cambios en esta política',
      body: [
        'Si cambiamos lo que guardamos o con quién lo compartimos, vamos a actualizar este texto y la fecha de arriba.',
        'Esta es la versión vigente. La fecha de la última actualización figura al comienzo.',
      ],
    },
  ],
};
