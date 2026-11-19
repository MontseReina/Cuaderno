// @ts-nocheck
// Generado con scripts/build-avisos.mjs a partir de supabase/functions/avisos (no editar a mano).
//#region supabase/functions/avisos/store-stub.ts
/** Sustituto de `src/store` dentro de la función del servidor: las reglas de la app (cycle.ts) leen el paciente con
*  `backend.all('patients')`; aquí devuelve lo que la función ha cargado de la base de datos. */
const datos = {};
function setDatos(tabla, filas) {
	datos[tabla] = filas;
}
const backend = {
	mode: "supabase",
	all: (t) => datos[t] ?? [],
	currentUserId: () => "",
	currentUserName: () => "servidor"
};
//#endregion
//#region supabase/functions/avisos/webpush.ts
/** Web Push con WebCrypto (sin librerías): firma VAPID (RFC 8292) y cifrado aes128gcm (RFC 8291).
*  Funciona igual en Deno (Supabase Edge Functions) y en Node 20+, donde se prueba. */
const enc = new TextEncoder();
function b64urlDecode(s) {
	const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
	const bin = atob(b64);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}
function b64urlEncode(b) {
	const u = b instanceof Uint8Array ? b : new Uint8Array(b);
	let s = "";
	for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
	return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function concat(...parts) {
	const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
	let o = 0;
	for (const p of parts) {
		out.set(p, o);
		o += p.length;
	}
	return out;
}
async function hmac(key, data) {
	const k = await crypto.subtle.importKey("raw", key, {
		name: "HMAC",
		hash: "SHA-256"
	}, false, ["sign"]);
	return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}
/** Cabecera Authorization de VAPID para un endpoint. */
async function vapidAuth(endpoint, keys, nowSec = Math.floor(Date.now() / 1e3)) {
	const pub = b64urlDecode(keys.publicKey);
	const jwk = {
		kty: "EC",
		crv: "P-256",
		ext: true,
		x: b64urlEncode(pub.slice(1, 33)),
		y: b64urlEncode(pub.slice(33, 65)),
		d: keys.privateKey
	};
	const key = await crypto.subtle.importKey("jwk", jwk, {
		name: "ECDSA",
		namedCurve: "P-256"
	}, false, ["sign"]);
	const aud = new URL(endpoint).origin;
	const unsigned = `${b64urlEncode(enc.encode(JSON.stringify({
		typ: "JWT",
		alg: "ES256"
	})))}.${b64urlEncode(enc.encode(JSON.stringify({
		aud,
		exp: nowSec + 43200,
		sub: keys.subject
	})))}`;
	return `vapid t=${unsigned}.${b64urlEncode(await crypto.subtle.sign({
		name: "ECDSA",
		hash: "SHA-256"
	}, key, enc.encode(unsigned)))}, k=${keys.publicKey}`;
}
/** Cifra el contenido para una suscripción (aes128gcm, un solo registro). */
async function encryptPayload(p256dh, auth, plaintext, salt, serverKeys) {
	const uaPublic = b64urlDecode(p256dh);
	const authSecret = b64urlDecode(auth);
	const as = serverKeys ?? await crypto.subtle.generateKey({
		name: "ECDH",
		namedCurve: "P-256"
	}, true, ["deriveBits"]);
	const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", as.publicKey));
	const uaKey = await crypto.subtle.importKey("raw", uaPublic, {
		name: "ECDH",
		namedCurve: "P-256"
	}, false, []);
	const ikm = (await hmac(await hmac(authSecret, new Uint8Array(await crypto.subtle.deriveBits({
		name: "ECDH",
		public: uaKey
	}, as.privateKey, 256))), concat(enc.encode("WebPush: info\0"), uaPublic, asPublic, new Uint8Array([1])))).slice(0, 32);
	const s = salt ?? crypto.getRandomValues(/* @__PURE__ */ new Uint8Array(16));
	const prk = await hmac(s, ikm);
	const cek = (await hmac(prk, concat(enc.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))).slice(0, 16);
	const nonce = (await hmac(prk, concat(enc.encode("Content-Encoding: nonce\0"), new Uint8Array([1])))).slice(0, 12);
	const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
	const padded = concat(plaintext, new Uint8Array([2]));
	const ct = new Uint8Array(await crypto.subtle.encrypt({
		name: "AES-GCM",
		iv: nonce
	}, key, padded));
	return concat(s, new Uint8Array([
		0,
		0,
		16,
		0
	]), new Uint8Array([asPublic.length]), asPublic, ct);
}
/** Manda un aviso a una suscripción. `gone` = la suscripción ya no existe (se borra). */
async function sendPush(sub, data, keys, fetchFn = fetch) {
	const body = await encryptPayload(sub.p256dh, sub.auth, enc.encode(JSON.stringify(data)));
	const res = await fetchFn(sub.endpoint, {
		method: "POST",
		headers: {
			TTL: String(21600),
			Urgency: "high",
			"Content-Encoding": "aes128gcm",
			"Content-Type": "application/octet-stream",
			Authorization: await vapidAuth(sub.endpoint, keys)
		},
		body
	});
	const text = res.ok ? void 0 : (await res.text().catch(() => "")).slice(0, 300);
	return {
		ok: res.ok,
		status: res.status,
		gone: res.status === 404 || res.status === 410,
		text
	};
}
//#endregion
//#region src/domain/catalogs.ts
const SYMPTOMS = [
	{
		key: "fiebre",
		label: "Fiebre o escalofríos",
		when: "siempre",
		redAt3: true
	},
	{
		key: "mucositis",
		label: "Boca: llagas o dolor al comer",
		when: "siempre",
		redAt3: true,
		help: "Leve: le molesta · Moderado: come menos por el dolor · Intenso: no puede comer ni beber"
	},
	{
		key: "piel",
		label: "Piel seca, enrojecida o con heridas",
		when: "siempre"
	},
	{
		key: "cabello",
		label: "Caída del cabello / cuero cabelludo molesto",
		when: "siempre"
	},
	{
		key: "sangrado",
		label: "Sangrado o hematomas",
		when: "siempre",
		redAt3: true,
		help: "Intenso: no cede o hematomas extensos"
	},
	{
		key: "hormigueo",
		label: "Hormigueos o calambres",
		when: "siempre"
	},
	{
		key: "oido",
		label: "Oye peor o pitidos",
		when: "siempre"
	},
	{
		key: "disnea",
		label: "Dificultad para respirar o dolor en el pecho",
		when: "siempre",
		redAt3: true
	},
	{
		key: "flemas",
		label: "Flemas",
		when: "siempre",
		help: "Leve: alguna vez al día · Moderado: le cuesta echarlas · Intenso: constantes o le dificultan respirar"
	},
	{
		key: "somnolencia",
		label: "Somnolencia o confusión inusual",
		when: "siempre",
		redAt3: true
	},
	{
		key: "mareo",
		label: "Mareo o inestabilidad",
		when: "siempre",
		help: "Leve: se marea al levantarse · Moderado: necesita sentarse o apoyarse · Intenso: no se sostiene o se ha desmayado",
		redAt3: true
	},
	{
		key: "nauseas",
		label: "Náuseas",
		when: "siempre",
		help: "Escala de caras 0-10 por la mañana, la tarde y la noche; impacto en comer, arcadas y rescates"
	},
	{
		key: "vomitos",
		label: "Vómitos",
		when: "siempre",
		redAt3: true,
		help: "Intenso: no retiene líquidos"
	},
	{
		key: "distension",
		label: "Plenitud o tripa hinchada",
		when: "ciclo"
	},
	{
		key: "estrenimiento",
		label: "Estreñimiento",
		when: "ciclo"
	},
	{
		key: "reaccion_infusion",
		label: "Reacción en el brazo / picor durante la perfusión",
		when: "ciclo"
	},
	{
		key: "apetito",
		label: "Menos apetito que la semana pasada",
		when: "fuera"
	},
	{
		key: "infeccion",
		label: "Signos de infección (catéter rojo, tos, mocos, dolor al orinar, diarrea)",
		when: "fuera",
		redAt3: true
	},
	{
		key: "energia",
		label: "Menos energía que la semana pasada",
		when: "fuera"
	},
	{
		key: "sueno_alterado",
		label: "Sueño alterado",
		when: "fuera"
	}
];
const pautaNueva = (date) => !!date && date >= "2026-10-18";
/** Las tomas del día, como en New Version: desayuno, media mañana (batido), comida, media tarde (batido) y cena. */
const TOMAS = [
	{
		key: "desayuno",
		label: "Desayuno",
		principal: true
	},
	{
		key: "media_manana",
		label: "Media mañana",
		batido: true
	},
	{
		key: "comida",
		label: "Comida",
		principal: true,
		plato: true
	},
	{
		key: "merienda",
		label: "Media tarde",
		batido: true
	},
	{
		key: "cena",
		label: "Cena",
		principal: true,
		plato: true
	}
];
/** Tipos de vómito por lo que se ve. Los marcados con alerta son señal roja por sí solos. */
const VOMIT_KINDS = [
	{
		value: "alimentario",
		label: "Alimentario",
		help: "Comida sin digerir, poco después de comer"
	},
	{
		value: "acuoso",
		label: "Acuoso o mucoso",
		help: "Líquido claro, saliva o moco; con el estómago vacío"
	},
	{
		value: "bilioso",
		label: "Bilioso",
		help: "Amarillo-verdoso y amargo (bilis); típico tras varios vómitos seguidos"
	},
	{
		value: "espumoso",
		label: "Espumoso",
		help: "Con espuma; suele ser saliva y aire"
	},
	{
		value: "sangre",
		label: "Con sangre roja",
		help: "Sangre roja fresca: avisar al equipo",
		alerta: true
	},
	{
		value: "posos",
		label: "En posos de café",
		help: "Marrón oscuro, como posos: sangre digerida. Avisar al equipo",
		alerta: true
	},
	{
		value: "escopetazo",
		label: "En escopetazo",
		help: "A chorro y sin náusea previa; si se repite, sobre todo con dolor de cabeza, avisar al equipo",
		alerta: true
	},
	{
		value: "fecaloideo",
		label: "Fecaloideo",
		help: "Olor a heces: señal de obstrucción. Avisar al equipo",
		alerta: true
	}
];
const STOOL_COLORS = [
	{
		key: "normal",
		label: "Normal"
	},
	{
		key: "oscuro",
		label: "Muy oscuro / negro"
	},
	{
		key: "sangre",
		label: "Con sangre"
	},
	{
		key: "palido",
		label: "Pálido"
	},
	{
		key: "verdoso",
		label: "Verdoso"
	}
];
const LOCATIONS = [
	{
		value: "casa",
		label: "Casa",
		short: "En casa",
		emoji: "🏠"
	},
	{
		value: "ingreso",
		label: "Ingreso",
		short: "Ingresado",
		emoji: "🏥"
	},
	{
		value: "hospital_dia",
		label: "Hospital de día",
		short: "Hospital de día",
		emoji: "💉"
	},
	{
		value: "urgencias",
		label: "Urgencias",
		short: "En urgencias",
		emoji: "🚑"
	}
];
/** Anexo 2 del protocolo ISG-GEIS-OS-2, pacientes ABCB1/P-glicoproteína negativos: 34 semanas. */
const PROTOCOL_34 = [
	{
		week: 0,
		label: "MTX"
	},
	{
		week: 1,
		label: "CDP + ADM"
	},
	{
		week: 4,
		label: "MTX"
	},
	{
		week: 5,
		label: "CDP + ADM"
	},
	{
		week: 8,
		label: "Cirugía"
	},
	{
		week: 9,
		label: "ADM*"
	},
	{
		week: 12,
		label: "MTX"
	},
	{
		week: 13,
		label: "MTX"
	},
	{
		week: 14,
		label: "CDP"
	},
	{
		week: 17,
		label: "ADM*"
	},
	{
		week: 20,
		label: "MTX"
	},
	{
		week: 21,
		label: "MTX"
	},
	{
		week: 22,
		label: "CDP"
	},
	{
		week: 25,
		label: "ADM*"
	},
	{
		week: 28,
		label: "MTX"
	},
	{
		week: 29,
		label: "MTX"
	},
	{
		week: 30,
		label: "CDP"
	},
	{
		week: 33,
		label: "MTX"
	},
	{
		week: 34,
		label: "MTX"
	}
];
//#endregion
//#region src/domain/dates.ts
const todayStr = () => toDateStr(/* @__PURE__ */ new Date());
function toDateStr(d) {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(dateStr, n) {
	const d = /* @__PURE__ */ new Date(dateStr + "T12:00:00");
	d.setDate(d.getDate() + n);
	return toDateStr(d);
}
function diffDays(a, b) {
	const da = (/* @__PURE__ */ new Date(a.slice(0, 10) + "T12:00:00")).getTime();
	const db = (/* @__PURE__ */ new Date(b.slice(0, 10) + "T12:00:00")).getTime();
	return Math.round((da - db) / 864e5);
}
/** Horas de reloj: las que se escriben a mano en la app (perfusión, ingreso,
*  última comida, citas…). Se guardan y se muestran tal cual, sin cambios de
*  zona horaria: si se escribe 13:25, en todas partes pone 13:25. */
function wallClock(s) {
	if (!s) return "";
	return s.replace(" ", "T").slice(0, 16);
}
function nowLocalInput() {
	const d = /* @__PURE__ */ new Date();
	d.setSeconds(0, 0);
	const off = d.getTimezoneOffset();
	return (/* @__PURE__ */ new Date(d.getTime() - off * 6e4)).toISOString().slice(0, 16);
}
//#endregion
//#region src/domain/protocol.ts
/** Anclas del protocolo (0.39.1, 08/11/2026): el inicio (semana 0) y cada sesión registrada en Tratamiento
*  con su semana del protocolo. El hospital numera las semanas por la secuencia del protocolo, no por el
*  calendario: si una sesión se retrasa (p. ej. la semana 9 fue el 05/11 en vez del 28/10), las semanas
*  siguientes se corren con ella. */
function anclasProtocolo(start, cycles = []) {
	if (!start) return [];
	const out = /* @__PURE__ */ new Map([[0, start.slice(0, 10)]]);
	for (const c of cycles) {
		if (c.deleted_at || c.protocol_week == null) continue;
		out.set(c.protocol_week, (c.start_at ?? c.planned_date).slice(0, 10));
	}
	return [...out.entries()].map(([week, date]) => ({
		week,
		date
	})).sort((a, b) => a.week - b.week);
}
/** Fecha de una semana del protocolo: la registrada si la hay; si no, la última sesión registrada
*  anterior + 7 días por semana. */
function fechaSemana(start, cycles, week) {
	const a = anclasProtocolo(start, cycles).filter((x) => x.week <= week).pop();
	return a ? addDays(a.date, (week - a.week) * 7) : null;
}
/** Nombre completo de cada sesión del Anexo 2 (para el calendario). */
const PLAN_NOMBRE = {
	"MTX": {
		corto: "MTX",
		largo: "Metotrexato",
		tipo: "mtx"
	},
	"CDP + ADM": {
		corto: "CDDP + ADM",
		largo: "Cisplatino y Adriamicina",
		tipo: "cddp"
	},
	"CDP": {
		corto: "CDDP",
		largo: "Cisplatino",
		tipo: "cddp"
	},
	"ADM*": {
		corto: "ADM",
		largo: "Adriamicina (tras la cirugía)",
		tipo: "adm"
	},
	"Cirugía": {
		corto: "Cirugía",
		largo: "Cirugía (posible)",
		tipo: "cirugia"
	}
};
/** Días de quimio y cirugía del protocolo, por fecha. Si en Tratamiento hay una sesión con esa semana
*  del protocolo, manda su fecha real; si no, se calcula desde la última sesión registrada (fechaSemana). */
function calendarioTratamiento(start, cycles) {
	const out = /* @__PURE__ */ new Map();
	if (!start) return out;
	for (const p of PROTOCOL_34) {
		const n = PLAN_NOMBRE[p.label] ?? {
			corto: p.label,
			largo: p.label,
			tipo: "mtx"
		};
		const reg = cycles.find((c) => c.protocol_week === p.week);
		const date = reg ? (reg.start_at ?? reg.planned_date).slice(0, 10) : fechaSemana(start, cycles, p.week) ?? addDays(start, p.week * 7);
		out.set(date, {
			week: p.week,
			...n,
			registrada: !!reg,
			ciclo: null
		});
	}
	const regDates = cycles.filter((c) => (c.drugs ?? []).some((d) => [
		"MTX",
		"CDDP",
		"ADM",
		"HDIFO"
	].includes(d))).map((c) => (c.start_at ?? c.planned_date).slice(0, 10));
	const pendientes = Array.from(out.entries()).filter(([, d]) => d.tipo !== "cirugia" && !d.registrada).map(([date]) => date);
	const todas = [...regDates.map((date) => ({
		date,
		reg: true
	})), ...pendientes.map((date) => ({
		date,
		reg: false
	}))].sort((a, b) => a.date.localeCompare(b.date) || (a.reg === b.reg ? 0 : a.reg ? -1 : 1));
	for (const [date, d] of out) {
		if (d.tipo === "cirugia") continue;
		const reg = d.registrada ? cycles.find((c) => c.protocol_week === d.week) : void 0;
		const i = todas.findIndex((x) => x.date === date && x.reg === d.registrada);
		d.ciclo = reg?.number ?? (i >= 0 ? i + 1 : null);
	}
	return out;
}
//#endregion
//#region src/domain/fases.ts
const KIND = {
	"MTX": "mtx",
	"CDP + ADM": "cddp",
	"CDP": "cddp",
	"ADM*": "cddp",
	"Cirugía": "cirugia"
};
function sesionesTratamiento(start, cycles) {
	const out = [];
	const usadas = /* @__PURE__ */ new Set();
	for (const c of cycles) {
		const ds = c.drugs ?? [];
		const kind = ds.includes("MTX") ? "mtx" : ds.includes("CDDP") || ds.includes("ADM") ? "cddp" : null;
		if (!kind) continue;
		const date = (c.start_at ?? c.planned_date).slice(0, 10);
		out.push({
			date,
			end: (c.end_at ?? c.start_at ?? c.planned_date).slice(0, 10),
			kind,
			week: c.protocol_week ?? null,
			cycle: c,
			delProtocolo: false
		});
		if (c.protocol_week != null) usadas.add(c.protocol_week);
	}
	if (start) for (const p of PROTOCOL_34) {
		if (usadas.has(p.week)) continue;
		const date = fechaSemana(start, cycles, p.week) ?? addDays(start, p.week * 7);
		out.push({
			date,
			end: date,
			kind: KIND[p.label] ?? "mtx",
			week: p.week,
			delProtocolo: true
		});
	}
	return out.sort((a, b) => a.date.localeCompare(b.date));
}
/** Fase y tramo de un día:
*  - La víspera de un metotrexato y los 7 días desde su inicio (D0-D6) → semana de metotrexato.
*  - 7 días desde el inicio del cisplatino y/o adriamicina (D0-D6) → semana de cisplatino.
*  - Desde el 8.º día (D7) hasta la siguiente sesión → semana nadir (tramo «nadir» hasta D14).
*  - Cirugía, o más de 7 días tras un metotrexato sin otra sesión → null. */
function faseDelDia(start, cycles, date, sesiones) {
	const ses = sesiones ?? sesionesTratamiento(start, cycles);
	const manana = addDays(date, 1);
	if (!ses.some((s) => s.date === date) && ses.some((s) => s.kind === "mtx" && s.date === manana)) return {
		fase: "mtx",
		tramo: "vispera",
		dia: -1
	};
	const last = ses.filter((s) => s.date <= date).pop();
	if (!last || last.kind === "cirugia") return null;
	const d = diffDays(date, last.date);
	if (last.kind === "mtx") {
		if (d > 6) return null;
		const finRescate = last.cycle?.rescue?.end ? last.cycle.rescue.end.slice(0, 10) : addDays(last.date, 3);
		return {
			fase: "mtx",
			tramo: date <= last.end ? "perfusion" : date <= finRescate ? "rescate" : "resto",
			dia: d
		};
	}
	if (d <= 6) return {
		fase: "cddp",
		tramo: date <= (last.cycle?.end_at ? last.end : addDays(last.date, 2)) ? "perfusion48" : "alta",
		dia: d
	};
	return {
		fase: "nadir",
		tramo: d <= 14 ? "nadir" : null,
		dia: d
	};
}
//#endregion
//#region src/domain/cycle.ts
/** Ventana "en ciclo": desde el inicio hasta 24 h tras el fin de la infusión, a la hora (CDDP/ADM; decisión de
*  Montserrate del 04/10/2026, antes eran 48 h en días completos)
*  o hasta el fin del rescate con folinato (MTX). Si no hay datos, D0-D4. */
/** Inicio del protocolo del paciente (para las sesiones de la hoja que aún no están en Tratamiento). */
function protocolStart() {
	try {
		return backend.all("patients")[0]?.protocol_start ?? null;
	} catch {
		return null;
	}
}
/** Sesión del protocolo (aún sin registrar en Tratamiento) posterior al último ciclo registrado: se trata como
*  un ciclo provisional con la fecha de la hoja, igual que hacen el calendario y las pautas (30/09/2026: el cisplatino
*  del día aún no registrado salía como «nadir» del metotrexato anterior). */
function sesionProvisional(start, cycles, date, ultimo) {
	if (!start) return null;
	const s = sesionesTratamiento(start, cycles).filter((x) => x.delProtocolo && x.kind !== "cirugia" && x.date <= date).pop();
	if (!s) return null;
	if (ultimo && (ultimo.start_at ?? ultimo.planned_date).slice(0, 10) >= s.date) return null;
	const ciclo = calendarioTratamiento(start, cycles).get(s.date)?.ciclo ?? null;
	return {
		id: `protocolo-${s.week}`,
		patient_id: "",
		number: ciclo ?? ultimo?.number ?? 1,
		protocol_week: s.week,
		drugs: s.kind === "mtx" ? ["MTX"] : ["CDDP", "ADM"],
		planned_date: s.date,
		corticoid_iv: false
	};
}
/** Momento (hora de reloj) en que termina la ventana «en ciclo» del cisplatino + adriamicina: fin de la perfusión + 24 h. */
function finVentanaCiclo(cycle) {
	if (cycle.drugs.includes("MTX") || !cycle.end_at) return null;
	return new Date((/* @__PURE__ */ new Date(wallClock(cycle.end_at) + ":00Z")).getTime() + 864e5).toISOString().slice(0, 16);
}
function cycleContext(cycles, date) {
	const started = cycles.filter((c) => (c.start_at ?? c.planned_date) <= date + "T23:59").sort((a, b) => (b.start_at ?? b.planned_date).localeCompare(a.start_at ?? a.planned_date));
	const start = protocolStart();
	const cycle = sesionProvisional(start, cycles, date, started[0] ?? null) ?? started[0] ?? null;
	if (!cycle) return {
		cycle: null,
		day: null,
		inCycle: false,
		nadir: false,
		mtxDay: false,
		phase: "sin_ciclos",
		fase: null
	};
	const d0 = (cycle.start_at ?? cycle.planned_date).slice(0, 10);
	const day = diffDays(date, d0);
	const esMtx = cycle.drugs.includes("MTX");
	let inCycle;
	if (!esMtx && cycle.end_at) {
		const libre = finVentanaCiclo(cycle);
		const ref = date === todayStr() ? nowLocalInput() : date + "T23:59";
		inCycle = day >= 0 && ref < libre;
	} else {
		let windowEnd = esMtx ? 4 : 3;
		if (esMtx && cycle.rescue?.end) windowEnd = Math.max(0, diffDays(cycle.rescue.end.slice(0, 10), d0));
		else if (cycle.end_at) windowEnd = diffDays(cycle.end_at.slice(0, 10), d0) + 2;
		if (cycle.discharge_at) windowEnd = Math.max(windowEnd, diffDays(cycle.discharge_at.slice(0, 10), d0));
		inCycle = day >= 0 && day <= windowEnd;
	}
	const nadir = !cycle.drugs.includes("MTX") && day >= 7 && day <= 14;
	const mtxDay = cycle.drugs.includes("MTX") && day >= 0 && (cycle.rescue?.end ? date <= cycle.rescue.end.slice(0, 10) : day <= 4);
	return {
		cycle,
		day,
		inCycle,
		nadir,
		mtxDay,
		phase: inCycle ? "en_ciclo" : nadir ? "valle" : day < 0 ? "previo" : "recuperacion",
		fase: faseDelDia(start, cycles, date)?.fase ?? null
	};
}
/** Semáforo diario. Regla propuesta, pendiente de validación por oncología. */
/** Otros síntomas escritos a mano (0.42.0): solo los que tienen texto. */
function otrosSintomas(log) {
	return (log?.extra?.other_symptoms ?? []).filter((o) => o.text?.trim());
}
/** Fecha (YYYY-MM-DD) del final de la última quimio iniciada hasta `date` (fin de la infusión o, si no consta, inicio). */
function lastChemoDate(cycles, date) {
	const started = cycles.filter((c) => (c.start_at ?? c.planned_date).slice(0, 10) <= date).map((c) => (c.end_at ?? c.start_at ?? c.planned_date).slice(0, 10)).filter((d) => d <= date).sort();
	return started.length ? started[started.length - 1] : null;
}
/** Productos que cuentan los días desde el final del ciclo (el cisplatino + adriamicina) y no desde
*  la última quimio. Decisión de Montserrate (27/09/2026): solo el ginseng. */
function countsFromCycleEnd(p) {
	return /ginseng/i.test(p.name ?? "");
}
/** Regla «empezar N días después de la quimio»: devuelve desde cuándo se puede dar y si hoy aún no toca.
*  El ginseng cuenta desde el final del ciclo: si la última sesión fue solo metotrexato, espera
*  al cisplatino + adriamicina de ese ciclo. */
function afterChemoGate(p, cycles, date) {
	if (!p.after_chemo_days) return null;
	const n = p.after_chemo_days;
	if (!countsFromCycleEnd(p)) {
		const chemo = lastChemoDate(cycles, date);
		if (!chemo) return null;
		const from = addDays(chemo, n);
		return {
			from,
			chemo,
			waiting: date < from,
			basis: "ultima"
		};
	}
	const startOf = (c) => (c.start_at ?? c.planned_date).slice(0, 10);
	const closes = (c) => (c.drugs ?? []).includes("CDDP") || (c.drugs ?? []).includes("ADM");
	const last = cycles.filter((c) => startOf(c) <= date).sort((a, b) => startOf(a).localeCompare(startOf(b))).at(-1);
	if (!last) return null;
	if (closes(last)) {
		const chemo = (last.end_at ?? last.start_at ?? last.planned_date).slice(0, 10);
		const from = addDays(chemo, n);
		return {
			from,
			chemo,
			waiting: date < from,
			basis: "fin_ciclo"
		};
	}
	const next = cycles.filter((c) => closes(c) && startOf(c) > date).sort((a, b) => startOf(a).localeCompare(startOf(b)))[0];
	if (next) return {
		from: addDays(startOf(next), n),
		chemo: startOf(next),
		waiting: true,
		basis: "fin_ciclo",
		planned: true
	};
	return {
		from: null,
		chemo: null,
		waiting: true,
		basis: "fin_ciclo"
	};
}
//#endregion
//#region src/domain/alimentos.ts
const A = (id, nombre, grupo, u, k, s, n, np) => ({
	id,
	nombre,
	grupo,
	u,
	k,
	s,
	n,
	np
});
const VERDURAS = [
	A("brocoli", "Brócoli", "verdura", "1 ración (150 g)", 50, [
		"brocoli",
		"brocolis",
		"brecol"
	]),
	A("coliflor", "Coliflor", "verdura", "1 ración (150 g)", 38, ["coliflor"]),
	A("col", "Col o repollo", "verdura", "1 ración (150 g)", 35, [
		"col",
		"repollo",
		"lombarda",
		"col lombarda"
	]),
	A("col_china", "Col china", "verdura", "1 ración (150 g)", 25, [
		"col china",
		"pak choi",
		"bok choy"
	]),
	A("kale", "Kale", "verdura", "1 ración (100 g)", 45, ["kale", "col rizada"]),
	A("coles_bruselas", "Coles de Bruselas", "verdura", "1 ración (100 g)", 43, ["coles de bruselas", "col de bruselas"]),
	A("espinacas", "Espinacas", "verdura", "1 ración (100 g)", 23, ["espinaca", "espinacas"]),
	A("acelgas", "Acelgas", "verdura", "1 ración (150 g)", 30, ["acelga", "acelgas"]),
	A("judias_verdes", "Judías verdes", "verdura", "1 ración (150 g)", 45, [
		"judias verdes",
		"judia verde",
		"judiasverdes",
		"vainas"
	]),
	A("calabacin", "Calabacín", "verdura", "1 ración (150 g)", 25, ["calabacin", "calabacines"]),
	A("berenjena", "Berenjena", "verdura", "1 ración (150 g)", 38, ["berenjena"]),
	A("calabaza", "Calabaza", "verdura", "1 ración (200 g)", 50, ["calabaza"]),
	A("zanahoria", "Zanahoria", "verdura", "1 mediana (80 g)", 32, ["zanahoria"], 1, 2),
	A("pimiento", "Pimiento", "verdura", "1/2 pimiento (100 g)", 30, [
		"pimiento",
		"pimientos asados",
		"pimiento asado"
	]),
	A("tomate", "Tomate", "verdura", "1 mediano (150 g)", 30, [
		"tomate",
		"tomate natural",
		"tomate rallado"
	]),
	A("tomate_frito", "Tomate frito o salsa de tomate", "verdura", "2 cucharadas (40 g)", 30, [
		"tomate frito",
		"salsa de tomate",
		"tomate triturado"
	]),
	A("cherry", "Tomates cherry", "verdura", "1 puñado (6 unidades)", 12, [
		"tomates cherry",
		"tomate cherry",
		"cherrys",
		"cherry"
	]),
	A("cebolla", "Cebolla", "verdura", "1/4 de cebolla (50 g)", 20, ["cebolla", "cebolleta"]),
	A("puerro", "Puerro", "verdura", "1 puerro (100 g)", 30, ["puerro"]),
	A("alcachofa", "Alcachofas", "verdura", "4 corazones (150 g)", 65, ["alcachofa", "alcachofas"]),
	A("esparragos", "Espárragos", "verdura", "6 espárragos (100 g)", 25, [
		"esparrago",
		"esparragos",
		"trigueros",
		"esparragos trigueros"
	]),
	A("setas", "Setas o champiñones", "verdura", "1 puñado (100 g)", 25, [
		"seta",
		"setas",
		"champiñon",
		"champiñones",
		"boletus",
		"shiitake"
	]),
	A("hojas", "Lechuga u hojas verdes", "verdura", "1 puñado (50 g)", 10, [
		"lechuga",
		"canonigos",
		"rucula",
		"escarola",
		"brotes",
		"hojas verdes",
		"berros",
		"endibia",
		"endibias"
	]),
	A("ensalada", "Ensalada", "verdura", "1 plato (150 g)", 30, [
		"ensalada",
		"ensalada verde",
		"ensalada mixta"
	]),
	A("pepino", "Pepino", "verdura", "1/2 pepino (80 g)", 12, ["pepino"]),
	A("apio", "Apio", "verdura", "1 rama (50 g)", 8, ["apio"]),
	A("remolacha", "Remolacha", "verdura", "1 ración (100 g)", 45, ["remolacha"]),
	A("hinojo", "Hinojo", "verdura", "1/2 bulbo (100 g)", 30, ["hinojo"]),
	A("verduras", "Verduras", "verdura", "1 ración (200 g)", 60, [
		"verdura",
		"verduras",
		"verduras al vapor",
		"verdura al vapor",
		"menestra"
	]),
	A("salteado", "Salteado de verduras", "verdura", "1 plato (200 g)", 110, [
		"salteado de verduras",
		"verduras salteadas",
		"wok de verduras"
	]),
	A("pisto", "Pisto", "verdura", "1 ración (200 g)", 140, ["pisto", "samfaina"]),
	A("pure", "Puré o crema de verduras", "verdura", "1 cuenco (300 ml)", 120, [
		"pure",
		"crema",
		"crema de verduras",
		"pure de verduras"
	]),
	A("sopa", "Sopa de verduras", "verdura", "1 cuenco (300 ml)", 80, ["sopa", "sopa de verduras"]),
	A("caldo", "Caldo", "bebida", "1 taza (250 ml)", 25, [
		"caldo",
		"caldo de verduras",
		"caldo de pollo",
		"caldo de huesos"
	])
];
/** «Puré de calabaza», «crema de calabacín»…: un solo puré, sin contar la verdura otra vez. */
const PURES = VERDURAS.filter((v) => v.grupo === "verdura" && ![
	"pure",
	"sopa",
	"ensalada",
	"verduras",
	"salteado",
	"pisto",
	"hojas",
	"cherry",
	"tomate_frito"
].includes(v.id)).flatMap((v) => v.s.map((w) => w));
const PROTEINAS = [
	A("pollo", "Pechuga de pollo", "proteina", "1 pechuga pequeña (130 g)", 145, [
		"pollo",
		"pechuga",
		"pechuga de pollo",
		"pollo a la plancha",
		"pollo desmigado",
		"pollo asado"
	]),
	A("pollo_muslo", "Muslos o contramuslos de pollo", "proteina", "2 contramuslos (150 g limpios)", 230, [
		"contramuslo",
		"contramuslos",
		"muslo de pollo",
		"muslos de pollo",
		"muslitos",
		"muslito",
		"alitas",
		"alitas de pollo"
	]),
	A("codorniz", "Codorniz", "proteina", "1 codorniz", 190, [
		"codorniz",
		"codornices",
		"alitas de codorniz"
	]),
	A("bacon", "Beicon o panceta", "proteina", "2 lonchas (30 g)", 120, [
		"bacon",
		"beicon",
		"beacon",
		"panceta",
		"chorizo",
		"salchichon",
		"fuet",
		"salchicha",
		"salchichas"
	]),
	A("pavo", "Pavo", "proteina", "1 filete (130 g)", 140, [
		"pavo",
		"filete de pavo",
		"pechuga de pavo",
		"secreto de pavo"
	]),
	A("pavo_fiambre", "Pavo cocido en lonchas", "proteina", "3-4 lonchas (50 g)", 55, [
		"pavo cocido",
		"fiambre de pavo",
		"lonchas de pavo",
		"pavo en lonchas",
		"jamon de pavo",
		"jamon pavo"
	]),
	A("jamon", "Jamón serrano", "proteina", "2 lonchas (30 g)", 75, [
		"jamon",
		"jamon serrano",
		"jamon iberico"
	]),
	A("jamon_york", "Jamón cocido", "proteina", "2 lonchas (30 g)", 35, ["jamon york", "jamon cocido"]),
	A("ternera", "Ternera", "proteina", "1 filete (140 g)", 200, [
		"ternera",
		"filete de ternera",
		"carne de ternera",
		"carne roja",
		"buey",
		"entrecot"
	]),
	A("carne_picada", "Carne picada o albóndigas", "proteina", "1 ración (130 g)", 250, [
		"carne picada",
		"albondiga",
		"albondigas"
	]),
	A("hamburguesa", "Hamburguesa (solo la carne)", "proteina", "1 hamburguesa (120 g)", 250, ["hamburguesa", "hamburguesas"]),
	A("cerdo", "Cerdo", "proteina", "1 ración (130 g)", 190, [
		"cerdo",
		"lomo",
		"solomillo",
		"solomillo de cerdo",
		"lomo de cerdo",
		"secreto",
		"costillas"
	]),
	A("cordero", "Cordero", "proteina", "1 ración (130 g)", 300, ["cordero"]),
	A("conejo", "Conejo", "proteina", "1 ración (150 g)", 200, ["conejo"]),
	A("salmon", "Salmón", "proteina", "1 lomo (150 g)", 300, ["salmon"]),
	A("salmon_ahumado", "Salmón ahumado", "proteina", "2 lonchas (40 g)", 70, ["salmon ahumado"]),
	A("atun", "Atún o bonito fresco", "proteina", "1 rodaja (150 g)", 200, [
		"atun",
		"bonito",
		"atun fresco",
		"tataki"
	]),
	A("atun_lata", "Atún en lata", "proteina", "1 lata pequeña (60 g escurrido)", 120, [
		"atun en lata",
		"lata de atun",
		"atun al natural",
		"atun en aceite"
	]),
	A("sardinas", "Sardinas", "proteina", "1 ración (150 g)", 210, [
		"sardina",
		"sardinas",
		"sardinillas"
	]),
	A("caballa", "Caballa", "proteina", "1 ración (150 g)", 285, ["caballa", "verdel"]),
	A("boquerones", "Boquerones", "proteina", "1 ración (150 g)", 170, [
		"boqueron",
		"boquerones",
		"anchoas frescas"
	]),
	A("anchoas", "Anchoas en lata", "proteina", "5 anchoas (20 g)", 40, ["anchoa", "anchoas"]),
	A("merluza", "Merluza o pescado blanco", "proteina", "1 lomo (150 g)", 120, [
		"merluza",
		"pescado",
		"pescado blanco",
		"bacalao",
		"gallo",
		"lenguado",
		"rape",
		"pescadilla",
		"abadejo",
		"panga"
	]),
	A("lubina", "Lubina", "proteina", "1 ración (150 g)", 170, ["lubina", "corvina"]),
	A("dorada", "Dorada", "proteina", "1 ración (150 g)", 240, ["dorada"]),
	A("trucha", "Trucha", "proteina", "1 ración (150 g)", 210, ["trucha"]),
	A("marisco", "Gambas o langostinos", "proteina", "1 ración (100 g pelados)", 90, [
		"gamba",
		"gambas",
		"langostino",
		"langostinos",
		"marisco"
	]),
	A("mejillones", "Mejillones", "proteina", "1 ración (150 g)", 130, [
		"mejillon",
		"mejillones",
		"almejas",
		"berberechos"
	]),
	A("calamar", "Calamar, sepia o pulpo", "proteina", "1 ración (150 g)", 120, [
		"calamar",
		"calamares",
		"sepia",
		"pulpo",
		"chipirones"
	]),
	A("huevo", "Huevo", "proteina", "1 huevo", 70, [
		"huevo",
		"huevo cocido",
		"huevo duro",
		"huevo a la plancha",
		"huevo frito",
		"huevo poche",
		"yema",
		"yemas"
	], 1, 2),
	A("huevos_revueltos", "Huevos revueltos", "proteina", "1 huevo", 85, [
		"revuelto",
		"huevos revueltos",
		"revuelto de huevo"
	], 2, 2),
	A("tortilla", "Tortilla francesa", "proteina", "1 tortilla (2 huevos)", 200, ["tortilla", "tortilla francesa"]),
	A("tofu", "Tofu", "proteina", "1 ración (125 g)", 150, ["tofu"]),
	A("tempeh", "Tempeh", "proteina", "1 ración (100 g)", 190, ["tempeh"]),
	A("proteina_polvo", "Proteína en polvo", "proteina", "1 cacito (25 g)", 95, [
		"proteina",
		"proteina en polvo",
		"proteina de guisante",
		"whey",
		"colageno"
	])
];
const LACTEOS = [
	A("yogur", "Yogur natural", "lacteo", "1 yogur (125 g)", 110, [
		"yogur",
		"yogurt",
		"iogurt",
		"yogur natural",
		"yogur de oveja",
		"yogur de cabra"
	]),
	A("yogur_coco", "Yogur de coco", "lacteo", "1 yogur (125 g)", 120, [
		"yogur de coco",
		"yogurt de coco",
		"iogurt de coco"
	]),
	A("yogur_griego", "Yogur griego", "lacteo", "1 yogur (125 g)", 150, ["yogur griego"]),
	A("kefir", "Kéfir", "lacteo", "1 vaso (200 ml)", 120, ["kefir"]),
	A("cuajada", "Cuajada", "lacteo", "1 cuajada (125 g)", 120, ["cuajada"]),
	A("queso", "Queso curado o semicurado", "lacteo", "1 cuña (30 g)", 120, [
		"queso",
		"queso curado",
		"queso semicurado",
		"queso de cabra",
		"queso de oveja",
		"manchego",
		"queso rallado"
	]),
	A("queso_fresco", "Queso fresco", "lacteo", "2 rodajas (60 g)", 110, [
		"queso fresco",
		"queso de burgos",
		"mozzarella",
		"burrata",
		"feta"
	]),
	A("queso_crema", "Queso crema", "lacteo", "1 cucharada colmada (30 g)", 75, [
		"queso crema",
		"queso untable",
		"philadelphia"
	]),
	A("requeson", "Requesón", "lacteo", "2 cucharadas (50 g)", 75, ["requeson", "ricotta"]),
	A("parmesano", "Parmesano", "lacteo", "1 cucharada (10 g)", 40, ["parmesano"]),
	A("leche", "Leche", "lacteo", "1 vaso (250 ml)", 160, [
		"leche",
		"leche de vaca",
		"leche sin lactosa"
	]),
	A("bebida_vegetal", "Bebida vegetal", "lacteo", "1 vaso (250 ml)", 50, [
		"bebida vegetal",
		"leche de coco",
		"leche de almendras",
		"leche de avena",
		"leche de arroz",
		"bebida de coco",
		"bebida de almendras",
		"bebida de avena"
	]),
	A("leche_coco_lata", "Leche de coco de lata", "grasa", "1/4 de lata (100 ml)", 190, [
		"leche de coco de lata",
		"crema de coco",
		"nata de coco"
	]),
	A("nata", "Nata", "grasa", "2 cucharadas (30 ml)", 100, ["nata"])
];
const HIDRATOS = [
	A("patata", "Patata", "hidrato", "1 mediana (150 g)", 115, [
		"patata",
		"patata cocida",
		"patata asada",
		"papa",
		"patatas al horno"
	], 1, 1),
	A("patatas_fritas", "Patatas fritas", "hidrato", "1 ración (100 g)", 300, ["patatas fritas", "patata frita"]),
	A("boniato", "Boniato", "hidrato", "1 mediano (150 g)", 135, [
		"boniato",
		"batata",
		"moniato"
	]),
	A("arroz", "Arroz", "hidrato", "1 plato pequeño (150 g cocido)", 195, [
		"arroz",
		"arroz blanco",
		"arroz integral",
		"arroz basmati",
		"risotto"
	]),
	A("quinoa", "Quinoa", "hidrato", "1 plato pequeño (150 g cocida)", 180, ["quinoa", "quinua"]),
	A("pasta", "Pasta", "hidrato", "1 plato (60 g en crudo)", 210, [
		"pasta",
		"macarrones",
		"espaguetis",
		"fideos",
		"pasta sin gluten",
		"tallarines",
		"noodles"
	]),
	A("cereal_cocido", "Trigo sarraceno, mijo o cuscús", "hidrato", "1 plato pequeño (150 g cocido)", 160, [
		"trigo sarraceno",
		"alforfon",
		"mijo",
		"cuscus",
		"bulgur",
		"amaranto"
	]),
	A("pan", "Pan", "hidrato", "1 rebanada (30 g)", 75, [
		"pan",
		"pan sin gluten",
		"pan de trigo sarraceno",
		"pan integral",
		"pan de molde",
		"bocadillo"
	], 2),
	A("tostada", "Tostada", "hidrato", "1 tostada (30 g)", 75, [
		"tostada",
		"tostada de pan",
		"tostadas de pan"
	], 1, 2),
	A("tortitas_arroz", "Tortitas de arroz o maíz", "hidrato", "1 tortita", 30, [
		"tortitas de arroz",
		"tortitas de maiz",
		"tortita de arroz"
	], 3),
	A("avena", "Copos de avena o cereales", "hidrato", "4 cucharadas (40 g)", 150, [
		"avena",
		"copos de avena",
		"cereales",
		"muesli",
		"granola",
		"porridge",
		"gachas"
	]),
	A("yuca", "Yuca o plátano macho", "hidrato", "1 ración (150 g)", 240, [
		"yuca",
		"mandioca",
		"platano macho",
		"patacones",
		"patacon",
		"tostones"
	]),
	A("crema_arroz", "Crema de arroz", "hidrato", "2 cucharadas (20 g)", 72, ["crema de arroz", "harina de arroz"]),
	A("crackers", "Crackers o picos", "hidrato", "1 puñado (30 g)", 130, [
		"cracker",
		"crackers",
		"picos",
		"regañas",
		"tostas"
	]),
	A("maiz", "Maíz", "hidrato", "1 ración (100 g)", 90, ["maiz", "mazorca"]),
	A("legumbres", "Legumbres cocidas", "hidrato", "1 plato (200 g cocidas)", 230, [
		"legumbres",
		"lentejas",
		"garbanzos",
		"alubias",
		"judias blancas",
		"guisantes",
		"habas",
		"azukis",
		"frijoles"
	]),
	A("harina", "Harina (castaña, almendra, coco)", "hidrato", "4 cucharadas (40 g)", 150, [
		"harina",
		"harina de castaña",
		"harina de trigo sarraceno"
	])
];
const FRUTAS = [
	A("manzana", "Manzana", "fruta", "1 manzana (150 g)", 80, [
		"manzana",
		"manzana asada",
		"compota"
	]),
	A("pera", "Pera", "fruta", "1 pera (150 g)", 85, ["pera"]),
	A("platano", "Plátano", "fruta", "1 plátano (120 g)", 105, ["platano", "banana"]),
	A("naranja", "Naranja", "fruta", "1 naranja (180 g)", 85, ["naranja", "pomelo"]),
	A("mandarina", "Mandarina", "fruta", "1 mandarina (70 g)", 35, ["mandarina", "clementina"], 1, 2),
	A("kiwi", "Kiwi", "fruta", "1 kiwi", 50, ["kiwi"], 1, 2),
	A("uvas", "Uvas", "fruta", "1 racimo pequeño (120 g)", 85, ["uva", "uvas"]),
	A("caqui", "Caqui", "fruta", "1 caqui", 105, [
		"caqui",
		"kaki",
		"persimon"
	]),
	A("granada", "Granada", "fruta", "1/2 granada", 75, ["granada"]),
	A("fresas", "Fresas", "fruta", "1 ración (150 g)", 50, [
		"fresa",
		"fresas",
		"freson",
		"fresones"
	]),
	A("frutos_rojos", "Frutos rojos", "fruta", "1 puñado (60 g)", 30, [
		"frutos rojos",
		"frutos del bosque",
		"arandanos",
		"arandano",
		"frambuesas",
		"frambuesa",
		"moras",
		"cerezas"
	]),
	A("melocoton", "Melocotón o nectarina", "fruta", "1 pieza", 60, [
		"melocoton",
		"nectarina",
		"paraguayo",
		"albaricoque",
		"albaricoques"
	]),
	A("ciruela", "Ciruelas", "fruta", "2 ciruelas", 50, ["ciruela", "ciruelas"]),
	A("pina", "Piña", "fruta", "2 rodajas (150 g)", 75, ["piña"]),
	A("mango", "Mango", "fruta", "1/2 mango", 100, ["mango", "papaya"]),
	A("melon", "Melón o sandía", "fruta", "1 tajada (200 g)", 65, ["melon", "sandia"]),
	A("higos", "Higos", "fruta", "2 higos", 75, ["higo", "higos"]),
	A("datiles", "Dátiles", "fruta", "2 dátiles", 130, ["datil", "datiles"]),
	A("pasas", "Pasas o fruta desecada", "fruta", "1 cucharada (15 g)", 45, [
		"pasas",
		"orejones",
		"fruta desecada",
		"ciruelas pasas"
	]),
	A("fruta", "Fruta", "fruta", "1 pieza", 75, ["fruta", "pieza de fruta"]),
	A("zumo", "Zumo", "bebida", "1 vaso (200 ml)", 90, ["zumo", "zumo de naranja"]),
	A("limon", "Limón", "fruta", "1 chorrito", 3, ["limon", "lima"])
];
const GRASAS = [
	A("aceite", "Aceite", "grasa", "1 cucharada (10 ml)", 90, [
		"aceite",
		"aceite de oliva",
		"aove",
		"aceite de coco",
		"aceite de sesamo"
	]),
	A("mct", "Aceite MCT", "grasa", "1 cucharada (15 ml)", 120, ["mct", "aceite mct"]),
	A("mantequilla", "Mantequilla o ghee", "grasa", "1 cucharadita (10 g)", 75, [
		"mantequilla",
		"ghee",
		"margarina"
	]),
	A("aguacate", "Aguacate", "grasa", "1/2 aguacate (80 g)", 130, ["aguacate", "guacamole"]),
	A("aceitunas", "Aceitunas", "grasa", "6-8 aceitunas", 40, [
		"aceituna",
		"aceitunas",
		"olivas"
	]),
	A("frutos_secos", "Frutos secos", "grasa", "1 puñado (20 g)", 125, [
		"frutos secos",
		"almendra",
		"almendras",
		"nuez",
		"nueces",
		"avellana",
		"avellanas",
		"anacardo",
		"anacardos",
		"pistacho",
		"pistachos",
		"macadamia",
		"macadamias",
		"piñones",
		"nueces de brasil"
	]),
	A("cacahuetes", "Cacahuetes", "grasa", "1 puñado (20 g)", 115, [
		"cacahuete",
		"cacahuetes",
		"mani"
	]),
	A("crema_fs", "Crema de frutos secos o tahini", "grasa", "1 cucharada (15 g)", 95, [
		"crema de almendras",
		"crema de avellanas",
		"crema de cacahuete",
		"mantequilla de cacahuete",
		"tahini",
		"tahin",
		"crema de frutos secos",
		"crema de anacardos"
	]),
	A("semillas", "Semillas", "grasa", "1 cucharada (10 g)", 50, [
		"semillas",
		"lino",
		"linaza",
		"chia",
		"sesamo",
		"pipas",
		"semillas de calabaza",
		"semillas de girasol",
		"semillas de lino",
		"semillas de chia",
		"cañamo"
	]),
	A("coco", "Coco rallado", "grasa", "1 cucharada (10 g)", 65, [
		"coco",
		"coco rallado",
		"coco seco",
		"coco deshidratado"
	]),
	A("mayonesa", "Mayonesa o alioli", "grasa", "1 cucharada (15 g)", 100, [
		"mayonesa",
		"alioli",
		"salsa"
	]),
	A("hummus", "Hummus", "grasa", "2 cucharadas (50 g)", 150, ["hummus", "humus"])
];
const DULCES = [
	A("miel", "Miel", "dulce", "1 cucharadita (10 g)", 30, [
		"miel",
		"sirope",
		"sirope de agave",
		"melaza"
	]),
	A("azucar", "Azúcar", "dulce", "1 cucharadita (8 g)", 32, ["azucar", "panela"]),
	A("mermelada", "Mermelada", "dulce", "1 cucharadita (15 g)", 35, ["mermelada", "confitura"]),
	A("chocolate", "Chocolate negro", "dulce", "2 onzas (20 g)", 115, [
		"chocolate",
		"chocolate negro",
		"onza",
		"onzas"
	]),
	A("nibs", "Nibs de cacao", "dulce", "1 cucharadita (5 g)", 30, [
		"nibs",
		"nibs de cacao",
		"nibs de chocolate",
		"cacao",
		"cacao puro"
	]),
	A("galletas", "Galletas", "dulce", "3 galletas (30 g)", 140, [
		"galleta",
		"galletas",
		"cookies"
	]),
	A("bizcocho", "Bizcocho o bizcochito", "dulce", "1 porción (60 g)", 230, [
		"bizcocho",
		"bizcochito",
		"bizcochitos",
		"brownie",
		"banana bread"
	]),
	A("muffin", "Muffin o magdalena", "dulce", "1 unidad", 250, [
		"muffin",
		"muffins",
		"magdalena",
		"magdalenas",
		"cupcake"
	]),
	A("bolleria", "Bollería", "dulce", "1 pieza", 260, [
		"croissant",
		"cruasan",
		"napolitana",
		"bolleria",
		"donut",
		"ensaimada"
	]),
	A("tarta", "Tarta", "dulce", "1 porción (100 g)", 300, ["tarta", "pastel"]),
	A("helado", "Helado", "dulce", "2 bolas (100 g)", 200, ["helado"]),
	A("pudding_chia", "Pudding de chía", "dulce", "1 vaso", 220, [
		"pudding de chia",
		"pudin de chia",
		"pudding",
		"pudding de chia con leche de coco",
		"pudding de chia con bebida vegetal",
		"pudding de chia con leche de almendras"
	]),
	A("natillas", "Natillas, flan o arroz con leche", "dulce", "1 unidad", 150, [
		"natillas",
		"flan",
		"arroz con leche",
		"crema catalana"
	]),
	A("tortitas", "Tortitas o crepes", "dulce", "3 tortitas", 250, [
		"tortitas",
		"tortita",
		"pancakes",
		"crepes",
		"crepe",
		"gofre",
		"gofres"
	]),
	A("barrita", "Barrita", "dulce", "1 barrita", 200, [
		"barrita",
		"barritas",
		"barrita energetica",
		"barrita de proteina"
	]),
	A("bunuelo", "Buñuelo", "dulce", "1 buñuelo", 110, [
		"buñuelo",
		"buñuelos",
		"buñuelo de crema",
		"buñuelos de crema",
		"profiterol",
		"profiteroles"
	]),
	A("rollito", "Rollito salado de horno", "dulce", "1 rollito", 330, ["rollito", "rollitos"])
];
const PLATOS = [
	A("tortilla_patata", "Tortilla de patata", "plato", "1 ración (150 g)", 230, [
		"tortilla de patata",
		"tortilla de patatas",
		"tortilla española"
	]),
	A("paella", "Paella o arroz con cosas", "plato", "1 plato (300 g)", 420, [
		"paella",
		"arroz con pollo",
		"arroz con verduras",
		"arroz meloso",
		"arroz caldoso"
	]),
	A("lentejas", "Lentejas o garbanzos guisados", "plato", "1 plato (300 g)", 330, [
		"lentejas estofadas",
		"cocido",
		"potaje",
		"fabada",
		"garbanzos con espinacas"
	]),
	A("croquetas", "Croquetas", "plato", "3 croquetas", 230, ["croqueta", "croquetas"]),
	A("empanadilla", "Empanadilla o empanada", "plato", "1 pieza", 200, [
		"empanadilla",
		"empanadillas",
		"empanada"
	]),
	A("pizza", "Pizza", "plato", "2 porciones", 500, ["pizza"]),
	A("sandwich", "Sándwich", "plato", "1 sándwich", 300, [
		"sandwich",
		"sandwiches",
		"mixto",
		"wrap",
		"wrap de yuca",
		"bocadillo de jamon",
		"bocadillo"
	]),
	A("ensaladilla", "Ensaladilla", "plato", "1 ración (200 g)", 300, ["ensaladilla", "ensaladilla rusa"]),
	A("gazpacho", "Gazpacho o salmorejo", "plato", "1 vaso (250 ml)", 120, ["gazpacho", "salmorejo"]),
	A("lasana", "Lasaña o canelones", "plato", "1 ración (250 g)", 400, [
		"lasaña",
		"canelones",
		"musaka",
		"moussaka"
	]),
	A("batido", "Batido", "plato", "1 vaso grande", 350, [
		"batido",
		"smoothie",
		"licuado"
	]),
	A("sushi", "Sushi", "plato", "8 piezas", 350, [
		"sushi",
		"maki",
		"poke"
	]),
	A("pan_tomate", "Pan con tomate", "plato", "1 tostada", 140, ["pan con tomate", "tostada con tomate"]),
	A("huevos_rotos", "Huevos rotos", "plato", "1 plato", 500, ["huevos rotos", "huevos con patatas"])
];
const BEBIDAS = [
	A("cafe_leche", "Café con leche", "bebida", "1 taza", 70, [
		"cafe con leche",
		"cortado",
		"capuchino",
		"latte"
	]),
	A("sin_kcal", "Agua, café solo o infusión", "bebida", "1 vaso o taza", 0, [
		"agua",
		"cafe",
		"cafe solo",
		"te",
		"infusion",
		"manzanilla",
		"tila",
		"poleo",
		"rooibos"
	]),
	A("refresco", "Refresco", "bebida", "1 lata", 140, [
		"refresco",
		"cola",
		"coca cola",
		"fanta",
		"tonica"
	]),
	A("alcohol", "Cerveza o vino", "bebida", "1 caña o copa", 100, [
		"cerveza",
		"vino",
		"cava",
		"sidra"
	])
];
const PURE = VERDURAS.find((v) => v.id === "pure");
/** Puré o crema de una verdura concreta: cuenta como el puré, no como la verdura. */
PURE.s = [...PURE.s, ...PURES.flatMap((w) => [`pure de ${w}`, `crema de ${w}`])];
const ALIMENTOS = [
	...VERDURAS,
	...PROTEINAS,
	...LACTEOS,
	...HIDRATOS,
	...FRUTAS,
	...GRASAS,
	...DULCES,
	...PLATOS,
	...BEBIDAS
];
/** Minúsculas y sin tildes (la ñ se queda). */
const normalizar = (t) => t.toLowerCase().replace(/(.)\1{2,}/g, "$1$1").replace(/ñ/g, "\0").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\u0000/g, "ñ");
const NUMEROS = {
	un: 1,
	una: 1,
	uno: 1,
	dos: 2,
	tres: 3,
	cuatro: 4,
	cinco: 5,
	seis: 6,
	medio: .5,
	media: .5,
	"un poco de": .5,
	poco: .5,
	"un par de": 2,
	par: 2
};
const UNIDADES = "rebanadas?|lonchas?|cucharadas?|cucharaditas?|cdas?|cdtas?|pu(?:ñ|n)ados?|vasos?|tazas?|piezas?|filetes?|trozos?|latas?|unidades?|uds?|raciones?|platos?|cuencos?|bolas?|onzas?|lomos?|rodajas?|tajadas?|porciones?|cacitos?|chorritos?|hojas?";
const RE_CANT = new RegExp(`(?:^|\\s)(\\d+\\/\\d+|\\d+(?:[.,]\\d+)?|un par de|un poco de|un|una|uno|dos|tres|cuatro|cinco|seis|medio|media|poco|par)\\s+(?:(?:${UNIDADES})\\s+)?(?:de\\s+)?$`);
const RE_UNIDAD = new RegExp(`^(?:${UNIDADES})$`);
/** Palabras que no son alimentos y no hace falta reconocer. */
const RELLENO = new Set("un una uno unos unas dos tres cuatro cinco seis medio media poco mucho algo par de del con sin y e o al a la el los las lo en para por mas menos tambien solo sola siempre habitual plancha horno vapor asado asada asados asadas cocido cocida cocidos cocidas hervido hervida frito frita fritos fritas salteado salteada guisado guisada estofado estofada casero casera natural integral grande pequeño pequeña mediano mediana buen buena trocitos troceado microondas papillote rebozado rebozada gratinado gratinada crudo cruda tibio tibia caliente frio fria resto mitad entero entera mio mia albahaca perejil oregano tomillo romero cilantro eneldo especias especia sal pimienta pimenton curcuma comino canela jengibre vinagre suravitasan".split(" "));
const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const PATRONES = ALIMENTOS.flatMap((a) => a.s.map((s) => {
	const w = normalizar(s).split(/\s+/);
	const cuerpo = w.map((x) => escapar(x) + "(?:es|s)?").join("\\s+");
	return {
		re: new RegExp(`(?<![a-zñ0-9])${cuerpo}(?![a-zñ])`, "g"),
		a,
		largo: w.join(" ").length
	};
})).sort((x, y) => y.largo - x.largo);
/** Lee los alimentos de un texto libre. Devuelve lo reconocido y los trozos que no se han reconocido. */
function leerAlimentos(texto) {
	const original = normalizar(texto ?? "");
	let resto = original;
	const hallados = [];
	for (const p of PATRONES) {
		p.re.lastIndex = 0;
		let m;
		while (m = p.re.exec(resto)) {
			hallados.push({
				ini: m.index,
				fin: m.index + m[0].length,
				a: p.a,
				txt: m[0]
			});
			resto = resto.slice(0, m.index) + " ".repeat(m[0].length) + resto.slice(m.index + m[0].length);
		}
	}
	hallados.sort((x, y) => x.ini - y.ini);
	const leidos = hallados.map((h) => {
		const antes = original.slice(0, h.ini).split(/[,;+\-]|\.(?!\d)|\s(?:y|con|e)\s/).pop() ?? "";
		const c = RE_CANT.exec(antes);
		let unidades, conNumero = false;
		if (c) {
			const v = c[1].replace(",", ".");
			const fr = /^(\d+)\/(\d+)$/.exec(v);
			unidades = fr ? Number(fr[1]) / Math.max(1, Number(fr[2])) : NUMEROS[v] ?? Number(v);
			conNumero = true;
		} else unidades = /s$/.test(h.txt) && !h.a.s.some((s) => normalizar(s) === h.txt) && h.a.np ? h.a.np : h.a.n ?? 1;
		return {
			alimento: h.a,
			texto: h.txt,
			unidades,
			conNumero,
			kcal: Math.round(h.a.k * unidades),
			ini: h.ini,
			fin: h.fin
		};
	});
	for (let i = leidos.length - 1; i > 0; i--) {
		const a = leidos[i - 1], b = leidos[i], entre = original.slice(a.fin, b.ini).trim();
		if (b.alimento.id === "huevo" && (a.alimento.id === "tortilla" || a.alimento.id === "huevos_revueltos") && /^(?:de)?(?:\s*\S+)?$/.test(entre) && (entre === "" || entre === "de" || b.conNumero)) {
			const n = b.conNumero ? b.unidades : 2;
			a.unidades = a.alimento.id === "tortilla" ? n / 2 : n;
			a.conNumero = true;
			a.kcal = Math.round(a.alimento.k * a.unidades);
			leidos.splice(i, 1);
		} else if (a.alimento.id === "fruta" && b.alimento.grupo === "fruta" && entre === "") leidos.splice(i - 1, 1);
		else if (b.alimento.id === "harina" && !b.conNumero && (a.alimento.id === "tortitas" || a.alimento.id === "pan" || a.alimento.id === "bizcocho") && (entre === "" || entre === "de")) leidos.splice(i, 1);
	}
	return {
		leidos,
		sinReconocer: resto.split(/[,;+.\n\-\/]|\s(?:y|con|e)\s/).map((x) => x.trim().replace(/\s+/g, " ")).filter((x) => x && !x.split(" ").every((w) => RELLENO.has(w) || RELLENO.has(w.replace(/e?s$/, "")) || RELLENO.has(w.replace(/s$/, "")) || /^\d+(?:[.,/]\d+)?$/.test(w) || RE_UNIDAD.test(w)))
	};
}
//#endregion
//#region src/domain/batido.ts
const RECETA_BATIDO = {
	media_manana: {
		guisante_g: 30,
		platano: 1 / 2,
		platanoTxt: "½ plátano",
		ml: 200
	},
	merienda: {
		guisante_g: 15,
		platano: 1 / 3,
		platanoTxt: "⅓ de plátano",
		ml: 100
	}
};
/** Líquido del batido si no se escribe nada en «Líquido» (13/11/2026): 200 ml media mañana, 100 ml media tarde. */
const BATIDO_ML_TOMA = {
	media_manana: 200,
	merienda: 100
};
//#endregion
//#region src/domain/kcal.ts
/** Kilocalorías estimadas (0.33.0, como New Version).
*  - Si se escribe algo en «Otro», sustituye al menú: cada alimento reconocido cuenta por su ración casera (o por el
*    número escrito) y por la cantidad marcada (en comida y cena, la parte del plato dibujado; si no, Entera,
*    ¾, Media o Casi nada).
*  - Si no se escribe nada, cuentan los platos del menú de ese día (o el batido en media mañana y media tarde).
*  Son una estimación para saber más o menos cuánto come al día: ni un tope ni un objetivo. */
/** Cantidad de cada parte del plato dibujado: nada, poca, la que toca y (hidratos) más de la que toca. */
const FACTOR_PLATO = {
	veg: [
		0,
		.5,
		1
	],
	prot: [
		0,
		.5,
		1
	],
	starch: [
		0,
		.5,
		1,
		1.5
	]
};
ALIMENTOS.find((a) => a.id === "batido");
/** ¿Cuenta esta toma como tomada? Marcada con algo distinto de «No», o con algo escrito o una hora. */
const tomada = (m) => !!m && m.fraction !== 0 && (m.fraction != null || !!m.note?.trim() || !!m.dessert?.trim() || !!m.time || !!m.end);
/** Parte que se tomó de cada zona del plato dibujado y la media para el resto (aceite, salsas). Lo que no se
*  marca en el plato toma la cantidad de Entera / ¾ / Media / Casi nada (1 si tampoco hay). */
function factoresPlato(m) {
	const base = m?.fraction != null && m.fraction > 0 ? m.fraction : 1;
	const f = (k) => {
		const n = m?.macros?.[k];
		return n == null ? null : FACTOR_PLATO[k][n] ?? 1;
	};
	const veg = f("veg"), prot = f("prot"), hid = f("starch");
	const marcados = [
		veg,
		prot,
		hid
	].filter((v) => v != null);
	const resto = marcados.length ? marcados.reduce((s, v) => s + v, 0) / marcados.length : base;
	return {
		veg: veg ?? base,
		prot: prot ?? base,
		hid: hid ?? base,
		resto
	};
}
/** Platos del menú que cuentan en una toma: los guardados al marcarla o, si no, los del menú del día. */
function platosDeToma(m, menu) {
	if (m.dishes?.length) return m.dishes;
	return menu?.platos(m.slot) ?? [];
}
//#endregion
//#region src/domain/completeness.ts
/** ¿Está el registro del día completo? Diario + comidas y líquidos + actividad del día.
*  Protocolo: menos de la mitad → rojo · de la mitad en adelante → naranja · todo → verde. */
/** Los síntomas no son un punto obligatorio: si no se marca nada, es que no hay síntomas. */
function dayCompleteness(log, date, med, tomasMeta = 3) {
	const diario = `/diario/${date}`;
	const has = (v) => v !== void 0 && v !== null && v !== "";
	const items = [
		{
			key: "location",
			label: "Dónde está",
			done: has(log?.location),
			to: diario,
			diario: true,
			group: "Signos y síntomas"
		},
		{
			key: "temp",
			label: "Temperatura",
			done: has(log?.temp_max) || !!log?.extra?.not_measured?.temp,
			to: diario,
			diario: true,
			group: "Signos y síntomas"
		},
		{
			key: "orina",
			label: "Orina",
			done: has(log?.urine_color) || has(log?.urine_amount) || !!log?.extra?.not_measured?.urine,
			to: diario,
			diario: true,
			group: "Signos y síntomas"
		},
		{
			key: "deposiciones",
			label: "Deposiciones",
			done: has(log?.stools_n),
			to: diario,
			diario: true,
			group: "Signos y síntomas"
		},
		{
			key: "dolor",
			label: "Dolor",
			done: has(log?.pain_max),
			to: diario,
			diario: true,
			group: "Signos y síntomas"
		},
		{
			key: "fatiga",
			label: "Fatiga",
			done: has(log?.fatigue),
			to: diario,
			diario: true,
			group: "Signos y síntomas"
		},
		{
			key: "animo",
			label: "Ánimo",
			done: has(log?.mood_child),
			to: diario,
			diario: true,
			group: "Signos y síntomas"
		},
		{
			key: "preventivos",
			label: "Cuidados preventivos",
			done: Object.values(log?.preventive ?? {}).some(Boolean),
			to: diario,
			diario: true,
			group: "Signos y síntomas"
		},
		{
			key: "medicacion",
			label: med && med.planned > 0 ? `Tomas de medicación (${med.taken}/${med.planned})` : "Tomas de medicación",
			done: !med || med.planned === 0 || med.taken >= med.planned,
			to: "/medicacion",
			group: "Medicación"
		},
		{
			key: "comidas",
			label: "Comidas",
			done: (log?.meals ?? []).filter((m) => tomada(m)).length >= tomasMeta,
			to: `/nutricion/${date}`,
			group: "Nutrición"
		},
		{
			key: "liquidos",
			label: "Líquidos",
			done: (log?.fluids_total_ml ?? 0) > 0 || (log?.water_ml ?? 0) > 0 || (log?.broth_cups ?? 0) > 0 || (log?.seawater_ml ?? 0) > 0,
			to: `/hidratacion/${date}`,
			group: "Hidratación"
		},
		{
			key: "biohacking",
			label: "Sueño y sincronizadores",
			done: has(log?.sleep_start) || has(log?.sleep_end) || !!log?.wakeups || [
				log?.ir_morning,
				log?.ir_night,
				log?.glasses,
				log?.daylight_morning,
				log?.daylight_afternoon,
				log?.sun_exposure
			].some(Boolean) || Object.keys(log?.extra?.sync ?? {}).length > 0,
			to: `/biohacking/${date}`,
			group: "Biohacking"
		},
		{
			key: "ejercicio",
			label: "Ejercicio",
			done: has(log?.steps) || has(log?.activity_min) || Object.values(log?.activity ?? {}).some(Boolean) || Object.values(log?.extra?.move_after ?? {}).some(Boolean) || Object.values(log?.extra?.mano ?? {}).some(Boolean) || Object.values(log?.extra?.functional ?? {}).some((v) => v !== void 0 && v !== null && v !== "") || Object.values(log?.extra?.ex_no ?? {}).some(Boolean),
			to: `/ejercicio/${date}`,
			group: "Ejercicio"
		}
	];
	const done = items.filter((i) => i.done).length;
	const total = items.length;
	const half = Math.ceil(total / 2);
	return {
		items,
		done,
		total,
		level: done === total ? "verde" : done >= half ? "amarillo" : "rojo",
		missing: items.filter((i) => !i.done),
		missingGroups: groupMissing(items)
	};
}
function groupMissing(items) {
	const out = [];
	for (const i of items.filter((x) => !x.done)) {
		const g = out.find((x) => x.group === i.group);
		if (g) {
			g.n++;
			g.labels.push(i.label.toLowerCase());
		} else out.push({
			group: i.group,
			to: i.to,
			n: 1,
			labels: [i.label.toLowerCase()]
		});
	}
	return out;
}
//#endregion
//#region src/domain/medication.ts
/** Ventana de cirugía apuntada en Medicación (desde · alta). */
function surgeryWindow() {
	try {
		const p = backend.all("patients")[0];
		return p?.surgery_from ? {
			from: p.surgery_from.slice(0, 10),
			to: p.surgery_to ? p.surgery_to.slice(0, 10) : null
		} : null;
	} catch {
		return null;
	}
}
/** ¿Ese día está dentro de la ventana de cirugía? (sin alta apuntada sigue abierta). */
function inSurgeryWindow(date) {
	const w = surgeryWindow();
	return !!w && date >= w.from && (!w.to || date <= w.to);
}
/** Ventana del semáforo en la que estamos ese día (cirugía, día de infusión, ciclo, nadir…).
*  La cirugía manda sobre las demás (0.35.0). */
function trafficWindow(ctx, date) {
	if (inSurgeryWindow(date)) return "cirugia";
	if (!ctx.cycle) return null;
	if (ctx.day === 0 || ctx.inCycle && ctx.cycle.end_at && date <= ctx.cycle.end_at.slice(0, 10)) return "infusion";
	if (ctx.inCycle) return ctx.cycle.drugs.includes("MTX") ? "mtx" : "cddp_adm";
	return ctx.nadir ? "nadir" : null;
}
/** Cuántas tomas de medicación y suplementos tocaban ese día y cuántas están marcadas.
*  Con `soloMomentos` se cuentan solo las tomas de esos momentos del día (para la pantalla «Hoy»). */
function medicationProgress(products, intakes, cycles, date, soloMomentos) {
	const wk = trafficWindow(cycleContext(cycles, date), date);
	const dow = (/* @__PURE__ */ new Date(date + "T12:00")).getDay();
	let planned = 0;
	let taken = 0;
	for (const p of products) {
		if (p.end_date && p.end_date <= date) continue;
		if (p.start_date && p.start_date > date) continue;
		if (!p.moments?.length) continue;
		if (p.condition) continue;
		if (p.weekdays?.length && !p.weekdays.includes(dow)) continue;
		if (afterChemoGate(p, cycles, date)?.waiting) continue;
		if (wk && p.traffic?.[wk] === "rojo") continue;
		for (const m of p.moments) {
			if (soloMomentos && !soloMomentos.includes(m)) continue;
			const it = intakes.find((i) => i.product_id === p.id && i.date === date && i.moment === m);
			if (it?.status === "no_precisa") continue;
			planned++;
			if (it?.taken || it?.status === "dada") taken++;
		}
	}
	return {
		planned,
		taken
	};
}
//#endregion
//#region src/domain/nutrition.ts
function hoursDiff(a, b) {
	const [ah, am] = a.split(":").map(Number);
	const [bh, bm] = b.split(":").map(Number);
	return Math.round((bh * 60 + bm - (ah * 60 + am)) / 60 * 10) / 10;
}
/** ¿En esta comida comió algo? Si está marcada "Nada" (o todo a cero) no cuenta
*  para el ayuno: si no cenó, la última ingesta es la merienda o la comida. */
/** Hora de empezar y de terminar de una toma (si solo hay una, vale para las dos). */
const iniDe = (m) => m.time || m.end || null;
const finDe = (m) => m.end || m.time || null;
function comio(m) {
	if (!iniDe(m)) return false;
	if (m.fraction === 0) return false;
	if (m.fraction != null && m.fraction > 0) return true;
	const mc = m.macros;
	if (mc && (mc.veg || mc.prot || mc.starch || mc.fat)) return true;
	if (m.carb || m.texture || m.note || m.amount) return true;
	return m.fraction == null && !mc;
}
/** Comidas que cuentan para el ayuno, ordenadas por hora. */
function ingestas(log) {
	return (log?.meals ?? []).filter(comio).sort((x, y) => (iniDe(x) ?? "").localeCompare(iniDe(y) ?? ""));
}
/** Ayuno nocturno con el detalle de qué comidas se han usado. */
function overnightFastDetail(today, yesterday) {
	const last = ingestas(yesterday).sort((x, y) => (finDe(x) ?? "").localeCompare(finDe(y) ?? "")).pop();
	const first = ingestas(today)[0];
	const lt = last && finDe(last), ft = first && iniDe(first);
	if (!lt || !ft) return null;
	return {
		hours: Math.round((24 - hoursDiff("00:00", lt) + hoursDiff("00:00", ft)) * 10) / 10,
		last: {
			...last,
			time: lt
		},
		first: {
			...first,
			time: ft
		}
	};
}
/** Ayuno nocturno: desde la última ingesta real de ayer hasta la primera de hoy. */
function overnightFast(today, yesterday) {
	return overnightFastDetail(today, yesterday)?.hours ?? null;
}
/** Horas de ayuno del día: las tecleadas a mano tienen prioridad; si no, se calculan. */
function fastingHours(today, yesterday) {
	if (today?.extra?.fasting_h != null) return today.extra.fasting_h;
	return overnightFast(today, yesterday);
}
/** Modo de la semana: manual si se ha elegido; si no, "quimio" en ciclo o D0-D6 y "nadir" desde D7. */
/** Modo de la semana (comidas de quimio o de nadir). Decisión 28/09/2026: sigue la misma regla que las pautas
*  de alimentación y el calendario: **semana nadir desde el 8.º día del cisplatino** hasta la siguiente quimio;
*  semana de metotrexato y de cisplatino = semana de quimio. Se puede forzar a mano. Sin sesiones registradas
*  alrededor de ese día, se deduce del ciclo como antes. */
function weekMode(log, ctx) {
	if (log?.extra?.mode) return log.extra.mode;
	if (ctx.fase) return ctx.fase === "nadir" ? "nadir" : "quimio";
	if (!ctx.cycle || ctx.day == null) return "nadir";
	if (ctx.inCycle || ctx.day >= 0 && ctx.day < 7) return "quimio";
	return "nadir";
}
/** Total de líquidos: si se tecleó el total se usa; si no, suma agua + agua de mar + caldo + infusiones. */
function totalFluids(log) {
	if (!log) return null;
	if (log.fluids_total_ml != null) return log.fluids_total_ml;
	const sum = [
		log.water_ml ?? 0,
		log.seawater_ml ?? 0,
		(log.broth_cups ?? 0) * 200,
		(log.extra?.infusion_cups ?? 0) * 200
	].reduce((a, b) => a + b, 0);
	return sum > 0 ? sum : null;
}
//#endregion
//#region src/domain/avisos.ts
/** Meta de líquidos del día (ml): 1.500 (Montserrate, 18/10/2026). */
const AGUA_DIA_ML = 1500;
/** Tomas al día: 4 en semana de quimio (puede ser media mañana o media tarde) y 5 en el resto. */
const TOMAS_DIA = {
	quimio: 4,
	nadir: 5
};
/** Tomas que tocaría llevar a cada hora. Se cuentan, no se mira cuáles. */
const TOMAS_A_LA_HORA = {
	quimio: {
		"12": 1,
		"16": 2,
		"19": 3
	},
	nadir: {
		"12": 2,
		"16": 3,
		"19": 4
	}
};
/** Temperaturas apuntadas que tocaría llevar (la app tiene 3 huecos: mañana, tarde y noche). */
const TEMPS_A_LA_HORA = {
	"12": 1,
	"19": 2
};
/** Cena terminada como tarde a las 19:30 y a la cama 2 h después de terminarla (Montserrate, 18/10/2026: dormir bien
*  a las 21:30). El aviso de la cena va 30 min antes del límite, en el de las 19 h. */
const CENA_LIMITE = "19:30";
/** Caminar después de cada comida principal (Montserrate, 18/10/2026): aviso al terminar (hora de fin apuntada; si no,
*  30 min después de empezar). Solo en casa: tras la operación, traumatología puede limitar que camine. */
const PRINCIPALES = [
	"desayuno",
	"comida",
	"cena"
];
const DE_LA = {
	desayuno: "del desayuno",
	comida: "de la comida",
	cena: "de la cena"
};
const enCasa = (log) => !log?.location || log.location === "casa";
/** Momentos que reciben también los móviles con perfil «parte». */
const MOMENTOS_PARTE = (momento) => momento === "parte" || momento.startsWith("tendencia");
const min = (hhmm) => {
	const [h, m] = hhmm.split(":").map(Number);
	return h * 60 + (m || 0);
};
const hhmmDe = (mins) => {
	const m = (Math.round(mins) % 1440 + 1440) % 1440;
	return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};
/** «08:40» → «8:40». */
const hora$1 = (hhmm) => hhmm.replace(/^0(\d)/, "$1");
const ml = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
/** Hora de despertar de ese día (Biohacking); si no está apuntada, las 8:00. */
function horaDespertar(log) {
	const s = log?.sleep_end;
	if (s && /^\d{1,2}:\d{2}/.test(s)) return s.slice(0, 5).padStart(5, "0");
	return "08:00";
}
/** Agua que tocaría llevar a una hora: 500 ml a las 4 h de despertarse, 900 a las 8, 1.250 a las 11 y 1.500 a las 13
*  (con despertar a las 8: 500 a las 12, 900 a las 16 y 1.250 a las 19, lo aprobado). Redondeado a 50 ml. */
function aguaALaHora(hhmm, despertar = "08:00") {
	const h = (min(hhmm) - min(despertar)) / 60;
	const puntos = [
		[0, 0],
		[4, 500],
		[8, 900],
		[11, 1250],
		[13, AGUA_DIA_ML]
	];
	if (h <= 0) return 0;
	if (h >= 13) return AGUA_DIA_ML;
	for (let i = 1; i < puntos.length; i++) {
		const [h1, v1] = puntos[i];
		const [h0, v0] = puntos[i - 1];
		if (h <= h1) return Math.round((v0 + (v1 - v0) * (h - h0) / (h1 - h0)) / 50) * 50;
	}
	return AGUA_DIA_ML;
}
BATIDO_ML_TOMA.media_manana;
/** Mililitros de líquido de media mañana y media tarde. Lo escrito en «Líquido (ml)» manda; si no hay nada, el
*  batido (no el snack del menú ni otra cosa escrita) cuenta por la parte tomada: 200 ml media mañana y 100 ml
*  media tarde (13/11/2026; antes 250 y nada). */
function batidoMl(log) {
	let total = 0;
	for (const m of log?.meals ?? []) {
		if (!TOMAS.find((x) => x.key === m.slot)?.batido || !tomada(m)) continue;
		if (m.liquid_ml != null) {
			total += Math.max(0, m.liquid_ml);
			continue;
		}
		const ml = BATIDO_ML_TOMA[m.slot];
		if (!ml || m.choice === "menu" || m.note?.trim()) continue;
		total += ml * (m.fraction != null && m.fraction > 0 ? m.fraction : 1);
	}
	return Math.round(total);
}
/** Líquidos del día con el batido incluido. */
function liquidosDelDia(log) {
	return (totalFluids(log) ?? 0) + (log?.fluids_total_ml != null ? 0 : batidoMl(log));
}
/** Tomas hechas (las marcadas con algo distinto de «No», con algo escrito o con hora). */
const tomasHechas = (log) => (log?.meals ?? []).filter((m) => tomada(m)).length;
/** Temperaturas apuntadas ese día (mañana, tarde, noche). «No se ha podido medir» cuenta como apuntada. */
function temperaturasApuntadas(log) {
	const v = log?.extra?.vitals ?? {};
	let n = [
		"manana",
		"tarde",
		"noche"
	].filter((k) => v[k]?.temp != null).length;
	if (n === 0 && log?.temp_max != null) n = 1;
	if (log?.extra?.not_measured?.temp) n = Math.max(n, 2);
	return n;
}
/** Días desde el último peso (pesadas o el peso del registro diario). null si nunca se ha pesado. */
function diasDesdePeso(date, logs, weights) {
	const ultima = [...weights.map((w) => w.at.slice(0, 10)), ...logs.filter((l) => l.weight != null).map((l) => l.date)].filter((d) => d <= date).sort().pop();
	if (!ultima) return null;
	return Math.round(((/* @__PURE__ */ new Date(date + "T12:00")).getTime() - (/* @__PURE__ */ new Date(ultima + "T12:00")).getTime()) / 864e5);
}
/** Días seguidos, contando hoy, sin deposición apuntada. */
function diasSinDeposicion(date, logs) {
	const por = new Map(logs.map((l) => [l.date, l]));
	let n = 0;
	for (let d = date; n < 15; d = addDays(d, -1)) {
		if ((por.get(d)?.stools_n ?? 0) > 0) break;
		n++;
	}
	return n;
}
/** Tomas que pide el registro de ese día: desde la pauta del 18/10/2026, 4 en semana de quimio y 5 en el resto
*  (las mismas que los avisos); antes, 3. */
function tomasMetaDelDia(log, cycles, date) {
	return pautaNueva(date) ? TOMAS_DIA[modoDelDia(log, cycles, date)] : 3;
}
function modoDelDia(log, cycles, date) {
	return weekMode(log, cycleContext(cycles, date));
}
/** «un vaso», «un vaso y medio», «2 vasos»… (vaso = 200 ml). */
function vasos(mlFaltan) {
	const medios = Math.max(1, Math.ceil(mlFaltan / 100));
	const enteros = Math.floor(medios / 2);
	const medio = medios % 2 === 1;
	if (enteros === 0) return "medio vaso";
	if (enteros === 1) return medio ? "un vaso y medio" : "un vaso";
	return `${enteros} vasos${medio ? " y medio" : ""}`;
}
const ARTICULO = {
	desayuno: "el desayuno",
	media_manana: "la media mañana",
	comida: "la comida",
	merienda: "la media tarde",
	cena: "la cena"
};
function siguienteToma(log) {
	const t = TOMAS.find((x) => !tomada((log?.meals ?? []).find((m) => m.slot === x.key)));
	return t ? ARTICULO[t.key] ?? t.label.toLowerCase() : null;
}
const tomasTxt = (n) => `${n} ${n === 1 ? "toma hecha" : "tomas hechas"}`;
/** Controles de un momento del día (12, 16 o 19 h), con las líneas del aviso para lo que va por detrás. */
function controlesDelMomento(m, d) {
	const { log } = d;
	const modo = modoDelDia(log, d.cycles, d.date);
	const out = [];
	const agua = liquidosDelDia(log);
	const metaAgua = aguaALaHora(m === "12" ? "12:00" : m === "16" ? "16:00" : "19:00", horaDespertar(log));
	const okAgua = agua >= metaAgua;
	out.push({
		area: "agua",
		valor: agua,
		meta: metaAgua,
		ok: okAgua,
		linea: okAgua ? void 0 : m === "19" ? `💧 ${ml(agua)} ml apuntados. Con ${vasos(AGUA_DIA_ML - agua)} más antes de dormir, completa el día.` : agua === 0 ? `💧 Buen momento para empezar con el agua: ${vasos(metaAgua)} y estará en su ritmo ${m === "12" ? "de mediodía" : "de la tarde"}.` : `💧 ${ml(agua)} ml apuntados${m === "16" ? ", buen camino" : ""}. Con ${vasos(metaAgua - agua)} más estará en su ritmo ${m === "12" ? "de mediodía" : "de la tarde"}.`
	});
	const n = tomasHechas(log);
	const metaT = TOMAS_A_LA_HORA[modo][m];
	const okT = n >= metaT;
	const sig = siguienteToma(log);
	out.push({
		area: "comidas",
		valor: n,
		meta: metaT,
		ok: okT,
		linea: okT ? void 0 : n === 0 ? "🍽 El desayuno le dará energía para empezar el día." : modo === "quimio" || !sig ? `🍽 ${tomasTxt(n)}. Con una más, va a su ritmo.` : `🍽 ${tomasTxt(n)}. Ahora toca ${sig}.`
	});
	const metaTemp = TEMPS_A_LA_HORA[m];
	if (metaTemp != null) {
		const t = temperaturasApuntadas(log);
		const ok = t >= metaTemp;
		out.push({
			area: "temperatura",
			valor: t,
			meta: metaTemp,
			ok,
			linea: ok ? void 0 : m === "12" ? "🌡 Cuando podáis, tomad la temperatura de la mañana y apuntadla." : t === 0 ? "🌡 Cuando podáis, tomad la temperatura y apuntadla." : "🌡 Un momento para la temperatura de la tarde y listo."
		});
	}
	if (m === "12") {
		const dias = diasDesdePeso(d.date, d.logs, d.weights);
		const ok = dias != null && dias < 3;
		out.push({
			area: "peso",
			valor: dias,
			meta: 3,
			ok,
			linea: ok ? void 0 : dias == null ? "⚖️ Hoy toca pesarle." : `⚖️ Hoy toca pesarle: el último peso fue hace ${dias} días.`
		});
	}
	if (m === "19") {
		const cena = (log?.meals ?? []).find((x) => x.slot === "cena");
		const ok = tomada(cena);
		out.push({
			area: "cena",
			valor: ok ? 1 : 0,
			meta: 1,
			ok,
			linea: ok ? void 0 : `🌙 La cena, como tarde a las ${hora$1(CENA_LIMITE)}, para que a las 21:30 pueda dormir bien.`
		});
	}
	if (m === "19") {
		const dias = diasSinDeposicion(d.date, d.logs);
		const ok = dias < 2;
		out.push({
			area: "deposiciones",
			valor: dias,
			meta: 2,
			ok,
			linea: ok ? void 0 : `🚽 Llevamos ${dias} días sin deposición apuntada. Si ha ido al baño, apuntadlo; si no, vigilad cómo sigue mañana.`
		});
	}
	return out;
}
const TITULOS = {
	"12": "Huma · Mediodía 🌿",
	"16": "Huma · Tarde 🌿",
	"19": "Huma · Recta final 🌿",
	"21": "Huma · Cierre del día",
	"2130": "Huma · Para mañana",
	cama: "Huma · A dormir 🌙",
	caminar: "Huma · A caminar 🚶",
	mano: "Huma · Ejercicios de la mano ✋",
	ayuno11: "Huma · Buenos días 🌅",
	ayuno12: "Huma · Buenos días 🌅",
	parte: "Huma · Parte del día 🌅",
	prueba: "Huma · Aviso de prueba"
};
/** Aviso de las 12, 16 o 19 h: solo las líneas de lo que va por detrás; null si todo va bien. */
function avisoDelMomento(m, controles) {
	const lineas = controles.filter((c) => !c.ok && c.linea).map((c) => c.linea);
	if (!lineas.length) return null;
	return {
		title: TITULOS[m],
		body: lineas.join("\n")
	};
}
/** Controles del día entero (al cerrarlo a medianoche): cómo terminó cada apartado. */
function controlesFinales(d) {
	const modo = modoDelDia(d.log, d.cycles, d.date);
	const agua = liquidosDelDia(d.log);
	const n = tomasHechas(d.log);
	const t = temperaturasApuntadas(d.log);
	return [
		{
			area: "agua",
			valor: agua,
			meta: AGUA_DIA_ML,
			ok: agua >= AGUA_DIA_ML
		},
		{
			area: "comidas",
			valor: n,
			meta: TOMAS_DIA[modo],
			ok: n >= TOMAS_DIA[modo]
		},
		{
			area: "temperatura",
			valor: t,
			meta: 2,
			ok: t >= 2
		},
		...paseosFinal(d)
	];
}
/** Paseos tras las comidas principales hechas ese día (solo en casa). */
function paseosFinal(d) {
	if (!enCasa(d.log)) return [];
	const hechas = PRINCIPALES.filter((s) => tomada((d.log?.meals ?? []).find((m) => m.slot === s)));
	if (!hechas.length) return [];
	const n = hechas.filter((s) => d.log?.extra?.move_after?.[s]).length;
	return [{
		area: "paseos",
		valor: n,
		meta: hechas.length,
		ok: n >= hechas.length
	}];
}
/** Lo que queda por rellenar del día (los apartados del registro). */
function pendientesDelDia(d) {
	const med = d.products ? medicationProgress(d.products, d.intakes ?? [], d.cycles, d.date) : void 0;
	return dayCompleteness(d.log, d.date, med, tomasMetaDelDia(d.log, d.cycles, d.date)).missingGroups.map((g) => g.group.toLowerCase());
}
const lista = (xs) => xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`;
/** Aviso de las 21 h: lo que queda por apuntar o, si está todo, el día completo. Siempre se manda. */
function avisoCierre(d) {
	const p = pendientesDelDia(d);
	if (p.length) return {
		title: TITULOS["21"],
		body: `Ya casi está 🌙. Queda por apuntar: ${lista(p)}. Tenéis hasta las 00:00.`
	};
	const n = tomasHechas(d.log);
	return {
		title: TITULOS["21"],
		body: `Día completo ✓. Gracias por cuidar cada detalle: hoy ${ml(liquidosDelDia(d.log))} ml y ${n} ${n === 1 ? "toma" : "tomas"}.`
	};
}
/** Última ingesta con hora (fin si la tiene; si no, la de empezar). El agua y las infusiones no cuentan. */
function ultimaIngesta(log) {
	return (log?.meals ?? []).filter((m) => tomada(m) && (m.end || m.time)).map((m) => ({
		meal: m,
		at: (m.end || m.time).slice(0, 5)
	})).sort((a, b) => a.at.localeCompare(b.at)).pop() ?? null;
}
/** Aviso de las 21:30: hasta qué hora puede desayunar mañana sin pasar de 12 h de ayuno. */
function avisoParaManana(d) {
	const u = ultimaIngesta(d.log);
	if (!u || u.at < "17:00") return {
		title: TITULOS["2130"],
		body: "🌅 Apuntad la hora de la cena y Huma os dirá a qué hora desayunar mañana."
	};
	const limite = hora$1(hhmmDe(min(u.at) + 720));
	const que = u.meal.slot === "cena" ? "La cena fue" : "La última toma fue";
	return {
		title: TITULOS["2130"],
		body: `🌅 ${que} a las ${hora$1(u.at)}. Mañana, desayuno antes de las ${limite}.`
	};
}
/** Aviso de ir a la cama: 2 h después de terminar la cena. Con `conDesayuno`, añade la hora límite del desayuno
*  (así no llegan dos avisos seguidos cuando la cena terminó a las 19:30). */
function avisoCama(d, ahora, conDesayuno) {
	const cena = (d.log?.meals ?? []).find((m) => m.slot === "cena");
	if (!tomada(cena)) return null;
	const at = (cena.end || cena.time)?.slice(0, 5);
	if (!at || at < "17:00") return null;
	if (min(ahora) < min(at) + 120) return null;
	const lineas = [`🌙 Han pasado 2 horas desde la cena: buen momento para irse a la cama.`];
	if (conDesayuno) lineas.push(`🌅 Mañana, desayuno antes de las ${hora$1(hhmmDe(min(at) + 720))}.`);
	return {
		title: TITULOS.cama,
		body: lineas.join("\n")
	};
}
/** Aviso de caminar tras una comida principal que acaba de terminar (una vez por comida; no si ya está marcado que se
*  movió después de esa comida, ni fuera de casa). */
function avisoCaminar(d, ahora, yaMandados) {
	if (!enCasa(d.log)) return null;
	for (const slot of PRINCIPALES) {
		const momento = `caminar_${slot}`;
		if (yaMandados.has(momento) || d.log?.extra?.move_after?.[slot]) continue;
		const m = (d.log?.meals ?? []).find((x) => x.slot === slot);
		if (!tomada(m)) continue;
		const fin = m.end?.slice(0, 5) ?? (m.time ? hhmmDe(min(m.time.slice(0, 5)) + 30) : null);
		if (!fin) continue;
		if (min(ahora) < min(fin) || min(ahora) > min(fin) + 90) continue;
		return {
			momento,
			aviso: {
				title: TITULOS.caminar,
				body: `🚶 Después ${DE_LA[slot]}, buen momento para caminar un rato: ayuda a desinflamar el hígado. Si lo hacéis, marcadlo en Ejercicio.`
			}
		};
	}
	return null;
}
const MANO_HORAS = Array.from({ length: 12 }, (_, i) => String(9 + i).padStart(2, "0"));
MANO_HORAS.map((h) => `mano_${h}`);
function avisoMano(d, hora) {
	if (d.log?.extra?.mano?.[hora]) return null;
	return {
		title: TITULOS.mano,
		body: "✋ Unai, toca mover la mano: primero los dedos y después los ejercicios con la bola. ¡Cada ronda suma! Al terminar, marcadla en Ejercicio."
	};
}
/** Reloj de ayuno de la mañana: horas desde la última ingesta de ayer si hoy aún no ha tomado nada. */
function ayunoAhora(d, ahora) {
	if ((d.log?.meals ?? []).some((m) => tomada(m))) return null;
	const u = ultimaIngesta(d.ayer);
	if (!u) return null;
	return {
		horas: (1440 - min(u.at) + min(ahora)) / 60,
		desde: u.at,
		limite: hhmmDe(min(u.at) + 720)
	};
}
/** Aviso de ayuno que toca mandar ahora (11 h o 12 h), si toca. `yaMandados` = momentos ya enviados hoy. */
function avisoAyuno(d, ahora, yaMandados) {
	if (ahora < "07:00" || ahora > "13:00") return null;
	const a = ayunoAhora(d, ahora);
	if (!a) return null;
	if (a.horas >= 12) {
		if (yaMandados.has("ayuno12")) return null;
		return {
			momento: "ayuno12",
			horas: a.horas,
			aviso: {
				title: TITULOS.ayuno12,
				body: "Ya son 12 h de ayuno. Buen momento para el desayuno o el batido."
			}
		};
	}
	if (a.horas >= 11 && !yaMandados.has("ayuno11")) return {
		momento: "ayuno11",
		horas: a.horas,
		aviso: {
			title: TITULOS.ayuno11,
			body: `Buenos días 🌅. Mejor desayunar antes de las ${hora$1(a.limite)} para que no pase de 12 h de ayuno.`
		}
	};
	return null;
}
function tareasALaHora(ahora) {
	const out = [];
	const entre = (a, b) => ahora >= a && ahora < b;
	if (entre("08:00", "09:30")) out.push({ tipo: "parte" });
	if (entre("12:00", "12:45")) out.push({
		tipo: "momento",
		momento: "12"
	});
	if (entre("16:00", "16:45")) out.push({
		tipo: "momento",
		momento: "16"
	});
	if (entre("19:00", "19:45")) out.push({
		tipo: "momento",
		momento: "19"
	});
	if (entre("21:00", "21:25")) out.push({ tipo: "21" });
	if (entre("19:30", "23:30")) out.push({ tipo: "cama" });
	if (entre("21:30", "22:15")) out.push({ tipo: "2130" });
	if (entre("07:00", "13:00")) out.push({ tipo: "ayuno" });
	if (entre("06:00", "23:30")) out.push({ tipo: "caminar" });
	if (entre("00:00", "02:00")) out.push({ tipo: "cierre" });
	const h = ahora.slice(0, 2);
	if (MANO_HORAS.includes(h) && ahora.slice(3, 5) < "40") out.push({
		tipo: "mano",
		momento: `mano_${h}`
	});
	return out;
}
//#endregion
//#region src/domain/deposiciones.ts
/** Deposiciones con un tipo de Bristol por cada una (0.28.0, pedido de Montserrate: «ayer fueron 3 cacas y de formato
*  diferente»). Se guardan en `extra.stools`; la columna `bristol` guarda el tipo más alejado del 4 (el que más avisa
*  de estreñimiento o diarrea), para que informes y semáforos sigan funcionando igual. */
function tiposBristol(l) {
	if (!l) return [];
	const lista = l.extra?.stools;
	if (lista?.length) {
		const n = l.stools_n ?? lista.length;
		return lista.slice(0, Math.max(n, 1)).map((s) => s.bristol).filter((b) => b != null);
	}
	return l.bristol != null ? [l.bristol] : [];
}
//#endregion
//#region src/domain/informeSignosEjercicio.ts
const RANGOS_SIGNOS = {
	fiebre: 38,
	febricula: 37.5,
	sys: [86, 110],
	diaMax: 73,
	pulso: [75, 118],
	satOk: 95,
	satRojo: 94,
	dolorAmbar: 4,
	dolorRojo: 7
};
const SLOT = {
	manana: "mañana",
	tarde: "tarde",
	noche: "noche"
};
const es$1 = (x) => String(x).replace(".", ",");
function buildSignos(days, logs, patient) {
	const byDate = new Map(logs.map((l) => [l.date, l]));
	const logOf = (d) => byDate.get(d);
	const A = [];
	const add = (nivel, dia, titulo, hora, detalle) => A.push({
		nivel,
		dia,
		titulo,
		hora,
		detalle
	});
	const usual = patient?.usual_voids ?? null;
	const filas = [];
	const sinTemp = [], sinDolor = [];
	let tomasT = 0;
	const menosOrinaDias = [];
	for (const d of days) {
		const l = logOf(d);
		const vit = Object.entries(l?.extra?.vitals ?? {}).filter((x) => !!x[1]);
		const temps = vit.filter(([, v]) => v.temp != null).map(([s, v]) => ({
			s,
			t: v.temp
		}));
		if (l?.temp_max != null && !temps.some((x) => x.t === l.temp_max)) temps.push({
			s: "",
			t: l.temp_max
		});
		const tmax = temps.length ? Math.max(...temps.map((x) => x.t)) : null;
		const n = l ? temperaturasApuntadas(l) : 0;
		tomasT += Math.min(n, 2);
		if (l && n < 2) sinTemp.push(d);
		const fiebre = temps.filter((x) => x.t >= RANGOS_SIGNOS.fiebre);
		const feb = temps.filter((x) => x.t >= RANGOS_SIGNOS.febricula && x.t < RANGOS_SIGNOS.fiebre);
		if (fiebre.length) {
			const x = fiebre.sort((a, b) => b.t - a.t)[0];
			add("rojo", d, `Fiebre ${es$1(x.t)} °C`, SLOT[x.s], l?.extra?.fever_cause ? `foco marcado: ${l.extra.fever_cause.replace("_", " ")}` : void 0);
		} else if (feb.length >= 2) add("rojo", d, `37,5 °C o más repetida (${feb.map((x) => es$1(x.t)).join(" y ")} °C)`);
		else if (feb.length === 1) add("ambar", d, `Febrícula ${es$1(feb[0].t)} °C`, SLOT[feb[0].s]);
		let ta = null, pulso = null, sat = null;
		for (const [s, v] of vit) {
			if (v.sys != null) {
				const mal = v.sys < RANGOS_SIGNOS.sys[0] || v.sys > RANGOS_SIGNOS.sys[1] || v.dia != null && v.dia > RANGOS_SIGNOS.diaMax;
				if (!ta || mal && !ta.mal) ta = {
					txt: `${v.sys}/${v.dia ?? "—"}`,
					mal
				};
				if (mal) add("ambar", d, `Tensión ${v.sys}/${v.dia ?? "—"}`, SLOT[s], "rango: sistólica 86–110, diastólica hasta 73");
			}
			if (v.pulse != null) {
				const mal = v.pulse < RANGOS_SIGNOS.pulso[0] || v.pulse > RANGOS_SIGNOS.pulso[1];
				if (!pulso || mal && !pulso.mal || mal === pulso.mal && Math.abs(v.pulse - 96) > Math.abs(pulso.v - 96)) pulso = {
					v: v.pulse,
					mal
				};
				if (mal) add("ambar", d, `Pulso ${v.pulse} lpm`, SLOT[s], "rango: 75–118 en reposo");
			}
			if (v.spo2 != null) {
				sat = sat == null ? v.spo2 : Math.min(sat, v.spo2);
				if (v.spo2 < RANGOS_SIGNOS.satRojo) add("rojo", d, `Saturación ${v.spo2} %`, SLOT[s]);
				else if (v.spo2 < RANGOS_SIGNOS.satOk) add("ambar", d, `Saturación ${v.spo2} %`, SLOT[s]);
			}
		}
		const dolor = l?.pain_max ?? null;
		if (l && dolor == null) sinDolor.push(d);
		if (dolor != null && dolor >= RANGOS_SIGNOS.dolorRojo) add("rojo", d, `Dolor ${dolor}/10`, void 0, l?.pain_location || void 0);
		else if (dolor != null && dolor >= RANGOS_SIGNOS.dolorAmbar) add("ambar", d, `Dolor ${dolor}/10`, void 0, l?.pain_location || void 0);
		for (const e of l?.extra?.vomits ?? []) {
			const k = VOMIT_KINDS.find((x) => x.value === e.kind);
			if (k?.alerta) add("rojo", d, `Vómito ${k.label.toLowerCase()}`, e.time || void 0);
		}
		if (l?.extra?.vomit_no_liquids) add("rojo", d, "No retiene ni líquidos");
		if (l?.stool_color === "oscuro" || l?.stool_color === "sangre" || l?.stool_color === "palido") add("rojo", d, `Heces: ${STOOL_COLORS.find((x) => x.key === l.stool_color)?.label.toLowerCase()}`);
		if (tiposBristol(l).some((b) => b >= 6) && (l?.stools_n ?? 0) >= 3) add((tmax ?? 0) >= RANGOS_SIGNOS.fiebre ? "rojo" : "ambar", d, (tmax ?? 0) >= RANGOS_SIGNOS.fiebre ? "Diarrea con fiebre" : "Diarrea");
		if (l?.extra?.phlegm_color === "verde" || l?.extra?.phlegm_color === "rojo") add("rojo", d, `Flemas ${l.extra.phlegm_color === "rojo" ? "con sangre" : "verdes"}`);
		for (const [k, v] of Object.entries(l?.symptoms ?? {})) {
			if (k === "nauseas" || k === "vomitos" || k === "fiebre") continue;
			const def = SYMPTOMS.find((s) => s.key === k);
			const label = def?.label ?? k.replace(/^dx_/, "").replace(/_/g, " ");
			if (v >= 3 && def?.redAt3) add("rojo", d, `${label}: intenso`);
			else if (v >= 2) add("ambar", d, `${label}: moderado`);
		}
		for (const o of otrosSintomas(l)) add("ambar", d, `Otro síntoma: ${o.text.trim()}`, void 0, [
			"",
			"leve",
			"moderado",
			"intenso"
		][o.sev]);
		if ((l?.fatigue ?? 0) >= 3) add("ambar", d, `Cansancio ${l.fatigue}/4`, void 0, "descansa más de lo normal o casi todo el día tumbado");
		if (l?.mood_child != null && l.mood_child <= 2) add("ambar", d, `Ánimo ${l.mood_child}/5`);
		const menos = l?.urine_amount === "menos" || usual != null && l?.urine_count != null && l.urine_count < usual;
		if (menos) menosOrinaDias.push(d);
		filas.push({
			d,
			tempMax: tmax,
			tempTomas: n,
			ta,
			pulso,
			sat,
			dolor,
			fatiga: l?.fatigue ?? null,
			animo: l?.mood_child ?? null,
			micciones: l?.urine_count ?? null,
			menosOrina: menos
		});
	}
	if (menosOrinaDias.length >= 2) add("ambar", menosOrinaDias[0], `Orina menos de lo habitual ${menosOrinaDias.length} días`, void 0, usual != null ? `lo habitual: ${usual} micciones` : void 0);
	const keys = /* @__PURE__ */ new Set();
	for (const d of days) for (const k of Object.keys(logOf(d)?.symptoms ?? {})) keys.add(k);
	const sintomas = [];
	for (const k of keys) {
		if (k === "nauseas" || k === "vomitos") continue;
		const vals = days.map((d) => logOf(d)?.symptoms?.[k] ?? 0).filter((v) => v > 0);
		if (!vals.length) continue;
		const label = SYMPTOMS.find((s) => s.key === k)?.label ?? k.replace(/^dx_/, "").replace(/_/g, " ");
		sintomas.push(`${label} (${vals.length} día${vals.length > 1 ? "s" : ""}, máx. ${[
			"",
			"leve",
			"moderado",
			"intenso"
		][Math.max(...vals)]})`);
	}
	const otrosSem = /* @__PURE__ */ new Map();
	for (const d of days) for (const o of otrosSintomas(logOf(d))) {
		const k = o.text.trim().toLowerCase();
		const x = otrosSem.get(k) ?? {
			txt: o.text.trim(),
			dias: 0,
			max: 0
		};
		x.dias++;
		x.max = Math.max(x.max, o.sev);
		otrosSem.set(k, x);
	}
	for (const x of otrosSem.values()) sintomas.push(`${x.txt} [otro] (${x.dias} día${x.dias > 1 ? "s" : ""}, máx. ${[
		"",
		"leve",
		"moderado",
		"intenso"
	][x.max]})`);
	A.sort((a, b) => a.nivel === b.nivel ? a.dia.localeCompare(b.dia) : a.nivel === "rojo" ? -1 : 1);
	const conDatos = days.some((d) => logOf(d));
	return {
		alertas: A,
		filas,
		sintomas,
		tempTomas: tomasT,
		tempPrevistas: days.filter((d) => logOf(d)).length * 2,
		sem: !conDatos ? "gris" : A.some((a) => a.nivel === "rojo") ? "rojo" : A.length ? "ambar" : "verde",
		huecos: [...sinTemp.length ? [{
			que: `Tomas de temperatura (menos de 2 al día)`,
			dias: sinTemp
		}] : [], ...sinDolor.length ? [{
			que: "Dolor (0–10)",
			dias: sinDolor
		}] : []]
	};
}
/** Gramos de alimento proteico de una unidad casera de lo que se escribe en «Otro» o «Postre». Solo los grupos que
*  cuentan; lo demás (verdura, hidratos, bebida vegetal, tofu…) no suma. */
const G_UNIDAD = {
	pollo: 130,
	pollo_muslo: 150,
	codorniz: 100,
	bacon: 30,
	pavo: 130,
	pavo_fiambre: 50,
	jamon: 30,
	jamon_york: 30,
	ternera: 140,
	carne_picada: 130,
	hamburguesa: 120,
	cerdo: 130,
	cordero: 130,
	conejo: 150,
	salmon: 150,
	salmon_ahumado: 40,
	atun: 150,
	atun_lata: 60,
	sardinas: 150,
	caballa: 150,
	boquerones: 150,
	anchoas: 20,
	merluza: 150,
	lubina: 150,
	dorada: 150,
	trucha: 150,
	marisco: 100,
	mejillones: 150,
	calamar: 150,
	huevo: 55,
	huevos_revueltos: 55,
	tortilla: 110,
	proteina_polvo: 25,
	yogur: 125,
	yogur_griego: 125,
	queso: 30,
	queso_fresco: 60,
	queso_crema: 30,
	requeson: 50,
	parmesano: 10,
	leche: 250
};
const esPrincipal = (slot) => !!TOMAS.find((t) => t.key === slot)?.principal;
/** Proteína total de un plato del menú: la guardada al marcar o, si no la tiene, la del menú cargado. */
const gDe = (d, data) => d.g ?? data?.platos[d.id]?.prot_g ?? null;
/** Lo que se reconoce como alimento proteico en un texto, por unidades caseras. */
function protEscrito(texto, factor) {
	if (!texto?.trim()) return [];
	return leerAlimentos(texto).leidos.filter((l) => G_UNIDAD[l.alimento.id] != null).map((l) => ({
		n: l.alimento.nombre,
		g: Math.round(G_UNIDAD[l.alimento.id] * l.unidades * factor(l.alimento.grupo, l.conNumero))
	}));
}
function proteinaToma(m, slot, menu, data) {
	const t = TOMAS.find((x) => x.key === slot);
	const principal = esPrincipal(slot);
	const f = m?.fraction;
	const registrada = f != null || tomada(m);
	const parte = f != null && f > 0 ? f : f === 0 ? 0 : 1;
	const r = {
		slot,
		principal,
		registrada,
		previsto: 0,
		tomado: 0,
		lineas: [],
		sinDato: [],
		fuente: null,
		nivel: "gris"
	};
	const receta = t?.batido ? RECETA_BATIDO[slot] : void 0;
	const delMenu = m ? platosDeToma(m, menu) : menu?.platos(slot) ?? [];
	const snack = !!t?.batido && m?.choice === "menu";
	if (receta && !snack) r.previsto = receta.guisante_g;
	else if (t?.principal) r.previsto = 120;
	else r.previsto = delMenu.reduce((s, d) => s + (gDe(d, data) ?? 0), 0);
	if (!registrada || f === 0) {
		r.nivel = principal && f === 0 ? "rojo" : "gris";
		return r;
	}
	const fPlato = t?.plato ? factoresPlato(m).prot : parte;
	if (m?.note?.trim()) {
		r.fuente = "escrito";
		r.lineas = protEscrito(m.note, (grupo, conNumero) => conNumero ? 1 : grupo === "proteina" ? fPlato : parte);
	} else if (receta && !snack) {
		r.fuente = "batido";
		r.lineas = [{
			n: "Proteína de guisante",
			g: Math.round(receta.guisante_g * parte)
		}];
	} else if (t?.principal) {
		r.fuente = "menu";
		r.lineas = [{
			n: "Proteína pesada (120 g)",
			g: Math.round(120 * fPlato)
		}];
	} else {
		r.fuente = "menu";
		delMenu.forEach((d, i) => {
			if (i > 0 && m?.taken?.[d.id] === "no") return;
			const g = gDe(d, data);
			if (g == null) {
				r.sinDato.push(d.n);
				return;
			}
			if (g > 0) r.lineas.push({
				n: d.n,
				g: Math.round(g * fPlato)
			});
		});
	}
	if (t?.plato) r.lineas.push(...protEscrito(m?.dessert, () => 1).map((l) => ({
		...l,
		n: `${l.n} (postre)`
	})));
	r.tomado = r.lineas.reduce((s, l) => s + l.g, 0);
	r.nivel = r.tomado >= 120 ? "verde" : r.tomado >= 80 ? "amarillo" : "rojo";
	return r;
}
function proteinaDia(meals, menu, data) {
	const tomas = TOMAS.map((t) => proteinaToma(meals.find((m) => m.slot === t.key), t.key, menu, data));
	const total = tomas.reduce((s, t) => s + t.tomado, 0);
	const pendientes = tomas.filter((t) => !t.registrada).length;
	const estado = total > 400 ? "encima" : total >= 360 ? "rango" : pendientes > 0 ? "curso" : "debajo";
	const ps = tomas.filter((t) => t.principal);
	return {
		tomas,
		total,
		pendientes,
		estado,
		principalesEnMeta: ps.filter((t) => t.nivel === "verde").length,
		principalesRegistradas: ps.filter((t) => t.registrada).length
	};
}
//#endregion
//#region src/domain/menu.ts
/** Platos de un día. `null` si no hay menú o el día es anterior al menú o a la pauta del 18/10. */
function menuDelDia(m, date) {
	if (!m || !m.dias?.length) return null;
	if (date < "2026-10-18") return null;
	const indice = ((/* @__PURE__ */ new Date(date + "T12:00:00")).getDay() + 6) % 7;
	const semana = (Math.floor(diffDays(date, m.desde) / 7) % 2 + 2) % 2 === 0 ? 1 : 2;
	const dia = m.dias[indice % m.dias.length] ?? {};
	return {
		indice,
		semana,
		platos: (slot) => (dia[slot] ?? []).filter((r) => typeof r === "string" || !r.semana || r.semana === semana).map((r) => {
			const id = typeof r === "string" ? r : r.id;
			const p = m.platos[id];
			return {
				id,
				n: p?.nombre ?? id,
				k: p?.kcal,
				p: p?.partes,
				g: p?.prot_g
			};
		}),
		hora: (slot) => m.horas?.[slot] ?? null
	};
}
//#endregion
//#region src/domain/nausea.ts
/** Máximo del día en la escala 0-10 (null si no se ha apuntado ninguna cara). */
function nauseaMax(n) {
	const vs = Object.values(n?.score ?? {}).filter((v) => v != null);
	return vs.length ? Math.max(...vs) : null;
}
//#endregion
//#region src/domain/parte.ts
const PUNTO = {
	verde: "🟢",
	naranja: "🟠",
	rojo: "🔴",
	gris: "⚪"
};
/** Medicación de rescate (a demanda). Se reconoce por el nombre del producto en Medicación. */
const RESCATE = [
	{
		key: "nausealiv",
		nombre: "Nausealiv",
		re: /nausea\s*liv/i
	},
	{
		key: "homeopatia",
		nombre: "Ipeca + Nux vómica + Arsenicum",
		re: /nux|arsenicum|ipeca/i
	},
	{
		key: "paracetamol",
		nombre: "Paracetamol",
		re: /paracetamol|apiretal|dalsy|termalgin/i
	},
	{
		key: "ondansetron",
		nombre: "Ondansetrón",
		re: /ondansetr|zofran|yatrox/i
	}
];
/** Horas de sueño recomendadas a su edad (6-12 años: 9-12 h; AASM, Paruthi et al., J Clin Sleep Med 2016). */
const SUENO_H = [9, 12];
const es = (n, dec = 1) => String(Math.round(n * 10 ** dec) / 10 ** dec).replace(".", ",");
const hora = (hhmm) => hhmm.slice(0, 5).replace(/^0(\d)/, "$1");
const minDe = (hhmm) => {
	const m = /^(\d{1,2}):(\d{2})/.exec(hhmm ?? "");
	return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const MOMENTO = {
	ayunas: "ayunas",
	manana: "mañana",
	media_manana: "media mañana",
	comida: "comida",
	media_tarde: "media tarde",
	cena: "cena",
	dormir: "al dormir"
};
const DOW = [
	"domingo",
	"lunes",
	"martes",
	"miércoles",
	"jueves",
	"viernes",
	"sábado"
];
const fechaCorta = (d) => {
	const x = /* @__PURE__ */ new Date(d + "T12:00");
	return `${DOW[x.getDay()]} ${x.getDate()}`;
};
const vigente = (p, d) => !p.deleted_at && (!p.start_date || p.start_date <= d) && (!p.end_date || p.end_date > d);
function buildParte(date, data) {
	const byDate = new Map(data.logs.map((l) => [l.date, l]));
	const log = byDate.get(date);
	const vispera = byDate.get(addDays(date, -1));
	const modo = modoDelDia(log, data.cycles, date);
	const loc = LOCATIONS.find((x) => x.value === (log?.location ?? "casa"));
	const out = {
		date,
		fase: modo === "quimio" ? "Semana de quimio" : "Semana nadir",
		lugar: loc ? `${loc.emoji} ${loc.short}` : "",
		sinDatos: !log,
		sinRellenar: [],
		signos: [],
		deposiciones: null,
		rescate: [],
		rescatesNausea: [],
		nutricion: [],
		proteina: null,
		hidratacion: null,
		descanso: [],
		otros: [],
		notas: null,
		rojos: 0,
		naranjas: 0
	};
	out.sinRellenar = (log?.extra && log.extra.cierre?.sin_rellenar) ?? pendientesDelDia({
		date,
		log,
		ayer: vispera,
		logs: data.logs,
		weights: data.weights,
		cycles: data.cycles,
		products: data.products,
		intakes: data.intakes.filter((i) => i.date === date)
	});
	if (!log) return out;
	const sg = buildSignos([date], data.logs, data.patient);
	const conHora = (a) => a.hora ? `${a.titulo} (${a.hora})` : a.titulo;
	out.signos = sg.alertas.map((a) => ({
		color: a.nivel === "rojo" ? "rojo" : "naranja",
		texto: conHora(a),
		detalle: a.detalle
	}));
	const vom = log.extra?.vomits ?? [];
	if (vom.length && !out.signos.some((s) => /^Vómito/.test(s.texto))) out.signos.push({
		color: vom.length >= 3 ? "rojo" : "naranja",
		texto: `${vom.length} ${vom.length === 1 ? "vómito" : "vómitos"}`,
		detalle: vom.map((v) => v.time).filter(Boolean).join(", ") || void 0
	});
	const nm = nauseaMax(log.extra?.nausea);
	if (nm != null && nm >= 5) out.signos.push({
		color: nm >= 8 ? "rojo" : "naranja",
		texto: `Náuseas ${nm}/10`
	});
	const tipos = tiposBristol(log);
	const color = STOOL_COLORS.find((x) => x.key === log.stool_color)?.label.toLowerCase();
	if (log.stools_n == null) out.deposiciones = {
		color: "gris",
		texto: "Deposiciones sin registrar"
	};
	else if (log.stools_n === 0) out.deposiciones = {
		color: "verde",
		texto: "Sin deposición"
	};
	else out.deposiciones = {
		color: tipos.some((b) => b <= 2 || b >= 5) ? "naranja" : "verde",
		texto: `${log.stools_n} ${log.stools_n === 1 ? "deposición" : "deposiciones"}${tipos.length ? ` · Bristol ${tipos.join(", ")}` : ""}${color && log.stool_color !== "normal" ? ` · ${color}` : ""}`
	};
	const intakesDia = data.intakes.filter((i) => i.date === date && !i.deleted_at);
	for (const r of RESCATE) {
		const prods = data.products.filter((p) => r.re.test(p.name) && vigente(p, date));
		if (!prods.length) continue;
		const ids = new Set(prods.map((p) => p.id));
		const tomas = intakesDia.filter((i) => ids.has(i.product_id));
		const dadas = tomas.filter((i) => i.status === "dada" || i.status == null && i.taken);
		const noDadas = tomas.filter((i) => i.status === "no_dada");
		const np = tomas.filter((i) => i.status === "no_precisa");
		out.rescate.push({
			nombre: r.nombre,
			estado: dadas.length ? "dada" : noDadas.length ? "no_dada" : np.length ? "np" : "sin_marcar",
			veces: dadas.length,
			momentos: dadas.map((i) => MOMENTO[i.moment] ?? i.moment),
			motivo: noDadas.map((i) => i.reason).filter(Boolean).join("; ") || void 0
		});
	}
	out.rescatesNausea = (log.extra?.nausea?.rescates ?? []).map((x) => `${x.med}${x.time ? ` a las ${hora(x.time)}` : ""}${x.efecto ? ` (${x.efecto === "si" ? "funcionó" : x.efecto === "algo" ? "funcionó algo" : "no funcionó"})` : ""}`);
	const ay = fastingHours(log, vispera);
	if (ay == null) out.nutricion.push({
		color: "gris",
		texto: "Ayuno de la noche: faltan horas para calcularlo"
	});
	else out.nutricion.push({
		color: ay <= 12 ? "verde" : "naranja",
		texto: `Ayuno de la noche: ${es(ay)} h`,
		detalle: `máximo 12 h`
	});
	const meta = tomasMetaDelDia(log, data.cycles, date);
	const hechas = tomasHechas(log);
	out.nutricion.push({
		color: hechas >= meta ? "verde" : hechas >= meta - 1 ? "naranja" : "rojo",
		texto: `Ingestas: ${hechas} de ${meta}`
	});
	const cena = log.meals.find((m) => m.slot === "cena");
	const cenaFin = cena && tomada(cena) ? finDe(cena) : null;
	if (cena && cena.fraction === 0) out.nutricion.push({
		color: "naranja",
		texto: "No cenó"
	});
	else if (cenaFin) out.nutricion.push({
		color: cenaFin.slice(0, 5) <= "19:30" ? "verde" : "naranja",
		texto: `Cena terminada a las ${hora(cenaFin)}`,
		detalle: `como tarde ${hora(CENA_LIMITE)}`
	});
	else out.nutricion.push({
		color: "gris",
		texto: "Hora de la cena sin registrar"
	});
	if (date >= "2026-11-11") {
		const p = proteinaDia(log.meals, menuDelDia(data.menu, date), data.menu);
		out.proteina = {
			total: Math.round(p.total),
			color: p.total >= 360 ? "verde" : p.total >= 240 ? "naranja" : "rojo",
			tomas: p.tomas.filter((t) => t.principal).map((t) => ({
				label: TOMAS.find((x) => x.key === t.slot)?.label ?? t.slot,
				g: Math.round(t.tomado),
				color: !t.registrada ? "gris" : t.nivel === "verde" ? "verde" : t.nivel === "amarillo" ? "naranja" : "rojo",
				registrada: t.registrada
			}))
		};
	}
	if (!(totalFluids(log) != null || batidoMl(log) > 0)) out.hidratacion = {
		color: "gris",
		texto: "Líquidos sin registrar"
	};
	else {
		const v = liquidosDelDia(log);
		out.hidratacion = {
			color: v >= 1500 ? "verde" : v >= 900 ? "naranja" : "rojo",
			texto: `${ml(v)} ml de ${ml(AGUA_DIA_ML)}`
		};
	}
	if (log.fatigue != null) out.descanso.push({
		color: log.fatigue >= 3 ? "naranja" : "verde",
		texto: `Cansancio ${log.fatigue}/4`,
		detalle: [
			"juega normal",
			"algo cansado",
			"descansa más de lo normal",
			"casi todo el día tumbado",
			"no se levanta"
		][log.fatigue]
	});
	else out.descanso.push({
		color: "gris",
		texto: "Cansancio sin registrar"
	});
	if (log.mood_child != null) out.descanso.push({
		color: log.mood_child <= 2 ? "naranja" : "verde",
		texto: `Ánimo ${log.mood_child}/5`
	});
	const ini = minDe(log.sleep_start), fin = minDe(log.sleep_end);
	if (ini != null && fin != null) {
		const h = (fin - ini + 1440) % 1440 / 60;
		out.descanso.push({
			color: h >= SUENO_H[0] && h <= SUENO_H[1] ? "verde" : "naranja",
			texto: `Sueño de la noche: ${es(h)} h (${hora(log.sleep_start)}–${hora(log.sleep_end)})`,
			detalle: `recomendado ${SUENO_H[0]}–${SUENO_H[1]} h${log.wakeups ? ` · ${log.wakeups} despertares` : ""}`
		});
		const cenaV = vispera?.meals.find((m) => m.slot === "cena");
		const cv = cenaV && tomada(cenaV) ? minDe(finDe(cenaV)) : null;
		if (cv != null) {
			const g = (ini - cv + 1440) % 1440 / 60;
			out.descanso.push({
				color: g >= 2 ? "verde" : "naranja",
				texto: `Entre la cena y dormir: ${es(g)} h`,
				detalle: `mínimo 2 h, ideal 3 h`
			});
		}
	} else out.descanso.push({
		color: "gris",
		texto: "Sueño sin registrar"
	});
	const luz = [
		log.daylight_morning && "mañana",
		log.daylight_afternoon && "tarde",
		log.sun_exposure && "sol directo"
	].filter(Boolean);
	out.descanso.push(luz.length ? {
		color: "verde",
		texto: `Luz del día: ${luz.join(", ")}`
	} : {
		color: "naranja",
		texto: "Sin luz del día apuntada"
	});
	const pesos = [...data.weights.filter((w) => !w.deleted_at).map((w) => ({
		d: w.at.slice(0, 10),
		kg: w.kg
	})), ...data.logs.filter((l) => l.weight != null).map((l) => ({
		d: l.date,
		kg: l.weight
	}))].sort((a, b) => a.d.localeCompare(b.d));
	const hoyP = pesos.filter((p) => p.d === date).pop();
	if (hoyP) {
		const ant = pesos.filter((p) => p.d < date).pop();
		const dif = ant ? hoyP.kg - ant.kg : null;
		const pctDif = ant && dif != null ? dif / ant.kg * 100 : null;
		out.otros.push({
			color: pctDif != null && pctDif <= -2 ? "naranja" : "verde",
			texto: `Peso ${es(hoyP.kg, 2)} kg${dif != null ? ` (${dif >= 0 ? "+" : ""}${es(dif, 2)} kg desde el ${fechaCorta(ant.d)})` : ""}`
		});
	}
	const mano = MANO_HORAS.filter((h) => log.extra?.mano?.[h]).length;
	out.otros.push({
		color: mano >= MANO_HORAS.length / 2 ? "verde" : mano > 0 ? "naranja" : "gris",
		texto: `Ejercicios de la mano: ${mano} de ${MANO_HORAS.length} rondas`
	});
	if (enCasa(log)) {
		const princ = PRINCIPALES.filter((s) => tomada(log.meals.find((m) => m.slot === s)));
		if (princ.length) {
			const n = princ.filter((s) => log.extra?.move_after?.[s]).length;
			out.otros.push({
				color: n >= princ.length ? "verde" : "naranja",
				texto: `Caminar tras comer: ${n} de ${princ.length}`
			});
		}
	}
	out.notas = log.notes?.trim() || null;
	const todas = [
		...out.signos,
		...out.deposiciones ? [out.deposiciones] : [],
		...out.nutricion,
		...out.hidratacion ? [out.hidratacion] : [],
		...out.descanso,
		...out.otros
	];
	if (out.proteina) todas.push({
		color: out.proteina.color,
		texto: ""
	}, ...out.proteina.tomas.map((t) => ({
		color: t.color,
		texto: ""
	})));
	out.rojos = todas.filter((l) => l.color === "rojo").length;
	out.naranjas = todas.filter((l) => l.color === "naranja").length;
	return out;
}
/** Título y texto del aviso de las 8:00 (corto: el detalle está en la app). */
function avisoParte(p) {
	const title = `Huma · Parte del ${fechaCorta(p.date)} 🌅`;
	if (p.sinDatos) return {
		title,
		body: "Ayer no se registró nada en Huma."
	};
	const lineas = [];
	const alertas = p.signos.filter((s) => s.color === "rojo").concat(p.signos.filter((s) => s.color === "naranja"));
	lineas.push(alertas.length ? alertas.slice(0, 3).map((s) => `${PUNTO[s.color]} ${s.texto}`).join(" · ") + (alertas.length > 3 ? ` (+${alertas.length - 3})` : "") : "🟢 Sin signos fuera de lo normal");
	const dadas = p.rescate.filter((r) => r.estado === "dada");
	lineas.push(dadas.length ? `💊 Rescate: ${dadas.map((r) => `${r.nombre}${r.veces > 1 ? ` ×${r.veces}` : ""}`).join(", ")}` : "💊 Sin medicación de rescate");
	const nut = [];
	if (p.proteina) nut.push(`${PUNTO[p.proteina.color]} Proteína ${p.proteina.total} g`);
	if (p.hidratacion && p.hidratacion.color !== "gris") nut.push(`${PUNTO[p.hidratacion.color]} Líquidos ${p.hidratacion.texto.replace(/ de .*/, "")}`);
	const ay = p.nutricion.find((l) => l.texto.startsWith("Ayuno") && l.color !== "gris");
	if (ay) nut.push(`${PUNTO[ay.color]} ${ay.texto.replace("Ayuno de la noche: ", "Ayuno ")}`);
	if (nut.length) lineas.push(nut.join(" · "));
	if (p.deposiciones && p.deposiciones.color === "naranja") lineas.push(`${PUNTO.naranja} ${p.deposiciones.texto}`);
	if (p.sinRellenar.length) lineas.push(`⚪ Sin rellenar: ${p.sinRellenar.join(", ")}`);
	return {
		title,
		body: lineas.join("\n")
	};
}
//#endregion
//#region supabase/functions/avisos/handler.ts
/** Función del servidor «avisos» (Supabase Edge Function). La llama la base de datos cada 5 minutos (pg_cron) y la app
*  para el aviso de prueba. Las reglas y los textos están en `src/domain/avisos.ts` (los mismos que ve la app).
*
*  Acciones (POST JSON):
*  - `{accion:'tick'}` con la cabecera `x-cron-secret`: hace lo que toque a esa hora de Madrid (controles de 12, 16 y
*    19 h, aviso de las 21 h, de las 21:30, de ayuno y cierre del día de ayer). Con `ahora` (fecha y hora de Madrid,
*    «2026-10-19T12:05») simula otra hora; con `dry:true` solo devuelve lo que haría, sin guardar ni mandar nada.
*  - `{accion:'prueba'}` con la sesión del usuario: manda un aviso de prueba a sus móviles. */
const CORS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
	"Access-Control-Allow-Methods": "POST, OPTIONS"
};
const json = (data, status = 200) => new Response(JSON.stringify(data), {
	status,
	headers: {
		...CORS,
		"Content-Type": "application/json"
	}
});
/** Fecha y hora de Madrid. */
function madrid(now) {
	const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
		timeZone: "Europe/Madrid",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23"
	}).formatToParts(now).map((x) => [x.type, x.value]));
	return {
		date: `${p.year}-${p.month}-${p.day}`,
		hhmm: `${p.hour === "24" ? "00" : p.hour}:${p.minute}`
	};
}
function db(env, fetchFn) {
	const headers = {
		apikey: env.serviceKey,
		Authorization: `Bearer ${env.serviceKey}`,
		"Content-Type": "application/json"
	};
	const get = async (path) => {
		const r = await fetchFn(`${env.url}/rest/v1/${path}`, { headers });
		if (!r.ok) throw new Error(`GET ${path.split("?")[0]}: ${r.status} ${await r.text()}`);
		return r.json();
	};
	const insert = async (table, rows, ignoreDup = false) => {
		if (!rows.length) return [];
		const q = ignoreDup ? "?on_conflict=patient_id,date,momento,area" : "";
		const r = await fetchFn(`${env.url}/rest/v1/${table}${q}`, {
			method: "POST",
			headers: {
				...headers,
				Prefer: `return=representation${ignoreDup ? ",resolution=ignore-duplicates" : ""}`
			},
			body: JSON.stringify(rows)
		});
		if (!r.ok) throw new Error(`INSERT ${table}: ${r.status} ${await r.text()}`);
		return r.json();
	};
	const patch = async (table, filter, values) => {
		const r = await fetchFn(`${env.url}/rest/v1/${table}?${filter}`, {
			method: "PATCH",
			headers: {
				...headers,
				Prefer: "return=minimal"
			},
			body: JSON.stringify(values)
		});
		if (!r.ok) throw new Error(`PATCH ${table}: ${r.status} ${await r.text()}`);
	};
	return {
		get,
		insert,
		patch
	};
}
async function enviar(env, fetchFn, subs, aviso, tag, url = "./#/") {
	const d = db(env, fetchFn);
	const res = await Promise.all(subs.map(async (s) => {
		try {
			const r = await sendPush(s, {
				title: aviso.title,
				body: aviso.body,
				tag,
				url
			}, env.vapid, fetchFn);
			if (r.ok) await d.patch("push_subscriptions", `id=eq.${s.id}`, {
				last_ok_at: (/* @__PURE__ */ new Date()).toISOString(),
				last_error: null
			}).catch(() => {});
			else await d.patch("push_subscriptions", `id=eq.${s.id}`, r.gone ? {
				deleted_at: (/* @__PURE__ */ new Date()).toISOString(),
				last_error: `${r.status}`
			} : { last_error: `${r.status} ${r.text ?? ""}`.slice(0, 300) }).catch(() => {});
			return r;
		} catch (e) {
			return {
				ok: false,
				status: 0,
				gone: false,
				text: String(e)
			};
		}
	}));
	return {
		enviados: res.filter((r) => r.ok).length,
		total: subs.length,
		errores: res.filter((r) => !r.ok).map((r) => `${r.status} ${r.text ?? ""}`.trim())
	};
}
async function handle(req, env, fetchFn = fetch, now = /* @__PURE__ */ new Date()) {
	if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
	if (req.method !== "POST") return json({ error: "POST" }, 405);
	let body = {};
	try {
		body = await req.json();
	} catch {}
	if (body.accion === "prueba") {
		const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
		const u = await fetchFn(`${env.url}/auth/v1/user`, { headers: {
			apikey: env.serviceKey,
			Authorization: `Bearer ${token}`
		} });
		if (!u.ok) return json({ error: "Sin sesión" }, 401);
		const user = await u.json();
		const d = db(env, fetchFn);
		const subs = await d.get(`push_subscriptions?select=*&user_id=eq.${user.id}&deleted_at=is.null`);
		if (!subs.length) return json({
			enviados: 0,
			total: 0,
			errores: ["Este usuario no tiene ningún móvil con los avisos activados"]
		});
		const r = await enviar(env, fetchFn, subs, {
			title: TITULOS.prueba,
			body: "Si ves esto, los avisos llegan bien a este móvil 🌿"
		}, "prueba");
		const { date } = madrid(now);
		await d.insert("avisos", [{
			patient_id: subs[0].patient_id,
			date,
			momento: `prueba ${now.toISOString().slice(11, 19)}`,
			area: "envio",
			titulo: TITULOS.prueba,
			texto: "Aviso de prueba",
			enviados: r.enviados
		}]).catch(() => {});
		return json(r);
	}
	if (body.accion === "tick") {
		if (!env.cronSecret || req.headers.get("x-cron-secret") !== env.cronSecret) return json({ error: "No autorizado" }, 401);
		const t = body.ahora ? {
			date: body.ahora.slice(0, 10),
			hhmm: body.ahora.slice(11, 16)
		} : madrid(now);
		return json(await tick(env, fetchFn, t.date, t.hhmm, !!body.dry));
	}
	return json({ error: "Acción desconocida" }, 400);
}
/** Lo que toca a esta hora de Madrid. Cada momento se hace una sola vez al día: la fila «envio» de la tabla `avisos`
*  hace de candado (única por paciente, día, momento y área). */
async function tick(env, fetchFn, date, hhmm, dry = false) {
	const tareas = tareasALaHora(hhmm);
	const hecho = [];
	if (!tareas.length) return {
		date,
		hhmm,
		hecho
	};
	const d = db(env, fetchFn);
	const patient = (await d.get("patients?select=*&deleted_at=is.null&order=created_at.asc&limit=1"))[0];
	if (!patient) return {
		date,
		hhmm,
		hecho: ["sin paciente"]
	};
	setDatos("patients", [patient]);
	const pid = patient.id;
	const ayer = addDays(date, -1);
	const conParte = tareas.some((t) => t.tipo === "parte");
	const [cycles, logs, weights, products, intakes, hechos, subs, menus] = await Promise.all([
		d.get(`cycles?select=*&patient_id=eq.${pid}&deleted_at=is.null`),
		d.get(`daily_logs?select=*&patient_id=eq.${pid}&deleted_at=is.null&date=gte.${addDays(date, -16)}`),
		d.get(`weights?select=*&patient_id=eq.${pid}&deleted_at=is.null&at=gte.${addDays(date, -40)}`),
		d.get(`products?select=*&patient_id=eq.${pid}&deleted_at=is.null`),
		d.get(`intakes?select=*&patient_id=eq.${pid}&deleted_at=is.null&date=in.(${ayer},${date})`),
		d.get(`avisos?select=date,momento&patient_id=eq.${pid}&area=eq.envio&date=in.(${ayer},${date})`),
		d.get(`push_subscriptions?select=*&patient_id=eq.${pid}&deleted_at=is.null`),
		conParte ? d.get(`menus?select=*&patient_id=eq.${pid}&active=eq.true&deleted_at=is.null&order=created_at.desc&limit=1`).catch(() => []) : Promise.resolve([])
	]);
	/** Móviles que reciben este momento: los de perfil «parte» (Montserrate) solo el parte y las tendencias. */
	const subsDe = (momento) => subs.filter((s) => (s.perfil ?? "cuidador") !== "parte" || MOMENTOS_PARTE(momento));
	const ya = new Set(hechos.map((h) => `${h.date}|${h.momento}`));
	const datos = (dia) => ({
		date: dia,
		log: logs.find((l) => l.date === dia),
		ayer: logs.find((l) => l.date === addDays(dia, -1)),
		logs,
		weights,
		cycles,
		products,
		intakes: intakes.filter((i) => i.date === dia)
	});
	const base = (dia) => {
		const l = logs.find((x) => x.date === dia);
		return {
			patient_id: pid,
			date: dia,
			modo: modoDelDia(l, cycles, dia),
			lugar: l?.location ?? null
		};
	};
	const filasControl = (dia, momento, cs) => cs.map((c) => ({
		...base(dia),
		momento,
		area: c.area,
		valor: c.valor,
		meta: c.meta,
		ok: c.ok,
		texto: c.linea ?? null
	}));
	/** Toma el candado del momento; si ya lo tenía otro, no se hace nada. */
	const candado = async (dia, momento, aviso, extra = {}) => {
		if (ya.has(`${dia}|${momento}`)) return false;
		if (dry) return true;
		const filas = await d.insert("avisos", [{
			...base(dia),
			momento,
			area: "envio",
			titulo: aviso?.title ?? null,
			texto: aviso?.body ?? null,
			enviados: 0,
			...extra
		}], true);
		ya.add(`${dia}|${momento}`);
		return filas.length > 0;
	};
	const mandar = async (dia, momento, aviso, url) => {
		const destino = subsDe(momento);
		if (dry || !destino.length) return {
			enviados: 0,
			total: destino.length,
			errores: []
		};
		const r = await enviar(env, fetchFn, destino, aviso, momento, url);
		await d.patch("avisos", `patient_id=eq.${pid}&date=eq.${dia}&momento=eq.${momento}&area=eq.envio`, {
			enviados: r.enviados,
			errores: r.errores.length ? r.errores.join(" | ").slice(0, 500) : null
		});
		return r;
	};
	for (const t of tareas) if (t.tipo === "parte") {
		const parte = buildParte(ayer, {
			logs,
			cycles,
			products,
			intakes,
			weights,
			menu: menus[0]?.data ?? null,
			patient
		});
		const aviso = avisoParte(parte);
		if (!await candado(ayer, "parte", aviso, { valor: parte.rojos * 100 + parte.naranjas })) continue;
		hecho.push({
			momento: "parte",
			dia: ayer,
			aviso,
			envio: await mandar(ayer, "parte", aviso, `./#/parte/${ayer}`)
		});
	} else if (t.tipo === "momento") {
		const dd = datos(date);
		const cs = controlesDelMomento(t.momento, dd);
		const aviso = avisoDelMomento(t.momento, cs);
		if (!await candado(date, t.momento, aviso)) continue;
		if (!dry) await d.insert("avisos", filasControl(date, t.momento, cs), true);
		const r = aviso ? await mandar(date, t.momento, aviso) : null;
		hecho.push({
			momento: t.momento,
			controles: cs,
			aviso,
			envio: r
		});
	} else if (t.tipo === "21") {
		const aviso = avisoCierre(datos(date));
		if (!await candado(date, "21", aviso)) continue;
		hecho.push({
			momento: "21",
			aviso,
			envio: await mandar(date, "21", aviso)
		});
	} else if (t.tipo === "cama") {
		if (ya.has(`${date}|cama`)) continue;
		const conDesayuno = !ya.has(`${date}|2130`);
		const aviso = avisoCama(datos(date), hhmm, conDesayuno);
		if (!aviso) continue;
		if (!await candado(date, "cama", aviso)) continue;
		if (conDesayuno) await candado(date, "2130", null, { texto: "Incluido en el aviso de la cama" });
		hecho.push({
			momento: "cama",
			aviso,
			envio: await mandar(date, "cama", aviso)
		});
	} else if (t.tipo === "caminar") {
		const enviados = new Set([...ya].filter((k) => k.startsWith(date + "|caminar_")).map((k) => k.split("|")[1]));
		const a = avisoCaminar(datos(date), hhmm, enviados);
		if (!a) continue;
		if (!await candado(date, a.momento, a.aviso)) continue;
		hecho.push({
			momento: a.momento,
			aviso: a.aviso,
			envio: await mandar(date, a.momento, a.aviso)
		});
	} else if (t.tipo === "2130") {
		const aviso = avisoParaManana(datos(date));
		if (!await candado(date, "2130", aviso)) continue;
		hecho.push({
			momento: "2130",
			aviso,
			envio: await mandar(date, "2130", aviso)
		});
	} else if (t.tipo === "ayuno") {
		const enviados = new Set([...ya].filter((k) => k.startsWith(date + "|ayuno")).map((k) => k.split("|")[1]));
		const a = avisoAyuno(datos(date), hhmm, enviados);
		if (!a) continue;
		if (!await candado(date, a.momento, a.aviso, {
			valor: Math.round(a.horas * 10) / 10,
			meta: 12
		})) continue;
		hecho.push({
			momento: a.momento,
			horas: a.horas,
			aviso: a.aviso,
			envio: await mandar(date, a.momento, a.aviso)
		});
	} else if (t.tipo === "mano") {
		const aviso = avisoMano(datos(date), t.momento.slice(5));
		if (!aviso) continue;
		if (!await candado(date, t.momento, aviso)) continue;
		hecho.push({
			momento: t.momento,
			aviso,
			envio: await mandar(date, t.momento, aviso)
		});
	} else if (t.tipo === "cierre") {
		const dd = datos(ayer);
		const cs = controlesFinales(dd);
		const pend = pendientesDelDia(dd);
		if (!await candado(ayer, "final", null, {
			texto: pend.length ? `Sin rellenar: ${pend.join(", ")}` : "Todo rellenado",
			valor: pend.length
		})) continue;
		if (!dry) {
			await d.insert("avisos", [...filasControl(ayer, "final", cs), {
				...base(ayer),
				momento: "final",
				area: "registro",
				valor: pend.length,
				meta: 0,
				ok: pend.length === 0,
				texto: pend.length ? pend.join(", ") : null
			}], true);
			if (dd.log) {
				const cierre = {
					at: (/* @__PURE__ */ new Date()).toISOString(),
					sin_rellenar: pend
				};
				await d.patch("daily_logs", `id=eq.${dd.log.id}`, { extra: {
					...dd.log.extra ?? {},
					cierre
				} });
			}
		}
		hecho.push({
			momento: "final",
			dia: ayer,
			controles: cs,
			sin_rellenar: pend
		});
	}
	return {
		date,
		hhmm,
		suscripciones: subs.length,
		hecho
	};
}
//#endregion
//#region supabase/functions/avisos/deno-entry.ts
/** Punto de entrada en Supabase (Deno). Secretos de la función: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT y
*  CRON_SECRET. SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los pone Supabase solo (la clave nunca sale de allí). */
Deno.serve((req) => handle(req, {
	url: Deno.env.get("SUPABASE_URL") ?? "",
	serviceKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
	cronSecret: Deno.env.get("CRON_SECRET") ?? "",
	vapid: {
		publicKey: Deno.env.get("VAPID_PUBLIC_KEY") ?? "",
		privateKey: Deno.env.get("VAPID_PRIVATE_KEY") ?? "",
		subject: Deno.env.get("VAPID_SUBJECT") ?? "https://montsereina.github.io/Cuaderno/"
	}
}).catch((e) => new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
	status: 500,
	headers: {
		"Content-Type": "application/json",
		"Access-Control-Allow-Origin": "*"
	}
})));
//#endregion
