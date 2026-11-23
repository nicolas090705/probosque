import { useState } from "react";
import { HashRouter, Link, NavLink, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { ESTADOS, nombrePrograma, normalizarProgramaId } from "./datos/catalogos";
import { camposDeConvocatoria, formatearRespuesta } from "./datos/camposFormulario";
import { descargarArchivo } from "./api/cliente";
import { ProveedorAlmacen, useAlmacen } from "./estado/Almacen";
import EnlaceUbicacion from "./componentes/EnlaceUbicacion";
import Convocatorias from "./paginas/Convocatorias";
import Estatus from "./paginas/Estatus";
import { calcularApoyo, estadoConvocatoria, fechaLarga, pesos } from "./utilidades/reglas";
import EmisionDictamenes from "./vistas/EmisionDictamenes";
import PublicacionConvocatorias from "./vistas/PublicacionConvocatorias";
import RecepcionSolicitudes from "./vistas/RecepcionSolicitudes";
import RegistroConvocatoria from "./vistas/RegistroConvocatoria";
import "./App.css";

// Cada "Ruta..." conecta una vista con el almacén: la vista solo dibuja y avisa.

// Aviso de error o de "enviando..." arriba de una pantalla
const Aviso = ({ texto }) =>
  texto ? <p className="app-aviso app-aviso--suelto" role="status">{texto}</p> : null;

function RutaPublicar() {
  const { publicarConvocatoria } = useAlmacen();
  const navegar = useNavigate();
  const [aviso, setAviso] = useState("");
  return (
    <>
      <Aviso texto={aviso} />
      <PublicacionConvocatorias
        onVolver={() => navegar("/")}
        onPublicar={async (formData) => {
          setAviso("Publicando convocatoria...");
          try {
            await publicarConvocatoria({
              programa: formData.get("programa"),
              fechaApertura: formData.get("fechaApertura"),
              fechaClausura: formData.get("fechaClausura"),
              reglas: formData.get("reglas"), // el archivo completo: Django lo guarda en media/
              texto: formData.get("texto").trim(),
            });
            navegar("/");
          } catch (error) {
            setAviso(`No se publicó: ${error.message}`);
          }
        }}
      />
    </>
  );
}

function RutaRegistro() {
  const { id } = useParams();
  const { convocatorias, cargando, registrarSolicitud } = useAlmacen();
  const navegar = useNavigate();
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);
  const convocatoria = convocatorias.find((c) => c.id === Number(id));

  if (cargando) return <Aviso texto="Cargando convocatoria..." />;
  if (!convocatoria || estadoConvocatoria(convocatoria) !== "abierta") {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      <Aviso texto={aviso} />
      <RegistroConvocatoria
        nombrePrograma={nombrePrograma(convocatoria.programa)}
        campos={camposDeConvocatoria(convocatoria)}
        conConceptos={normalizarProgramaId(convocatoria.programa) === "plantaciones"}
        onRegresar={() => navegar("/")}
        onFinalizar={async (respuestas, archivos) => {
          if (enviando) return; // evita registrar dos veces si se da doble clic
          setEnviando(true);
          setAviso("Enviando solicitud y documentos...");
          try {
            const solicitud = await registrarSolicitud(convocatoria, respuestas, archivos);
            navegar(`/estatus?folio=${solicitud.folio}&nuevo=1`);
          } catch (error) {
            setAviso(`No se registró: ${error.message}`);
            window.scrollTo(0, 0);
          } finally {
            setEnviando(false);
          }
        }}
      />
    </>
  );
}

const respuestasDe = (solicitud) => solicitud.respuestas ?? solicitud;

const nombreCompleto = (solicitud, convocatorias) => {
  const respuestas = respuestasDe(solicitud);
  const nombre = [
    respuestas.nombres,
    respuestas.apellidos,
    respuestas.segundoApellido,
  ].filter(Boolean).join(" ");
  if (nombre) return nombre;
  const convocatoria = convocatorias.find((c) => c.id === solicitud.convocatoriaId);
  const campoInicial = camposDeConvocatoria(convocatoria).find(
    (campo) => campo.tipo !== "file" && campo.tipo !== "checkbox" && respuestas[campo.id]
  );
  return campoInicial
    ? `${campoInicial.etiqueta}: ${formatearRespuesta(campoInicial, respuestas[campoInicial.id])}`
    : solicitud.folio;
};

function RutaRecepcion() {
  const { solicitudes, convocatorias, aceptarSolicitud, rechazarSolicitud } = useAlmacen();
  const [aviso, setAviso] = useState("");

  const prepararSolicitud = (s) => {
    const convocatoria = convocatorias.find((c) => c.id === s.convocatoriaId);
    const respuestas = respuestasDe(s);
    const apoyo = calcularApoyo(s.concepto, s.superficie);
    return {
      id: s.id,
      folio: s.folio,
      nombre: nombreCompleto(s, convocatorias),
      documentos: s.documentos,
      detalles: [
        ["Registrada el", fechaLarga(s.registradaEl)],
        ["Notificar faltantes a más tardar", fechaLarga(s.limiteAvisoFaltantes)], // N5: 10 días naturales
        ["Ubicación del predio", <EnlaceUbicacion key="ubicacion" ubicacion={s.ubicacion} />],
        ...camposDeConvocatoria(convocatoria)
          .filter((campo) => campo.tipo !== "file") // los archivos van en la lista de documentos
          .map((campo) => [
            campo.etiqueta,
            formatearRespuesta(campo, respuestas[campo.id]),
          ])
          .filter(([, valor]) => valor),
        ...(apoyo ? [["Apoyo calculado", apoyo.total > 0 ? pesos(apoyo.total) : "Solo planta"]] : []),
      ],
    };
  };

  const pendientes = solicitudes
    .filter((s) => s.estado === ESTADOS.RECIBIDA)
    .map(prepararSolicitud);
  const aprobadas = solicitudes
    .filter((s) => s.estado === ESTADOS.EN_DICTAMEN)
    .map(prepararSolicitud);

  const folioDe = (id) => solicitudes.find((s) => s.id === id)?.folio;

  return (
    <>
      {aviso && <p className="app-aviso app-aviso--suelto" role="status">{aviso}</p>}
      <RecepcionSolicitudes
        solicitudes={pendientes}
        aprobadas={aprobadas}
        onAceptar={async (id) => {
          try {
            await aceptarSolicitud(id);
            setAviso(`${folioDe(id)}: documentación completa. Pasó a dictamen jurídico.`);
          } catch (error) {
            setAviso(`No se guardó: ${error.message}`);
          }
        }}
        onRechazar={async (id, faltantes) => {
          try {
            const limite = await rechazarSolicitud(id, faltantes);
            setAviso(`${folioDe(id)}: documentación incompleta. El solicitante puede subsanar hasta el ${fechaLarga(limite)}.`);
          } catch (error) {
            setAviso(`No se guardó: ${error.message}`);
          }
        }}
      />
    </>
  );
}

function RutaDictamenes() {
  const { solicitudes, convocatorias, dictaminar } = useAlmacen();
  const [aviso, setAviso] = useState("");

  const preparar = (s) => ({
    id: s.id,
    folio: s.folio,
    nombre: nombreCompleto(s, convocatorias),
    documentos: s.documentos,
    plazo: `Dictaminar a más tardar el ${fechaLarga(s.fechaLimiteDictamen)} (45 días hábiles).`, // N5
  });
  const enDictamen = solicitudes.filter((s) => s.estado === ESTADOS.EN_DICTAMEN).map(preparar);
  const dictamenesAprobados = solicitudes.filter((s) => s.estado === ESTADOS.JURIDICO_FAVORABLE).map(preparar);

  const folioDe = (id) => solicitudes.find((s) => s.id === id)?.folio;

  return (
    <>
      {aviso && <p className="app-aviso app-aviso--suelto" role="status">{aviso}</p>}
      <EmisionDictamenes
        solicitudes={enDictamen}
        aprobadas={dictamenesAprobados}
        onAbrirDocumento={(doc) => descargarArchivo(doc.url)}
        onFavorable={async (id, observaciones) => {
          try {
            await dictaminar(id, true, observaciones);
            setAviso(`${folioDe(id)}: dictamen jurídico favorable.`);
          } catch (error) {
            setAviso(`No se guardó: ${error.message}`);
          }
        }}
        onDesfavorable={async (id, observaciones) => {
          try {
            await dictaminar(id, false, observaciones);
            setAviso(`${folioDe(id)}: dictamen desfavorable. Pasó al listado de no factibles.`);
          } catch (error) {
            setAviso(`No se guardó: ${error.message}`);
          }
        }}
      />
    </>
  );
}

function Navegacion() {
  const { solicitudes } = useAlmacen();
  const cuenta = (estado) => solicitudes.filter((s) => s.estado === estado).length;
  const enlaces = [
    { a: "/", texto: "Convocatorias", rol: "Público" },
    { a: "/estatus", texto: "Mi estatus", rol: "Beneficiario" },
    { a: "/publicar", texto: "Publicar", rol: "Dirección General" },
    { a: "/recepcion", texto: "Recepción", rol: "Delegación", pendientes: cuenta(ESTADOS.RECIBIDA) },
    { a: "/dictamenes", texto: "Dictámenes", rol: "Unidad jurídica", pendientes: cuenta(ESTADOS.EN_DICTAMEN) },
  ];
  return (
    <header className="app-barra">
      <div className="app-barra-interior">
      <Link className="app-marca" to="/">
        <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
          <path d="M17 3 9 14h4l-6 8h5l-5 7h20l-5-7h5l-6-8h4z" fill="#8fc49a" />
          <rect x="15.5" y="27" width="3" height="5" fill="#8fc49a" />
        </svg>
        <div>
          <strong>PROBOSQUE</strong>
          <span>Convocatorias forestales 2026</span>
        </div>
      </Link>
      <nav className="app-nav" aria-label="Secciones">
        {enlaces.map((e) => (
          <NavLink key={e.a} to={e.a} end={e.a === "/"}>
            <span className="app-nav-texto">
              {e.texto}
              {e.pendientes > 0 && <b className="app-contador">{e.pendientes}</b>}
            </span>
            <small>{e.rol}</small>
          </NavLink>
        ))}
      </nav>
      </div>
    </header>
  );
}

function Pie() {
  const { recargar } = useAlmacen();
  return (
    <footer className="app-pie">
      <div className="app-pie-interior">
      <span>Prototipo académico (FPI, ESCOM-IPN). Los datos se guardan en el servidor (API de Django).</span>
      <button type="button" className="app-enlace" onClick={recargar}>
        Recargar datos
      </button>
      </div>
    </footer>
  );
}

// Si el backend está apagado, se avisa en todas las pantallas
function AvisoConexion() {
  const { errorConexion, recargar } = useAlmacen();
  if (!errorConexion) return null;
  return (
    <p className="app-aviso app-aviso--suelto" role="alert">
      {errorConexion}{" "}
      <button type="button" className="app-enlace" onClick={recargar}>Reintentar</button>
    </p>
  );
}

export default function App() {
  return (
    <ProveedorAlmacen>
      <HashRouter>
        <Navegacion />
        <main className="app-principal">
          <AvisoConexion />
          <Routes>
            <Route path="/" element={<Convocatorias />} />
            <Route path="/publicar" element={<RutaPublicar />} />
            <Route path="/registro/:id" element={<RutaRegistro />} />
            <Route path="/recepcion" element={<RutaRecepcion />} />
            <Route path="/dictamenes" element={<RutaDictamenes />} />
            <Route path="/estatus" element={<Estatus />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <Pie />
      </HashRouter>
    </ProveedorAlmacen>
  );
}
