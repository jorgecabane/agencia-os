import { useEffect, useState } from "react";
import { Chat, type Pedido } from "../componentes/Chat";
import { useAlgunoEnCurso } from "../datos/chat";
import { colorPara, titulo } from "../datos/hoy";
import { cambiar, separar } from "../datos/md";
import { useSesion } from "../datos/sesion";
import type { Aprobacion } from "../datos/tipos";
import "./pantallas.css";

export const CANAL: Record<string, string> = { email: "correo", instagram: "Instagram", dm: "mensaje directo", ads: "anuncios", otro: "otro canal" };
const ESTADO: Record<string, string> = { pendiente: "por revisar", aprobado: "aprobada, sin enviar", descartado: "descartada", ejecutado: "enviada" };
const ICONO: Record<string, string> = { pendiente: "◌", aprobado: "✓", descartado: "×", ejecutado: "●" };
const ABIERTAS = new Set(["pendiente", "aprobado"]);
// "bandeja/2026-10-27-aprobacion-correo-ana.md" → "Correo ana": aquí todo es una aprobación.
const nombre = (ruta: string) => titulo(ruta.replace(/\/(\d{4}-\d{2}-\d{2}-)?aprobacion-/, "/$1"));

/** Borradores hacia afuera (`bandeja/*aprobacion*.md`): revisar, aprobar y enviar, corregir o descartar. */
export function Aprobaciones({ inicial, onEditar }: { inicial?: string; onEditar: (ruta: string) => void }) {
  const { indice, persona } = useSesion();
  const abiertas = indice.aprobaciones
    .filter((a) => ABIERTAS.has(a.estado))
    .sort((a, b) => Number(b.persona === persona) - Number(a.persona === persona) || b.ruta.localeCompare(a.ruta));
  const [sel, setSel] = useState<string | undefined>(inicial ?? abiertas[0]?.ruta);
  const grupos = [
    { titulo: "Por revisar", items: abiertas.filter((a) => a.estado === "pendiente") },
    { titulo: "Aprobadas, sin enviar", items: abiertas.filter((a) => a.estado === "aprobado") },
  ].filter((g) => g.items.length);

  return (
    <main className="principal aprobaciones">
      <h1 className="titulo">Aprobaciones</h1>
      <p className="bajada">Lo que Claude dejó listo para salir. Nada se envía hasta que lo apruebes.</p>
      <div className="aprob-cuerpo">
        <nav className="aprob-lista" aria-label="Borradores">
          {grupos.length === 0 && <p className="vacio">No hay nada esperando tu OK.</p>}
          {grupos.map((g) => (
            <section key={g.titulo} className="seccion">
              <h2>{g.titulo} <span className="c">{g.items.length}</span></h2>
              {g.items.map((a) => <Fila key={a.ruta} a={a} marcada={sel === a.ruta} onElegir={() => setSel(a.ruta)} />)}
            </section>
          ))}
        </nav>
        {sel ? <Detalle key={sel} ruta={sel} onEditar={onEditar} /> : <div />}
      </div>
    </main>
  );
}

function Fila({ a, marcada, onElegir }: { a: Aprobacion; marcada: boolean; onElegir: () => void }) {
  const { indice } = useSesion();
  const cliente = indice.clientes.find((c) => c.slug === a.cliente)?.nombre ?? a.cliente;
  const quien = indice.personas.find((p) => p.slug === a.persona)?.nombre ?? a.persona;
  return (
    <button className="fila aprob-fila" aria-pressed={marcada} onClick={onElegir}>
      <span className="barra" style={{ background: colorPara(a.cliente) }} aria-hidden />
      <span>
        <span className="t">{nombre(a.ruta)}</span>
        <span className="sub">{cliente} · {CANAL[a.canal] ?? a.canal} · {quien}</span>
      </span>
    </button>
  );
}

/** Lee el borrador y lo mantiene al día si Claude o alguien más lo cambia. */
function useArchivo(ruta: string): string | null {
  const [texto, setTexto] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    const leer = () => window.aos.repo.read(ruta).then((t) => vivo && setTexto(t), () => vivo && setTexto(""));
    void leer();
    const quitar = window.aos.repo.onCambio((rutas) => rutas.includes(ruta) && void leer());
    return () => { vivo = false; quitar(); };
  }, [ruta]);
  return texto;
}

function Detalle({ ruta, onEditar }: { ruta: string; onEditar: (ruta: string) => void }) {
  const { indice } = useSesion();
  const texto = useArchivo(ruta);
  const ocupado = useAlgunoEnCurso();
  const [pedido, setPedido] = useState<Pedido>();
  const [error, setError] = useState<string | null>(null);
  if (texto === null) return <section className="aprob-detalle" aria-busy />;
  const { meta, cuerpo } = separar(texto);
  const estado = String(meta?.estado ?? "");
  const canal = String(meta?.canal ?? "");
  const cliente = indice.clientes.find((c) => c.slug === meta?.cliente);
  const guardar = (e: string) => cambiar(ruta, { estado: e }).then(() => true, () => {
    setError("No se pudo guardar el cambio. Revisa que el archivo se pueda leer.");
    return false;
  });
  // Primero queda aprobada en el repo; el shell solo deja enviar si el archivo dice `estado: aprobado`.
  const aprobar = async () => {
    if (canal === "otro") return void guardar("aprobado"); // Claude no envía por "otro": lo envías tú
    if (ocupado) return setError("Claude está respondiendo otra cosa. Espera a que termine y vuelve a aprobar.");
    setError(null);
    if (estado === "aprobado" || (await guardar("aprobado"))) setPedido({ texto: `Ejecuta la aprobación ${ruta}` });
  };
  const corregir = () => document.querySelector<HTMLTextAreaElement>(".aprob-detalle .entrada textarea")?.focus();

  return (
    <section className="aprob-detalle" aria-label={`Borrador ${nombre(ruta)}`}>
      <div className="chips">
        {cliente && <span className="chip"><span className="dot" style={{ background: colorPara(cliente.slug) }} aria-hidden />{cliente.nombre}</span>}
        <span className="chip"><span className="k">por</span>{CANAL[canal] ?? canal}</span>
        <span className={`chip estado-${estado}`}><span aria-hidden>{ICONO[estado] ?? "·"}</span>{ESTADO[estado] ?? estado}</span>
      </div>
      <h2>{nombre(ruta)}</h2>
      <div className="borrador">{cuerpo.trim() || "El borrador está vacío."}</div>
      {ABIERTAS.has(estado) && (
        <Acciones estado={estado} canal={canal} ocupado={ocupado} onAprobar={() => void aprobar()} onGuardar={guardar}
          onCorregir={corregir} onEditar={() => onEditar(ruta)} />
      )}
      {error && <p className="error" role="alert">{error}</p>}
      {canal === "otro" && ABIERTAS.has(estado) && <p className="vacio">Este canal no tiene conector: cuando lo apruebes, envíalo tú y márcalo como enviado.</p>}
      <Chat contextoId={ruta} contexto={ruta} etiqueta={nombre(ruta)} color={cliente ? colorPara(cliente.slug) : undefined} pedido={pedido} onAbrir={onEditar} />
    </section>
  );
}

function Acciones({ estado, canal, ocupado, onAprobar, onGuardar, onCorregir, onEditar }: {
  estado: string; canal: string; ocupado: boolean; onAprobar: () => void;
  onGuardar: (estado: string) => Promise<boolean>; onCorregir: () => void; onEditar: () => void;
}) {
  const [confirmar, setConfirmar] = useState(false);
  const manual = canal === "otro";
  return (
    <>
      <div className="acciones">
        {manual && estado === "aprobado" ? (
          <button className="btn pri" onClick={() => void onGuardar("ejecutado")}>Ya lo envié</button>
        ) : (
          <button className="btn pri" aria-disabled={ocupado && !manual} onClick={onAprobar}>
            {manual ? "Aprobar" : estado === "aprobado" ? "Enviar" : "Aprobar y enviar"}
          </button>
        )}
        {estado === "pendiente" && <button className="btn" onClick={onCorregir}>Corregir con Claude</button>}
        <button className="btn" onClick={onEditar}>Editar</button>
        <button className="btn" aria-expanded={confirmar} onClick={() => setConfirmar(true)}>Descartar</button>
      </div>
      {confirmar && (
        <div className="formulario" role="alertdialog" aria-label="Confirmar descarte"
          onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); setConfirmar(false); } }}>
          <span>¿Descartar este borrador? No se enviará.</span>
          <button className="btn peligro" autoFocus onClick={() => void onGuardar("descartado").then(() => setConfirmar(false))}>Sí, descartar</button>
          <button className="btn plano" onClick={() => setConfirmar(false)}>Cancelar</button>
        </div>
      )}
    </>
  );
}
