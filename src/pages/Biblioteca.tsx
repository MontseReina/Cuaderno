/** T4 · Biblioteca y evidencia. Fase 1: accesos directos a la carpeta maestra del Drive.
 *  Fase 3: índice de los documentos, buscador y "preguntar" con citas. */
const FOLDERS = [
  { name: 'Osteosarcoma (carpeta raíz)', url: 'https://drive.google.com/drive/folders/1ctXd2QbsDoj5RpJ2r5Xbf45wva2He9n3', desc: 'Toda la documentación de la familia' },
  { name: '📖 Guías resumidas', url: 'https://drive.google.com/drive/folders/1GRtV4kb2F55bwnQdO0pWbYOeiophgyQu', desc: 'Resúmenes de consulta rápida' },
  { name: '📕 Formaciones', url: 'https://drive.google.com/drive/folders/1OP9vWEMtUfAai--4mB9S2ReVJBy93Cgp', desc: 'Material del módulo de oncología integrativa' },
  { name: '🎓 Formación 10 semanas', url: 'https://drive.google.com/drive/folders/1IjzuQLXDNiuD-5-yL3oLQz9PqO3EvNFz', desc: 'Programa de estudio (alopático + metabólico)' },
  { name: '📚 Libros', url: 'https://drive.google.com/drive/folders/1AtJP-w4MCetmq4qaUqE4MlxWlU8U7g0Y', desc: 'Cáncer, integrativo, nutrición, recetas, psico' },
  { name: '👩‍🔬 Médicos', url: 'https://drive.google.com/drive/folders/1ED000YwpTuH9BfW5g1QbR9zFWlOkhnfn', desc: 'Informes y preguntas para el equipo' },
  { name: '🧚 Tratamiento Imohe', url: 'https://drive.google.com/drive/folders/1Eh_29G__Fff5C-fJ0TA_Fjj9FB4_k7bJ', desc: 'Pauta actual, suplementación por ventanas' },
  { name: '🧪 Analíticas', url: 'https://drive.google.com/drive/folders/1aKAqqh-XYVSufSCTfquMxX_ENIxOmOvB', desc: 'Informes de laboratorio (los valores fuera de rango se ven en Analíticas)' },
  { name: 'Registro diario (fotos del cuaderno)', url: 'https://drive.google.com/drive/folders/1IXgtAQXWJOUpvOIgXvHGEzRVqCD3DcfD', desc: 'Diario manuscrito anterior a la app' },
]

export default function Biblioteca() {
  return (
    <div>
      <h1>Biblioteca y evidencia</h1>
      <p className="muted small">La fuente maestra es la carpeta compartida del Drive. Los enlaces abren la carpeta en Google Drive (hace falta tener acceso).</p>
      {FOLDERS.map((f) => (
        <a key={f.url} className="card tight" href={f.url} target="_blank" rel="noopener" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
          <strong>{f.name}</strong>
          <div className="muted small">{f.desc}</div>
        </a>
      ))}
      <div className="notice">
        <strong>Próximamente (fase 3):</strong> índice de todos los documentos, buscador dentro de la app y "preguntar a la biblioteca" con respuesta citada; lo externo aparecerá siempre marcado como <em>extra</em> con autor y referencia.
      </div>
    </div>
  )
}
