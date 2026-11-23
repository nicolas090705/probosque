// Cliente de la API de Django. Es el único archivo que sabe la dirección del backend.
// Se puede cambiar sin tocar código creando un archivo .env con VITE_API_URL=http://otra-direccion/api
export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

// Convierte los errores de Django REST Framework en un texto legible.
// DRF responde así: { "correo": ["Introduzca un correo válido."], "datos_programa": { "clabe": ["..."] } }
export function mensajeDeError(datos) {
  if (!datos || typeof datos !== "object") return datos ? String(datos) : "";
  return Object.entries(datos)
    .map(([campo, valor]) => {
      const texto = Array.isArray(valor)
        ? valor.join(" ")
        : typeof valor === "object"
          ? mensajeDeError(valor)
          : String(valor);
      return campo === "non_field_errors" || campo === "detail" ? texto : `${campo}: ${texto}`;
    })
    .join(" · ");
}

// Baja un archivo del servidor (por ejemplo un documento de media/) como Blob.
// Sirve para mostrarlo dentro de la página: Django no deja incrustar sus direcciones en un iframe.
export async function descargarArchivo(url) {
  let respuesta;
  try {
    respuesta = await fetch(url);
  } catch {
    throw new Error("No se pudo conectar con el servidor. Revisa que el backend esté corriendo (docker compose up -d).");
  }
  if (!respuesta.ok) throw new Error(`El servidor respondió con error ${respuesta.status}.`);
  return respuesta.blob();
}

// pedir("/convocatorias/")                                  → GET
// pedir("/solicitudes/", { metodo: "POST", datos: {...} })  → POST con JSON
// pedir("/documentos/", { metodo: "POST", datos: formData }) → POST con archivos (multipart)
export async function pedir(ruta, { metodo = "GET", datos } = {}) {
  const opciones = { method: metodo, headers: {} };
  if (datos instanceof FormData) {
    opciones.body = datos; // el navegador arma el multipart/form-data y su encabezado
  } else if (datos !== undefined) {
    opciones.headers["Content-Type"] = "application/json";
    opciones.body = JSON.stringify(datos);
  }

  let respuesta;
  try {
    respuesta = await fetch(`${API_URL}${ruta}`, opciones);
  } catch {
    throw new Error("No se pudo conectar con el servidor. Revisa que el backend esté corriendo (docker compose up -d).");
  }

  const cuerpo = await respuesta.json().catch(() => null); // un error 500 de Django no trae JSON
  if (!respuesta.ok) {
    throw new Error(mensajeDeError(cuerpo) || `El servidor respondió con error ${respuesta.status}.`);
  }
  return cuerpo;
}
