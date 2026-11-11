import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react";
import { useReducedMotion } from "framer-motion";
import { X, Info, ShieldCheck, TriangleAlert } from "lucide-react";
import * as api from "./lib/api";
export const Language = createContext({
  ur: true,
  t: (_en: string, ur: string) => ur,
});
export const useLang = () => useContext(Language);
export const Data = createContext<{
  villages: api.Village[];
  cases: api.CaseRecord[];
  alerts: api.AlertRecord[];
  error: string;
  loading: boolean;
}>({ villages: [], cases: [], alerts: [], error: "", loading: true });
export const useData = () => useContext(Data);
export function DataProvider({ children }: { children: React.ReactNode }) {
  const [villages, V] = useState<api.Village[]>([]),
    [cases, C] = useState<api.CaseRecord[]>([]),
    [alerts, A] = useState<api.AlertRecord[]>([]),
    [error, E] = useState(""),
    [loading, L] = useState(true);
  useEffect(() => {
    const fail = () => {
      E("Unable to connect");
      L(false);
    };
    const off = [
      api.subscribeVillages((v) => {
        V(v);
        E("");
        L(false);
      }, fail),
      api.subscribeCases(C, fail),
      api.subscribeAlerts(A, fail),
    ];
    return () => off.forEach((f) => f());
  }, []);
  return (
    <Data.Provider value={{ villages, cases, alerts, error, loading }}>
      {children}
    </Data.Provider>
  );
}
export function RippleButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`ripple-button ${className}`}
      onPointerDown={(e) => {
        if (matchMedia("(prefers-reduced-motion:reduce)").matches) {
          props.onPointerDown?.(e);
          return;
        }
        const rect = e.currentTarget.getBoundingClientRect(),
          s = document.createElement("span");
        s.className = "ripple";
        s.style.left = `${e.clientX - rect.left}px`;
        s.style.top = `${e.clientY - rect.top}px`;
        e.currentTarget.appendChild(s);
        s.addEventListener("animationend", () => s.remove(), { once: true });
        s.addEventListener("animationcancel", () => s.remove(), { once: true });
        props.onPointerDown?.(e);
      }}
    >
      {children}
    </button>
  );
}
export function GlassCard({
  children,
  className = "",
  tilt = false,
}: {
  children: React.ReactNode;
  className?: string;
  tilt?: boolean;
}) {
  return (
    <section
      className={`glass ${className}`}
      onPointerMove={(e) => {
        if (
          tilt &&
          matchMedia("(hover:hover) and (pointer:fine)").matches &&
          !matchMedia("(prefers-reduced-motion:reduce)").matches
        ) {
          const r = e.currentTarget.getBoundingClientRect();
          e.currentTarget.style.transform = `perspective(900px) rotateX(${(-(e.clientY - r.top - r.height / 2) / r.height) * 7}deg) rotateY(${((e.clientX - r.left - r.width / 2) / r.width) * 7}deg)`;
        }
      }}
      onPointerLeave={(e) => (e.currentTarget.style.transform = "")}
    >
      {children}
    </section>
  );
}
export function Logo() {
  return (
    <svg
      viewBox="0 0 48 48"
      width="44"
      height="44"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M24 3 42 10v13c0 11-18 22-18 22S6 34 6 23V10Z"
        stroke="currentColor"
        strokeWidth="2"
        fill="#14b8a61a"
      />
      <path
        d="M12 24h7l4-9 5 18 4-9h5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export function SeverityPill({ value }: { value: string }) {
  const { t } = useLang();
  return (
    <span
      className={`badge ${value === "urgent" ? "danger" : value === "medium" ? "watch" : ""}`}
    >
      <TriangleAlert size={14} />
      {t(
        (
          {
            unknown: "Not stated",
            low: "Low",
            medium: "Medium",
            urgent: "Urgent",
          } as Record<string, string>
        )[value] || value,
        (
          {
            unknown: "بیان نہیں ہوا",
            low: "کم",
            medium: "درمیانہ",
            urgent: "فوری",
          } as Record<string, string>
        )[value] || value,
      )}
    </span>
  );
}
export function ConfidenceMeter({ value }: { value: api.Confidence }) {
  const { t } = useLang();
  return (
    <div className="confidence">
      <span>
        {t("Confidence", "اعتماد")} ·{" "}
        {t(value, { low: "کم", medium: "درمیانہ", high: "زیادہ" }[value])}
      </span>
      <div>
        {[1, 2, 3].map((n) => (
          <i
            key={n}
            className={n <= { low: 1, medium: 2, high: 3 }[value] ? "on" : ""}
          />
        ))}
      </div>
    </div>
  );
}
export function Skeleton() {
  return (
    <div className="glass skeleton" aria-busy="true">
      <i />
      <i />
      <i />
    </div>
  );
}
export function EmptyState({ title }: { title: string }) {
  return (
    <div className="empty">
      <ShieldCheck size={48} />
      <h3>{title}</h3>
    </div>
  );
}
export function Toast({ message }: { message: string }) {
  return message ? (
    <div className="toast" role="status">
      {message}
    </div>
  ) : null;
}
export function BottomSheet({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { t } = useLang();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const node = ref.current!;
    const els = () =>
      Array.from(
        node.querySelectorAll<HTMLElement>(
          'button,select,input,textarea,a[href],[tabindex="0"]',
        ),
      ).filter((e) => !e.hasAttribute("disabled"));
    els()[0]?.focus();
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const a = els(),
          first = a[0],
          last = a[a.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", listener);
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", listener);
      document.body.style.overflow = old;
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="glass modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="section-row">
          <h2>{title}</h2>
          <RippleButton onClick={onClose}>
            <X size={18} />
            {t("Close", "بند کریں")}
          </RippleButton>
        </div>
        {children}
      </div>
    </div>
  );
}
export function DisclaimerBar() {
  const { t } = useLang(),
    [open, S] = useState(false);
  return (
    <>
      <div className="disclaimer">
        <span>
          {t(
            "Early-warning aid only. Not a diagnosis. A human makes the final decision.",
            "یہ صرف ابتدائی انتباہ ہے، تشخیص نہیں۔ حتمی فیصلہ انسان کرتا ہے۔",
          )}
        </span>
        <RippleButton onClick={() => S(true)}>
          <Info size={14} />
          <span>{t("Limitations", "حدود")}</span>
        </RippleButton>
      </div>
      {open && (
        <BottomSheet
          title={t("Know the limitations", "حدود جانیں")}
          onClose={() => S(false)}
        >
          <ul>
            {[
              [
                "Only submitted reports are shown; no reports does not mean no illness.",
                "صرف موصولہ رپورٹس دکھائی جاتی ہیں۔ رپورٹ نہ ہونے کا مطلب بیماری نہ ہونا نہیں۔",
              ],
              [
                "AI can mishear or misread.",
                "اے آئی سننے یا پڑھنے میں غلطی کر سکتی ہے۔",
              ],
              [
                "Alerts need a verified local baseline.",
                "الرٹس کے لیے مقامی معمول کی تصدیق ضروری ہے۔",
              ],
              ["Not a medical diagnosis.", "یہ طبی تشخیص نہیں ہے۔"],
              ["Verify on the ground.", "موقع پر تصدیق کریں۔"],
            ].map(([en, ur]) => (
              <li key={en}>{t(en, ur)}</li>
            ))}
          </ul>
        </BottomSheet>
      )}
    </>
  );
}
export function StatTile({
  count,
  label,
  icon,
}: {
  count: number;
  label: string;
  icon: React.ReactNode;
}) {
  const reduced = useReducedMotion(),
    [n, S] = useState(count),
    old = useRef(count);
  useEffect(() => {
    if (reduced) {
      S(count);
      return;
    }
    let frame: number;
    const start = performance.now(),
      from = old.current;
    const tick = (time: number) => {
      const p = Math.min((time - start) / 650, 1);
      S(Math.round(from + (count - from) * p));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    old.current = count;
    return () => cancelAnimationFrame(frame);
  }, [count, reduced]);
  return (
    <GlassCard className="stat">
      <span className="stat-icon">{icon}</span>
      <div>
        <strong dir="ltr">{n.toString().padStart(2, "0")}</strong>
        <p>{label}</p>
      </div>
      <span className="stat-spark">▁ ▂ ▁ ▄ ▃ ▆</span>
    </GlassCard>
  );
}
export function AuroraBackground() {
  return (
    <div className="aurora" aria-hidden="true">
      {[0, 1, 2, 3].map((n) => (
        <i key={n} />
      ))}
    </div>
  );
}
export function ParticleField() {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let w = innerWidth,
      h = innerHeight,
      frame = 0;
    let dots: { x: number; y: number; s: number }[] = [];
    const resize = () => {
      w = innerWidth;
      h = innerHeight;
      const d = Math.min(devicePixelRatio, 2);
      canvas.width = w * d;
      canvas.height = h * d;
      ctx.setTransform(d, 0, 0, d, 0, 0);
      dots = Array.from({ length: w < 768 ? 18 : 45 }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        s: Math.random() * 0.25 + 0.08,
      }));
    };
    resize();
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const dot of dots) {
        dot.y -= dot.s;
        if (dot.y < 0) dot.y = h;
        ctx.fillStyle = "#71e3d43d";
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, 1.4, 0, 7);
        ctx.fill();
        if (w >= 768)
          for (const other of dots) {
            const distance = Math.hypot(dot.x - other.x, dot.y - other.y);
            if (distance < 100) {
              ctx.strokeStyle = `rgba(100,220,210,${0.045 * (1 - distance / 100)})`;
              ctx.beginPath();
              ctx.moveTo(dot.x, dot.y);
              ctx.lineTo(other.x, other.y);
              ctx.stroke();
            }
          }
      }
      frame = requestAnimationFrame(draw);
    };
    const visibility = () => {
      cancelAnimationFrame(frame);
      if (!document.hidden) draw();
    };
    visibility();
    addEventListener("resize", resize);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [reduced]);
  return reduced ? null : (
    <canvas ref={ref} className="particles" aria-hidden="true" />
  );
}
export const syndrome = (
  g: api.SyndromeGroup,
  t: (en: string, ur: string) => string,
) =>
  ({
    gi_waterborne: t("Stomach & water-related", "پیٹ اور پانی کی علامات"),
    fever_rash_joint: t("Fever, rash & joints", "بخار، دانے اور جوڑ"),
    jaundice: t("Yellow eyes & weakness", "آنکھوں کا پیلا پن"),
    respiratory: t("Cough & breathing", "کھانسی اور سانس"),
    other: t("Other symptoms", "دیگر علامات"),
    unclear: t("Unclear symptoms", "غیر واضح علامات"),
  })[g];
export function CaseSummary({ c }: { c: api.CaseRecord }) {
  const { villages } = useData(),
    { t, ur } = useLang();
  const v = villages.find((v) => v.id === c.villageId);
  return (
    <div className="case-summary">
      <div className="section-row">
        <strong>
          {(ur ? v?.nameUr : v?.name) ||
            c.locationText ||
            t("Location needs review", "مقام کی تصدیق درکار ہے")}
        </strong>
        <SeverityPill value={c.severity} />
      </div>
      <p>
        {c.numPatients ?? "—"} {t("people", "افراد")} ·{" "}
        {syndrome(c.syndromeGroup, t)}
      </p>
      <small>
        {c.synthetic && <>{t("Synthetic", "مصنوعی")} · </>}
        {Math.max(0, Math.floor((Date.now() - c.createdAt) / 60000))}{" "}
        {t("min ago", "منٹ پہلے")}
      </small>
    </div>
  );
}
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="empty">
        <h2>Something went wrong · خرابی ہوئی</h2>
        <RippleButton onClick={() => location.reload()}>
          Retry · دوبارہ کوشش
        </RippleButton>
      </div>
    ) : (
      this.props.children
    );
  }
}
