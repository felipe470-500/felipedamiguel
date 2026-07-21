import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ImagePlus, Plus, Save, Trash2, LogOut, X, Star, Download, Search, Share2, Camera } from "lucide-react";
import {
  ADMIN_PASSWORD,
  ADMIN_SESSION_KEY,
  ADMIN_SELLER_ID_KEY,
  ADMIN_SELLER_NAME_KEY,
  fileToCompressedDataURL,
  type Vehicle,
  isVideoUrl,
} from "@/lib/vehicles-store";
import { SELLERS } from "@/lib/sellers";
import {
  listVehiclesFn,
  saveVehiclesFn,
  uploadVehicleImageFn,
  createVehicleUploadUrlFn,
} from "@/lib/vehicles.functions";
import { supabase } from "@/integrations/supabase/client";

import {
  getSiteSettingsFn,
  setLeadGateFn,
  listLeadsFn,
  listSellerProfilesFn,
  saveSellerProfileFn,
} from "@/lib/settings.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin | Miguel Veículos" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [pwd, setPwd] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [error, setError] = useState("");
  const [sellerName, setSellerName] = useState("");
  const [loggedSellerId, setLoggedSellerId] = useState("");
 
  useEffect(() => {
    if (typeof window === "undefined") return;
    setAuthed(sessionStorage.getItem(ADMIN_SESSION_KEY) === "1");
    setSellerName(sessionStorage.getItem(ADMIN_SELLER_NAME_KEY) || "");
    setLoggedSellerId(sessionStorage.getItem(ADMIN_SELLER_ID_KEY) || "");
  }, []);
 
  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!sellerId) {
      setError("Selecione um vendedor");
      return;
    }
    if (pwd === ADMIN_PASSWORD) {
      const seller = SELLERS.find((s) => s.id === sellerId);
      if (seller) {
        sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
        sessionStorage.setItem(ADMIN_SELLER_ID_KEY, seller.id);
        sessionStorage.setItem(ADMIN_SELLER_NAME_KEY, seller.name);
        setSellerName(seller.name);
        setLoggedSellerId(seller.id);
        setAuthed(true);
        setError("");
      }
    } else {
      setError("Senha incorreta");
    }
  }
 
  function logout() {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    sessionStorage.removeItem(ADMIN_SELLER_ID_KEY);
    sessionStorage.removeItem(ADMIN_SELLER_NAME_KEY);
    setAuthed(false);
    setPwd("");
    setSellerId("");
    setLoggedSellerId("");
    setSellerName("");
  }

  if (!authed) {    return (
      <main className="grid min-h-screen place-items-center bg-background px-4 text-foreground">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
        >
          <h1 className="text-xl font-bold">Área administrativa</h1>
          <p className="mt-1 text-sm text-muted-foreground">Selecione seu nome e digite a senha.</p>
          
          <select
            value={sellerId}
            onChange={(e) => setSellerId(e.target.value)}
            className="mt-4 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-ring text-foreground"
            required
          >
            <option value="">Selecione seu nome...</option>
            {SELLERS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <input
            type="password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            placeholder="Senha"
            className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-ring"
            autoFocus
          />
          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
          <button
            type="submit"
            className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Entrar
          </button>
          <Link to="/" className="mt-3 block text-center text-xs text-muted-foreground hover:text-foreground">
            ← Voltar ao site
          </Link>
        </form>
      </main>
    );
  }
 
  return <Editor onLogout={logout} sellerName={sellerName} sellerId={loggedSellerId} />;}

function Editor({
  onLogout,
  sellerName,
  sellerId,
}: {
  onLogout: () => void;
  sellerName: string;
  sellerId: string;
}) {
  const [items, setItems] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [search, setSearch] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
 
  const listVehicles = useServerFn(listVehiclesFn);
  const saveVehicles = useServerFn(saveVehiclesFn);
  const uploadImage = useServerFn(uploadVehicleImageFn);
  const createUploadUrl = useServerFn(createVehicleUploadUrlFn);
  const listSellerProfiles = useServerFn(listSellerProfilesFn);
  const saveSellerProfile = useServerFn(saveSellerProfileFn);

  // Faz upload de um arquivo: vídeos vão direto ao storage (via signed URL) para
  // evitar o limite de memória do worker; imagens continuam via base64 comprimido.
  async function uploadFile(file: File): Promise<string> {
    if (file.type.startsWith("video/")) {
      const { path, token, publicUrl } = await createUploadUrl({
        data: { password: ADMIN_PASSWORD, contentType: file.type },
      });
      const { error } = await supabase.storage
        .from("vehicle-images")
        .uploadToSignedUrl(path, token, file, { contentType: file.type });
      if (error) throw new Error(error.message);
      return publicUrl;
    }
    const dataUrl = await fileToCompressedDataURL(file);
    const res = await uploadImage({ data: { password: ADMIN_PASSWORD, dataUrl } });
    return res.url;
  }

 
  useEffect(() => {
    listVehicles()
      .then((rows) =>
        setItems(
          rows.map((r) => ({
            id: r.id,
            name: r.name,
            year: r.year,
            km: r.km,
            price: r.price,
            tag: r.tag ?? undefined,
            images: r.images ?? [],
            plate: r.plate ?? undefined,
            description: r.description ?? undefined,
          })),
        ),
      )
      .catch((err) => setErrorMsg(String(err?.message ?? err)))
      .finally(() => setLoading(false));
  }, [listVehicles]);
 
  useEffect(() => {
    if (!sellerId) return;
    listSellerProfiles()
      .then((rows) => {
        const profile = rows.find((r) => r.seller_id === sellerId);
        if (profile) {
          setAvatarUrl(profile.avatar_url);
        }
      })
      .catch((err) => console.error("Erro ao carregar avatar", err));
  }, [sellerId, listSellerProfiles]);
 
  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    setErrorMsg("");
    try {
      const compressedDataUrl = await fileToCompressedDataURL(file);
      const uploadRes = await uploadImage({
        data: {
          password: ADMIN_PASSWORD,
          dataUrl: compressedDataUrl,
        },
      });
      await saveSellerProfile({
        data: {
          password: ADMIN_PASSWORD,
          sellerId,
          avatarUrl: uploadRes.url,
        },
      });
      setAvatarUrl(uploadRes.url);
    } catch (err) {
      setErrorMsg(`Não foi possível salvar foto de perfil: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploadingAvatar(false);
    }
  }

  function update(id: string, patch: Partial<Vehicle>) {
    setItems((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  }
  function remove(id: string) {
    setItems((prev) => prev.filter((v) => v.id !== id));
  }
  function add() {
    const novo: Vehicle = {
      id: `tmp-${Date.now()}`,
      name: "Novo veículo",
      year: "2024",
      km: "0 km",
      price: "R$ 0",
      images: [],
      tag: "",
    };
    setItems((prev) => [novo, ...prev]);
  }
  async function persist() {
    setSaving(true);
    setErrorMsg("");
    try {
      await saveVehicles({
        data: {
          password: ADMIN_PASSWORD,
          vehicles: items.map((v) => ({
            name: v.name,
            year: v.year,
            km: v.km,
            price: v.price,
            tag: v.tag ?? null,
            images: v.images,
            plate: v.plate ?? null,
            description: v.description ?? null,
          })),
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setErrorMsg(`Não foi possível salvar: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");

  async function importFromLocalStorage() {
    setImporting(true);
    setImportMsg("");
    setErrorMsg("");
    try {
      const raw =
        localStorage.getItem("fdm_vehicles_v2") ?? localStorage.getItem("fdm_vehicles_v1");
      if (!raw) {
        setImportMsg("Nenhum veículo antigo encontrado neste navegador.");
        return;
      }
      const parsed = JSON.parse(raw) as Array<{
        id?: string;
        name?: string;
        year?: string;
        km?: string;
        price?: string;
        tag?: string;
        image?: string;
        images?: string[];
      }>;
      if (!Array.isArray(parsed) || parsed.length === 0) {
        setImportMsg("Nenhum veículo antigo encontrado.");
        return;
      }

      const imported: Vehicle[] = [];
      for (let i = 0; i < parsed.length; i++) {
        const v = parsed[i];
        setImportMsg(`Importando ${i + 1}/${parsed.length}: ${v.name ?? "veículo"}…`);
        const rawImgs =
          Array.isArray(v.images) && v.images.length > 0
            ? v.images
            : v.image
              ? [v.image]
              : [];
        const urls: string[] = [];
        for (const src of rawImgs) {
          if (typeof src !== "string") continue;
          // Apenas base64 do localStorage precisa subir; URLs http já são públicas
          if (src.startsWith("data:image/")) {
            try {
              const r = await uploadImage({
                data: { password: ADMIN_PASSWORD, dataUrl: src },
              });
              urls.push(r.url);
            } catch (err) {
              console.error("[import] upload failed", err);
            }
          } else if (src.startsWith("http")) {
            urls.push(src);
          }
        }
        imported.push({
          id: `tmp-import-${Date.now()}-${i}`,
          name: v.name ?? "Sem nome",
          year: v.year ?? "",
          km: v.km ?? "",
          price: v.price ?? "",
          tag: v.tag ?? undefined,
          images: urls,
        });
      }

      // Mescla com o que já está na tela (adiciona ao final)
      setItems((prev) => [...prev, ...imported]);
      setImportMsg(
        `✓ ${imported.length} veículo(s) importado(s). Confira a lista e clique em Salvar para publicar.`,
      );
    } catch (e) {
      setErrorMsg(`Falha ao importar: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setImporting(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Ver site
          </Link>
          <div className="flex items-center gap-3">
            {sellerName && (
              <div className="flex items-center gap-2">
                <div className="relative group">
                  <div className="h-8 w-8 rounded-full overflow-hidden border border-border bg-muted flex items-center justify-center">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={sellerName} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs font-semibold text-muted-foreground">
                        {sellerName.substring(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-100 disabled:bg-black/30"
                    title="Mudar foto de perfil"
                  >
                    <Camera className="h-3.5 w-3.5 text-white" />
                  </button>
                  <input
                    type="file"
                    ref={avatarInputRef}
                    onChange={handleAvatarChange}
                    accept="image/*"
                    className="hidden"
                  />
                </div>
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  Olá, <strong className="text-foreground">{sellerName}</strong>
                </span>
              </div>
            )}
            <button
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-card"
            >
              <LogOut className="h-3.5 w-3.5" /> Sair
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Editar catálogo</h1>
            <p className="text-sm text-muted-foreground">
              Os veículos e as fotos ficam salvos no servidor e aparecem para todos os visitantes.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={importFromLocalStorage}
              disabled={importing}
              title="Resgata os veículos que estavam salvos no seu navegador antigo"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-card/80 disabled:opacity-60"
            >
              <Download className="h-4 w-4" /> {importing ? "Importando…" : "Importar do navegador"}
            </button>
            <button
              onClick={add}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-card/80"
            >
              <Plus className="h-4 w-4" /> Adicionar
            </button>
            <button
              onClick={persist}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              <Save className="h-4 w-4" /> {saving ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </div>
        {saved && (
          <p className="mt-3 rounded-lg border border-whatsapp/40 bg-whatsapp/10 px-3 py-2 text-sm text-foreground">
            ✓ Alterações salvas e publicadas no catálogo.
          </p>
        )}
        {errorMsg && (
          <p className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errorMsg}
          </p>
        )}
        {importMsg && (
          <p className="mt-3 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
            {importMsg}
          </p>
        )}

        <GatePanel />

        <div className="mt-6 rounded-2xl border border-border bg-card p-3">
          <label className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar veículo por nome, tag ou ano…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground"
                aria-label="Limpar busca"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </label>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Encontre rapidamente e use o botão “Compartilhar no WhatsApp” em cada veículo para enviar ao cliente.
          </p>
        </div>

        {loading ? (
          <p className="mt-6 text-sm text-muted-foreground">Carregando veículos…</p>
        ) : (
          (() => {
            const q = search.trim().toLowerCase();
            const filtered = q
              ? items.filter((v) =>
                  [v.name, v.tag ?? "", v.year, v.km, v.price]
                    .join(" ")
                    .toLowerCase()
                    .includes(q),
                )
              : items;
            return (
              <div className="mt-4 space-y-4">
                {q && (
                  <p className="text-xs text-muted-foreground">
                    {filtered.length} de {items.length} veículo(s) para “{search}”.
                  </p>
                )}
                {filtered.map((v) => (
                  <VehicleRow
                    key={v.id}
                    vehicle={v}
                    onChange={(p) => update(v.id, p)}
                    onRemove={() => remove(v.id)}
                    uploadFile={uploadFile}
                  />
                ))}

                {items.length === 0 && (
                  <p className="rounded-2xl border border-dashed border-border bg-card/40 px-4 py-8 text-center text-sm text-muted-foreground">
                    Nenhum veículo. Clique em <strong>Adicionar</strong> para criar o primeiro.
                  </p>
                )}
                {items.length > 0 && filtered.length === 0 && (
                  <p className="rounded-2xl border border-dashed border-border bg-card/40 px-4 py-8 text-center text-sm text-muted-foreground">
                    Nenhum veículo corresponde à busca.
                  </p>
                )}
              </div>
            );
          })()
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={persist}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            <Save className="h-4 w-4" /> {saving ? "Salvando…" : "Salvar alterações"}
          </button>
        </div>
      </section>
    </main>
  );
}

function VehicleRow({
  vehicle,
  onChange,
  onRemove,
  uploadFile,
}: {
  vehicle: Vehicle;
  onChange: (patch: Partial<Vehicle>) => void;
  onRemove: () => void;
  uploadFile: (file: File) => Promise<string>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
 
  function handleDragEnter(targetIdx: number) {
    if (draggedIdx === null || draggedIdx === targetIdx) return;
    const copy = [...vehicle.images];
    const [draggedItem] = copy.splice(draggedIdx, 1);
    copy.splice(targetIdx, 0, draggedItem);
    onChange({ images: copy });
    setDraggedIdx(targetIdx);
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadError("");
    try {
      const urls: string[] = [];
      for (const f of Array.from(files)) {
        if (!f.type.startsWith("image/") && !f.type.startsWith("video/")) continue;
        const url = await uploadFile(f);
        urls.push(url);
      }
      onChange({ images: [...vehicle.images, ...urls] });
    } catch (e) {
      setUploadError(`Falha ao enviar arquivo: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function downloadOne(src: string, idx: number) {
    try {
      const ext = isVideoUrl(src) ? "mp4" : "jpg";
      const base = (vehicle.name || "midia").replace(/[^\w\-]+/g, "_").toLowerCase();
      const filename = `${base}-${String(idx + 1).padStart(2, "0")}.${ext}`;
      const res = await fetch(src, { mode: "cors" });
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objUrl);
    } catch {
      window.open(src, "_blank", "noopener,noreferrer");
    }
  }

  async function downloadAll() {
    for (let i = 0; i < vehicle.images.length; i++) {
      await downloadOne(vehicle.images[i], i);
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  function removeImage(idx: number) {
    onChange({ images: vehicle.images.filter((_, i) => i !== idx) });
  }
  function makePrimary(idx: number) {
    if (idx === 0) return;
    const next = [...vehicle.images];
    const [chosen] = next.splice(idx, 1);
    next.unshift(chosen);
    onChange({ images: next });
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-muted-foreground">
          {vehicle.name || "Sem nome"}{" "}
          {vehicle.plate && (
            <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-foreground">
              Placa: {vehicle.plate}
            </span>
          )}
          {" "}
          <span className="text-xs">({vehicle.images.length} foto{vehicle.images.length === 1 ? "" : "s"})</span>
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              const linhas = [
                `🚗 *${vehicle.name || "Veículo"}*`,
                vehicle.year && `Ano: ${vehicle.year}`,
                vehicle.km && `KM: ${vehicle.km}`,
                vehicle.price && `Preço: ${vehicle.price}`,
                vehicle.images[0] && vehicle.images[0].startsWith("http")
                  ? `Foto: ${vehicle.images[0]}`
                  : null,
                "",
                "— Miguel Veículos",
              ].filter(Boolean);
              const url = `https://wa.me/?text=${encodeURIComponent(linhas.join("\n"))}`;
              window.open(url, "_blank", "noopener,noreferrer");
            }}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-whatsapp/40 bg-whatsapp/10 px-3 py-1.5 text-xs font-semibold text-whatsapp hover:bg-whatsapp/20"
          >
            <Share2 className="h-3.5 w-3.5" /> Compartilhar no WhatsApp
          </button>
          <button
            onClick={downloadAll}
            disabled={vehicle.images.length === 0}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-3.5 w-3.5" /> Baixar mídias
          </button>
          <button
            onClick={onRemove}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5" /> Excluir veículo
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {vehicle.images.map((src, idx) => (
          <div
            key={idx}
            draggable
            onDragStart={() => setDraggedIdx(idx)}
            onDragEnter={() => handleDragEnter(idx)}
            onDragEnd={() => setDraggedIdx(null)}
            onDragOver={(e) => e.preventDefault()}
            className={`group relative h-24 w-32 overflow-hidden rounded-lg border border-border bg-secondary cursor-grab active:cursor-grabbing transition-opacity ${
              draggedIdx === idx ? "opacity-40 border-primary" : ""
            }`}
          >
            {isVideoUrl(src) ? (
              <video src={src} className="h-full w-full object-cover" />
            ) : (
              <img src={src} alt="" className="h-full w-full object-cover" />
            )}
            {idx === 0 && (
              <span className="absolute left-1 top-1 inline-flex items-center gap-1 rounded-full bg-primary/90 px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                <Star className="h-2.5 w-2.5" /> Principal
              </span>
            )}
            <button
              onClick={() => removeImage(idx)}
              type="button"
              className="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-destructive/90 text-white hover:bg-destructive transition-colors shadow-md"
              aria-label="Remover foto"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => downloadOne(src, idx)}
              type="button"
              className="absolute left-1 bottom-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-primary/90 text-primary-foreground hover:bg-primary transition-colors shadow-md"
              aria-label="Baixar mídia"
              title="Baixar"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
            {idx !== 0 && (
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-background/80 py-1 md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-opacity">
                <button
                  onClick={() => makePrimary(idx)}
                  type="button"
                  className="rounded px-1.5 py-0.5 text-[10px] text-foreground hover:bg-card w-full text-center"
                >
                  Tornar principal
                </button>
              </div>
            )}
          </div>
        ))}

        <label className="grid h-24 w-32 cursor-pointer place-items-center rounded-lg border border-dashed border-border bg-background text-xs text-muted-foreground hover:border-primary hover:text-foreground">
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <span className="flex flex-col items-center gap-1">
            <ImagePlus className="h-5 w-5" />
            {uploading ? "Enviando..." : "Adicionar mídia"}
          </span>
        </label>
      </div>
      {uploadError && <p className="mt-2 text-xs text-destructive">{uploadError}</p>}

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label="Nome" value={vehicle.name} onChange={(val) => onChange({ name: val })} />
        <Field label="Tag (opcional)" value={vehicle.tag ?? ""} onChange={(val) => onChange({ tag: val })} />
        <Field label="Ano" value={vehicle.year} onChange={(val) => onChange({ year: val })} />
        <Field label="KM" value={vehicle.km} onChange={(val) => onChange({ km: val })} />
        <Field label="Preço" value={vehicle.price} onChange={(val) => onChange({ price: val })} />
        <Field label="Placa (apenas no admin)" value={vehicle.plate ?? ""} onChange={(val) => onChange({ plate: val })} />
        <div className="sm:col-span-2">
          <label className="block text-xs">
            <span className="mb-1 block text-muted-foreground">Descrição / Observações (opcional)</span>
            <textarea
              value={vehicle.description ?? ""}
              onChange={(e) => onChange({ description: e.target.value })}
              rows={3}
              placeholder="Ex: Único dono, IPVA pago, revisões em dia, pneus novos..."
              className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm outline-none focus:ring-1 focus:ring-ring resize-y min-h-[80px]"
            />
          </label>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
      />
    </label>
  );
}

type LeadRow = {
  id: string;
  name: string;
  whatsapp: string;
  payment_type: string;
  payment_value: string | null;
  desired_car: string | null;
  created_at: string;
};

function GatePanel() {
  const getSettings = useServerFn(getSiteSettingsFn);
  const setGate = useServerFn(setLeadGateFn);
  const listLeads = useServerFn(listLeadsFn);

  const [enabled, setEnabled] = useState(false);
  const [loadingS, setLoadingS] = useState(true);
  const [savingS, setSavingS] = useState(false);
  const [msg, setMsg] = useState("");
  const [showLeads, setShowLeads] = useState(false);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);

  useEffect(() => {
    getSettings()
      .then((s) => setEnabled(s.lead_gate_enabled))
      .catch((e) => setMsg(String(e?.message ?? e)))
      .finally(() => setLoadingS(false));
  }, [getSettings]);

  async function toggle() {
    setSavingS(true);
    setMsg("");
    try {
      const next = !enabled;
      await setGate({ data: { password: ADMIN_PASSWORD, enabled: next } });
      setEnabled(next);
      setMsg(next ? "✓ Formulário ativado para visitantes." : "✓ Formulário desativado.");
    } catch (e) {
      setMsg(`Falha: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSavingS(false);
    }
  }

  async function loadLeads() {
    setLoadingLeads(true);
    try {
      const rows = await listLeads({ data: { password: ADMIN_PASSWORD } });
      setLeads(rows as LeadRow[]);
      setShowLeads(true);
    } catch (e) {
      setMsg(`Falha ao carregar contatos: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoadingLeads(false);
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Formulário de captura</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Quando ativado, o visitante precisa informar nome, WhatsApp e preferência de pagamento
            antes de ver o catálogo.
          </p>
        </div>
        <button
          onClick={toggle}
          disabled={loadingS || savingS}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60 ${
            enabled
              ? "bg-whatsapp text-whatsapp-foreground"
              : "border border-border bg-background text-foreground hover:bg-card"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${enabled ? "bg-whatsapp-foreground" : "bg-muted-foreground"}`}
          />
          {loadingS ? "Carregando…" : enabled ? "Ativado" : "Desativado"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={loadLeads}
          disabled={loadingLeads}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs hover:bg-card disabled:opacity-60"
        >
          {loadingLeads ? "Carregando…" : showLeads ? "Atualizar contatos" : "Ver contatos recebidos"}
        </button>
        <button
          onClick={async () => {
            setMsg("");
            try {
              const rows =
                leads.length > 0
                  ? leads
                  : ((await listLeads({ data: { password: ADMIN_PASSWORD } })) as LeadRow[]);
              if (!rows || rows.length === 0) {
                setMsg("Nenhum contato para baixar ainda.");
                return;
              }
              setLeads(rows);
              await downloadLeadsXLSX(rows);
              setMsg(`✓ Planilha Excel gerada com ${rows.length} contato(s).`);
            } catch (e) {
              const err = e instanceof Error ? e.message : String(e);
              console.error("[xlsx] erro ao baixar", e);
              setMsg(`Erro ao baixar planilha: ${err}`);
            }
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Download className="h-3.5 w-3.5" /> Baixar planilha (Excel)
        </button>
        {showLeads && (
          <span className="text-xs text-muted-foreground">{leads.length} contato(s)</span>
        )}
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        A planilha baixa em formato .xlsx para abrir direto no Excel ou importar no Google Sheets.
      </p>

      {msg && <p className="mt-2 text-xs text-muted-foreground">{msg}</p>}

      {showLeads && leads.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-background text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Quando</th>
                <th className="px-3 py-2 font-medium">Nome</th>
                <th className="px-3 py-2 font-medium">WhatsApp</th>
                <th className="px-3 py-2 font-medium">Carro buscado</th>
                <th className="px-3 py-2 font-medium">Pagamento</th>
                <th className="px-3 py-2 font-medium">Valor</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className="border-t border-border">
                  <td className="px-3 py-2 text-muted-foreground">
                    {new Date(l.created_at).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-3 py-2 font-medium">{l.name}</td>
                  <td className="px-3 py-2">
                    <a
                      href={`https://wa.me/${l.whatsapp.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-whatsapp hover:underline"
                    >
                      {l.whatsapp}
                    </a>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{l.desired_car ?? "—"}</td>
                  <td className="px-3 py-2">
                    {l.payment_type === "avista" ? "À vista" : "Parcelado"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{l.payment_value ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showLeads && leads.length === 0 && (
        <p className="mt-3 text-xs text-muted-foreground">Nenhum contato recebido ainda.</p>
      )}
    </div>
  );
}

async function downloadLeadsXLSX(rows: LeadRow[]) {
  const XLSX = await import("xlsx");
  const values = [
    ["Data", "Nome", "WhatsApp", "Carro buscado", "Pagamento", "Valor"],
    ...rows.map((r) => [
      new Date(r.created_at).toLocaleString("pt-BR"),
      r.name,
      r.whatsapp,
      r.desired_car ?? "",
      r.payment_type === "avista" ? "À vista" : "Parcelado",
      r.payment_value ?? "",
    ]),
  ];
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(values);
  worksheet["!cols"] = [{ wch: 22 }, { wch: 24 }, { wch: 18 }, { wch: 24 }, { wch: 14 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(workbook, worksheet, "Contatos");
  const file = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  const blob = new Blob([file], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `contatos-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}







