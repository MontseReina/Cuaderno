/** Catálogo genérico de alimentos para contar lo que se escribe en «Otro». Kilocalorías aproximadas por unidad
 *  casera (tablas de composición españolas, redondeadas); sirven para estimar, no para pesar. Sin datos personales.
 *
 *  Cada alimento tiene una unidad casera (`u`, con sus kcal en `k`) y cuántas unidades se cuentan si no se dice
 *  cuántas (`n`, por defecto 1; `np` si se escribe en plural sin número, como «huevos»). El grupo decide qué parte
 *  del plato dibujado le aplica la cantidad: verdura, proteína o hidratos. */

export type Grupo = 'verdura' | 'proteina' | 'hidrato' | 'fruta' | 'grasa' | 'lacteo' | 'dulce' | 'plato' | 'bebida'

export interface Alimento {
  id: string
  nombre: string
  grupo: Grupo
  /** Unidad casera, en singular: «1 lomo», «1 rebanada», «1 puñado». */
  u: string
  /** Kilocalorías de una unidad. */
  k: number
  /** Unidades que se cuentan sin número. */
  n?: number
  /** Unidades que se cuentan si se escribe en plural sin número. */
  np?: number
  /** Formas de escribirlo (en minúsculas; sin tildes da igual). La primera es la más corta habitual. */
  s: string[]
}

const A = (id: string, nombre: string, grupo: Grupo, u: string, k: number, s: string[], n?: number, np?: number): Alimento => ({ id, nombre, grupo, u, k, s, n, np })

const VERDURAS: Alimento[] = [
  A('brocoli', 'Brócoli', 'verdura', '1 ración (150 g)', 50, ['brocoli', 'brocolis', 'brecol']),
  A('coliflor', 'Coliflor', 'verdura', '1 ración (150 g)', 38, ['coliflor']),
  A('col', 'Col o repollo', 'verdura', '1 ración (150 g)', 35, ['col', 'repollo', 'lombarda', 'col lombarda']),
  A('col_china', 'Col china', 'verdura', '1 ración (150 g)', 25, ['col china', 'pak choi', 'bok choy']),
  A('kale', 'Kale', 'verdura', '1 ración (100 g)', 45, ['kale', 'col rizada']),
  A('coles_bruselas', 'Coles de Bruselas', 'verdura', '1 ración (100 g)', 43, ['coles de bruselas', 'col de bruselas']),
  A('espinacas', 'Espinacas', 'verdura', '1 ración (100 g)', 23, ['espinaca', 'espinacas']),
  A('acelgas', 'Acelgas', 'verdura', '1 ración (150 g)', 30, ['acelga', 'acelgas']),
  A('judias_verdes', 'Judías verdes', 'verdura', '1 ración (150 g)', 45, ['judias verdes', 'judia verde', 'judiasverdes', 'vainas']),
  A('calabacin', 'Calabacín', 'verdura', '1 ración (150 g)', 25, ['calabacin', 'calabacines']),
  A('berenjena', 'Berenjena', 'verdura', '1 ración (150 g)', 38, ['berenjena']),
  A('calabaza', 'Calabaza', 'verdura', '1 ración (200 g)', 50, ['calabaza']),
  A('zanahoria', 'Zanahoria', 'verdura', '1 mediana (80 g)', 32, ['zanahoria'], 1, 2),
  A('pimiento', 'Pimiento', 'verdura', '1/2 pimiento (100 g)', 30, ['pimiento', 'pimientos asados', 'pimiento asado']),
  A('tomate', 'Tomate', 'verdura', '1 mediano (150 g)', 30, ['tomate', 'tomate natural', 'tomate rallado']),
  A('tomate_frito', 'Tomate frito o salsa de tomate', 'verdura', '2 cucharadas (40 g)', 30, ['tomate frito', 'salsa de tomate', 'tomate triturado']),
  A('cherry', 'Tomates cherry', 'verdura', '1 puñado (6 unidades)', 12, ['tomates cherry', 'tomate cherry', 'cherrys', 'cherry']),
  A('cebolla', 'Cebolla', 'verdura', '1/4 de cebolla (50 g)', 20, ['cebolla', 'cebolleta']),
  A('puerro', 'Puerro', 'verdura', '1 puerro (100 g)', 30, ['puerro']),
  A('alcachofa', 'Alcachofas', 'verdura', '4 corazones (150 g)', 65, ['alcachofa', 'alcachofas']),
  A('esparragos', 'Espárragos', 'verdura', '6 espárragos (100 g)', 25, ['esparrago', 'esparragos', 'trigueros', 'esparragos trigueros']),
  A('setas', 'Setas o champiñones', 'verdura', '1 puñado (100 g)', 25, ['seta', 'setas', 'champiñon', 'champiñones', 'boletus', 'shiitake']),
  A('hojas', 'Lechuga u hojas verdes', 'verdura', '1 puñado (50 g)', 10, ['lechuga', 'canonigos', 'rucula', 'escarola', 'brotes', 'hojas verdes', 'berros', 'endibia', 'endibias']),
  A('ensalada', 'Ensalada', 'verdura', '1 plato (150 g)', 30, ['ensalada', 'ensalada verde', 'ensalada mixta']),
  A('pepino', 'Pepino', 'verdura', '1/2 pepino (80 g)', 12, ['pepino']),
  A('apio', 'Apio', 'verdura', '1 rama (50 g)', 8, ['apio']),
  A('remolacha', 'Remolacha', 'verdura', '1 ración (100 g)', 45, ['remolacha']),
  A('hinojo', 'Hinojo', 'verdura', '1/2 bulbo (100 g)', 30, ['hinojo']),
  A('verduras', 'Verduras', 'verdura', '1 ración (200 g)', 60, ['verdura', 'verduras', 'verduras al vapor', 'verdura al vapor', 'menestra']),
  A('salteado', 'Salteado de verduras', 'verdura', '1 plato (200 g)', 110, ['salteado de verduras', 'verduras salteadas', 'wok de verduras']),
  A('pisto', 'Pisto', 'verdura', '1 ración (200 g)', 140, ['pisto', 'samfaina']),
  A('pure', 'Puré o crema de verduras', 'verdura', '1 cuenco (300 ml)', 120, ['pure', 'crema', 'crema de verduras', 'pure de verduras']),
  A('sopa', 'Sopa de verduras', 'verdura', '1 cuenco (300 ml)', 80, ['sopa', 'sopa de verduras']),
  A('caldo', 'Caldo', 'bebida', '1 taza (250 ml)', 25, ['caldo', 'caldo de verduras', 'caldo de pollo', 'caldo de huesos']),
]

/** «Puré de calabaza», «crema de calabacín»…: un solo puré, sin contar la verdura otra vez. */
const PURES = VERDURAS.filter((v) => v.grupo === 'verdura' && !['pure', 'sopa', 'ensalada', 'verduras', 'salteado', 'pisto', 'hojas', 'cherry', 'tomate_frito'].includes(v.id))
  .flatMap((v) => v.s.map((w) => w))

const PROTEINAS: Alimento[] = [
  A('pollo', 'Pechuga de pollo', 'proteina', '1 pechuga pequeña (130 g)', 145, ['pollo', 'pechuga', 'pechuga de pollo', 'pollo a la plancha', 'pollo desmigado', 'pollo asado']),
  A('pollo_muslo', 'Muslos o contramuslos de pollo', 'proteina', '2 contramuslos (150 g limpios)', 230, ['contramuslo', 'contramuslos', 'muslo de pollo', 'muslos de pollo', 'muslitos', 'muslito', 'alitas', 'alitas de pollo']),
  A('codorniz', 'Codorniz', 'proteina', '1 codorniz', 190, ['codorniz', 'codornices', 'alitas de codorniz']),
  A('bacon', 'Beicon o panceta', 'proteina', '2 lonchas (30 g)', 120, ['bacon', 'beicon', 'beacon', 'panceta', 'chorizo', 'salchichon', 'fuet', 'salchicha', 'salchichas']),
  A('pavo', 'Pavo', 'proteina', '1 filete (130 g)', 140, ['pavo', 'filete de pavo', 'pechuga de pavo', 'secreto de pavo']),
  A('pavo_fiambre', 'Pavo cocido en lonchas', 'proteina', '3-4 lonchas (50 g)', 55, ['pavo cocido', 'fiambre de pavo', 'lonchas de pavo', 'pavo en lonchas', 'jamon de pavo', 'jamon pavo']),
  A('jamon', 'Jamón serrano', 'proteina', '2 lonchas (30 g)', 75, ['jamon', 'jamon serrano', 'jamon iberico']),
  A('jamon_york', 'Jamón cocido', 'proteina', '2 lonchas (30 g)', 35, ['jamon york', 'jamon cocido']),
  A('ternera', 'Ternera', 'proteina', '1 filete (140 g)', 200, ['ternera', 'filete de ternera', 'carne de ternera', 'carne roja', 'buey', 'entrecot']),
  A('carne_picada', 'Carne picada o albóndigas', 'proteina', '1 ración (130 g)', 250, ['carne picada', 'albondiga', 'albondigas']),
  A('hamburguesa', 'Hamburguesa (solo la carne)', 'proteina', '1 hamburguesa (120 g)', 250, ['hamburguesa', 'hamburguesas']),
  A('cerdo', 'Cerdo', 'proteina', '1 ración (130 g)', 190, ['cerdo', 'lomo', 'solomillo', 'solomillo de cerdo', 'lomo de cerdo', 'secreto', 'costillas']),
  A('cordero', 'Cordero', 'proteina', '1 ración (130 g)', 300, ['cordero']),
  A('conejo', 'Conejo', 'proteina', '1 ración (150 g)', 200, ['conejo']),
  A('salmon', 'Salmón', 'proteina', '1 lomo (150 g)', 300, ['salmon']),
  A('salmon_ahumado', 'Salmón ahumado', 'proteina', '2 lonchas (40 g)', 70, ['salmon ahumado']),
  A('atun', 'Atún o bonito fresco', 'proteina', '1 rodaja (150 g)', 200, ['atun', 'bonito', 'atun fresco', 'tataki']),
  A('atun_lata', 'Atún en lata', 'proteina', '1 lata pequeña (60 g escurrido)', 120, ['atun en lata', 'lata de atun', 'atun al natural', 'atun en aceite']),
  A('sardinas', 'Sardinas', 'proteina', '1 ración (150 g)', 210, ['sardina', 'sardinas', 'sardinillas']),
  A('caballa', 'Caballa', 'proteina', '1 ración (150 g)', 285, ['caballa', 'verdel']),
  A('boquerones', 'Boquerones', 'proteina', '1 ración (150 g)', 170, ['boqueron', 'boquerones', 'anchoas frescas']),
  A('anchoas', 'Anchoas en lata', 'proteina', '5 anchoas (20 g)', 40, ['anchoa', 'anchoas']),
  A('merluza', 'Merluza o pescado blanco', 'proteina', '1 lomo (150 g)', 120, ['merluza', 'pescado', 'pescado blanco', 'bacalao', 'gallo', 'lenguado', 'rape', 'pescadilla', 'abadejo', 'panga']),
  A('lubina', 'Lubina', 'proteina', '1 ración (150 g)', 170, ['lubina', 'corvina']),
  A('dorada', 'Dorada', 'proteina', '1 ración (150 g)', 240, ['dorada']),
  A('trucha', 'Trucha', 'proteina', '1 ración (150 g)', 210, ['trucha']),
  A('marisco', 'Gambas o langostinos', 'proteina', '1 ración (100 g pelados)', 90, ['gamba', 'gambas', 'langostino', 'langostinos', 'marisco']),
  A('mejillones', 'Mejillones', 'proteina', '1 ración (150 g)', 130, ['mejillon', 'mejillones', 'almejas', 'berberechos']),
  A('calamar', 'Calamar, sepia o pulpo', 'proteina', '1 ración (150 g)', 120, ['calamar', 'calamares', 'sepia', 'pulpo', 'chipirones']),
  A('huevo', 'Huevo', 'proteina', '1 huevo', 70, ['huevo', 'huevo cocido', 'huevo duro', 'huevo a la plancha', 'huevo frito', 'huevo poche', 'yema', 'yemas'], 1, 2),
  A('huevos_revueltos', 'Huevos revueltos', 'proteina', '1 huevo', 85, ['revuelto', 'huevos revueltos', 'revuelto de huevo'], 2, 2),
  A('tortilla', 'Tortilla francesa', 'proteina', '1 tortilla (2 huevos)', 200, ['tortilla', 'tortilla francesa']),
  A('tofu', 'Tofu', 'proteina', '1 ración (125 g)', 150, ['tofu']),
  A('tempeh', 'Tempeh', 'proteina', '1 ración (100 g)', 190, ['tempeh']),
  A('proteina_polvo', 'Proteína en polvo', 'proteina', '1 cacito (25 g)', 95, ['proteina', 'proteina en polvo', 'proteina de guisante', 'whey', 'colageno']),
]

const LACTEOS: Alimento[] = [
  A('yogur', 'Yogur natural', 'lacteo', '1 yogur (125 g)', 110, ['yogur', 'yogurt', 'iogurt', 'yogur natural', 'yogur de oveja', 'yogur de cabra']),
  A('yogur_coco', 'Yogur de coco', 'lacteo', '1 yogur (125 g)', 120, ['yogur de coco', 'yogurt de coco', 'iogurt de coco']),
  A('yogur_griego', 'Yogur griego', 'lacteo', '1 yogur (125 g)', 150, ['yogur griego']),
  A('kefir', 'Kéfir', 'lacteo', '1 vaso (200 ml)', 120, ['kefir']),
  A('cuajada', 'Cuajada', 'lacteo', '1 cuajada (125 g)', 120, ['cuajada']),
  A('queso', 'Queso curado o semicurado', 'lacteo', '1 cuña (30 g)', 120, ['queso', 'queso curado', 'queso semicurado', 'queso de cabra', 'queso de oveja', 'manchego', 'queso rallado']),
  A('queso_fresco', 'Queso fresco', 'lacteo', '2 rodajas (60 g)', 110, ['queso fresco', 'queso de burgos', 'mozzarella', 'burrata', 'feta']),
  A('queso_crema', 'Queso crema', 'lacteo', '1 cucharada colmada (30 g)', 75, ['queso crema', 'queso untable', 'philadelphia']),
  A('requeson', 'Requesón', 'lacteo', '2 cucharadas (50 g)', 75, ['requeson', 'ricotta']),
  A('parmesano', 'Parmesano', 'lacteo', '1 cucharada (10 g)', 40, ['parmesano']),
  A('leche', 'Leche', 'lacteo', '1 vaso (250 ml)', 160, ['leche', 'leche de vaca', 'leche sin lactosa']),
  A('bebida_vegetal', 'Bebida vegetal', 'lacteo', '1 vaso (250 ml)', 50, ['bebida vegetal', 'leche de coco', 'leche de almendras', 'leche de avena', 'leche de arroz', 'bebida de coco', 'bebida de almendras', 'bebida de avena']),
  A('leche_coco_lata', 'Leche de coco de lata', 'grasa', '1/4 de lata (100 ml)', 190, ['leche de coco de lata', 'crema de coco', 'nata de coco']),
  A('nata', 'Nata', 'grasa', '2 cucharadas (30 ml)', 100, ['nata']),
]

const HIDRATOS: Alimento[] = [
  A('patata', 'Patata', 'hidrato', '1 mediana (150 g)', 115, ['patata', 'patata cocida', 'patata asada', 'papa', 'patatas al horno'], 1, 1),
  A('patatas_fritas', 'Patatas fritas', 'hidrato', '1 ración (100 g)', 300, ['patatas fritas', 'patata frita']),
  A('boniato', 'Boniato', 'hidrato', '1 mediano (150 g)', 135, ['boniato', 'batata', 'moniato']),
  A('arroz', 'Arroz', 'hidrato', '1 plato pequeño (150 g cocido)', 195, ['arroz', 'arroz blanco', 'arroz integral', 'arroz basmati', 'risotto']),
  A('quinoa', 'Quinoa', 'hidrato', '1 plato pequeño (150 g cocida)', 180, ['quinoa', 'quinua']),
  A('pasta', 'Pasta', 'hidrato', '1 plato (60 g en crudo)', 210, ['pasta', 'macarrones', 'espaguetis', 'fideos', 'pasta sin gluten', 'tallarines', 'noodles']),
  A('cereal_cocido', 'Trigo sarraceno, mijo o cuscús', 'hidrato', '1 plato pequeño (150 g cocido)', 160, ['trigo sarraceno', 'alforfon', 'mijo', 'cuscus', 'bulgur', 'amaranto']),
  A('pan', 'Pan', 'hidrato', '1 rebanada (30 g)', 75, ['pan', 'pan sin gluten', 'pan de trigo sarraceno', 'pan integral', 'pan de molde', 'bocadillo'], 2),
  A('tostada', 'Tostada', 'hidrato', '1 tostada (30 g)', 75, ['tostada', 'tostada de pan', 'tostadas de pan'], 1, 2),
  A('tortitas_arroz', 'Tortitas de arroz o maíz', 'hidrato', '1 tortita', 30, ['tortitas de arroz', 'tortitas de maiz', 'tortita de arroz'], 3),
  A('avena', 'Copos de avena o cereales', 'hidrato', '4 cucharadas (40 g)', 150, ['avena', 'copos de avena', 'cereales', 'muesli', 'granola', 'porridge', 'gachas']),
  A('yuca', 'Yuca o plátano macho', 'hidrato', '1 ración (150 g)', 240, ['yuca', 'mandioca', 'platano macho', 'patacones', 'patacon', 'tostones']),
  A('crema_arroz', 'Crema de arroz', 'hidrato', '2 cucharadas (20 g)', 72, ['crema de arroz', 'harina de arroz']),
  A('crackers', 'Crackers o picos', 'hidrato', '1 puñado (30 g)', 130, ['cracker', 'crackers', 'picos', 'regañas', 'tostas']),
  A('maiz', 'Maíz', 'hidrato', '1 ración (100 g)', 90, ['maiz', 'mazorca']),
  A('legumbres', 'Legumbres cocidas', 'hidrato', '1 plato (200 g cocidas)', 230, ['legumbres', 'lentejas', 'garbanzos', 'alubias', 'judias blancas', 'guisantes', 'habas', 'azukis', 'frijoles']),
  A('harina', 'Harina (castaña, almendra, coco)', 'hidrato', '4 cucharadas (40 g)', 150, ['harina', 'harina de castaña', 'harina de trigo sarraceno']),
]

const FRUTAS: Alimento[] = [
  A('manzana', 'Manzana', 'fruta', '1 manzana (150 g)', 80, ['manzana', 'manzana asada', 'compota']),
  A('pera', 'Pera', 'fruta', '1 pera (150 g)', 85, ['pera']),
  A('platano', 'Plátano', 'fruta', '1 plátano (120 g)', 105, ['platano', 'banana']),
  A('naranja', 'Naranja', 'fruta', '1 naranja (180 g)', 85, ['naranja', 'pomelo']),
  A('mandarina', 'Mandarina', 'fruta', '1 mandarina (70 g)', 35, ['mandarina', 'clementina'], 1, 2),
  A('kiwi', 'Kiwi', 'fruta', '1 kiwi', 50, ['kiwi'], 1, 2),
  A('uvas', 'Uvas', 'fruta', '1 racimo pequeño (120 g)', 85, ['uva', 'uvas']),
  A('caqui', 'Caqui', 'fruta', '1 caqui', 105, ['caqui', 'kaki', 'persimon']),
  A('granada', 'Granada', 'fruta', '1/2 granada', 75, ['granada']),
  A('fresas', 'Fresas', 'fruta', '1 ración (150 g)', 50, ['fresa', 'fresas', 'freson', 'fresones']),
  A('frutos_rojos', 'Frutos rojos', 'fruta', '1 puñado (60 g)', 30, ['frutos rojos', 'frutos del bosque', 'arandanos', 'arandano', 'frambuesas', 'frambuesa', 'moras', 'cerezas']),
  A('melocoton', 'Melocotón o nectarina', 'fruta', '1 pieza', 60, ['melocoton', 'nectarina', 'paraguayo', 'albaricoque', 'albaricoques']),
  A('ciruela', 'Ciruelas', 'fruta', '2 ciruelas', 50, ['ciruela', 'ciruelas']),
  A('pina', 'Piña', 'fruta', '2 rodajas (150 g)', 75, ['piña']),
  A('mango', 'Mango', 'fruta', '1/2 mango', 100, ['mango', 'papaya']),
  A('melon', 'Melón o sandía', 'fruta', '1 tajada (200 g)', 65, ['melon', 'sandia']),
  A('higos', 'Higos', 'fruta', '2 higos', 75, ['higo', 'higos']),
  A('datiles', 'Dátiles', 'fruta', '2 dátiles', 130, ['datil', 'datiles']),
  A('pasas', 'Pasas o fruta desecada', 'fruta', '1 cucharada (15 g)', 45, ['pasas', 'orejones', 'fruta desecada', 'ciruelas pasas']),
  A('fruta', 'Fruta', 'fruta', '1 pieza', 75, ['fruta', 'pieza de fruta']),
  A('zumo', 'Zumo', 'bebida', '1 vaso (200 ml)', 90, ['zumo', 'zumo de naranja']),
  A('limon', 'Limón', 'fruta', '1 chorrito', 3, ['limon', 'lima']),
]

const GRASAS: Alimento[] = [
  A('aceite', 'Aceite', 'grasa', '1 cucharada (10 ml)', 90, ['aceite', 'aceite de oliva', 'aove', 'aceite de coco', 'aceite de sesamo']),
  A('mct', 'Aceite MCT', 'grasa', '1 cucharada (15 ml)', 120, ['mct', 'aceite mct']),
  A('mantequilla', 'Mantequilla o ghee', 'grasa', '1 cucharadita (10 g)', 75, ['mantequilla', 'ghee', 'margarina']),
  A('aguacate', 'Aguacate', 'grasa', '1/2 aguacate (80 g)', 130, ['aguacate', 'guacamole']),
  A('aceitunas', 'Aceitunas', 'grasa', '6-8 aceitunas', 40, ['aceituna', 'aceitunas', 'olivas']),
  A('frutos_secos', 'Frutos secos', 'grasa', '1 puñado (20 g)', 125, ['frutos secos', 'almendra', 'almendras', 'nuez', 'nueces', 'avellana', 'avellanas', 'anacardo', 'anacardos', 'pistacho', 'pistachos', 'macadamia', 'macadamias', 'piñones', 'nueces de brasil']),
  A('cacahuetes', 'Cacahuetes', 'grasa', '1 puñado (20 g)', 115, ['cacahuete', 'cacahuetes', 'mani']),
  A('crema_fs', 'Crema de frutos secos o tahini', 'grasa', '1 cucharada (15 g)', 95, ['crema de almendras', 'crema de avellanas', 'crema de cacahuete', 'mantequilla de cacahuete', 'tahini', 'tahin', 'crema de frutos secos', 'crema de anacardos']),
  A('semillas', 'Semillas', 'grasa', '1 cucharada (10 g)', 50, ['semillas', 'lino', 'linaza', 'chia', 'sesamo', 'pipas', 'semillas de calabaza', 'semillas de girasol', 'semillas de lino', 'semillas de chia', 'cañamo']),
  A('coco', 'Coco rallado', 'grasa', '1 cucharada (10 g)', 65, ['coco', 'coco rallado', 'coco seco', 'coco deshidratado']),
  A('mayonesa', 'Mayonesa o alioli', 'grasa', '1 cucharada (15 g)', 100, ['mayonesa', 'alioli', 'salsa']),
  A('hummus', 'Hummus', 'grasa', '2 cucharadas (50 g)', 150, ['hummus', 'humus']),
]

const DULCES: Alimento[] = [
  A('miel', 'Miel', 'dulce', '1 cucharadita (10 g)', 30, ['miel', 'sirope', 'sirope de agave', 'melaza']),
  A('azucar', 'Azúcar', 'dulce', '1 cucharadita (8 g)', 32, ['azucar', 'panela']),
  A('mermelada', 'Mermelada', 'dulce', '1 cucharadita (15 g)', 35, ['mermelada', 'confitura']),
  A('chocolate', 'Chocolate negro', 'dulce', '2 onzas (20 g)', 115, ['chocolate', 'chocolate negro', 'onza', 'onzas']),
  A('nibs', 'Nibs de cacao', 'dulce', '1 cucharadita (5 g)', 30, ['nibs', 'nibs de cacao', 'nibs de chocolate', 'cacao', 'cacao puro']),
  A('galletas', 'Galletas', 'dulce', '3 galletas (30 g)', 140, ['galleta', 'galletas', 'cookies']),
  A('bizcocho', 'Bizcocho o bizcochito', 'dulce', '1 porción (60 g)', 230, ['bizcocho', 'bizcochito', 'bizcochitos', 'brownie', 'banana bread']),
  A('muffin', 'Muffin o magdalena', 'dulce', '1 unidad', 250, ['muffin', 'muffins', 'magdalena', 'magdalenas', 'cupcake']),
  A('bolleria', 'Bollería', 'dulce', '1 pieza', 260, ['croissant', 'cruasan', 'napolitana', 'bolleria', 'donut', 'ensaimada']),
  A('tarta', 'Tarta', 'dulce', '1 porción (100 g)', 300, ['tarta', 'pastel']),
  A('helado', 'Helado', 'dulce', '2 bolas (100 g)', 200, ['helado']),
  A('pudding_chia', 'Pudding de chía', 'dulce', '1 vaso', 220, ['pudding de chia', 'pudin de chia', 'pudding', 'pudding de chia con leche de coco', 'pudding de chia con bebida vegetal', 'pudding de chia con leche de almendras']),
  A('natillas', 'Natillas, flan o arroz con leche', 'dulce', '1 unidad', 150, ['natillas', 'flan', 'arroz con leche', 'crema catalana']),
  A('tortitas', 'Tortitas o crepes', 'dulce', '3 tortitas', 250, ['tortitas', 'tortita', 'pancakes', 'crepes', 'crepe', 'gofre', 'gofres']),
  A('barrita', 'Barrita', 'dulce', '1 barrita', 200, ['barrita', 'barritas', 'barrita energetica', 'barrita de proteina']),
  A('bunuelo', 'Buñuelo', 'dulce', '1 buñuelo', 110, ['buñuelo', 'buñuelos', 'buñuelo de crema', 'buñuelos de crema', 'profiterol', 'profiteroles']),
  A('rollito', 'Rollito salado de horno', 'dulce', '1 rollito', 330, ['rollito', 'rollitos']),
]

const PLATOS: Alimento[] = [
  A('tortilla_patata', 'Tortilla de patata', 'plato', '1 ración (150 g)', 230, ['tortilla de patata', 'tortilla de patatas', 'tortilla española']),
  A('paella', 'Paella o arroz con cosas', 'plato', '1 plato (300 g)', 420, ['paella', 'arroz con pollo', 'arroz con verduras', 'arroz meloso', 'arroz caldoso']),
  A('lentejas', 'Lentejas o garbanzos guisados', 'plato', '1 plato (300 g)', 330, ['lentejas estofadas', 'cocido', 'potaje', 'fabada', 'garbanzos con espinacas']),
  A('croquetas', 'Croquetas', 'plato', '3 croquetas', 230, ['croqueta', 'croquetas']),
  A('empanadilla', 'Empanadilla o empanada', 'plato', '1 pieza', 200, ['empanadilla', 'empanadillas', 'empanada']),
  A('pizza', 'Pizza', 'plato', '2 porciones', 500, ['pizza']),
  A('sandwich', 'Sándwich', 'plato', '1 sándwich', 300, ['sandwich', 'sandwiches', 'mixto', 'wrap', 'wrap de yuca', 'bocadillo de jamon', 'bocadillo']),
  A('ensaladilla', 'Ensaladilla', 'plato', '1 ración (200 g)', 300, ['ensaladilla', 'ensaladilla rusa']),
  A('gazpacho', 'Gazpacho o salmorejo', 'plato', '1 vaso (250 ml)', 120, ['gazpacho', 'salmorejo']),
  A('lasana', 'Lasaña o canelones', 'plato', '1 ración (250 g)', 400, ['lasaña', 'canelones', 'musaka', 'moussaka']),
  A('batido', 'Batido', 'plato', '1 vaso grande', 350, ['batido', 'smoothie', 'licuado']),
  A('sushi', 'Sushi', 'plato', '8 piezas', 350, ['sushi', 'maki', 'poke']),
  A('pan_tomate', 'Pan con tomate', 'plato', '1 tostada', 140, ['pan con tomate', 'tostada con tomate']),
  A('huevos_rotos', 'Huevos rotos', 'plato', '1 plato', 500, ['huevos rotos', 'huevos con patatas']),
]

const BEBIDAS: Alimento[] = [
  A('cafe_leche', 'Café con leche', 'bebida', '1 taza', 70, ['cafe con leche', 'cortado', 'capuchino', 'latte']),
  A('sin_kcal', 'Agua, café solo o infusión', 'bebida', '1 vaso o taza', 0, ['agua', 'cafe', 'cafe solo', 'te', 'infusion', 'manzanilla', 'tila', 'poleo', 'rooibos']),
  A('refresco', 'Refresco', 'bebida', '1 lata', 140, ['refresco', 'cola', 'coca cola', 'fanta', 'tonica']),
  A('alcohol', 'Cerveza o vino', 'bebida', '1 caña o copa', 100, ['cerveza', 'vino', 'cava', 'sidra']),
]

const PURE = VERDURAS.find((v) => v.id === 'pure')!
/** Puré o crema de una verdura concreta: cuenta como el puré, no como la verdura. */
PURE.s = [...PURE.s, ...PURES.flatMap((w) => [`pure de ${w}`, `crema de ${w}`])]

export const ALIMENTOS: Alimento[] = [...VERDURAS, ...PROTEINAS, ...LACTEOS, ...HIDRATOS, ...FRUTAS, ...GRASAS, ...DULCES, ...PLATOS, ...BEBIDAS]

// ---------- Lectura del texto ----------

/** Minúsculas y sin tildes (la ñ se queda). */
export const normalizar = (t: string) =>
  t.toLowerCase().replace(/(.)\1{2,}/g, '$1$1').replace(/ñ/g, '\u0000').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\u0000/g, 'ñ')

const NUMEROS: { [k: string]: number } = {
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, medio: 0.5, media: 0.5, 'un poco de': 0.5, poco: 0.5, 'un par de': 2, par: 2,
}
const UNIDADES = 'rebanadas?|lonchas?|cucharadas?|cucharaditas?|cdas?|cdtas?|pu(?:ñ|n)ados?|vasos?|tazas?|piezas?|filetes?|trozos?|latas?|unidades?|uds?|raciones?|platos?|cuencos?|bolas?|onzas?|lomos?|rodajas?|tajadas?|porciones?|cacitos?|chorritos?|hojas?'
const NUM = `(\\d+\\/\\d+|\\d+(?:[.,]\\d+)?|un par de|un poco de|un|una|uno|dos|tres|cuatro|cinco|seis|medio|media|poco|par)`
const RE_CANT = new RegExp(`(?:^|\\s)${NUM}\\s+(?:(?:${UNIDADES})\\s+)?(?:de\\s+)?$`)

const RE_UNIDAD = new RegExp(`^(?:${UNIDADES})$`)
/** Palabras que no son alimentos y no hace falta reconocer. */
const RELLENO = new Set(('un una uno unos unas dos tres cuatro cinco seis medio media poco mucho algo par de del con sin y e o al a la el los las lo en '
  + 'para por mas menos tambien solo sola siempre habitual plancha horno vapor asado asada asados asadas cocido cocida cocidos cocidas hervido hervida frito frita fritos fritas '
  + 'salteado salteada guisado guisada estofado estofada casero casera natural integral grande pequeño pequeña mediano mediana buen buena trocitos troceado '
  + 'microondas papillote rebozado rebozada gratinado gratinada crudo cruda tibio tibia caliente frio fria resto mitad entero entera mio mia '
  + 'albahaca perejil oregano tomillo romero cilantro eneldo especias especia sal pimienta pimenton curcuma comino canela jengibre vinagre suravitasan').split(' '))
const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
interface Patron { re: RegExp; a: Alimento; largo: number }
const PATRONES: Patron[] = ALIMENTOS.flatMap((a) => a.s.map((s) => {
  const w = normalizar(s).split(/\s+/)
  // Cada palabra admite plural (s / es); las palabras se separan por espacios.
  const cuerpo = w.map((x) => escapar(x) + '(?:es|s)?').join('\\s+')
  return { re: new RegExp(`(?<![a-zñ0-9])${cuerpo}(?![a-zñ])`, 'g'), a, largo: w.join(' ').length }
})).sort((x, y) => y.largo - x.largo)

export interface Leido {
  alimento: Alimento
  /** Lo que se ha escrito para este alimento. */
  texto: string
  /** Unidades: el número escrito o, sin número, las de la ración. */
  unidades: number
  /** Si se escribió un número (entonces la cantidad del plato no se aplica). */
  conNumero: boolean
  kcal: number
  /** Posición en el texto normalizado. */
  ini: number
  fin: number
}

/** Lee los alimentos de un texto libre. Devuelve lo reconocido y los trozos que no se han reconocido. */
export function leerAlimentos(texto: string): { leidos: Leido[]; sinReconocer: string[] } {
  const original = normalizar(texto ?? '')
  let resto = original
  const hallados: { ini: number; fin: number; a: Alimento; txt: string }[] = []
  for (const p of PATRONES) {
    p.re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = p.re.exec(resto))) {
      hallados.push({ ini: m.index, fin: m.index + m[0].length, a: p.a, txt: m[0] })
      // Se tapa lo encontrado para que una forma más corta no lo cuente otra vez.
      resto = resto.slice(0, m.index) + ' '.repeat(m[0].length) + resto.slice(m.index + m[0].length)
    }
  }
  hallados.sort((x, y) => x.ini - y.ini)
  const leidos: Leido[] = hallados.map((h) => {
    // Número delante, dentro del mismo trozo: «2 huevos», «media manzana», «3 rebanadas de pan».
    const antes = original.slice(0, h.ini).split(/[,;+\-]|\.(?!\d)|\s(?:y|con|e)\s/).pop() ?? ''
    const c = RE_CANT.exec(antes)
    let unidades: number, conNumero = false
    if (c) {
      const v = c[1].replace(',', '.')
      const fr = /^(\d+)\/(\d+)$/.exec(v)
      unidades = fr ? Number(fr[1]) / Math.max(1, Number(fr[2])) : NUMEROS[v] ?? Number(v)
      conNumero = true
    } else {
      const plural = /s$/.test(h.txt) && !h.a.s.some((s) => normalizar(s) === h.txt)
      unidades = plural && h.a.np ? h.a.np : h.a.n ?? 1
    }
    return { alimento: h.a, texto: h.txt, unidades, conNumero, kcal: Math.round(h.a.k * unidades), ini: h.ini, fin: h.fin }
  })
  // «Tortilla de dos huevos», «revuelto de 3 huevos»: los huevos dicen el tamaño, no se suman aparte.
  // «Fruta granada»: la palabra «fruta» delante de una fruta concreta no se cuenta otra vez.
  for (let i = leidos.length - 1; i > 0; i--) {
    const a = leidos[i - 1], b = leidos[i], entre = original.slice(a.fin, b.ini).trim()
    if (b.alimento.id === 'huevo' && (a.alimento.id === 'tortilla' || a.alimento.id === 'huevos_revueltos') && /^(?:de)?(?:\s*\S+)?$/.test(entre) && (entre === '' || entre === 'de' || b.conNumero)) {
      const n = b.conNumero ? b.unidades : 2
      a.unidades = a.alimento.id === 'tortilla' ? n / 2 : n
      a.conNumero = true
      a.kcal = Math.round(a.alimento.k * a.unidades)
      leidos.splice(i, 1)
    } else if (a.alimento.id === 'fruta' && b.alimento.grupo === 'fruta' && entre === '') leidos.splice(i - 1, 1)
    // «Tortitas de harina de castaña», «crepes de harina de avena»: la harina es el ingrediente, no se suma aparte.
    else if (b.alimento.id === 'harina' && !b.conNumero && (a.alimento.id === 'tortitas' || a.alimento.id === 'pan' || a.alimento.id === 'bizcocho') && (entre === '' || entre === 'de')) leidos.splice(i, 1)
  }
  // Lo que no se ha reconocido: trozos separados por comas, «y», «con» o «+» que no son solo palabras de relleno.
  const sinReconocer = resto.split(/[,;+.\n\-\/]|\s(?:y|con|e)\s/).map((x) => x.trim().replace(/\s+/g, ' '))
    .filter((x) => x && !x.split(' ').every((w) => RELLENO.has(w) || RELLENO.has(w.replace(/e?s$/, '')) || RELLENO.has(w.replace(/s$/, '')) || /^\d+(?:[.,/]\d+)?$/.test(w) || RE_UNIDAD.test(w)))
  return { leidos, sinReconocer }
}
