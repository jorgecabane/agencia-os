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
import { commandsCtx } from "@milkdown/kit/core";
import { uploadConfig } from "@milkdown/kit/plugin/upload";
import { clearTextInCurrentBlockCommand } from "@milkdown/kit/preset/commonmark";
import { Decoration } from "@milkdown/kit/prose/view";
import { useEffect, useRef } from "react";

export const MAX_IMAGEN = 2 * 1024 * 1024;
const raizRepo = () => window.aos.config.leer().then((c) => c.repo);

/** Cómo el Editor lee en vivo el contenido de un lienzo (visual o markdown) y sabe cuándo nace y muere. */
export type Enlace = { onCambio: () => void; onListo: (leer: () => string) => void; onSoltar: (leer: () => string) => void };

type PropsLienzo = Enlace & {
  inicial: string; ruta: string;
  subirImagen: (f: File) => Promise<string>; onImagenPesada: () => void; onPedirClaude?: (pedido: string) => void;
};

/** El editor Crepe. Se crea una vez por montaje: para recargar el contenido se cambia su `key`. */
export function Lienzo(props: PropsLienzo) {
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
    crepe.on((l) => l.markdownUpdated(() => p.current.onCambio()));
    const leer = () => crepe.getMarkdown();
    let vivo = true;
    const creado = crepe.create().then(() => vivo && p.current.onListo(leer));
    return () => {
      // Al desmontar el Editor, su limpieza corre antes que esta (React limpia de padre a hijo) y alcanza a leer.
      vivo = false;
      p.current.onSoltar(leer);
      void creado.then(() => crepe.destroy());
    };
  }, []);
  return <div ref={raiz} className="lienzo" />;
}
