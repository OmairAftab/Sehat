import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  MapContainer,
  TileLayer,
  Marker,
  GeoJSON,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Search,
  ArrowUpRight,
  MapPin,
  ChevronUp,
  Plus,
  Minus,
  Scan,
  Layers,
  ArrowLeft,
  Radio,
  ArrowRight,
} from "lucide-react";
import {
  useLang,
  useData,
  GlassCard,
  RippleButton,
  CaseSummary,
  EmptyState,
  syndrome,
} from "../shared";
import {
  groups,
  weekly,
  searchLocations,
  registerLocation,
  type LocationSearchResult,
  type Village,
} from "../lib/api";
import { serviceError } from "../lib/errors";
const countryBounds: L.LatLngBoundsExpression = [
  [23.5, 60.8],
  [37.1, 77.5],
];
function MapView({
  villages,
  selected,
  open,
}: {
  villages: Village[];
  selected: string;
  open: boolean;
}) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(countryBounds, { padding: [20, 20] });
  }, [map]);
  useEffect(() => {
    const v = villages.find((v) => v.id === selected);
    if (v) {
      if (v.boundary) {
        map.fitBounds(L.geoJSON(v.boundary).getBounds(), {
          padding: [64, 64],
          maxZoom: 12,
          animate: !matchMedia("(prefers-reduced-motion:reduce)").matches,
        });
      } else
        map.flyTo([v.lat, v.lng], 12, {
          duration: matchMedia("(prefers-reduced-motion:reduce)").matches
            ? 0
            : 1,
        });
    }
  }, [map, selected, villages]);
  useEffect(() => {
    const resize = () => map.invalidateSize();
    const timer = setTimeout(resize, 250);
    addEventListener("resize", resize);
    return () => {
      clearTimeout(timer);
      removeEventListener("resize", resize);
    };
  }, [map, open]);
  return null;
}
function MapTools() {
  const { t } = useLang(),
    map = useMap(),
    [zoom, Z] = useState(map.getZoom());
  useMapEvents({ zoomend: () => Z(map.getZoom()) });
  return (
    <div className="atlas-tools">
      <RippleButton
        onClick={() => map.zoomIn()}
        disabled={zoom >= 18}
        aria-label={t("Zoom in", "بڑا کریں")}
      >
        <Plus size={18} />
        <span>{t("Zoom in", "بڑا کریں")}</span>
      </RippleButton>
      <RippleButton
        onClick={() => map.zoomOut()}
        disabled={zoom <= 3}
        aria-label={t("Zoom out", "چھوٹا کریں")}
      >
        <Minus size={18} />
        <span>{t("Zoom out", "چھوٹا کریں")}</span>
      </RippleButton>
      <RippleButton
        onClick={() =>
          map.fitBounds(countryBounds, {
            padding: [20, 20],
            animate: !matchMedia("(prefers-reduced-motion:reduce)").matches,
          })
        }
      >
        <Scan size={18} />
        <span>{t("Pakistan view", "پاکستان دیکھیں")}</span>
      </RippleButton>
    </div>
  );
}
function LocationLayer({
  villages,
  cases,
  alerts,
  selected,
  onSelect,
}: {
  villages: Village[];
  cases: import("../lib/api").CaseRecord[];
  alerts: import("../lib/api").AlertRecord[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const { t, ur } = useLang(),
    map = useMap(),
    [zoom, Z] = useState(map.getZoom());
  useMapEvents({ zoomend: () => Z(map.getZoom()) });
  const clusters: { villages: Village[]; x: number; y: number }[] = [];
  for (const village of villages) {
    const point = map.project([village.lat, village.lng], zoom);
    const near =
      village.id === selected
        ? undefined
        : clusters.find(
            (c) =>
              !c.villages.some((v) => v.id === selected) &&
              Math.hypot(c.x - point.x, c.y - point.y) < 52,
          );
    if (near) {
      const n = near.villages.length;
      near.x = (near.x * n + point.x) / (n + 1);
      near.y = (near.y * n + point.y) / (n + 1);
      near.villages.push(village);
    } else clusters.push({ villages: [village], x: point.x, y: point.y });
  }
  return (
    <>
      {clusters.map((cluster) => {
        if (cluster.villages.length > 1) {
          const members = cluster.villages;
          return (
            <Marker
              key={"cluster-" + members.map((v) => v.id).join("-")}
              position={map.unproject([cluster.x, cluster.y], zoom)}
              title={
                members.length +
                " " +
                t("registered locations", "درج شدہ مقامات")
              }
              icon={L.divIcon({
                className: "atlas-cluster-icon",
                html:
                  '<span class="atlas-cluster"><b>' +
                  members.length +
                  "</b><small>" +
                  t("locations", "مقامات") +
                  "</small></span>",
                iconSize: [54, 54],
                iconAnchor: [27, 27],
              })}
              eventHandlers={{
                click: () => {
                  if (zoom >= 16) onSelect(members[0].id);
                  else
                    map.fitBounds(
                      L.latLngBounds(members.map((v) => [v.lat, v.lng])),
                      {
                        padding: [70, 70],
                        maxZoom: 16,
                        animate: !matchMedia("(prefers-reduced-motion:reduce)")
                          .matches,
                      },
                    );
                },
              }}
            >
              <Tooltip
                direction="top"
                offset={[0, -22]}
                className="atlas-label"
              >
                {members.map((v) => (
                  <div key={v.id}>{ur ? v.nameUr : v.name}</div>
                ))}
              </Tooltip>
            </Marker>
          );
        }
        const v = cluster.villages[0],
          hasAlert = alerts.some((a) => a.villageId === v.id),
          entries = cases.filter((c) => c.villageId === v.id).length,
          status = hasAlert ? "alert" : entries ? "watch" : "idle";
        return (
          <Marker
            key={v.id}
            position={[v.lat, v.lng]}
            zIndexOffset={selected === v.id ? 1000 : 0}
            title={ur ? v.nameUr : v.name}
            icon={L.divIcon({
              className: "village-icon",
              html:
                '<span class="village-dot ' +
                status +
                " " +
                (selected === v.id ? "is-selected" : "") +
                '"><i></i>' +
                (entries ? "<b>" + entries + "</b>" : "") +
                "</span>",
              iconSize: [40, 40],
              iconAnchor: [20, 20],
            })}
            eventHandlers={{ click: () => onSelect(v.id) }}
          >
            <Tooltip
              permanent={
                selected === v.id || (zoom >= 8 && villages.length <= 8)
              }
              direction="top"
              offset={[0, -18]}
              className="atlas-label"
            >
              {ur ? v.nameUr : v.name}
            </Tooltip>
          </Marker>
        );
      })}
    </>
  );
}
export default function MapPage() {
  const [compact, Compact] = useState(
    () => matchMedia("(max-width:767px)").matches,
  );
  useEffect(() => {
    const query = matchMedia("(max-width:767px)"),
      update = () => Compact(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const { t, ur } = useLang(),
    { villages, cases, alerts, error, loading } = useData(),
    [params] = useSearchParams(),
    [selected, S] = useState(params.get("village") || ""),
    [tab, T] = useState("cases"),
    [open, O] = useState(false),
    [query, Q] = useState(""),
    [results, R] = useState<LocationSearchResult[]>([]),
    [searching, B] = useState(false),
    [searched, Z] = useState(false),
    [adding, A] = useState(""),
    [searchError, E] = useState(""),
    [tileErrors, F] = useState(0),
    [, tick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(timer);
  }, []);
  const current = villages.find((v) => v.id === selected),
    filtered = [...cases]
      .filter((c) => !selected || c.villageId === selected)
      .sort((a, b) => b.createdAt - a.createdAt),
    filteredAlerts = alerts.filter(
      (a) => !selected || a.villageId === selected,
    );
  const search = async () => {
    if (query.trim().length < 3 || searching) return;
    B(true);
    E("");
    try {
      R(await searchLocations(query.trim()));
      Z(true);
    } catch (e) {
      E(serviceError(e, t));
    } finally {
      B(false);
    }
  };
  const add = async (place: LocationSearchResult) => {
    A(place.placeId);
    E("");
    try {
      const location = await registerLocation(place.placeId);
      S(location.id);
      O(true);
      R([]);
      Z(false);
      Q("");
    } catch (e) {
      E(serviceError(e, t));
    } finally {
      A("");
    }
  };
  const carto = import.meta.env.VITE_CARTO_API_KEY,
    hasCarto = Boolean(carto) && tileErrors < 3;
  return (
    <>
      <div className="page-title atlas-title">
        <div>
          <p className="section-label">
            {t("FIELD ATLAS / PAKISTAN", "فیلڈ اٹلس / پاکستان")}
          </p>
          <h1>{t("A closer view.", "ایک واضح منظر۔")}</h1>
          <p>
            {t(
              "Real places. Local reports. A clearer picture of community health.",
              "اصل مقامات۔ مقامی رپورٹس۔ کمیونٹی کی صحت کا واضح منظر۔",
            )}
          </p>
        </div>
        <div className="atlas-summary">
          <span>
            <b>{villages.length}</b>
            {t("registered locations", "درج شدہ مقامات")}
          </span>
          <span>
            <b>{cases.length}</b>
            {t("reports received", "موصولہ رپورٹس")}
          </span>
        </div>
      </div>
      <div className="atlas-search-row">
        <form
          className="map-search"
          onSubmit={(e) => {
            e.preventDefault();
            void search();
          }}
        >
          <Search size={19} />
          <label htmlFor="place-search" className="sr-only">
            {t("Village or town and district", "گاؤں یا قصبہ اور ضلع")}
          </label>
          <input
            id="place-search"
            value={query}
            onChange={(e) => Q(e.target.value)}
            placeholder={t(
              "Search a village, town or district in Pakistan",
              "پاکستان میں گاؤں، قصبہ یا ضلع تلاش کریں",
            )}
            minLength={3}
            maxLength={160}
          />
          <RippleButton
            className="primary"
            type="submit"
            disabled={searching || query.trim().length < 3}
          >
            {searching
              ? t("Searching…", "تلاش جاری…")
              : t("Find location", "مقام تلاش کریں")}
            <ArrowRight size={16} />
          </RippleButton>
        </form>
        <span className="atlas-source">
          <Layers size={16} />
          {t("OpenStreetMap geography", "اوپن اسٹریٹ میپ جغرافیہ")}
        </span>
      </div>
      {searchError && (
        <p className="error" role="alert">
          {searchError}
        </p>
      )}
      {searched && !results.length && !searching && (
        <p className="registry-note">
          {t(
            "No matching place found. Include the district or province and try again.",
            "مقام نہیں ملا۔ ضلع یا صوبہ شامل کرکے دوبارہ تلاش کریں۔",
          )}
        </p>
      )}
      <AnimatePresence>
        <div className="search-results">
          {results.map((place) => (
            <motion.div
              key={place.placeId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <RippleButton
                className="search-result"
                disabled={Boolean(adding)}
                onClick={() => void add(place)}
              >
                <MapPin size={20} />
                <span>
                  <strong>{place.name}</strong>
                  <small>{place.displayName}</small>
                </span>
                <span>
                  {adding === place.placeId
                    ? t("Adding…", "شامل ہو رہا ہے…")
                    : t("Add location", "مقام شامل کریں")}
                  <ArrowUpRight size={16} />
                </span>
              </RippleButton>
            </motion.div>
          ))}
        </div>
      </AnimatePresence>
      {error && (
        <p className="error" role="alert">
          {t(
            "Report storage is unavailable. Reload to reconnect.",
            "رپورٹ کا ذخیرہ دستیاب نہیں۔ رابطے کے لیے صفحہ دوبارہ کھولیں۔",
          )}
        </p>
      )}
      <div className="map-layout">
        <GlassCard className="map-frame">
          <MapContainer
            center={[30.4, 69.3]}
            zoom={5}
            zoomControl={false}
            minZoom={3}
            maxZoom={18}
            scrollWheelZoom
            className="leaflet-map"
          >
            <MapView villages={villages} selected={selected} open={open} />
            <MapTools />
            <TileLayer
              key={hasCarto ? "carto" : "osm"}
              url={
                hasCarto
                  ? `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(carto)}`
                  : "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              }
              attribution={
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' +
                (hasCarto
                  ? ' &copy; <a href="https://carto.com/attribution/">CARTO</a>'
                  : "")
              }
              eventHandlers={{ tileerror: () => F((n) => n + 1) }}
            />
            {current?.boundary && (
              <GeoJSON
                key={current.id}
                data={current.boundary}
                style={{
                  color: "#245c46",
                  weight: 2,
                  fillColor: "#6c9674",
                  fillOpacity: 0.13,
                  dashArray: "6 4",
                }}
              />
            )}
            <LocationLayer
              villages={villages}
              cases={cases}
              alerts={alerts}
              selected={selected}
              onSelect={(id) => {
                S(id);
                O(true);
              }}
            />
          </MapContainer>
          <div className="atlas-map-label">
            <span className="map-crosshair">+</span>
            <div>
              <strong>{t("Pakistan", "پاکستان")}</strong>
              <small>
                {t("Community reporting atlas", "کمیونٹی رپورٹنگ اٹلس")}
              </small>
            </div>
          </div>
          <div className="map-legend">
            <span>
              <i className="idle" />
              {t("No reports", "کوئی رپورٹ نہیں")}
            </span>
            <span>
              <i className="watch" />
              {t("Reported", "رپورٹ موصول")}
            </span>
            <span>
              <i className="alert" />
              {t("Alert", "الرٹ")}
            </span>
          </div>
        </GlassCard>
        <motion.aside className={`map-panel ${open ? "expanded" : ""}`}>
          <RippleButton
            className="sheet-handle"
            onClick={() => O(!open)}
            aria-expanded={open}
          >
            <ChevronUp size={18} />
            {t(
              open ? "Collapse details" : "Open reports",
              open ? "تفصیل بند کریں" : "رپورٹس کھولیں",
            )}
          </RippleButton>
          <div className="panel-scroll" inert={compact && !open}>
            {current ? (
              <>
                <RippleButton className="panel-back" onClick={() => S("")}>
                  <ArrowLeft size={16} />
                  {t("All locations", "تمام مقامات")}
                </RippleButton>
                <p className="section-label">
                  {t("LOCATION PROFILE", "مقام کی تفصیل")}
                </p>
                <h2 className="location-title">
                  {ur ? current.nameUr : current.name}
                </h2>
                <p className="coordinate" dir="ltr">
                  {current.lat.toFixed(4)}° N &nbsp; {current.lng.toFixed(4)}° E
                </p>
                <div className="calibration-note">
                  <span className="status-dot" />
                  <p>
                    {current.baselineConfigured
                      ? t(
                          "Local weekly baseline configured.",
                          "مقامی ہفتہ وار معمول مقرر ہے۔",
                        )
                      : t(
                          "Baseline not calibrated. Automatic alerts are off until a verified local baseline is supplied.",
                          "مقامی معمول مقرر نہیں۔ تصدیق شدہ معمول ملنے تک خودکار الرٹس بند ہیں۔",
                        )}
                  </p>
                </div>
                <div className="mini-bars">
                  {groups.map((g) => (
                    <div key={g}>
                      <div className="section-row">
                        <small>{syndrome(g, t)}</small>
                        <span dir="ltr">
                          {weekly(cases, current.id, g)} /{" "}
                          {current.baselineConfigured
                            ? current.baseline[g]
                            : "—"}
                        </span>
                      </div>
                      <div className="bar-track">
                        <i
                          style={{
                            transform: `scaleX(${Math.min(weekly(cases, current.id, g) / 10, 1)})`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="boundary-note">
                  {current.boundary
                    ? t(
                        "Place outline supplied by OpenStreetMap.",
                        "مقام کی حد اوپن اسٹریٹ میپ سے حاصل ہے۔",
                      )
                    : t(
                        "No place outline supplied; the marker shows the registered point.",
                        "مقام کی حد دستیاب نہیں؛ نشان درج شدہ مقام دکھاتا ہے۔",
                      )}
                </p>
              </>
            ) : (
              <>
                <div className="panel-eyebrow">
                  <Radio size={15} />
                  {t("FIELD REGISTER", "فیلڈ رجسٹر")}
                </div>
                <h2>{t("Closer to the ground.", "مقامی حالات پر نظر۔")}</h2>
                <p className="registry-note">
                  {t(
                    "Only registered places and submitted reports appear here.",
                    "یہاں صرف درج شدہ مقامات اور موصولہ رپورٹس دکھائی جاتی ہیں۔",
                  )}
                </p>
                {!!villages.length && (
                  <div className="location-list">
                    {villages.map((v) => (
                      <RippleButton
                        key={v.id}
                        onClick={() => {
                          S(v.id);
                          O(true);
                        }}
                      >
                        <MapPin size={17} />
                        <span>{ur ? v.nameUr : v.name}</span>
                        <ArrowUpRight size={15} />
                      </RippleButton>
                    ))}
                  </div>
                )}
              </>
            )}
            <div className="segmented">
              <RippleButton
                className={tab === "cases" ? "selected" : ""}
                onClick={() => T("cases")}
              >
                {t("Reports", "رپورٹس")}
                <small>{filtered.length}</small>
              </RippleButton>
              <RippleButton
                className={tab === "alerts" ? "selected" : ""}
                onClick={() => T("alerts")}
              >
                {t("Alerts", "الرٹس")}
                <small>{filteredAlerts.length}</small>
              </RippleButton>
            </div>
            <AnimatePresence initial={false}>
              {tab === "cases"
                ? filtered.slice(0, current ? 3 : 30).map((c) => (
                    <motion.div
                      layout
                      key={c.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                    >
                      <CaseSummary c={c} />
                    </motion.div>
                  ))
                : filteredAlerts.map((a) => (
                    <Link key={a.id} to="/alerts" className="case-summary">
                      <strong>
                        {ur
                          ? villages.find((v) => v.id === a.villageId)?.nameUr
                          : villages.find((v) => v.id === a.villageId)?.name}
                      </strong>
                      <p>
                        {a.cases7d} {t("reported people", "رپورٹ شدہ افراد")}
                      </p>
                    </Link>
                  ))}
            </AnimatePresence>
            {!loading &&
              (tab === "cases" ? !filtered.length : !filteredAlerts.length) && (
                <EmptyState
                  title={
                    tab === "cases"
                      ? t(
                          "No reports submitted yet.",
                          "ابھی کوئی رپورٹ موصول نہیں ہوئی۔",
                        )
                      : t(
                          "No alerts generated.",
                          "ابھی کوئی الرٹ جاری نہیں ہوا۔",
                        )
                  }
                />
              )}
          </div>
          <div className="panel-footnote">
            <ShieldNote
              text={t(
                "Reports are signals, not confirmed diagnoses.",
                "رپورٹس اطلاعات ہیں، تصدیق شدہ تشخیص نہیں۔",
              )}
            />
          </div>
        </motion.aside>
      </div>
      <div className="atlas-footnote">
        <span>
          {t(
            "Geography © OpenStreetMap contributors",
            "جغرافیہ © اوپن اسٹریٹ میپ کے معاونین",
          )}
        </span>
        <span>
          {t(
            "No reports does not mean no illness. Verify on the ground.",
            "رپورٹ نہ ہونے کا مطلب بیماری نہ ہونا نہیں۔ موقع پر تصدیق کریں۔",
          )}
        </span>
      </div>
    </>
  );
}
function ShieldNote({ text }: { text: string }) {
  return <p>{text}</p>;
}
