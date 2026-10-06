"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Camera, Moon, Sun, Trash2 } from "lucide-react";
import { apiFetch, mensajeDeError } from "@/lib/auth";
import {
  ACCEPT_FOTO,
  FOTO_MAX_PX,
  FotoInvalida,
  iniciales,
  prepararFoto,
  useFotoPerfil,
} from "@/lib/foto-perfil";
import { setStoredTheme, useStoredTheme } from "@/lib/theme";
import type { CampoPerfilObligatorio, GeneroPerfil, PerfilIn, PerfilOut } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { AvatarPerfil } from "@/app/components/avatar-perfil";
import { BorrarCuenta } from "@/app/components/borrar-cuenta";
import { esGerencia } from "@/app/components/modulo-vendedores";
import { ServiciosNegocio } from "@/app/components/servicios-negocio";
import { UsuariosNegocio } from "@/app/components/usuarios-negocio";
import {
  Aviso,
  Boton,
  Campo,
  Cargando,
  Interruptor,
  PageHeader,
  inputClass,
  selectClass,
} from "@/app/components/ui";
import { useUsuario } from "@/app/components/usuario-context";

const GENEROS: { valor: GeneroPerfil; label: string }[] = [
  { valor: "femenino", label: "Femenino" },
  { valor: "masculino", label: "Masculino" },
  { valor: "prefiero_no_decirlo", label: "Prefiero no decirlo" },
];

const ETIQUETA_CAMPO: Record<CampoPerfilObligatorio, string> = {
  nombres: "nombre(s)",
  apellido_paterno: "apellido paterno",
  fecha_nacimiento: "fecha de nacimiento",
  genero: "género",
};

// Mismas reglas que schemas.PerfilIn en el backend, que es quien decide.
const PATRON_NOMBRE = /^[\p{L}](?:[\p{L}]|[ '’\-.])*$/u;
const EDAD_MINIMA = 18;

/** Fecha más reciente que cumple la edad mínima hoy, como YYYY-MM-DD. */
function fechaMaxima(): string {
  const hoy = new Date();
  const limite = new Date(hoy.getFullYear() - EDAD_MINIMA, hoy.getMonth(), hoy.getDate());
  const m = String(limite.getMonth() + 1).padStart(2, "0");
  const d = String(limite.getDate()).padStart(2, "0");
  return `${limite.getFullYear()}-${m}-${d}`;
}

/** Vacío no es error (se puede guardar a medias); lo que haya, tiene que ser un nombre. */
function errorNombre(valor: string): string | null {
  const v = valor.trim();
  if (!v) return null;
  if (v.length > 100) return "Máximo 100 caracteres";
  if (!PATRON_NOMBRE.test(v)) return "Solo letras, espacios, guion, apóstrofo o punto";
  return null;
}

/** "" -> null, para que el backend lo guarde vacío. */
function nulo(v: string): string | null {
  const t = v.trim();
  return t ? t : null;
}

/**
 * Preferencias: el perfil personal de quien entra, la apariencia del portal
 * y (solo gerencia) los servicios del negocio. Nada del perfil es obligatorio para usar el portal;
 * mientras falten datos, el backend manda un recordatorio diario durante
 * los primeros 20 días de la cuenta (jobs/perfil_background.py).
 */
export default function PreferenciasPage() {
  const { usuario, recargar: recargarUsuario } = useUsuario();
  const perfil = useApi<PerfilOut>("/api/perfil");
  const soloLectura = Boolean(usuario?.impersonado_por);

  const [nombres, setNombres] = useState("");
  const [apellidoPaterno, setApellidoPaterno] = useState("");
  const [apellidoMaterno, setApellidoMaterno] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [genero, setGenero] = useState<GeneroPerfil | "">("");
  const [empresa, setEmpresa] = useState("");

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);
  const inputFotoRef = useRef<HTMLInputElement>(null);

  const theme = useStoredTheme();
  const fotoUrl = useFotoPerfil(perfil.data?.foto_version);

  // Al llegar el perfil, el formulario parte de lo guardado.
  useEffect(() => {
    const p = perfil.data;
    if (!p) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- cargar el form desde el servidor es el patrón del resto del portal (ver gerencia/planes).
    setNombres(p.nombres ?? "");
    setApellidoPaterno(p.apellido_paterno ?? "");
    setApellidoMaterno(p.apellido_materno ?? "");
    setFechaNacimiento(p.fecha_nacimiento ?? "");
    setGenero(p.genero ?? "");
    setEmpresa(p.empresa ?? "");
  }, [perfil.data]);

  const errores = {
    nombres: errorNombre(nombres),
    apellido_paterno: errorNombre(apellidoPaterno),
    apellido_materno: errorNombre(apellidoMaterno),
    fecha_nacimiento:
      fechaNacimiento && fechaNacimiento > fechaMaxima()
        ? `Debes tener al menos ${EDAD_MINIMA} años`
        : null,
    empresa: empresa.trim().length > 255 ? "Máximo 255 caracteres" : null,
  };
  const hayErrores = Object.values(errores).some(Boolean);

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (hayErrores || soloLectura) return;
    setGuardando(true);
    setError(null);
    setAviso(null);
    try {
      const body: PerfilIn = {
        nombres: nulo(nombres),
        apellido_paterno: nulo(apellidoPaterno),
        apellido_materno: nulo(apellidoMaterno),
        fecha_nacimiento: fechaNacimiento || null,
        genero: genero || null,
        empresa: nulo(empresa),
      };
      const guardado = await apiFetch<PerfilOut>("/api/perfil", { method: "PUT", json: body });
      setAviso(
        guardado.completo
          ? "Perfil guardado."
          : "Guardado. Todavía faltan algunos datos para completar tu perfil.",
      );
      await perfil.recargar(true);
      recargarUsuario?.();
    } catch (err) {
      setError(mensajeDeError(err, "No se pudo guardar el perfil."));
    } finally {
      setGuardando(false);
    }
  };

  const elegirFoto = async (archivo: File | undefined) => {
    if (!archivo) return;
    setErrorFoto(null);
    setSubiendoFoto(true);
    try {
      const lista = await prepararFoto(archivo);
      const datos = new FormData();
      datos.append("archivo", lista);
      await apiFetch<PerfilOut>("/api/perfil/foto", { method: "PUT", body: datos });
      await perfil.recargar(true);
      recargarUsuario?.();
    } catch (err) {
      setErrorFoto(
        err instanceof FotoInvalida ? err.message : mensajeDeError(err, "No se pudo subir la foto."),
      );
    } finally {
      setSubiendoFoto(false);
      // Permite volver a elegir el mismo archivo después de un error.
      if (inputFotoRef.current) inputFotoRef.current.value = "";
    }
  };

  const quitarFoto = async () => {
    setErrorFoto(null);
    setSubiendoFoto(true);
    try {
      await apiFetch("/api/perfil/foto", { method: "DELETE" });
      await perfil.recargar(true);
      recargarUsuario?.();
    } catch (err) {
      setErrorFoto(mensajeDeError(err, "No se pudo quitar la foto."));
    } finally {
      setSubiendoFoto(false);
    }
  };

  const p = perfil.data;
  const bloqueado = guardando || soloLectura;

  return (
    <>
      <PageHeader
        titulo="Preferencias"
        sub={
          <span>
            {esGerencia(usuario)
              ? "tu perfil, la apariencia del portal y tu negocio"
              : "tu perfil y la apariencia del portal"}
          </span>
        }
      />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {perfil.error && <Aviso tipo="error">{perfil.error}</Aviso>}
          {soloLectura && (
            <Aviso tipo="info">Estás viendo el portal como este negocio: el perfil es de solo lectura.</Aviso>
          )}

          {p && !p.completo && (
            <Aviso tipo="info">
              Para completar tu perfil faltan:{" "}
              {p.faltantes.map((f) => ETIQUETA_CAMPO[f]).join(", ")}.
              {p.recordatorio_dias_restantes !== null &&
                ` Te lo recordaremos a diario durante ${p.recordatorio_dias_restantes} ${
                  p.recordatorio_dias_restantes === 1 ? "día" : "días"
                } más.`}
            </Aviso>
          )}

          {!p && perfil.loading ? (
            <Cargando />
          ) : (
            <>
              {/* Foto */}
              <section data-tour="preferencias.foto" className="flex flex-col gap-3 rounded-md border border-bg-700 bg-bg-900 p-4">
                <header>
                  <h2 className="text-sm font-medium text-text-100">Foto de perfil</h2>
                  <p className="font-mono text-[11px] text-text-600">
                    opcional · JPG o PNG · se ajusta sola a {FOTO_MAX_PX}×{FOTO_MAX_PX} px como máximo
                  </p>
                </header>
                <div className="flex items-center gap-4">
                  <AvatarPerfil
                    src={fotoUrl}
                    iniciales={iniciales(nombres, apellidoPaterno, usuario?.email)}
                    tamano={72}
                  />
                  <div className="flex flex-wrap gap-2">
                    <input
                      ref={inputFotoRef}
                      id="foto-perfil"
                      type="file"
                      accept={ACCEPT_FOTO}
                      className="sr-only"
                      onChange={(e) => elegirFoto(e.target.files?.[0])}
                      disabled={subiendoFoto || soloLectura}
                      aria-label="Elegir foto de perfil"
                    />
                    <Boton
                      onClick={() => inputFotoRef.current?.click()}
                      loading={subiendoFoto}
                      disabled={soloLectura}
                    >
                      {!subiendoFoto && <Camera size={13} aria-hidden />}
                      {p?.tiene_foto ? "Cambiar foto" : "Subir foto"}
                    </Boton>
                    {p?.tiene_foto && (
                      <Boton variante="fantasma" onClick={quitarFoto} disabled={subiendoFoto || soloLectura}>
                        <Trash2 size={13} aria-hidden />
                        Quitar
                      </Boton>
                    )}
                  </div>
                </div>
                {errorFoto && <Aviso tipo="error">{errorFoto}</Aviso>}
              </section>

              {/* Datos */}
              <form data-tour="preferencias.perfil"
                onSubmit={guardar}
                noValidate
                className="flex flex-col gap-4 rounded-md border border-bg-700 bg-bg-900 p-4"
              >
                <header>
                  <h2 className="text-sm font-medium text-text-100">Datos personales</h2>
                  <p className="font-mono text-[11px] text-text-600">
                    puedes guardar a medias y completarlo después
                  </p>
                </header>

                {/* Solo lectura: es el usuario con el que entra. Antes se veía
                    en la tarjeta de arriba del sidebar. */}
                <Campo id="correo" label="Correo" hint="con el que inicias sesión">
                  <input
                    id="correo"
                    type="email"
                    value={usuario?.email ?? ""}
                    readOnly
                    disabled
                    className={inputClass}
                  />
                </Campo>

                <Campo id="nombres" label="Nombre(s)" error={errores.nombres}>
                  <input
                    id="nombres"
                    type="text"
                    value={nombres}
                    onChange={(e) => setNombres(e.target.value)}
                    autoComplete="given-name"
                    maxLength={100}
                    disabled={bloqueado}
                    className={inputClass}
                  />
                </Campo>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Campo id="apellido_paterno" label="Apellido paterno" error={errores.apellido_paterno}>
                    <input
                      id="apellido_paterno"
                      type="text"
                      value={apellidoPaterno}
                      onChange={(e) => setApellidoPaterno(e.target.value)}
                      autoComplete="family-name"
                      maxLength={100}
                      disabled={bloqueado}
                      className={inputClass}
                    />
                  </Campo>
                  <Campo
                    id="apellido_materno"
                    label="Apellido materno"
                    hint="opcional"
                    error={errores.apellido_materno}
                  >
                    <input
                      id="apellido_materno"
                      type="text"
                      value={apellidoMaterno}
                      onChange={(e) => setApellidoMaterno(e.target.value)}
                      maxLength={100}
                      disabled={bloqueado}
                      className={inputClass}
                    />
                  </Campo>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Campo
                    id="fecha_nacimiento"
                    label="Fecha de nacimiento"
                    error={errores.fecha_nacimiento}
                  >
                    <input
                      id="fecha_nacimiento"
                      type="date"
                      value={fechaNacimiento}
                      onChange={(e) => setFechaNacimiento(e.target.value)}
                      max={fechaMaxima()}
                      autoComplete="bday"
                      disabled={bloqueado}
                      className={inputClass}
                    />
                  </Campo>
                  <Campo id="genero" label="Género">
                    <select
                      id="genero"
                      value={genero}
                      onChange={(e) => setGenero(e.target.value as GeneroPerfil | "")}
                      disabled={bloqueado}
                      className={selectClass}
                    >
                      <option value="">Selecciona…</option>
                      {GENEROS.map((g) => (
                        <option key={g.valor} value={g.valor}>
                          {g.label}
                        </option>
                      ))}
                    </select>
                  </Campo>
                </div>

                <Campo
                  id="empresa"
                  label="Empresa"
                  hint="opcional · de entrada, el nombre de tu negocio"
                  error={errores.empresa}
                >
                  <input
                    id="empresa"
                    type="text"
                    value={empresa}
                    onChange={(e) => setEmpresa(e.target.value)}
                    autoComplete="organization"
                    maxLength={255}
                    disabled={bloqueado}
                    className={inputClass}
                  />
                </Campo>

                {error && <Aviso tipo="error">{error}</Aviso>}
                {aviso && <Aviso tipo="exito">{aviso}</Aviso>}

                <div className="flex justify-end">
                  <Boton
                    type="submit"
                    variante="primario"
                    loading={guardando}
                    disabled={hayErrores || soloLectura}
                  >
                    Guardar
                  </Boton>
                </div>
              </form>

              {/* Apariencia (la misma que el desplegable del sidebar) */}
              <section data-tour="preferencias.tema" className="flex items-center justify-between gap-3 rounded-md border border-bg-700 bg-bg-900 p-4">
                <span className="flex items-center gap-2 text-sm text-text-100">
                  {theme === "light" ? <Sun size={14} aria-hidden /> : <Moon size={14} aria-hidden />}
                  Tema {theme === "light" ? "claro" : "oscuro"}
                </span>
                <Interruptor
                  label="Cambiar entre tema claro y oscuro"
                  checked={theme === "light"}
                  onChange={(claro) => setStoredTheme(claro ? "light" : "dark")}
                />
              </section>

              {/* Lo del negocio, no de la persona: solo gerencia (el backend
                  lo vuelve a exigir en cada endpoint). */}
              {esGerencia(usuario) && <ServiciosNegocio soloLectura={soloLectura} />}
              {esGerencia(usuario) && <UsuariosNegocio soloLectura={soloLectura} />}

              {usuario?.role === "owner" && !soloLectura && <BorrarCuenta />}
            </>
          )}
        </div>
      </div>
    </>
  );
}
