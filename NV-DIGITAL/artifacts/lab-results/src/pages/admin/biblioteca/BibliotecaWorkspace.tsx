import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Upload,
  FolderPlus,
  Search,
  List,
  Grid2X2,
  Columns3,
  Star,
  MoreVertical,
  Download,
  Copy,
  Trash2,
  RotateCcw,
  FolderInput,
  Link2,
  Info,
  RefreshCw,
  Home,
  Clock,
  Tag,
  History,
  X,
} from "lucide-react";
import {
  EMPTY,
  hospitalApi,
  content,
  saveBlob,
  base64,
  mime,
  kind,
  bytes,
  date,
  descendants,
  type LibraryData,
  type LibraryItem,
} from "./api";
import { FileIcon, Modal } from "./ui";

type View =
  | "inicio"
  | "minha"
  | "recentes"
  | "atividade"
  | "favoritos"
  | "tags"
  | "lixo";
type Dialog = {
  kind:
    | "new"
    | "rename"
    | "move"
    | "copy"
    | "description"
    | "tags"
    | "tag-manager"
    | "share";
  item?: LibraryItem;
};
const VIEWS: { id: View; label: string; Icon: typeof Home }[] = [
  { id: "inicio", label: "Início", Icon: Home },
  { id: "minha", label: "Biblioteca da empresa", Icon: FolderInput },
  { id: "recentes", label: "Recentes", Icon: Clock },
  { id: "atividade", label: "Actividade", Icon: History },
  { id: "favoritos", label: "Favoritos", Icon: Star },
  { id: "tags", label: "Etiquetas", Icon: Tag },
  { id: "lixo", label: "Lixeira", Icon: Trash2 },
];
const FILTERS = [
  ["all", "Todos"],
  ["folder", "Pastas"],
  ["image", "Imagens"],
  ["pdf", "PDF"],
  ["doc", "Documentos"],
  ["sheet", "Folhas"],
  ["text", "Texto"],
] as const;
const ACTIONS: Record<string, string> = {
  upload: "Carregou documento",
  download: "Consultou / descarregou documento",
  rename: "Renomeou",
  move: "Moveu",
  copy: "Duplicou",
  trash: "Moveu para a lixeira",
  restore: "Restaurou",
  purge: "Eliminou definitivamente",
  describe: "Actualizou a descrição",
  tag: "Actualizou etiquetas",
  "folder.create": "Criou pasta",
  "tag.create": "Criou etiqueta",
  "tag.delete": "Removeu etiqueta",
};

export default function BibliotecaWorkspace({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const [data, setData] = useState<LibraryData>(EMPTY),
    [error, setError] = useState(""),
    [loaded, setLoaded] = useState(false),
    [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState({ text: "", error: false });
  const [view, setView] = useState<View>("minha"),
    [folder, setFolder] = useState<string | null>(null),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all");
  const [mode, setMode] = useState<"list" | "grid" | "columns">("list"),
    [sort, setSort] = useState("name"),
    [descending, setDescending] = useState(false),
    [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string[]>([]),
    [lastSelected, setLastSelected] = useState(""),
    [tagFilter, setTagFilter] = useState("");
  const [from, setFrom] = useState(""),
    [until, setUntil] = useState(""),
    [minSize, setMinSize] = useState(""),
    [advanced, setAdvanced] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null),
    [draft, setDraft] = useState(""),
    [destination, setDestination] = useState(""),
    [draftTags, setDraftTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState(""),
    [tagColor, setTagColor] = useState("#0d7a8a"),
    [details, setDetails] = useState<LibraryItem | null>(null);
  const [preview, setPreview] = useState<{
    item: LibraryItem;
    url: string;
    text?: string;
  } | null>(null);
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
    name: string;
  } | null>(null);
  const [menu, setMenu] = useState<{
    item: LibraryItem;
    x: number;
    y: number;
  } | null>(null);
  const picker = useRef<HTMLInputElement>(null),
    folderPicker = useRef<HTMLInputElement>(null),
    searchInput = useRef<HTMLInputElement>(null);
  const serial = useRef(0),
    mounted = useRef(true),
    locked = useRef(false),
    receipts = useRef(new Map<string, string>()),
    usedDeepLink = useRef(false);
  const reload = useCallback(async () => {
    const seq = ++serial.current;
    setLoading(true);
    try {
      const result = await hospitalApi<LibraryData>("GET", "/library");
      if (!Array.isArray(result.items) || !result.quota)
        throw new Error(
          "A biblioteca está a aguardar a actualização do servidor. Contacte a administração.",
        );
      if (mounted.current && seq === serial.current) {
        setData(result);
        setLoaded(true);
        setError("");
      }
      return result;
    } catch (e) {
      if (mounted.current && seq === serial.current)
        setError(e instanceof Error ? e.message : "Biblioteca indisponível.");
      throw e;
    } finally {
      if (mounted.current && seq === serial.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void reload().catch(() => {});
    const timer = setInterval(() => {
      if (!document.hidden && !locked.current) void reload().catch(() => {});
    }, 30000);
    return () => {
      mounted.current = false;
      serial.current++;
      clearInterval(timer);
    };
  }, [reload]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview.url);
    },
    [preview],
  );
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    document.addEventListener("click", close);
    document.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("scroll", close, true);
    };
  }, [menu]);
  useEffect(
    () => setPage(0),
    [
      folder,
      view,
      query,
      filter,
      sort,
      descending,
      tagFilter,
      from,
      until,
      minSize,
    ],
  );
  useEffect(() => {
    if (
      folder &&
      loaded &&
      !data.items.some((i) => i.id === folder && !i.deletedAt)
    )
      setFolder(null);
    setSelected((ids) =>
      ids.filter((id) => data.items.some((i) => i.id === id)),
    );
  }, [data.items, loaded, folder]);
  async function run(fn: () => Promise<unknown>, message: string) {
    if (locked.current) return false;
    locked.current = true;
    setBusy(true);
    setNotice({ text: "", error: false });
    let confirmed = false;
    try {
      await fn();
      confirmed = true;
      await reload();
      if (mounted.current) setNotice({ text: message, error: false });
      return true;
    } catch (e) {
      if (mounted.current)
        setNotice({
          text:
            (confirmed ? "Alteração confirmada. Actualize a lista: " : "") +
            (e instanceof Error ? e.message : "Operação não confirmada."),
          error: true,
        });
      if (!confirmed) await reload().catch(() => {});
      return confirmed;
    } finally {
      locked.current = false;
      if (mounted.current) {
        setBusy(false);
        setProgress(null);
      }
    }
  }
  const live = data.items.filter((i) => !i.deletedAt),
    folders = live.filter((i) => i.type === "folder");
  const breadcrumb = useMemo(() => {
    const result: LibraryItem[] = [],
      seen = new Set<string>();
    let id = folder;
    while (id && !seen.has(id)) {
      seen.add(id);
      const found = data.items.find((i) => i.id === id && i.type === "folder");
      if (!found) break;
      result.unshift(found);
      id = found.parentId;
    }
    return result;
  }, [folder, data.items]);
  const visible = useMemo(() => {
    let rows = data.items.filter((i) =>
      view === "lixo" ? Boolean(i.deletedAt) : !i.deletedAt,
    );
    if (view === "favoritos") rows = rows.filter((i) => i.favorite);
    else if (view === "recentes" || view === "inicio")
      rows = rows.filter((i) => i.type === "file");
    else if (view === "tags")
      rows = rows.filter((i) =>
        tagFilter ? i.tags.includes(tagFilter) : i.tags.length > 0,
      );
    else if (view === "minha" && !query.trim())
      rows = rows.filter((i) => i.parentId === folder);
    const q = query.trim().toLocaleLowerCase();
    if (q)
      rows = rows.filter((i) =>
        [i.name, i.description, i.createdBy]
          .join(" ")
          .toLocaleLowerCase()
          .includes(q),
      );
    if (filter !== "all") rows = rows.filter((i) => kind(i) === filter);
    if (from) rows = rows.filter((i) => i.modifiedAt.slice(0, 10) >= from);
    if (until) rows = rows.filter((i) => i.modifiedAt.slice(0, 10) <= until);
    if (minSize)
      rows = rows.filter((i) => i.size >= Number(minSize) * 1024 * 1024);
    rows.sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      const order =
        sort === "size"
          ? a.size - b.size
          : sort === "modifiedAt"
            ? a.modifiedAt.localeCompare(b.modifiedAt)
            : sort === "type"
              ? kind(a).localeCompare(kind(b))
              : a.name.localeCompare(b.name, "pt");
      return descending ? -order : order;
    });
    if (view === "inicio" || view === "recentes")
      rows.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
    return rows;
  }, [
    data.items,
    view,
    folder,
    query,
    filter,
    sort,
    descending,
    tagFilter,
    from,
    until,
    minSize,
  ]);
  const pages = Math.max(1, Math.ceil(visible.length / 40)),
    currentPage = Math.min(page, pages - 1),
    shown = visible.slice(currentPage * 40, (currentPage + 1) * 40);
  function navigate(id: string | null, next: View = "minha") {
    setFolder(id);
    setView(next);
    setSelected([]);
    setQuery("");
    setFilter("all");
    setTagFilter("");
    setMenu(null);
  }
  function openDialog(kind: Dialog["kind"], item?: LibraryItem) {
    setMenu(null);
    setDialog({ kind, item });
    setDraft(
      kind === "copy"
        ? (item?.name || "") + " (cópia)"
        : kind === "description"
          ? item?.description || ""
          : item?.name || "",
    );
    setDestination(folder || "");
    setDraftTags(item?.tags || []);
  }
  function select(item: LibraryItem, multi = false, range = false) {
    if (range && lastSelected) {
      const start = visible.findIndex((i) => i.id === lastSelected),
        end = visible.findIndex((i) => i.id === item.id);
      if (start >= 0 && end >= 0) {
        setSelected(
          visible
            .slice(Math.min(start, end), Math.max(start, end) + 1)
            .map((i) => i.id),
        );
        return;
      }
    }
    setSelected((ids) =>
      multi
        ? ids.includes(item.id)
          ? ids.filter((id) => id !== item.id)
          : [...ids, item.id]
        : ids.length === 1 && ids[0] === item.id
          ? []
          : [item.id],
    );
    setLastSelected(item.id);
  }
  const refs = (items: LibraryItem[]) =>
    items.map(({ id, type, revision }) => ({ id, type, revision }));
  async function mutate(
    action: string,
    items: LibraryItem[],
    extra: Record<string, unknown> = {},
  ) {
    if (!items.length) return false;
    if (
      ["trash", "purge"].includes(action) &&
      !confirm(
        (action === "purge"
          ? "Eliminar definitivamente "
          : "Mover para a lixeira ") +
          items.length +
          " item(ns), incluindo o conteúdo das pastas seleccionadas?",
      )
    )
      return false;
    const ok = await run(
      () =>
        hospitalApi("POST", "/library/batch", {
          action,
          items: refs(items),
          ...extra,
        }),
      action === "trash"
        ? "Itens na lixeira."
        : action === "restore"
          ? "Itens restaurados."
          : action === "purge"
            ? "Itens eliminados definitivamente."
            : "Alteração guardada no servidor.",
    );
    if (ok) setSelected([]);
    return ok;
  }
  async function open(item: LibraryItem) {
    if (busy || item.deletedAt) return;
    if (item.type === "folder") {
      navigate(item.id);
      return;
    }
    await run(async () => {
      const blob = await content(item);
      if (!mounted.current) return;
      const text = item.mime.startsWith("text/")
        ? (await blob.text()).slice(0, 60000)
        : undefined;
      setPreview({ item, url: URL.createObjectURL(blob), text });
    }, "Documento consultado.");
  }
  useEffect(() => {
    if (!loaded || usedDeepLink.current) return;
    const id = new URLSearchParams(location.search).get("biblioteca");
    usedDeepLink.current = true;
    if (id) {
      const item = data.items.find((i) => i.id === id && !i.deletedAt);
      if (item) void open(item);
      else
        setNotice({
          text: "Documento indisponível nesta instituição.",
          error: true,
        });
    }
  }, [loaded]);
  async function upload(files: File[], directory = false) {
    if (!files.length) return;
    const target = view === "minha" ? folder : null;
    await run(async () => {
      if (files.length > 300)
        throw new Error("Carregue até 300 ficheiros por operação.");
      const total = files.reduce((n, f) => n + f.size, 0);
      if (total + data.quota.used > data.quota.limit)
        throw new Error("Espaço insuficiente na biblioteca.");
      for (const f of files)
        if (!f.size || f.size > data.quota.maxFile || !mime(f))
          throw new Error(
            "Formato não suportado, ficheiro vazio ou superior a 10 MB: " +
              f.name,
          );
      const paths = new Map<string, string | null>([["", target]]),
        known = [...data.items];
      let completed = 0;
      for (const f of files) {
        const segments = directory
          ? (f.webkitRelativePath || f.name).split("/")
          : [f.name];
        if (segments.some((part) => !part || part === "." || part === ".."))
          throw new Error("Caminho de pasta inválido.");
        let key = "",
          parent = target;
        for (const segment of segments.slice(0, -1)) {
          const next = key ? key + "/" + segment : segment;
          if (!paths.has(next)) {
            const found = known.find(
              (i) =>
                i.type === "folder" &&
                !i.deletedAt &&
                i.parentId === parent &&
                i.name === segment,
            );
            const created =
              found ||
              (await hospitalApi<{ id: string; name: string }>(
                "POST",
                "/library/folders",
                { name: segment, parentId: parent },
              ));
            paths.set(next, created.id);
            known.push({
              id: created.id,
              type: "folder",
              name: created.name,
              parentId: parent,
            } as LibraryItem);
          }
          parent = paths.get(next)!;
          key = next;
        }
        setProgress({ done: completed, total: files.length, name: f.name });
        const requestKey = [
          parent,
          f.webkitRelativePath,
          f.name,
          f.size,
          f.lastModified,
        ].join("|");
        const requestId =
          receipts.current.get(requestKey) || crypto.randomUUID();
        receipts.current.set(requestKey, requestId);
        try {
          await hospitalApi("POST", "/library/files", {
            name: f.name,
            mime: mime(f),
            base64: await base64(f),
            folderId: parent,
            requestId,
          });
          receipts.current.delete(requestKey);
          completed++;
        } catch (e) {
          throw new Error(
            "Carregamento parcial: " +
              completed +
              " de " +
              files.length +
              " confirmados. " +
              (e instanceof Error
                ? e.message
                : "Repita os ficheiros por carregar."),
          );
        }
      }
      navigate(target);
    }, files.length + " ficheiro(s) guardado(s) no servidor.");
  }
  async function exportItems(items: LibraryItem[]) {
    const expanded = new Map<string, LibraryItem>();
    for (const item of items)
      for (const child of item.type === "folder"
        ? descendants(data.items, item.id)
        : [item])
        if (!child.deletedAt) expanded.set(child.id, child);
    const files = [...expanded.values()].filter((i) => i.type === "file");
    await run(async () => {
      if (files.reduce((n, i) => n + i.size, 0) > 50 * 1024 * 1024)
        throw new Error("Seleccione até 50 MB por exportação.");
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip(),
        names = new Set<string>();
      function path(item: LibraryItem) {
        const parts = [item.name];
        let parent = item.parentId;
        const seen = new Set<string>([item.id]);
        while (parent && !seen.has(parent)) {
          seen.add(parent);
          const f = data.items.find((i) => i.id === parent);
          if (!f) break;
          parts.unshift(f.name);
          parent = f.parentId;
        }
        return parts.map((p) => p.replace(/[\\/]/g, "_")).join("/");
      }
      for (let i = 0; i < files.length; i++) {
        const item = files[i];
        setProgress({ done: i, total: files.length, name: item.name });
        let targetPath = path(item);
        if (names.has(targetPath))
          targetPath = item.id.slice(0, 8) + "_" + targetPath;
        names.add(targetPath);
        zip.file(targetPath, await (await content(item)).arrayBuffer());
      }
      zip.file(
        "_manifesto_biblioteca.json",
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            items: [...expanded.values()],
          },
          null,
          2,
        ),
      );
      saveBlob(
        await zip.generateAsync({ type: "blob" }),
        "Biblioteca_documentos.zip",
      );
    }, "Exportação de documentos iniciada.");
  }
  function context(item: LibraryItem, x: number, y: number) {
    setMenu({
      item,
      x: Math.max(8, Math.min(x, window.innerWidth - 232)),
      y: Math.max(8, Math.min(y, window.innerHeight - 380)),
    });
  }
  function tree(
    parent: string | null,
    depth = 0,
    seen = new Set<string>(),
  ): React.ReactNode {
    if (depth > 12) return null;
    return folders
      .filter((i) => i.parentId === parent && !seen.has(i.id))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((i) => (
        <div key={i.id}>
          <button
            type="button"
            style={{ paddingLeft: 14 + depth * 12 }}
            aria-current={folder === i.id ? "page" : undefined}
            onClick={() => navigate(i.id)}
          >
            <FolderInput size={14} />
            {i.name}
          </button>
          {tree(i.id, depth + 1, new Set([...seen, i.id]))}
        </div>
      ));
  }
  const pick = data.items.filter((i) => selected.includes(i.id)),
    modalItem = dialog?.item;
  const invalidDest = new Set(
    pick
      .filter((i) => i.type === "folder")
      .flatMap((i) => descendants(data.items, i.id).map((x) => x.id)),
  );
  const link = modalItem
    ? (() => {
        const url = new URL(location.href);
        url.searchParams.set("biblioteca", modalItem.id);
        url.hash = "biblioteca";
        return url.toString();
      })()
    : "";
  const title = dialog
    ? {
        new: "Nova pasta",
        rename: "Renomear",
        move: "Mover selecção",
        copy: "Fazer uma cópia",
        description: "Descrição",
        tags: "Etiquetas do item",
        "tag-manager": "Gerir etiquetas",
        share: "Ligação interna",
      }[dialog.kind]
    : "";
  const itemActions = (item: LibraryItem) =>
    [
      {
        label: item.type === "folder" ? "Abrir pasta" : "Pré-visualizar",
        Icon: FolderInput,
        show: !item.deletedAt,
        action: () => void open(item),
      },
      {
        label: "Informações",
        Icon: Info,
        show: true,
        action: () => setDetails(item),
      },
      {
        label: "Descarregar",
        Icon: Download,
        show: !item.deletedAt,
        action: () => void exportItems([item]),
      },
      {
        label: "Renomear",
        Icon: Tag,
        show: !item.deletedAt,
        action: () => openDialog("rename", item),
      },
      {
        label: "Mover",
        Icon: FolderInput,
        show: !item.deletedAt,
        action: () => {
          setSelected([item.id]);
          openDialog("move");
        },
      },
      {
        label: "Duplicar",
        Icon: Copy,
        show: !item.deletedAt,
        action: () => openDialog("copy", item),
      },
      {
        label: "Descrição",
        Icon: Info,
        show: !item.deletedAt,
        action: () => openDialog("description", item),
      },
      {
        label: "Etiquetas",
        Icon: Tag,
        show: !item.deletedAt,
        action: () => openDialog("tags", item),
      },
      {
        label: "Copiar ligação interna",
        Icon: Link2,
        show: !item.deletedAt && item.type === "file",
        action: () => openDialog("share", item),
      },
      {
        label: item.deletedAt ? "Restaurar" : "Mover para a lixeira",
        Icon: item.deletedAt ? RotateCcw : Trash2,
        show: true,
        action: () => void mutate(item.deletedAt ? "restore" : "trash", [item]),
      },
      {
        label: "Eliminar definitivamente",
        Icon: Trash2,
        show: Boolean(item.deletedAt) && data.canPurge,
        action: () => void mutate("purge", [item]),
      },
    ].filter((a) => a.show);
  function tags(item: LibraryItem) {
    return item.tags
      .map((id) => data.tags.find((t) => t.id === id))
      .filter(Boolean)
      .map((t) => (
        <span key={t!.id} className="hd-tag" style={{ background: t!.color }}>
          {t!.name}
        </span>
      ));
  }
  function itemButtons(item: LibraryItem) {
    return (
      <div className="hd-actions">
        {!item.deletedAt && (
          <button
            type="button"
            className="hd-icon-button hd-favorite"
            aria-label={
              (item.favorite
                ? "Retirar dos favoritos "
                : "Adicionar aos favoritos ") + item.name
            }
            disabled={busy}
            onClick={() => void mutate("favorite", [item])}
          >
            <Star size={16} fill={item.favorite ? "currentColor" : "none"} />
          </button>
        )}
        <button
          type="button"
          className="hd-icon-button"
          aria-label={"Acções de " + item.name}
          disabled={busy}
          onClick={(e) => {
            e.stopPropagation();
            const box = e.currentTarget.getBoundingClientRect();
            context(item, box.right - 220, box.bottom);
          }}
        >
          <MoreVertical size={17} />
        </button>
      </div>
    );
  }
  function renderItems(rows: LibraryItem[]) {
    if (!rows.length)
      return (
        <div className="hd-panel hd-empty">
          {loading ? "A carregar…" : "Nenhum item nesta vista."}
        </div>
      );
    if (mode === "grid")
      return (
        <div className="hd-grid">
          {rows.map((item) => (
            <article
              key={item.id}
              className="hd-file-card"
              data-selected={selected.includes(item.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                context(item, e.clientX, e.clientY);
              }}
            >
              <div
                className="hd-card-icon"
                onDoubleClick={() => void open(item)}
              >
                <input
                  type="checkbox"
                  aria-label={"Seleccionar " + item.name}
                  checked={selected.includes(item.id)}
                  onChange={() => select(item, true)}
                />
                <FileIcon item={item} size={48} />
              </div>
              <div className="hd-card-body">
                <button
                  type="button"
                  className="hd-name-button"
                  disabled={busy || Boolean(item.deletedAt)}
                  onClick={() => void open(item)}
                >
                  {item.name}
                </button>
                <div>{tags(item)}</div>
                <footer>
                  <span className="hd-subtle">
                    {item.type === "folder" ? "Pasta" : bytes(item.size)}
                  </span>
                  {itemButtons(item)}
                </footer>
              </div>
            </article>
          ))}
        </div>
      );
    return (
      <div className="hd-panel hd-table-wrap">
        <table className="hd-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  aria-label="Seleccionar página"
                  checked={rows.every((i) => selected.includes(i.id))}
                  onChange={(e) =>
                    setSelected(e.target.checked ? rows.map((i) => i.id) : [])
                  }
                />
              </th>
              {["Nome", "Guardado por", "Modificado", "Tamanho", "Acções"].map(
                (label) => (
                  <th key={label}>{label}</th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr
                key={item.id}
                data-selected={selected.includes(item.id)}
                onDoubleClick={() => void open(item)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  context(item, e.clientX, e.clientY);
                }}
              >
                <td>
                  <input
                    type="checkbox"
                    aria-label={"Seleccionar " + item.name}
                    checked={selected.includes(item.id)}
                    onChange={(e) =>
                      select(item, true, (e.nativeEvent as MouseEvent).shiftKey)
                    }
                  />
                </td>
                <td>
                  <div className="hd-file-name">
                    <FileIcon item={item} />
                    <div>
                      <button
                        type="button"
                        className="hd-name-button"
                        disabled={busy || Boolean(item.deletedAt)}
                        onClick={() => void open(item)}
                      >
                        {item.name}
                      </button>
                      <div>{tags(item)}</div>
                    </div>
                  </div>
                </td>
                <td>{item.createdBy}</td>
                <td>{date(item.modifiedAt)}</td>
                <td>{item.type === "folder" ? "—" : bytes(item.size)}</td>
                <td>{itemButtons(item)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <section className={embedded ? "" : "hd-workspace"}>
      {!embedded && (
        <header className="hd-heading">
          <div>
            <h1>Biblioteca institucional</h1>
            <p>
              Documentos internos, organização por pastas e gravação no
              servidor.
            </p>
          </div>
        </header>
      )}
      <div className="hd-library-layout">
        <aside className="hd-sidebar">
          <div className="hd-sidebar-title">Biblioteca</div>
          <div className="hd-sidebar-actions">
            <button
              type="button"
              className="hd-sidebar-new"
              disabled={busy || !loaded}
              onClick={() => openDialog("new")}
            >
              <Plus size={18} /> Nova pasta
            </button>
          </div>
          <div className="hd-sidebar-actions hd-actions">
            <button
              type="button"
              className="hd-button"
              disabled={busy || !loaded}
              onClick={() => picker.current?.click()}
            >
              <Upload size={14} /> Ficheiros
            </button>
            <button
              type="button"
              className="hd-button"
              disabled={busy || !loaded}
              onClick={() => folderPicker.current?.click()}
            >
              <FolderPlus size={14} /> Pasta
            </button>
          </div>
          <input
            ref={picker}
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.txt,.csv,.docx,.xlsx"
            hidden
            onChange={(e) => {
              const files = [...(e.target.files || [])];
              e.target.value = "";
              void upload(files);
            }}
          />
          <input
            ref={folderPicker}
            type="file"
            multiple
            {...({ webkitdirectory: "", directory: "" } as any)}
            hidden
            onChange={(e) => {
              const files = [...(e.target.files || [])];
              e.target.value = "";
              void upload(files, true);
            }}
          />
          <nav aria-label="Secções da biblioteca">
            {VIEWS.map(({ id, label, Icon }) => (
              <button
                type="button"
                key={id}
                className="hd-nav-button"
                aria-current={
                  view === id && !(id === "minha" && folder)
                    ? "page"
                    : undefined
                }
                onClick={() => navigate(null, id)}
              >
                <Icon size={15} />
                <span>{label}</span>
                {["favoritos", "lixo"].includes(id) && (
                  <small>
                    {
                      data.items.filter((i) =>
                        id === "lixo"
                          ? i.deletedAt
                          : i.favorite && !i.deletedAt,
                      ).length
                    }
                  </small>
                )}
              </button>
            ))}
          </nav>
          <div className="hd-tree" aria-label="Pastas">
            {tree(null)}
          </div>
          <div className="hd-storage">
            {loaded ? (
              <>
                <strong>
                  {live.filter((i) => i.type === "file").length} ficheiros ·{" "}
                  {folders.length} pastas
                </strong>
                <progress max={data.quota.limit} value={data.quota.used} />
                <div>
                  {bytes(data.quota.used)} de {bytes(data.quota.limit)}
                </div>
                <div>Máximo {bytes(data.quota.maxFile)} por ficheiro.</div>
              </>
            ) : (
              "A carregar armazenamento…"
            )}
          </div>
        </aside>
        <div
          className="hd-section-main"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (!busy) void upload([...e.dataTransfer.files]);
          }}
        >
          <div className="hd-toolbar">
            <h2 style={{ fontSize: 18, fontWeight: 650 }}>
              {folder && view === "minha"
                ? breadcrumb.at(-1)?.name
                : VIEWS.find((v) => v.id === view)?.label}
            </h2>
            <div className="hd-actions">
              <button
                type="button"
                className="hd-button"
                disabled={loading || busy}
                onClick={() => void reload().catch(() => {})}
              >
                <RefreshCw size={14} /> Actualizar
              </button>
              <div className="hd-view-switch" aria-label="Modo de visualização">
                {(
                  [
                    ["list", List, "Lista"],
                    ["grid", Grid2X2, "Grelha"],
                    ["columns", Columns3, "Colunas"],
                  ] as const
                ).map(([id, Icon, label]) => (
                  <button
                    type="button"
                    key={id}
                    aria-label={label}
                    aria-pressed={mode === id}
                    onClick={() => setMode(id)}
                  >
                    <Icon size={16} />
                  </button>
                ))}
              </div>
            </div>
          </div>
          {(error || notice.text) && (
            <p
              role={error || notice.error ? "alert" : "status"}
              className="hd-notice"
              data-error={Boolean(error || notice.error)}
            >
              {error || notice.text}
            </p>
          )}
          {progress && (
            <div className="hd-progress" role="status">
              {progress.done} / {progress.total} · {progress.name}
              <progress max={progress.total} value={progress.done} />A aguardar
              confirmação do servidor.
            </div>
          )}
          {view === "atividade" ? (
            <div className="hd-panel">
              <div className="hd-panel-head">
                <h2>Últimas 100 operações da instituição</h2>
              </div>
              {data.activity.map((a) => (
                <article className="hd-activity" key={a.id}>
                  <div>
                    <strong>
                      {ACTIONS[a.action.replace("library.", "")] || a.action}
                    </strong>
                    {a.name} · {a.actor}
                  </div>
                  <time>{date(a.created_at)}</time>
                </article>
              ))}
              {!data.activity.length && (
                <p className="hd-empty">Sem operações registadas.</p>
              )}
            </div>
          ) : (
            <>
              <div className="hd-toolbar">
                <label className="hd-search">
                  <Search size={16} />
                  <input
                    ref={searchInput}
                    className="hd-input"
                    aria-label="Pesquisar biblioteca"
                    placeholder="Pesquisar nome, descrição ou autor…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="hd-button"
                  aria-expanded={advanced}
                  onClick={() => setAdvanced((v) => !v)}
                >
                  Filtros
                </button>
                <select
                  aria-label="Ordenar biblioteca"
                  style={{ width: "auto" }}
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="name">Nome</option>
                  <option value="modifiedAt">Modificado</option>
                  <option value="size">Tamanho</option>
                  <option value="type">Tipo</option>
                </select>
                <button
                  type="button"
                  className="hd-button"
                  aria-label="Inverter ordenação"
                  onClick={() => setDescending((v) => !v)}
                >
                  {descending ? "↓" : "↑"}
                </button>
              </div>
              {advanced && (
                <div
                  className="hd-panel"
                  style={{ padding: 12, marginBottom: 12 }}
                >
                  <div className="hd-actions">
                    <label>
                      Desde
                      <input
                        className="hd-input"
                        aria-label="Data inicial"
                        type="date"
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                      />
                    </label>
                    <label>
                      Até
                      <input
                        className="hd-input"
                        aria-label="Data final"
                        type="date"
                        value={until}
                        onChange={(e) => setUntil(e.target.value)}
                      />
                    </label>
                    <label>
                      Mínimo MB
                      <input
                        className="hd-input"
                        type="number"
                        min="0"
                        max="10"
                        value={minSize}
                        onChange={(e) => setMinSize(e.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      className="hd-button"
                      onClick={() => {
                        setFrom("");
                        setUntil("");
                        setMinSize("");
                      }}
                    >
                      Limpar
                    </button>
                  </div>
                </div>
              )}
              {view === "minha" && (
                <nav className="hd-breadcrumb" aria-label="Caminho da pasta">
                  <button type="button" onClick={() => navigate(null)}>
                    Biblioteca da empresa
                  </button>
                  {breadcrumb.map((item) => (
                    <span key={item.id}>
                      {" "}
                      ›{" "}
                      <button type="button" onClick={() => navigate(item.id)}>
                        {item.name}
                      </button>
                    </span>
                  ))}
                </nav>
              )}
              {view === "tags" && (
                <div className="hd-actions" style={{ marginBottom: 12 }}>
                  {data.tags.map((tag) => (
                    <button
                      type="button"
                      className="hd-button"
                      key={tag.id}
                      aria-pressed={tagFilter === tag.id}
                      onClick={() =>
                        setTagFilter((old) => (old === tag.id ? "" : tag.id))
                      }
                    >
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: tag.color,
                        }}
                      />
                      {tag.name}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="hd-button"
                    onClick={() => openDialog("tag-manager")}
                  >
                    Gerir etiquetas
                  </button>
                </div>
              )}
              <div className="hd-filters">
                {FILTERS.map(([id, label]) => (
                  <button
                    type="button"
                    key={id}
                    aria-pressed={filter === id}
                    onClick={() => setFilter(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {selected.length > 0 && (
                <div className="hd-selection">
                  <strong>{selected.length} seleccionado(s)</strong>
                  {view === "lixo" ? (
                    <>
                      <button
                        type="button"
                        className="hd-button"
                        disabled={busy}
                        onClick={() => void mutate("restore", pick)}
                      >
                        <RotateCcw size={14} />
                        Restaurar
                      </button>
                      {data.canPurge && (
                        <button
                          type="button"
                          className="hd-button hd-danger"
                          disabled={busy}
                          onClick={() => void mutate("purge", pick)}
                        >
                          Eliminar definitivamente
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="hd-button"
                        disabled={busy}
                        onClick={() => openDialog("move")}
                      >
                        <FolderInput size={14} />
                        Mover
                      </button>
                      <button
                        type="button"
                        className="hd-button"
                        disabled={busy}
                        onClick={() => void exportItems(pick)}
                      >
                        <Download size={14} />
                        Exportar ZIP
                      </button>
                      <button
                        type="button"
                        className="hd-button hd-danger"
                        disabled={busy}
                        onClick={() => void mutate("trash", pick)}
                      >
                        <Trash2 size={14} />
                        Lixeira
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="hd-icon-button"
                    aria-label="Limpar selecção"
                    onClick={() => setSelected([])}
                  >
                    <X size={15} />
                  </button>
                </div>
              )}
              {loading && (
                <p className="hd-subtle" role="status">
                  A actualizar…
                </p>
              )}
              {mode === "columns" &&
              view === "minha" &&
              !query &&
              filter === "all" &&
              !from &&
              !until &&
              !minSize ? (
                <div className="hd-columns">
                  {[null, ...breadcrumb.map((i) => i.id)].map((parent) => (
                    <section key={parent || "root"} className="hd-column">
                      <h3>
                        {data.items.find((i) => i.id === parent)?.name ||
                          "Biblioteca da empresa"}
                      </h3>
                      {live
                        .filter((i) => i.parentId === parent)
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((item) => (
                          <button
                            type="button"
                            key={item.id}
                            aria-current={item.id === folder}
                            disabled={busy}
                            onClick={() =>
                              item.type === "folder"
                                ? navigate(item.id)
                                : void open(item)
                            }
                            onContextMenu={(e) => {
                              e.preventDefault();
                              context(item, e.clientX, e.clientY);
                            }}
                          >
                            <FileIcon item={item} size={18} />
                            {item.name}
                            {item.type === "folder" && <small>›</small>}
                          </button>
                        ))}
                    </section>
                  ))}
                </div>
              ) : (
                renderItems(shown)
              )}
              <footer className="hd-pagination">
                <span>{visible.length} item(ns)</span>
                <button
                  type="button"
                  className="hd-button"
                  disabled={currentPage === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Anterior
                </button>
                <span>
                  {currentPage + 1} / {pages}
                </span>
                <button
                  type="button"
                  className="hd-button"
                  disabled={currentPage + 1 >= pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Seguinte
                </button>
              </footer>
            </>
          )}
        </div>
      </div>
      {menu && (
        <div
          className="hd-context"
          role="menu"
          style={{ left: menu.x, top: menu.y }}
        >
          {itemActions(menu.item).map(({ label, Icon, action }) => (
            <button
              type="button"
              role="menuitem"
              key={label}
              disabled={busy}
              onClick={() => {
                setMenu(null);
                action();
              }}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
      )}
      {dialog && (
        <Modal title={title} busy={busy} onClose={() => setDialog(null)}>
          {notice.error && (
            <p className="hd-notice" data-error="true" role="alert">
              {notice.text}
            </p>
          )}
          {["new", "rename", "copy"].includes(dialog.kind) && (
            <>
              <label className="hd-label" htmlFor="lib-name">
                Nome
              </label>
              <input
                id="lib-name"
                className="hd-input"
                value={draft}
                maxLength={dialog.kind === "new" ? 120 : 200}
                onChange={(e) => setDraft(e.target.value)}
              />
            </>
          )}
          {["new", "move", "copy"].includes(dialog.kind) && (
            <>
              <label className="hd-label" htmlFor="lib-dest">
                Pasta de destino
              </label>
              <select
                id="lib-dest"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              >
                <option value="">Biblioteca da empresa</option>
                {folders
                  .filter(
                    (i) =>
                      !invalidDest.has(i.id) &&
                      !(
                        modalItem?.type === "folder" &&
                        descendants(data.items, modalItem.id).some(
                          (x) => x.id === i.id,
                        )
                      ),
                  )
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
              </select>
            </>
          )}
          {dialog.kind === "description" && (
            <textarea
              aria-label="Descrição"
              className="hd-input"
              rows={5}
              maxLength={2000}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          )}
          {dialog.kind === "tags" && (
            <div>
              {data.tags.map((tag) => (
                <label
                  key={tag.id}
                  className="hd-actions"
                  style={{ padding: 9 }}
                >
                  <input
                    type="checkbox"
                    checked={draftTags.includes(tag.id)}
                    onChange={(e) =>
                      setDraftTags((old) =>
                        e.target.checked
                          ? [...old, tag.id]
                          : old.filter((id) => id !== tag.id),
                      )
                    }
                  />
                  <span style={{ color: tag.color }}>●</span>
                  {tag.name}
                </label>
              ))}
            </div>
          )}
          {dialog.kind === "share" && (
            <>
              <p className="hd-subtle">
                Esta ligação exige autenticação e acesso à mesma instituição.
              </p>
              <input
                aria-label="Ligação interna"
                className="hd-input"
                readOnly
                value={link}
                onFocus={(e) => e.currentTarget.select()}
              />
              <button
                type="button"
                className="hd-button"
                style={{ marginTop: 12 }}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(link);
                    setNotice({
                      text: "Ligação interna copiada.",
                      error: false,
                    });
                    setDialog(null);
                  } catch {
                    setNotice({
                      text: "Seleccione e copie a ligação apresentada.",
                      error: true,
                    });
                  }
                }}
              >
                Copiar ligação
              </button>
            </>
          )}
          {dialog.kind === "tag-manager" && (
            <>
              {data.tags.map((tag) => (
                <div key={tag.id} className="hd-activity">
                  <span style={{ color: tag.color }}>● {tag.name}</span>
                  <button
                    type="button"
                    className="hd-button hd-danger"
                    disabled={busy}
                    onClick={() => {
                      if (
                        confirm(
                          "Remover a etiqueta de todos os documentos da instituição?",
                        )
                      )
                        void run(
                          () =>
                            hospitalApi("DELETE", "/library/tags/" + tag.id),
                          "Etiqueta removida.",
                        );
                    }}
                  >
                    Remover
                  </button>
                </div>
              ))}
              <label className="hd-label">
                Nova etiqueta
                <input
                  className="hd-input"
                  value={newTag}
                  maxLength={40}
                  onChange={(e) => setNewTag(e.target.value)}
                />
              </label>
              <div className="hd-actions">
                <input
                  aria-label="Cor da etiqueta"
                  type="color"
                  value={tagColor}
                  onChange={(e) => setTagColor(e.target.value)}
                />
                <button
                  type="button"
                  className="hd-button hd-primary"
                  disabled={busy || !newTag.trim()}
                  onClick={() =>
                    void run(async () => {
                      await hospitalApi("POST", "/library/tags", {
                        name: newTag.trim(),
                        color: tagColor,
                      });
                      setNewTag("");
                    }, "Etiqueta criada.")
                  }
                >
                  Criar etiqueta
                </button>
              </div>
            </>
          )}
          {!["share", "tag-manager"].includes(dialog.kind) && (
            <div className="hd-actions">
              <button
                type="button"
                className="hd-button"
                disabled={busy}
                onClick={() => setDialog(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="hd-button hd-primary"
                disabled={
                  busy ||
                  (["new", "rename", "copy"].includes(dialog.kind) &&
                    !draft.trim())
                }
                onClick={async () => {
                  let ok = false;
                  if (dialog.kind === "new")
                    ok = await run(
                      () =>
                        hospitalApi("POST", "/library/folders", {
                          name: draft.trim(),
                          parentId: destination || null,
                        }),
                      "Pasta criada.",
                    );
                  else if (dialog.kind === "move")
                    ok = await mutate("move", pick, {
                      folderId: destination || null,
                    });
                  else if (modalItem)
                    ok = await mutate(
                      dialog.kind === "description"
                        ? "describe"
                        : dialog.kind === "tags"
                          ? "tag"
                          : dialog.kind,
                      [modalItem],
                      {
                        name: draft.trim(),
                        description: draft,
                        tags: draftTags,
                        folderId: destination || null,
                      },
                    );
                  if (ok) setDialog(null);
                }}
              >
                {busy ? "A guardar…" : "Guardar"}
              </button>
            </div>
          )}
        </Modal>
      )}
      {details && (
        <Modal
          title={"Informações — " + details.name}
          onClose={() => setDetails(null)}
        >
          <dl className="hd-details">
            <dt>Nome</dt>
            <dd>{details.name}</dd>
            <dt>Tipo</dt>
            <dd>{details.type === "folder" ? "Pasta" : details.mime}</dd>
            <dt>Tamanho</dt>
            <dd>
              {bytes(
                details.type === "folder"
                  ? descendants(data.items, details.id).reduce(
                      (n, i) => n + i.size,
                      0,
                    )
                  : details.size,
              )}
            </dd>
            <dt>Guardado por</dt>
            <dd>{details.createdBy}</dd>
            <dt>Criado</dt>
            <dd>{date(details.createdAt)}</dd>
            <dt>Modificado</dt>
            <dd>{date(details.modifiedAt)}</dd>
            <dt>Revisão do registo</dt>
            <dd>{details.revision}</dd>
            <dt>Descrição</dt>
            <dd>{details.description || "Sem descrição."}</dd>
            <dt>Etiquetas</dt>
            <dd>{tags(details)}</dd>
          </dl>
        </Modal>
      )}
      {preview && (
        <Modal title={preview.item.name} wide onClose={() => setPreview(null)}>
          {preview.item.mime.startsWith("image/") ? (
            <img
              className="hd-preview"
              src={preview.url}
              alt={preview.item.name}
            />
          ) : preview.item.mime === "application/pdf" ? (
            <iframe
              className="hd-preview hd-preview-pdf"
              title={"Pré-visualização de " + preview.item.name}
              sandbox="allow-same-origin"
              src={preview.url}
            />
          ) : preview.text !== undefined ? (
            <>
              <pre className="hd-text-preview">{preview.text}</pre>
              {preview.item.size > 60000 && (
                <p className="hd-subtle">
                  Pré-visualização limitada. Descarregue para consultar o
                  conteúdo integral.
                </p>
              )}
            </>
          ) : (
            <p>
              A pré-visualização deste formato é feita no programa local após o
              download.
            </p>
          )}
          <div className="hd-actions">
            <a
              className="hd-button hd-primary"
              href={preview.url}
              download={preview.item.name}
            >
              <Download size={15} />
              Descarregar original
            </a>
          </div>
        </Modal>
      )}
    </section>
  );
}
