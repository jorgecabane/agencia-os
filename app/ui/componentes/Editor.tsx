import { CrepeBuilder } from "@milkdown/crepe/builder";
import { blockEdit } from "@milkdown/crepe/feature/block-edit";
import { cursor } from "@milkdown/crepe/feature/cursor";
import { imageBlock } from "@milkdown/crepe/feature/image-block";
import { linkTooltip } from "@milkdown/crepe/feature/link-tooltip";
import { listItem } from "@milkdown/crepe/feature/list-item";
import { placeholder } from "@milkdown/crepe/feature/placeholder";
import { table } from "@milkdown/crepe/feature/table";
import { toolbar } from "@milkdown/crepe/feature/toolbar";
import "@milkdown/crepe/theme/common/prosemirror.css";
import "@milkdown/crepe/theme/common/reset.css";
import "@milkdown/crepe/theme/common/block-edit.css";
import "@milkdown/crepe/theme/common/cursor.css";
import "@milkdown/crepe/theme/common/image-block.css";
import "@milkdown/crepe/theme/common/link-tooltip.css";
import "@milkdown/crepe/theme/common/list-item.css";
import "@milkdown/crepe/theme/common/placeholder.css";
import "@milkdown/crepe/theme/common/toolbar.css";
import "@milkdown/crepe/theme/common/table.css";
import { clearTextInCurrentBlockCommand } from "@milkdown/kit/preset/commonmark";
import { commandsCtx } from "@milkdown/kit/core";
import { uploadConfig } from "@milkdown/kit/plugin/upload";
import { Decoration } from "@milkdown/kit/prose/view";
import { useEffect, useRef, useState } from "react";
import type { Commit } from "../../shared/puente";
import { autor, hace } from "../datos/actividad";
import { fechaLocal, titulo } from "../datos/hoy";
import { componer, relativa, rutaAdjunto } from "../datos/markdown";
import { separar } from "../datos/md";
import { aGuardar } from "../datos/mezcla";
import { useSesion } from "../datos/sesion";
import { Etiquetas } from "./Etiquetas";

const ESPERA_GUARDADO_MS = 1000;
const MAX_IMAGEN = 2 * 1024 * 1024;
const raizRepo = () => window.aos.config.leer().then((c) => c.repo);

type Estado = "guardado" | "pendiente" | "guardando";

/** Página tipo Notion: frontmatter como etiquetas arriba, cuerpo en Milkdown Crepe, guardado solo y mezcla segura. */
export function Editor({ ruta, onPedirClaude }: { ruta: string; onPedirClaude?: (pedido: string) => void }) {
  const { indice } = useSesion();
  const [base, setBase] = useState<string | null>(null); // lo último leído o escrito: con esto se compara
  const [version, setVersion] = useState(0); // sube para recargar el lienzo con `base`
  const [estado, setEstado] = useState<Estado>("guardado");
  const [conflicto, setConflicto] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ultimo, setUltimo] = useState<Commit>();
  const [cambiosVista, setCambiosVista] = useState<Record<string, unknown>>({});
  const r = useRef({ base: "", cuerpo: null as string | null, cambios: {} as Record<string, unknown>, timer: 0, guardando: false });
  const lector = useRef<(() => string) | null>(null); // markdown actual del lienzo, sin esperar su aviso de cambio
  const sucio = () => r.current.cuerpo !== null || Object.keys(r.current.cambios).length > 0;

  const cargar = (texto: string) => {
    r.current = { ...r.current, base: texto, cuerpo: null, cambios: {} };
    setCambiosVista({});
    setBase(texto);
    setVersion((v) => v + 1);
  };

  const guardar = async (): Promise<void> => {
    const s = r.current;
    clearTimeout(s.timer);
    if (s.guardando) return void (s.timer = window.setTimeout(() => void guardarRef.current(), ESPERA_GUARDADO_MS));
    if (!sucio()) return;
    s.guardando = true;
    setEstado("guardando");
    try {
      const { cuerpo, cambios } = s;
      const mio = componer(s.base, cambios, cuerpo ?? separar(s.base).cuerpo);
      const enDisco = await window.aos.repo.read(ruta).catch(() => s.base);
      const res = aGuardar(s.base, mio, enDisco);
      if (res.texto !== null) await window.aos.repo.write(ruta, res.texto);
      const escrito = res.texto ?? enDisco;
      const siguioEscribiendo = s.cuerpo !== cuerpo || s.cambios !== cambios;
      // Si siguió escribiendo mientras se guardaba, su lienzo parte de `mio`: esa es la base del próximo guardado.
      s.base = siguioEscribiendo ? mio : escrito;
      if (!siguioEscribiendo) {
        s.cuerpo = null;
        s.cambios = {};
        setCambiosVista({});
      }
      setBase(s.base);
      // Si entró algo de afuera, el lienzo muestra la mezcla (salvo que siga escribiendo: se mezcla en el próximo guardado).
      if (escrito !== mio && !siguioEscribiendo) setVersion((v) => v + 1);
      if (res.conflicto) setConflicto(true);
      setEstado(sucio() ? "pendiente" : "guardado");
      if (sucio()) s.timer = window.setTimeout(() => void guardarRef.current(), ESPERA_GUARDADO_MS);
    } catch (e) {
      setEstado("pendiente");
      setAviso(`No pude guardar: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      s.guardando = false;
    }
  };
  const guardarRef = useRef(guardar);
  guardarRef.current = guardar;

  const programar = () => {
    setEstado("pendiente");
    clearTimeout(r.current.timer);
    r.current.timer = window.setTimeout(() => void guardarRef.current(), ESPERA_GUARDADO_MS);
  };

  useEffect(() => {
    let vivo = true;
    const traerUltimo = () => void window.aos.git.log({ ruta, max: 1 }).then(([c]) => vivo && setUltimo(c), () => {});
    void window.aos.repo.read(ruta).then((t) => vivo && cargar(t), (e: unknown) => vivo && setAviso(`No pude abrir el archivo: ${String(e)}`));
    traerUltimo();
    const quitar = window.aos.repo.onCambio((rutas) => {
      if (!rutas.includes(ruta)) return;
      traerUltimo();
      // Con cambios sin guardar no se recarga: al guardar se mezcla con lo de afuera.
      if (sucio() || r.current.guardando) return;
      void window.aos.repo.read(ruta).then((t) => vivo && !sucio() && t !== r.current.base && cargar(t), () => {});
    });
    return () => {
      vivo = false;
      quitar();
      // Al salir se guarda de inmediato, incluido lo último tecleado que el lienzo aún no avisó.
      // Si no cambió nada, componer devuelve el archivo tal cual y no se escribe.
      if (lector.current) r.current.cuerpo = lector.current();
      void guardarRef.current();
    };
  }, [ruta]);

  const avisoPesada = () => setAviso("La imagen pesa más de 2 MB. Súbela a Drive y pega el link");
  const subirImagen = async (file: File): Promise<string> => {
    if (file.size > MAX_IMAGEN) {
      avisoPesada();
      throw new Error("imagen muy pesada");
    }
    const primera = rutaAdjunto(ruta, file.name, fechaLocal());
    let destino = primera;
    for (let n = 2; (await window.aos.repo.list(destino)).length; n++) destino = primera.replace(/(\.[a-z0-9]+)$/, `-${n}$1`);
    await window.aos.repo.writeBase64(destino, await aBase64(file));
    return relativa(ruta, destino);
  };

  if (base === null) return aviso ? <p role="alert" className="aviso-editor">⚠ {aviso}</p> : null;
  const { meta } = separar(base);
  return (
    <article className="doc">
      <h1 className="doc-titulo">{titulo(ruta)}</h1>
      <p className="guardado" role="status">
        {estado === "guardado" ? <span className="ok">✓ Guardado</span> : <span>{estado === "guardando" ? "Guardando…" : "● Sin guardar"}</span>}
        {ultimo && <span>Editado por {autor(ultimo, indice.personas)} {hace(ultimo.fecha, new Date())}</span>}
      </p>
      {meta && (
        <Etiquetas meta={{ ...meta, ...cambiosVista }} onCambiar={(k, v) => {
          r.current.cambios = { ...r.current.cambios, [k]: v };
          setCambiosVista(r.current.cambios);
          programar();
        }} />
      )}
      {conflicto && (
        <div className="aviso-editor" role="alert">
          <span>⚠ Cambió mientras editabas: revisa. Quedaron las dos versiones, la tuya primero.</span>
          <button className="btn" aria-disabled={!onPedirClaude} disabled={!onPedirClaude}
            onClick={() => onPedirClaude?.(`En ${ruta} quedaron dos versiones de un bloque porque se editó al mismo tiempo. Mézclalas en una sola.`)}>
            Pedirle a Claude que lo mezcle
          </button>
          <button className="x" aria-label="Cerrar aviso" onClick={() => setConflicto(false)}>×</button>
        </div>
      )}
      {aviso && (
        <div className="aviso-editor" role="alert">
          <span>⚠ {aviso}</span>
          <button className="x" aria-label="Cerrar aviso" onClick={() => setAviso(null)}>×</button>
        </div>
      )}
      <Lienzo key={version} inicial={separar(base).cuerpo} ruta={ruta}
        onCambio={(md) => { r.current.cuerpo = md; programar(); }} lector={lector} subirImagen={subirImagen} onImagenPesada={avisoPesada} onPedirClaude={onPedirClaude} />
    </article>
  );
}

function aBase64(file: File): Promise<string> {
  return new Promise((ok, mal) => {
    const lector = new FileReader();
    lector.onload = () => ok(String(lector.result).split(",")[1] ?? "");
    lector.onerror = () => mal(lector.error);
    lector.readAsDataURL(file);
  });
}

type PropsLienzo = {
  inicial: string; ruta: string; onCambio: (md: string) => void; lector: { current: (() => string) | null };
  subirImagen: (f: File) => Promise<string>; onImagenPesada: () => void; onPedirClaude?: (pedido: string) => void;
};

/** El editor Crepe. Se crea una vez por montaje: para recargar el contenido se cambia su `key`. */
function Lienzo(props: PropsLienzo) {
  const raiz = useRef<HTMLDivElement>(null);
  const p = useRef(props);
  p.current = props;
  useEffect(() => {
    const { inicial, ruta } = p.current;
    // Sin bloques de código con resaltado ni fórmulas: traen cientos de archivos y el repo no los usa.
    const crepe = new CrepeBuilder({ root: raiz.current, defaultValue: inicial })
      .addFeature(cursor)
      .addFeature(listItem)
      .addFeature(table)
      .addFeature(toolbar)
      .addFeature(placeholder, { text: "Escribe, o usa / para insertar", mode: "block" })
      .addFeature(linkTooltip, { inputPlaceholder: "Pega o escribe un link", editButton: "Editar", removeButton: "Quitar", confirmButton: "Listo" })
      .addFeature(imageBlock, {
        onUpload: (f) => p.current.subirImagen(f),
        proxyDomURL: async (url) => {
          const repo = /^[a-z][a-z0-9+.-]*:/i.test(url) ? null : await raizRepo();
          return repo ? new URL(url, `file://${repo}/${ruta}`).href : url;
        },
        blockUploadButton: "Subir imagen",
        blockUploadPlaceholderText: "o pega un link de Drive",
        blockCaptionPlaceholderText: "Escribe una leyenda",
        blockConfirmButton: "Listo",
        inlineUploadButton: "Subir",
        inlineUploadPlaceholderText: "o pega un link",
        inlineConfirmButton: "Listo",
      })
      .addFeature(blockEdit, {
        textGroup: {
          label: "Texto", text: { label: "Texto" }, h1: { label: "Título" }, h2: { label: "Subtítulo" }, h3: { label: "Título 3" },
          h4: null, h5: null, h6: null, quote: { label: "Cita" }, divider: { label: "Separador" },
        },
        listGroup: { label: "Listas", bulletList: { label: "Lista" }, orderedList: { label: "Lista numerada" }, taskList: { label: "Lista de tareas" } },
        advancedGroup: { label: "Insertar", image: { label: "Imagen" }, codeBlock: null, table: { label: "Tabla" }, math: null },
        buildMenu: (menu) => {
          if (!p.current.onPedirClaude) return; // el chat llega después; sin él no se ofrece
          menu.addGroup("claude", "Claude").addItem("pedir", {
            label: "Pedirle a Claude", icon: "✦",
            onRun: (ctx) => {
              ctx.get(commandsCtx).call(clearTextInCurrentBlockCommand.key);
              p.current.onPedirClaude?.(`Escribe o completa esta sección de ${ruta}.`);
            },
          });
        },
      });
    // Pegar o soltar imágenes: las de más de 2 MB se descartan antes de subir (si no, queda el aviso "subiendo" pegado).
    crepe.editor.config((ctx) => ctx.update(uploadConfig.key, (prev) => ({
      ...prev,
      uploader: (files, schema, ctx2, pos) => {
        const livianas = new DataTransfer();
        for (const f of Array.from(files)) {
          if (f.size <= MAX_IMAGEN) livianas.items.add(f);
          else p.current.onImagenPesada();
        }
        return prev.uploader(livianas.files, schema, ctx2, pos);
      },
      uploadWidgetFactory: (pos, spec) => {
        const aviso = document.createElement("span");
        aviso.textContent = "Subiendo imagen…";
        return Decoration.widget(pos, aviso, spec);
      },
    })));
    crepe.on((l) => l.markdownUpdated((_ctx, md) => p.current.onCambio(md)));
    const { lector } = p.current;
    const leer = () => crepe.getMarkdown();
    let vivo = true;
    const creado = crepe.create().then(() => vivo && (lector.current = leer));
    return () => {
      // Al desmontar el Editor, su limpieza corre antes que esta (React limpia de padre a hijo) y alcanza a leer.
      vivo = false;
      if (lector.current === leer) lector.current = null;
      void creado.then(() => crepe.destroy());
    };
  }, []);
  return <div ref={raiz} className="lienzo" />;
}
