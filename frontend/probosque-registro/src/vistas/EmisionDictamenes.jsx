import { useState } from "react";
import VistaPreviaDocumento from "./VistaPreviaDocumento";
import "./PanelSolicitudes.css";

// HU-2.4-01 · Emisión de dictamen jurídico (Unidad Jurídica)
// Cada solicitud: { id, folio, nombre, plazo: "texto", documentos: [{ id, nombre, url }] }
// onAbrirDocumento(doc) devuelve una promesa con el archivo (Blob) para la vista previa.
export default function EmisionDictamenes({ solicitudes = [], aprobadas = [], onFavorable, onDesfavorable, onAbrirDocumento }) {
  const [seleccionadaId, setSeleccionadaId] = useState(null);
  const [observaciones, setObservaciones] = useState(""); // fundamento del dictamen
  const [enVistaPrevia, setEnVistaPrevia] = useState(null); // documento abierto en la ventana emergente
  const seleccionada = [...solicitudes, ...aprobadas].find((s) => s.id === seleccionadaId);
  const seleccionadaPendiente = solicitudes.some((s) => s.id === seleccionadaId);

  const elegir = (id) => {
    setSeleccionadaId(id);
    setObservaciones("");
    setEnVistaPrevia(null);
  };

  return (
    <div className="ps-pagina">
      <header className="ps-encabezado">
        <h1 className="ps-titulo">Emisión de dictámenes jurídicos</h1>
        <p className="ps-entrada">Revisa las escrituras y la documentación legal de las solicitudes que ya cotejó la delegación y emite el dictamen jurídico.</p>
      </header>

      <div className="ps-listas">
        <section className="ps-grupo" aria-labelledby="ps-aprobadas-titulo">
          <h2 className="ps-grupo-titulo" id="ps-aprobadas-titulo">
            Aprobadas <span>{aprobadas.length}</span>
          </h2>
          <ul className="ps-lista">
            {aprobadas.length === 0 ? (
              <li className="ps-lista-vacia">Aún no hay dictámenes aprobados.</li>
            ) : (
              aprobadas.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className={`ps-fila ps-fila--aprobada ${s.id === seleccionadaId ? "ps-fila--activa" : ""}`}
                    aria-pressed={s.id === seleccionadaId}
                    onClick={() => elegir(s.id)}
                  >
                    <span className="ps-folio">{s.folio}</span>
                    <span className="ps-nombre">{s.nombre}</span>
                    <span className="ps-accion">Ver dictamen</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="ps-grupo" aria-labelledby="ps-pendientes-titulo">
          <h2 className="ps-grupo-titulo" id="ps-pendientes-titulo">
            Pendientes <span>{solicitudes.length}</span>
          </h2>
          <ul className="ps-lista">
            {solicitudes.length === 0 ? (
              <li className="ps-lista-vacia">No hay solicitudes pendientes de dictamen jurídico.</li>
            ) : (
              solicitudes.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className={`ps-fila ${s.id === seleccionadaId ? "ps-fila--activa" : ""}`}
                    aria-pressed={s.id === seleccionadaId}
                    onClick={() => elegir(s.id)}
                  >
                    <span className="ps-folio">{s.folio}</span>
                    <span className="ps-nombre">{s.nombre}</span>
                    <span className="ps-accion">Revisar documentos</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      {/* Documentos de la solicitud elegida */}
      <section className="ps-detalle">
        <div className="ps-detalle-cuerpo">
          {seleccionada ? (
            <>
              <h2 className="ps-detalle-titulo">Documentos de {seleccionada.nombre}</h2>
              {seleccionadaPendiente && seleccionada.plazo && <p className="ps-plazo">{seleccionada.plazo}</p>}
              <ul className="ps-documentos">
                {seleccionada.documentos.map((doc) => (
                  <li key={doc.id}>
                    <a href={doc.url} target="_blank" rel="noreferrer">{doc.nombre}</a>
                    {onAbrirDocumento && (
                      <button
                        type="button"
                        className="ps-documento-ver"
                        aria-haspopup="dialog"
                        aria-label={`Vista previa de ${doc.nombre}`}
                        onClick={() => setEnVistaPrevia(doc)}
                      >
                        Vista previa
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="ps-vacio">Elige una solicitud con “Revisar documentos” para ver su lista.</p>
          )}
        </div>

        {seleccionadaPendiente ? (
          <>
            <div className="ps-observaciones">
              <label htmlFor="ps-dictamen">Fundamento del dictamen (obligatorio si es desfavorable)</label>
              <textarea
                id="ps-dictamen"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Ej. Escrituras y acta de asamblea vigentes; el representante está acreditado."
              />
            </div>
            <div className="ps-acciones">
              <button
                type="button"
                className="ps-boton ps-boton--secundario"
                disabled={!observaciones.trim()}
                onClick={() => onDesfavorable?.(seleccionada.id, observaciones.trim())}
              >
                Emitir desfavorable
              </button>
              <button
                type="button"
                className="ps-boton ps-boton--primario"
                onClick={() => onFavorable?.(seleccionada.id, observaciones.trim())}
              >
                Emitir favorable
              </button>
            </div>
          </>
        ) : seleccionada ? (
          <p className="ps-estado-aprobado">Dictamen jurídico favorable aprobado.</p>
        ) : null}
      </section>

      {enVistaPrevia && (
        <VistaPreviaDocumento
          key={enVistaPrevia.id}
          nombre={enVistaPrevia.nombre}
          cargar={() => onAbrirDocumento(enVistaPrevia)}
          onCerrar={() => setEnVistaPrevia(null)}
        />
      )}
    </div>
  );
}
