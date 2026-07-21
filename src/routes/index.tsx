import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, memo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, MapPin, ShieldCheck, CreditCard, Clock, Lock, Share2, PlayCircle } from "lucide-react";
import heroBg from "@/assets/hero-bg.jpg";
import logo from "@/assets/logo.jpg";
import { type Vehicle, isVideoUrl } from "@/lib/vehicles-store";
import { listVehiclesFn } from "@/lib/vehicles.functions";
import { getSiteSettingsFn, listSellerProfilesFn } from "@/lib/settings.functions";
import { LeadGate, hasPassedLeadGate } from "@/components/LeadGate";
import { SellerPickerDialog } from "@/components/SellerPicker";
import { ImageViewer } from "@/components/vehicle-viewer/ImageViewer";
import { MediaImg, MediaVideo } from "@/components/vehicle-viewer/MediaFallback";
import { buildVehicleShareUrl } from "@/lib/canonical-url";
import { trackWhatsAppClick, type TrackingParams } from "@/lib/analytics";


const FALLBACK_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'><rect width='400' height='300' fill='#15181e'/><g font-family='sans-serif' text-anchor='middle'><text x='200' y='145' fill='#f1f5f9' font-size='18' font-weight='bold'>Miguel Veículos</text><text x='200' y='172' fill='#94a3b8' font-size='12'>Toque para ver no WhatsApp</text></g></svg>`,
  );

export const Route = createFileRoute("/")({
  loader: async () => {
    try {
      const vehicles = await listVehiclesFn();
      return { vehicles };
    } catch (err) {
      console.error("Loader failed to load vehicles:", err);
      return { vehicles: [] };
    }
  },
  head: ({ loaderData }) => {
    const firstThree = loaderData?.vehicles?.slice(0, 3) || [];
    const preloadLinks = firstThree
      .map((v) => {
        const cover = v.images[0];
        if (!cover) return null;
        return {
          rel: "preload",
          as: "image",
          href: `/api/public/vehicle-image?path=${encodeURIComponent(cover)}`,
        };
      })
      .filter(Boolean);

    return {
      meta: [
        { title: "Miguel Veículos | Catálogo de veículos" },
        {
          name: "description",
          content:
            "Miguel Veículos — catálogo de veículos novos e seminovos. Atendimento personalizado com nossa equipe pelo WhatsApp.",
        },
        { property: "og:title", content: "Miguel Veículos | Catálogo" },
        {
          property: "og:description",
          content: "Veículos selecionados e atendimento direto pelo WhatsApp com a equipe Miguel Veículos.",
        },
        { property: "og:type", content: "website" },
      ],
      links: preloadLinks as any[],
    };
  },
  component: Landing,
});

function Landing() {
  const { vehicles: serverVehicles } = Route.useLoaderData();
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => {
    if (serverVehicles && serverVehicles.length > 0) return serverVehicles;
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("mv:vehicles-cache");
        if (cached) {
          const parsed = JSON.parse(cached) as Vehicle[];
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return [];
  });
  const [loading, setLoading] = useState<boolean>(() => vehicles.length === 0);
  const [gateRequired, setGateRequired] = useState(false);
  const [gatePassed, setGatePassed] = useState(true);
  const [picker, setPicker] = useState<{ source: string; message?: string; extraParams?: TrackingParams } | null>(null);
  const [detailVehicle, setDetailVehicle] = useState<Vehicle | null>(null);
 
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [maxPrice, setMaxPrice] = useState<number | "">("");
  const [visibleCount, setVisibleCount] = useState(5);
  const [shareToast, setShareToast] = useState<string | null>(null);

  const listVehicles = useServerFn(listVehiclesFn);
  const getSettings = useServerFn(getSiteSettingsFn);
  const listSellerProfiles = useServerFn(listSellerProfilesFn);
  const [profiles, setProfiles] = useState<Record<string, string | null>>({});

  useEffect(() => {
    let alive = true;
    // Hidrata imediatamente com cache local (se houver) para o site abrir em < 50ms.
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("mv:vehicles-cache");
        if (cached) {
          const parsed = JSON.parse(cached) as Vehicle[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            setVehicles(parsed);
            setLoading(false);
          }
        }
      } catch {
        /* ignore */
      }
    }

    // Timeout de segurança (2,5s) para encerrar o loading skeleton caso a rede caia
    const timeoutId = setTimeout(() => {
      if (alive) setLoading(false);
    }, 2500);

    listVehicles()
      .then((rows) => {
        if (!alive) return;
        clearTimeout(timeoutId);
        const mapped = rows.map((r) => ({
          id: r.id,
          name: r.name,
          year: r.year,
          km: r.km,
          price: r.price,
          tag: r.tag ?? undefined,
          images: r.images ?? [],
          description: r.description ?? undefined,
        }));
        setVehicles(mapped);
        setLoading(false);
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("mv:vehicles-cache", JSON.stringify(mapped));
          } catch {
            /* quota */
          }
        }
      })
      .catch((err) => {
        console.error("[vehicles] load failed", err);
        clearTimeout(timeoutId);
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
      clearTimeout(timeoutId);
    };
  }, [listVehicles]);

  // Pré-carregamento contínuo em segundo plano (da 4ª foto em diante)
  useEffect(() => {
    if (vehicles.length > 3) {
      const preloadSequence = async () => {
        // Aguarda 1.5 segundos para não interferir na banda inicial do site
        await new Promise((r) => setTimeout(r, 1500));
        for (let i = 3; i < vehicles.length; i++) {
          const cover = vehicles[i].images[0];
          if (!cover) continue;
          // Download sequencial com 400ms de intervalo para manter a conexão livre
          await new Promise((r) => setTimeout(r, 400));
          const img = new Image();
          img.src = `/api/public/vehicle-image?path=${encodeURIComponent(cover)}`;
        }
      };
      preloadSequence();
    }
  }, [vehicles]);


  useEffect(() => {
    let alive = true;
    getSettings()
      .then((s) => {
        if (!alive) return;
        if (s.lead_gate_enabled) {
          setGateRequired(true);
          setGatePassed(hasPassedLeadGate());
        }
      })
      .catch((err) => console.error("[settings] load failed", err));
    return () => {
      alive = false;
    };
  }, [getSettings]);
 
  useEffect(() => {
    listSellerProfiles()
      .then((rows) => {
        const mapping: Record<string, string | null> = {};
        rows.forEach((r) => {
          mapping[r.seller_id] = r.avatar_url;
        });
        setProfiles(mapping);
      })
      .catch((err) => console.error("[profiles] load failed", err));
  }, [listSellerProfiles]);

  function openPicker(source: string, message?: string, extraParams?: TrackingParams) {
    trackWhatsAppClick({ source, ...extraParams });
    setPicker({ source, message, extraParams });
  }


  useEffect(() => {
    if (typeof window === "undefined" || loading) return;
    const params = new URLSearchParams(window.location.search);
    const vid = params.get("vehicle");
    if (!vid) return;
    const found = vehicles.find((v) => v.id === vid);
    if (found) {
      setDetailVehicle(found);
    } else if (vehicles.length > 0) {
      // Link compartilhado aponta pra um veículo que já saiu do catálogo:
      // avisa o cliente em vez de deixar ele achar que o link "não fez nada".
      setShareToast("Este veículo não está mais disponível. Confira outras opções do catálogo.");
      const url = new URL(window.location.href);
      url.searchParams.delete("vehicle");
      window.history.replaceState({}, "", url.toString());
    }
  }, [vehicles, loading]);

  // Debounce da busca — evita re-renderizar o grid a cada tecla em mobile fraco.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 180);
    return () => clearTimeout(t);
  }, [search]);

  // Auto-esconde toast após 5s
  useEffect(() => {
    if (!shareToast) return;
    const t = setTimeout(() => setShareToast(null), 5000);
    return () => clearTimeout(t);
  }, [shareToast]);

  // Sincroniza modal com botão "voltar" do navegador — evita ficar preso em ?vehicle=...
  useEffect(() => {
    if (typeof window === "undefined") return;
    function onPop() {
      const params = new URLSearchParams(window.location.search);
      const vid = params.get("vehicle");
      if (!vid) {
        setDetailVehicle(null);
      } else {
        const found = vehicles.find((v) => v.id === vid);
        setDetailVehicle(found ?? null);
      }
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [vehicles]);

  function openDetail(v: Vehicle) {
    setDetailVehicle(v);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("vehicle", v.id);
      window.history.pushState({}, "", url.toString());
    }
  }

  function closeDetail() {
    setDetailVehicle(null);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.has("vehicle")) {
        url.searchParams.delete("vehicle");
        window.history.pushState({}, "", url.toString());
      }
    }
  }

 
  const parsePrice = (p: string | null | undefined) => {
    if (!p) return 0;
    const num = parseFloat(p.replace(/\D/g, ""));
    return isNaN(num) ? 0 : num;
  };

  // Memoiza derivados do catálogo — só recalcula quando vehicles mudar.
  const brands = useMemo(
    () =>
      Array.from(
        new Set(
          vehicles
            .map((v) => (v.name || "").trim().split(" ")[0])
            .filter((b) => b && b.length > 1),
        ),
      ).sort(),
    [vehicles],
  );

  const years = useMemo(
    () =>
      Array.from(
        new Set(
          vehicles
            .map((v) => {
              const match = (v.year || "").match(/\d{4}/);
              return match ? match[0] : null;
            })
            .filter((y): y is string => Boolean(y)),
        ),
      ).sort((a, b) => b.localeCompare(a)),
    [vehicles],
  );

  const catalogMaxPrice = useMemo(
    () =>
      vehicles.reduce((max, v) => {
        const p = parsePrice(v.price);
        return p > max ? p : max;
      }, 0),
    [vehicles],
  );

  // Memoiza a lista filtrada usando a busca com debounce — impede que o grid
  // inteiro recalcule a cada tecla ou pixel do slider em celular fraco.
  const filteredVehicles = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return vehicles.filter((v) => {
      const matchesSearch =
        !q ||
        [v.name || "", v.tag || "", v.year || "", v.km || "", v.price || ""]
          .join(" ")
          .toLowerCase()
          .includes(q);
      const brand = (v.name || "").trim().split(" ")[0];
      const matchesBrand = !selectedBrand || brand.toLowerCase() === selectedBrand.toLowerCase();
      const yearMatch = (v.year || "").match(/\d{4}/);
      const matchesYear = !selectedYear || (yearMatch && yearMatch[0] === selectedYear);
      const priceVal = parsePrice(v.price);
      const matchesPrice = maxPrice === "" || priceVal <= maxPrice;
      return matchesSearch && matchesBrand && matchesYear && matchesPrice;
    });
  }, [vehicles, debouncedSearch, selectedBrand, selectedYear, maxPrice]);

  // Reseta para 5 veículos ao mudar busca/filtros
  useEffect(() => {
    setVisibleCount(5);
  }, [debouncedSearch, selectedBrand, selectedYear, maxPrice]);

  // Rolagem Infinita: carrega de 5 em 5 ao rolar até o fim da página
  useEffect(() => {
    if (typeof window === "undefined") return;
    function onScroll() {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 600) {
        setVisibleCount((prev) => (prev < filteredVehicles.length ? prev + 5 : prev));
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [filteredVehicles.length]);

  const displayedVehicles = useMemo(
    () => filteredVehicles.slice(0, visibleCount),
    [filteredVehicles, visibleCount]
  );

  return (
    <main className="min-h-screen bg-background text-foreground">
      {vehicles.slice(0, 3).map((v) => {
        const cover = v.images[0];
        if (!cover) return null;
        return (
          <link
            key={v.id}
            rel="preload"
            as="image"
            href={`/api/public/vehicle-image?path=${encodeURIComponent(cover)}`}
          />
        );
      })}
      {gateRequired && !gatePassed && <LeadGate onDone={() => setGatePassed(true)} />}

      {shareToast && (
        <div
          role="status"
          className="fixed left-1/2 top-4 z-[300] -translate-x-1/2 max-w-[92vw] rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground shadow-[var(--shadow-card)]"
        >
          {shareToast}
        </div>
      )}

      <SellerPickerDialog
        open={!!picker}
        onClose={() => setPicker(null)}
        source={picker?.source ?? ""}
        message={picker?.message}
        profiles={profiles}
        extraParams={picker?.extraParams}
      />


      {detailVehicle && (
        <ImageViewer
          vehicle={detailVehicle}
          onClose={closeDetail}
          onContact={() =>
            openPicker(
              "detail_dialog",
              `Olá! Tenho interesse no ${detailVehicle.name} (${detailVehicle.year}) — ${detailVehicle.price}.`,
              {
                vehicle_name: detailVehicle.name,
                vehicle_year: detailVehicle.year,
                vehicle_price: detailVehicle.price,
              }
            )
          }

        />
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Miguel Veículos" className="h-10 w-auto rounded-lg object-contain" />
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <img
          src={heroBg}
          alt="Showroom de veículos"
          width={1600}
          height={1000}
          className="absolute inset-0 h-full w-full object-cover opacity-50"
        />
        <div className="absolute inset-0" style={{ background: "var(--gradient-hero)" }} aria-hidden />
        <div className="relative mx-auto max-w-5xl px-4 py-20 sm:py-28">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-[11px] uppercase tracking-widest text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Mais de 30 anos realizando sonhos com transparência e confiança
          </span>
          <h1 className="mt-4 text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
            O carro certo,
            <br />
            <span className="bg-[image:var(--gradient-accent)] bg-clip-text text-transparent">
              com quem entende.
            </span>
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
            Veículos novos e seminovos selecionados, aprovação rápida e condições especiais.
            Fale direto com nossa equipe pelo WhatsApp e leve o seu hoje mesmo.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <a
              href="#catalogo"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 text-base font-semibold text-primary-foreground shadow-[var(--shadow-card)] transition-transform active:scale-[0.98]"
            >
              Ver catálogo
            </a>
          </div>

          <div className="mt-8 grid grid-cols-3 gap-3 sm:max-w-md">
            <Stat icon={<ShieldCheck className="h-4 w-4" />} label="Procedência garantida" />
            <Stat icon={<CreditCard className="h-4 w-4" />} label="Financiamento facilitado" />
            <Stat icon={<Clock className="h-4 w-4" />} label="Aprovação rápida" />
          </div>
        </div>
      </section>
      {/* Catálogo */}
      <section id="catalogo" className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-primary">Catálogo</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              Veículos em destaque
            </h2>
          </div>
          <p className="hidden text-sm text-muted-foreground sm:block">
            Toque em um modelo e escolha o vendedor no WhatsApp
          </p>
        </div>
 
        {/* Painel de Filtros */}
        {!loading && vehicles.length > 0 && (
          <div className="mb-8 grid grid-cols-1 gap-4 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] sm:grid-cols-4">
            {/* Busca */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Busca</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Modelo, ano, tag..."
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring text-foreground"
              />
            </div>
            
            {/* Marca */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Marca</span>
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring text-foreground"
              >
                <option value="">Todas as marcas</option>
                {brands.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
 
            {/* Ano */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ano</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring text-foreground"
              >
                <option value="">Qualquer ano</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
 
            {/* Preço */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Preço máximo</span>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  R$
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={maxPrice !== "" ? Number(maxPrice).toLocaleString("pt-BR") : ""}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "");
                    const val = raw === "" ? "" : parseFloat(raw);
                    setMaxPrice(val);
                  }}
                  placeholder="Qualquer valor"
                  className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring text-foreground"
                />
              </div>
            </div>
            
            {/* Limpar Filtros */}
            {(search || selectedBrand || selectedYear || maxPrice !== "") && (
              <div className="sm:col-span-4 flex justify-end">
                <button
                  onClick={() => {
                    setSearch("");
                    setSelectedBrand("");
                    setSelectedYear("");
                    setMaxPrice("");
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
                >
                  Limpar todos os filtros
                </button>
              </div>
            )}
          </div>
        )}
 
        {loading && vehicles.length === 0 ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <VehicleCardSkeleton key={i} />
            ))}
          </div>
        ) : vehicles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum veículo cadastrado ainda. Em breve novidades — fale com nossa equipe no
              WhatsApp para opções sob medida.
            </p>
            <button
              onClick={() => openPicker("empty_catalog", undefined, { vehicle_name: "Catálogo vazio" })}
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-whatsapp px-5 py-3 text-sm font-semibold text-whatsapp-foreground"
            >
              <MessageCircle className="h-4 w-4" />
              Falar com nossa equipe
            </button>

          </div>
        ) : filteredVehicles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum veículo corresponde aos filtros selecionados.
            </p>
            <button
              onClick={() => {
                setSearch("");
                setSelectedBrand("");
                setSelectedYear("");
                setMaxPrice("");
              }}
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-card"
            >
              Limpar filtros
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {displayedVehicles.map((v) => (
                <VehicleCard
                  key={v.id}
                  vehicle={v}
                  onClick={() => openDetail(v)}
                  onContact={() =>
                    openPicker("vehicle_card", `Olá! Tenho interesse no ${v.name} (${v.year}) — ${v.price}.`, {
                      vehicle_name: v.name,
                      vehicle_year: v.year,
                      vehicle_price: v.price,
                    })
                  }
                />
              ))}
            </div>

            {visibleCount < filteredVehicles.length && (
              <div className="mt-8 flex flex-col items-center justify-center gap-3">
                <button
                  onClick={() => setVisibleCount((prev) => Math.min(prev + 5, filteredVehicles.length))}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-xs font-semibold text-foreground shadow-sm hover:bg-accent transition-all active:scale-95"
                >
                  <span className="h-2 w-2 rounded-full bg-primary animate-ping" />
                  Carregar mais 5 veículos ({visibleCount} de {filteredVehicles.length})
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* CTA final */}
      <section className="border-t border-border bg-card/40">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:py-20">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Não encontrou o que procura?
          </h2>
          <p className="mt-3 text-muted-foreground">
            Fale com nossa equipe no WhatsApp e encontramos o veículo ideal pra você — com o melhor
            preço e condições sob medida.
          </p>
          <button
            onClick={() => openPicker("cta_final", undefined, { vehicle_name: "Contato geral" })}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-whatsapp px-6 py-4 text-base font-semibold text-whatsapp-foreground shadow-[var(--shadow-card)] transition-transform active:scale-[0.98]"
          >
            <MessageCircle className="h-5 w-5" />
            Falar com a equipe Miguel Veículos
          </button>

        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto max-w-5xl px-4 py-8 text-sm text-muted-foreground">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-semibold text-foreground">Miguel Veículos</p>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              Atendimento Formosa/GO
            </span>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs">
            <p>© {new Date().getFullYear()} Miguel Veículos — Todos os direitos reservados.</p>
            <a href="/admin" className="inline-flex items-center gap-1 text-muted-foreground/70 hover:text-foreground">
              <Lock className="h-3 w-3" />
              Admin
            </a>
          </div>
        </div>
      </footer>

    </main>
  );
}

function Stat({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-start gap-1.5 rounded-lg border border-border bg-card/60 p-3">
      <span className="text-primary">{icon}</span>
      <span className="text-[11px] leading-tight text-muted-foreground">{label}</span>
    </div>
  );
}

function VehicleCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
      <div className="relative aspect-[4/3] overflow-hidden bg-secondary">
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>
      <div className="space-y-3 p-4">
        <div className="h-4 w-3/4 animate-pulse rounded bg-secondary" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-secondary" />
        <div className="h-6 w-1/3 animate-pulse rounded bg-secondary" />
        <div className="h-10 w-full animate-pulse rounded-xl bg-secondary" />
      </div>
    </div>
  );
}

const VehicleCard = memo(function VehicleCard({
  vehicle,
  onClick,
  onContact,
}: {
  vehicle: Vehicle;
  onClick: () => void;
  onContact: () => void;
}) {
  const images = vehicle.images.length > 0 ? vehicle.images : ["data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 4 3'/>"];
  const coverImage = images[0];

  return (
    <article className="group overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] transition-transform hover:-translate-y-1">
      {/* Container da Foto de Capa (Padrão OLX - Clicar abre a galeria completa) */}
      <div
        onClick={onClick}
        className="relative aspect-[16/10] overflow-hidden bg-[#101318] cursor-pointer"
      >
        {isVideoUrl(coverImage) ? (
          <div className="relative flex h-full w-full items-center justify-center bg-muted">
            <MediaVideo
              src={coverImage}
              controls={false}
              muted
              playsInline
              preload="metadata"
              className="h-full w-full object-contain"
            />
            <div className="absolute inset-0 flex items-center justify-center text-white/80">
              <PlayCircle className="h-10 w-10" />
            </div>
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[#15181e]">
            <MediaImg
              src={coverImage}
              alt={vehicle.name}
              loading="eager"
              decoding="async"
              // @ts-ignore
              fetchpriority="high"
              className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
              style={{ objectFit: "contain", width: "100%", height: "100%" }}
              onError={(e) => {
                const img = e.currentTarget;
                if (img.dataset.fallback === "1") return;
                img.dataset.fallback = "1";
                img.src = FALLBACK_IMAGE;
              }}
            />
          </div>
        )}

        {vehicle.tag && (
          <span className="absolute left-3 top-3 rounded-full bg-[image:var(--gradient-accent)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary-foreground z-10">
            {vehicle.tag}
          </span>
        )}

        {images.length > 1 && (
          <span className="absolute right-3 bottom-3 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md border border-white/10 z-10">
            1 / {images.length} fotos
          </span>
        )}
      </div>

      <div className="p-4">
        <div onClick={onClick} className="cursor-pointer">
          <h3 className="text-base font-semibold leading-tight">{vehicle.name}</h3>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <span>{vehicle.year}</span>
            <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
            <span>{vehicle.km}</span>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-lg font-bold tracking-tight">{vehicle.price}</p>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onContact();
            }}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-whatsapp px-4 py-3 text-sm font-semibold text-whatsapp-foreground transition-transform active:scale-[0.98]"
          >
            <MessageCircle className="h-4 w-4" />
            Tenho interesse
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (typeof window === "undefined") return;
              const shareUrl = buildVehicleShareUrl(vehicle.id);
              const text = `Confira este veículo na Miguel Veículos: *${vehicle.name}* (${vehicle.year}) - *${vehicle.price}*. Veja mais fotos e detalhes direto no link: ${shareUrl}`;
              window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
            }}

            title="Compartilhar veículo no WhatsApp"
            className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-3 py-3 text-muted-foreground hover:text-foreground transition-transform active:scale-[0.98]"
          >
            <Share2 className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>
    </article>
  );
});















