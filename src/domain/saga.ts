/** La saga de Huma · «El fuego que renace».
 *  Un capítulo por día. {E} = nombre del entrenador, {H} = nombre de la criatura.
 *  Según la forma de hoy: {HUMA} = «el huevo de Huma» o «Huma»; {A_HUMA} = «el huevo de Huma» o «a Huma»;
 *  {PIEL} = «su cáscara», «sus plumitas» o «sus plumas»; {SONIDO} = el huevo hace tac, tac o Huma pía.
 *  Reglas de escritura: lenguaje de niño, nada de palabras médicas, nunca culpa;
 *  la valentía es tener miedo y seguir adelante; el hospital es la Torre de los Sanadores,
 *  un sitio amigo. Los capítulos se escriben por tandas de semanas. */

export interface Capitulo {
  titulo: string
  /** Párrafos del cuerpo del capítulo. */
  texto: string[]
  /** Frase final que anuncia el capítulo de mañana. */
  manana: string
}

/** Primer día de la saga (capítulo 1). */
export const SAGA_INICIO = '2026-09-28'

export const SAGA: Capitulo[] = [
  // ───────────── Semana 1 · El Valle del Alba ─────────────
  {
    titulo: 'El huevo que brillaba',
    texto: [
      'Hace mucho, muchísimo tiempo, cuando las montañas todavía eran jóvenes y las estrellas bajaban a beber agua a los ríos, existía un lugar llamado el Valle del Alba. Allí el sol salía siempre un poquito antes que en el resto del mundo, y por eso todo brillaba: las hojas, las piedras, hasta los charcos parecían espejos de oro.',
      'En lo más alto del valle había una cueva que nadie se atrevía a visitar. La llamaban la Cueva de las Brasas Dormidas. Decían que dentro hacía calorcito incluso en invierno, y que por las noches, si mirabas con atención, se veía una lucecita naranja latiendo como un corazón.',
      'Una mañana, un entrenador muy especial subió por el camino de piedras. Ese entrenador eras tú, {E}. Llevabas la mochila a la espalda y una pregunta en la cabeza: ¿qué será esa luz? Tenías un poquito de miedo, claro. La cueva era oscura y el viento hacía ruidos raros. Pero diste un paso. Y luego otro. Y luego otro más. Porque eso es ser valiente: no es no tener miedo, es tener miedo y dar el paso igualmente.',
      'Al fondo de la cueva, sobre un nido de ramitas y ceniza templada, había un huevo. No era un huevo normal. Era grande como un balón, de color crema, con manchas que parecían pequeñas llamas dibujadas. Y brillaba. Brillaba despacito, como si respirara.',
      'Entonces apareció alguien entre las sombras. Era una salamandra de piel roja con puntitos amarillos, unas gafas redondas en la punta del hocico y un bastón hecho con una rama retorcida. —Por fin has llegado —dijo con voz de abuela—. Me llamo Doña Chispa, y llevo cien años esperando a que este huevo eligiera a su entrenador. Y te ha elegido a ti.',
      '—¿A mí? —preguntaste. —A ti —dijo Doña Chispa—. Dentro de este huevo duerme un fénix. Se llama {H}. Los fénix son las criaturas más valientes que existen, porque tienen un secreto: cada vez que se cansan, vuelven a nacer, y cada vez que renacen, son más fuertes que antes.',
      'Doña Chispa te explicó que {H} necesitaba seis poderes para crecer. El Fuego, que se gana comiendo. El Agua, que se gana bebiendo. El Rayo, que se gana moviéndose. El Escudo, que se gana tomando las pociones y medicinas. La Luna, que se gana durmiendo y descansando. Y el Corazón Valiente, que se gana contando cómo te sientes cada día. —Cada vez que tú ganes un poder —dijo la salamandra—, {H} lo sentirá por dentro. Tú eres su entrenador. Vais a crecer juntos.',
      'Cogiste el huevo con mucho cuidado. Estaba calentito. Y justo cuando lo abrazaste, el huevo hizo un sonido suave, como un tac, tac, tac. Como si alguien, desde dentro, te estuviera diciendo hola.',
    ],
    manana: 'Mañana conocerás a alguien muy pequeño que tiene un problema muy grande: una luciérnaga que no sabe brillar.',
  },
  {
    titulo: 'Lumo, la luciérnaga que no sabía brillar',
    texto: [
      'Aquella noche dormiste en la cabaña de Doña Chispa, con {HUMA} junto a tu almohada, bien arropado con una manta de lana. Por la ventana se veían miles de lucecitas verdes que bailaban sobre la hierba: eran las luciérnagas del Valle del Alba, que salían a jugar cuando se escondía el sol.',
      'Pero había una luciérnaga que no bailaba. Estaba sentada sola en el borde de la ventana, con las alas caídas. Era chiquitita, con unos ojos enormes y una antena torcida hacia un lado. —¿Qué te pasa? —le preguntaste en voz bajita, para no despertar a nadie.',
      '—Me llamo Lumo —dijo la luciérnaga, sorbiéndose los mocos—. Y soy la única luciérnaga del mundo que no sabe brillar. Todos mis amigos se encienden como bombillas. Yo lo intento, aprieto muy fuerte la barriga, pero nada. Solo me sale un pedo de lucecita, y dura un segundo.',
      'No pudiste evitar reírte, y Lumo, al oírte, también se rió. Y en ese momento pasó algo curioso: la barriga de Lumo hizo ¡plin! y se encendió un poquito. Solo un poquito, pero se encendió. —¿Has visto eso? —gritó Lumo, dando vueltas en el aire—. ¡He brillado! ¿Cómo lo he hecho?',
      'Doña Chispa, que no estaba tan dormida como parecía, abrió un ojo desde su mecedora. —Las luces de dentro no se encienden apretando la barriga —dijo—. Se encienden cuando dejamos de estar solos. Cuando alguien se ríe contigo, cuando alguien te acompaña, la luz sale sola.',
      'Lumo se quedó pensando. Luego voló hasta {H} y se posó encima. —¿Puedo quedarme con vosotros? —preguntó—. Prometo ayudar. Puedo iluminar el camino por la noche. Bueno, a lo mejor no mucho. Pero puedo intentarlo.',
      'Le dijiste que sí, claro. {SONIDO} Esta vez más fuerte. Doña Chispa sonrió. —{H} también está de acuerdo. Ya sois un equipo: un entrenador, un fénix y una luciérnaga que está aprendiendo a brillar.',
      'Esa noche, antes de dormir, Lumo te contó un secreto: él también tenía miedo de muchas cosas. De la oscuridad, de los ruidos fuertes, de las arañas con pelos. —Pero contigo cerca —dijo—, el miedo es más pequeñito. Como si fuera un miedo de bolsillo.',
    ],
    manana: 'Mañana el equipo tendrá que cruzar el Río de Cristal, donde el agua canta y las piedras se mueven.',
  },
  {
    titulo: 'El Río de Cristal',
    texto: [
      'A la mañana siguiente, Doña Chispa os despertó muy temprano. —Hoy empieza vuestro primer viaje —dijo—. Para que {H} crezca fuerte, tenéis que llegar al Árbol de las Mil Ramas, al otro lado del Río de Cristal. Allí vive una familia de ardillas que guarda las Semillas del Sol.',
      'Metiste {A_HUMA} en la mochila, bien acolchado con tu jersey favorito. Lumo se subió a tu hombro. Y echasteis a andar por un camino de tierra lleno de flores que olían a fresa.',
      'Después de un rato llegasteis al río. Era el río más bonito que habías visto nunca. El agua era tan transparente que se veían los peces de colores nadando por el fondo, y cuando corría entre las piedras hacía un ruido como de campanitas: tilín, tilín, tilín. Por eso lo llamaban el Río de Cristal.',
      'Pero había un problema. No había puente. Solo unas piedras redondas que asomaban del agua. Y las piedras, de vez en cuando, se movían. Porque no eran piedras: eran las cabezas de unas tortugas enormes y muy dormilonas.',
      '—Buenos días —dijiste, muy educado, a la primera tortuga—. ¿Podríamos pasar por encima de vosotras? La tortuga abrió un ojo lentamente. Tardó tanto en abrirlo que a Lumo le dio tiempo a contar hasta veinte. —Podéis pasar —dijo por fin, con voz de trueno lejano—, pero solo si antes bebéis del río. El agua del Río de Cristal da el Poder del Agua. Quien no bebe, pesa demasiado, y las tortugas no aguantan el peso de los que tienen sed.',
      'Así que bebiste. El agua estaba fresquita y sabía a algo parecido a la menta. Y al beber, notaste una cosa increíble: dentro de la mochila, {HUMA} se puso más brillante, y en {PIEL} aparecieron unas rayitas azules, como olas pequeñas.',
      'Cruzasteis el río saltando de tortuga en tortuga. En la tercera casi te resbalas, y Lumo gritó tan fuerte que la tortuga se rió, y de la risa le salieron burbujas por la nariz. En la última, diste un salto enorme y aterrizaste en la otra orilla, sobre la hierba blandita.',
      'Desde el otro lado, las tortugas os dijeron adiós moviendo las patas. Y la más vieja de todas os gritó una cosa que nunca olvidarás: —¡Recuerda, entrenador! ¡El agua es como la valentía: hay que tomarla poquito a poco, pero todos los días!',
    ],
    manana: 'Mañana el camino os llevará a un lugar muy especial: la Torre de los Sanadores, donde viven los Guardianes de Bata Blanca.',
  },
  {
    titulo: 'La Torre de los Sanadores',
    texto: [
      'Al otro lado del río, el camino subía por una colina, y en lo alto de la colina había una torre altísima, blanca como la nieve, con muchas ventanas redondas por donde salía una luz suave. —Es la Torre de los Sanadores —susurró Lumo—. Dicen que allí viven magos que curan a las criaturas.',
      'La puerta se abrió sola antes de que llamaseis. Dentro olía a limpio, y había pasillos largos con dibujos de colores en las paredes. Os recibieron unos personajes con batas blancas y azules, con gorros graciosos y unas cosas colgando del cuello que parecían serpientes de goma. Eran los Guardianes de Bata Blanca.',
      '—Bienvenidos —dijo una guardiana de pelo rizado y sonrisa grande—. Sabemos quiénes sois. Todo el valle habla del nuevo entrenador que cuida del huevo de fénix. Aquí preparamos las Pociones de Escudo. Son pociones muy poderosas. A veces saben un poco raro y a veces cansan un poquito, pero protegen por dentro como una armadura invisible.',
      'La guardiana os enseñó una sala llena de frascos de colores: amarillos, rojos, transparentes. Algunos burbujeaban. Otros brillaban como si tuvieran estrellas dentro. —Cada poción tiene su trabajo —explicó—. Unas persiguen a las sombras, otras hacen fuerte la sangre, otras calman la tripa. Y todas juntas forman el Escudo.',
      'Tú preguntaste lo que muchos niños valientes preguntan: —¿Y si me da miedo? La guardiana se agachó hasta ponerse a tu altura y te miró a los ojos. —Aquí dentro todo el mundo tiene miedo alguna vez. Hasta los guardianes. Pero ¿sabes qué? En esta torre nadie está solo. Tu familia está contigo, nosotros estamos contigo, y tu fénix está contigo. Eso es lo que hace fuertes a los valientes.',
      'En ese momento, dentro de la mochila, {HUMA} hizo algo nuevo: tembló, y a su alrededor apareció un brillo en forma de escudo, transparente y dorado, que duró unos segundos antes de desaparecer. La guardiana aplaudió. —¡Mirad! {H} ha sentido el Poder del Escudo. Cada vez que tomas tus pociones, tu fénix se hace más fuerte también.',
      'Antes de salir, los Guardianes de Bata Blanca os regalaron una medalla pequeñita con forma de torre. —Para que sepas —dijo la guardiana— que siempre que tengas que volver a la Torre, aquí tienes amigos. Y que cada día que pasas aquí cuenta doble en valentía.',
      'Lumo, que había estado muy callado todo el rato, os dijo al salir: —¿Sabéis qué? Pensaba que la torre me iba a dar miedo. Y un poquito me lo ha dado. Pero ya no tanto. —Y su barriga hizo ¡plin!, y brilló un poco más que el día anterior.',
    ],
    manana: 'Mañana ocurrirá algo inesperado: una niebla gris bajará de las montañas. Y el equipo tendrá que descubrir cómo se enfrenta uno a la niebla.',
  },
  {
    titulo: 'La Niebla Gris',
    texto: [
      'Aquel día amaneció distinto. El sol del Valle del Alba, que siempre salía el primero, no aparecía. En su lugar, desde las montañas bajaba una niebla espesa y gris, como un algodón sucio, que lo tapaba todo: los árboles, los caminos, hasta la punta de tu nariz.',
      '—Es la Niebla Gris —dijo Doña Chispa, preocupada, mientras se ajustaba las gafas—. Aparece de vez en cuando. No es mala del todo, pero intenta apagar los fuegos. Cuando llega, todo el mundo se siente cansado, con ganas de quedarse quieto y sin fuerzas para nada.',
      'Y era verdad. Lumo se había metido debajo de una hoja y no quería salir. Las ardillas no subían a los árboles. Hasta el río había dejado de cantar. Y tú también lo notabas: un cansancio pesado en los brazos y en las piernas, como si llevaras una mochila llena de piedras.',
      'Entonces miraste {A_HUMA}. Su brillo se había hecho más pequeñito, como una vela cuando hay corriente. Y eso no te gustó nada. —Doña Chispa —preguntaste—, ¿cómo se vence a la niebla? La salamandra se quedó pensando un rato largo.',
      '—La niebla no se vence a golpes —dijo al fin—. Se vence con pequeñas luces. Una luz sola es poca cosa. Pero muchas luces pequeñas juntas pueden abrir un agujero en la niebla más espesa. Y las luces más fuertes son las de dentro: un bocado de comida, un trago de agua, un abrazo, una risa, una poción tomada aunque cueste.',
      'Así que hiciste algo muy valiente, aunque parecía pequeño. Te comiste un poquito de pan con aceite, aunque no tenías mucha hambre. Bebiste unos sorbos de agua. Le diste un abrazo a {H}. Y le contaste a Lumo un chiste malísimo sobre un pingüino que quería ser bombero. Lumo se rió tanto que salió de debajo de la hoja, y su barriga hizo ¡plin!, y esta vez se quedó encendida.',
      'Una lucecita. Luego otra: {HUMA} volvió a brillar. Luego otra más: las luciérnagas del valle, al ver a Lumo, también se encendieron. Y poco a poco, en medio de la niebla, se abrió un agujero redondo por donde entró un rayo de sol. Y luego otro. Y luego otro.',
      'La Niebla Gris no desapareció del todo. Se quedó por las montañas, esperando. Pero ese día aprendiste una cosa importante: los días de niebla también se pueden atravesar. No hace falta ser gigante. Basta con encender luces pequeñas, una detrás de otra, y no hacerlo solo.',
    ],
    manana: 'Mañana, cuando se vaya la niebla, os espera algo muy divertido: el Baile de los Rayos en las Montañas del Trueno.',
  },
  {
    titulo: 'El Baile de los Rayos',
    texto: [
      'Después del día de niebla, el Valle del Alba amaneció más limpio que nunca. El cielo estaba tan azul que parecía recién pintado. Y desde las Montañas del Trueno llegaba un sonido muy raro: pum, pum, chas. Pum, pum, chas.',
      '—¡Es el Baile de los Rayos! —gritó Lumo, dando volteretas en el aire—. Solo se celebra una vez al año. Todas las criaturas de las montañas se juntan a bailar, y los rayos bajan del cielo a bailar con ellas. ¡Tenemos que ir!',
      'Doña Chispa os explicó que el Poder del Rayo es el poder del movimiento. —Un fénix que no se mueve se queda frío —dijo—. Pero no hace falta correr como un loco. Moverse es también estirar los brazos, mover los dedos de los pies, dar un paseo corto, jugar a las cartas moviendo las manos. Cada movimiento, aunque sea chiquitito, es una chispa.',
      'Cuando llegasteis a las montañas, aquello era una fiesta increíble. Había cabras montesas bailando claqué sobre las rocas. Había osos que movían la barriga al ritmo del tambor. Había un búho muy serio que solo movía la cabeza, de un lado a otro, y todo el mundo decía que era el mejor bailarín. Y en el cielo, los rayos hacían dibujos de luz: espirales, estrellas, corazones.',
      'Un conejo con gafas de sol te invitó a bailar. Tú le dijiste que a lo mejor no podías bailar mucho rato. —¡No importa! —dijo el conejo—. Aquí cada uno baila como puede. Mira al búho: solo mueve la cabeza, y es el campeón. Lo importante es moverse con alegría.',
      'Así que bailaste a tu manera. Moviste los brazos como un molino. Hiciste palmas. Moviste los hombros arriba y abajo. Y Lumo, a tu lado, hacía giros en el aire dejando un rastro de luz verde. Y entonces, dentro de la mochila, {HUMA} empezó a moverse también: se balanceaba a un lado y a otro, al ritmo del pum, pum, chas.',
      'De repente, un rayo pequeñito, del tamaño de un lápiz, bajó del cielo dando saltitos, como si fuera un cachorro, y se posó encima de {H}. Hizo cosquillas de electricidad, y en {PIEL} apareció un dibujo nuevo: un zigzag dorado. —¡El Poder del Rayo! —aplaudió Doña Chispa—. {H} lo ha conseguido gracias a ti.',
      'Volvisteis a casa cansados pero muy contentos, cantando la canción del baile. Y Lumo, antes de dormirse, te dijo: —Hoy he aprendido que no hace falta ser el que más corre para pasarlo bien. Basta con moverse como uno puede, pero con muchas ganas.',
    ],
    manana: 'Mañana es la última noche de la semana: la Noche del Lago de la Luna. Y allí, {H} va a descubrir un secreto sobre los fénix.',
  },
  {
    titulo: 'La noche del Lago de la Luna',
    texto: [
      'El último día de la semana, Doña Chispa os llevó a un sitio al que solo se puede ir de noche: el Lago de la Luna. Estaba en medio del bosque, rodeado de árboles tan altos que parecían tocar el cielo. Y el agua del lago era tan tranquila que la luna se reflejaba en ella como en un espejo gigante. Parecía que había dos lunas: una arriba y otra abajo.',
      '—Aquí se gana el Poder de la Luna —dijo la salamandra en voz baja, porque en ese lago todo el mundo hablaba bajito—. Es el poder del descanso. Mientras duermes, tu cuerpo trabaja en secreto: arregla lo que se ha roto, guarda lo que has aprendido y prepara la fuerza para el día siguiente. Por eso dormir bien es un superpoder, aunque parezca que no haces nada.',
      'Os tumbasteis en la hierba, con {HUMA} entre tus brazos y Lumo acurrucado en tu cuello. Mirando al cielo, Doña Chispa os fue enseñando las estrellas. Aquella de allí, la que parpadea, es la Estrella del Valiente. Aquella otra, la azul, es la Estrella del Agua. Y esas tres en fila son las Tres Plumas del Fénix.',
      'Entonces Doña Chispa te contó el gran secreto de los fénix. —Los fénix no crecen como los demás animales —dijo—. Crecen, crecen, crecen, y cuando llegan al final de una etapa, se envuelven en su propio fuego y vuelven a ser un huevo. Parece que empiezan de cero, pero no es así. Cada vez que renacen, guardan dentro una chispa de todo lo que vivieron. Y por eso, cada vez, son más fuertes.',
      '—¿Entonces {H} volverá a ser un huevo? —preguntaste. —Cada lunes —dijo Doña Chispa sonriendo—. Cada lunes {H} renacerá, y tú lo ayudarás a crecer de nuevo, forma a forma, hasta llegar a Fénix. Y cada semana llevará una chispa más. Hasta que un día, cuando tenga todas las chispas que necesita, podrá volar hasta la Cumbre del Sol, el lugar más alto del mundo.',
      'Te quedaste pensando en eso. Pensaste que tú también eras un poco como un fénix. Que había días de niebla y días de rayos, días de torre y días de lago, y que después de cada uno, algo dentro de ti se hacía más fuerte. Aunque no se viera por fuera.',
      'Esa noche, antes de cerrar los ojos, pasó una última cosa mágica. {H} soltó una pequeña chispa dorada, que subió flotando hacia el cielo y se quedó allí, brillando, junto a la Estrella del Valiente. —Esa es su primera chispa de renacimiento —susurró Lumo, con la barriga encendida del todo—. Y la ha ganado contigo.',
      'Y así terminó la primera semana del entrenador {E} y su fénix {H}. Una semana de huevos que brillan, luciérnagas que aprenden, ríos de cristal, torres amigas, nieblas que se atraviesan y rayos que bailan.',
    ],
    manana: 'Mañana es lunes: {H} renacerá. Y empezará una aventura nueva, en un lugar que todavía no conoces: el Bosque de los Susurros.',
  },
]
