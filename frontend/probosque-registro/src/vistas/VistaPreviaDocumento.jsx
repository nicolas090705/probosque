import { useEffect, useRef, useState } from "react";
import "./VistaPreviaDocumento.css";

// Ventana emergente para revisar un documento sin salir de la bandeja.
// "cargar" devuelve una promesa con el archivo (Blob); si falla, se avisa en la ventana.
export default function VistaPreviaDocumento({ nombre, cargar, onCerrar }) {
  const dialogo = useRef(null);
  const [vista, setVista] = useState({ fase: "cargando" });

  // showModal() da el fondo oscuro, atrapa el foco y cierra con Esc
  useEffect(() => {
    if (!dialogo.current.open) dialogo.current.showModal();
  }, []);

  useEffect(() => {
    let vigente = true;
    let url;
    Promise.resolve(cargar())
      .then((resultado) => {
        if (!vigente) return;
        const esPdf = resultado.type === "application/pdf" || /\.pdf$/i.test(nombre);
        url = URL.createObjectURL(resultado);
        setVista({ fase: esPdf ? "pdf" : "otro", url });
      })
      .catch((error) => vigente && setVista({ fase: "error", mensaje: error.message }));
    return () => {
      vigente = false;
      if (url) URL.revokeObjectURL(url);
    };
    // Solo al abrir: la ventana se monta de nuevo para cada documento
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <dialog
      ref={dialogo}
      className="vp-dialogo"
      aria-labelledby="vp-titulo"
      onClose={onCerrar}
      onClick={(e) => {
        if (e.target === dialogo.current) onCerrar(); // clic en el fondo
      }}
    >
      <div className="vp-marco">
        <header className="vp-encabezado">
          <div className="vp-encabezado-texto">
            <h2 id="vp-titulo" className="vp-titulo">{nombre}</h2>
          </div>
          {vista.url && (
            <a className="vp-enlace" href={vista.url} target="_blank" rel="noreferrer">
              Abrir en otra pestaña
            </a>
          )}
          <button type="button" className="ps-boton ps-boton--secundario vp-cerrar" onClick={onCerrar}>
            Cerrar
          </button>
        </header>

        <div className="vp-cuerpo">
          {vista.fase === "cargando" && <p className="vp-mensaje" role="status">Cargando documento…</p>}
          {vista.fase === "pdf" && <iframe className="vp-visor" src={vista.url} title={`Vista previa de ${nombre}`} />}
          {vista.fase === "otro" && (
            <div className="vp-mensaje">
              <p>Este tipo de archivo no se puede previsualizar aquí. Solo los PDF se muestran en la ventana.</p>
              <a className="vp-enlace" href={vista.url} download={nombre}>Descargar {nombre}</a>
            </div>
          )}
          {vista.fase === "error" && (
            <p className="vp-mensaje" role="alert">
              No se pudo cargar el documento. {vista.mensaje}
            </p>
          )}
        </div>
      </div>
    </dialog>
  );
}
