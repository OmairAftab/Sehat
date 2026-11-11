import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Bell,
  Copy,
  MessageCircle,
  MapPin,
  Check,
  TriangleAlert,
} from "lucide-react";
import {
  useLang,
  useData,
  GlassCard,
  RippleButton,
  EmptyState,
  syndrome,
  Skeleton,
} from "../shared";
import type { AlertRecord } from "../lib/api";
function AlertCard({ a }: { a: AlertRecord }) {
  const { t, ur } = useLang(),
    { villages } = useData(),
    [checked, S] = useState<number[]>([]),
    [toast, N] = useState("");
  const v = villages.find((v) => v.id === a.villageId);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(a.urduMessage);
      N(t("Message copied", "پیغام نقل ہو گیا"));
    } catch {
      N(
        t(
          "Copy unavailable. Select the message to copy.",
          "نقل ممکن نہیں۔ پیغام منتخب کرکے نقل کریں۔",
        ),
      );
    }
  };
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <GlassCard className="alert-card">
        <div className="section-row">
          <span className="badge danger">
            <Bell size={16} />
            {t("Early warning", "ابتدائی انتباہ")}
          </span>
          <span className="tiny">
            {new Date(a.createdAt).toLocaleDateString(ur ? "ur-PK" : "en-GB")}
          </span>
        </div>
        <h2>{ur ? v?.nameUr : v?.name}</h2>
        <p>{syndrome(a.syndromeGroup, t)}</p>
        <div className="alert-number">
          <strong>{a.cases7d}</strong>
          <div>
            {t("people in 7 days", "افراد، ۷ دن میں")}
            <p>
              {t("Normal", "معمول")}: {a.baseline}
            </p>
          </div>
        </div>
        <div className="comparison">
          <motion.i initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} />
          <span
            style={{ left: `${Math.max(3, (a.baseline / a.cases7d) * 100)}%` }}
          />
        </div>
        <details>
          <summary>{t("Why this alert?", "یہ الرٹ کیوں؟")}</summary>
          <p>
            {t(
              `This village normally has about ${a.baseline} case a week. This week there were ${a.cases7d}. The chance of this happening by luck alone is about ${(a.pValue * 100).toPrecision(2)}% (p = ${a.pValue.toPrecision(3)}).`,
              `اس گاؤں میں عموماً ہفتے میں ${a.baseline} کیس ہوتا ہے۔ اس ہفتے ${a.cases7d} افراد رپورٹ ہوئے۔ اتفاق سے ایسا ہونے کا امکان تقریباً ${(a.pValue * 100).toPrecision(2)}٪ ہے۔ (p = ${a.pValue.toPrecision(3)})`,
            )}
          </p>
        </details>
        <h3>{t("Officer field brief", "افسر کے لیے موقع کی ہدایات")}</h3>
        <div className="checklist" dir="ltr">
          {a.brief.split("\n").map((line, i) => (
            <RippleButton
              key={i}
              aria-pressed={checked.includes(i)}
              onClick={() =>
                S(
                  checked.includes(i)
                    ? checked.filter((n) => n !== i)
                    : [...checked, i],
                )
              }
            >
              <span
                className={`checkbox ${checked.includes(i) ? "checked" : ""}`}
              >
                {checked.includes(i) && <Check size={14} />}
              </span>
              <span>{line}</span>
            </RippleButton>
          ))}
        </div>
        <div className="urdu-message" dir="rtl">
          <p>{a.urduMessage}</p>
        </div>
        <div className="button-row">
          <RippleButton onClick={() => void copy()}>
            <Copy size={16} />
            {t("Copy", "نقل کریں")}
          </RippleButton>
          <a
            className="button"
            target="_blank"
            rel="noreferrer"
            href={`https://wa.me/?text=${encodeURIComponent(a.urduMessage)}`}
          >
            <MessageCircle size={16} />
            {t("Share on WhatsApp", "واٹس ایپ پر بھیجیں")}
          </a>
        </div>
        <span className="badge watch">
          <TriangleAlert size={14} />
          {t("Needs ground verification", "موقع پر تصدیق ضروری ہے")}
        </span>
        <Link className="button full" to={`/map?village=${a.villageId}`}>
          <MapPin size={16} />
          {t("Show on map", "نقشے پر دکھائیں")}
        </Link>
        {toast && <p role="status">{toast}</p>}
      </GlassCard>
    </motion.div>
  );
}
export default function Alerts() {
  const { t } = useLang(),
    { alerts, error, loading } = useData();
  return (
    <>
      <div className="page-title">
        <div>
          <p className="section-label">
            {t("FIELD NOTICES / HEALTH TEAM", "فیلڈ اطلاعات / صحت ٹیم")}
          </p>
          <h1>{t("Health alerts", "صحت کے الرٹس")}</h1>
          <p>
            {t(
              "Unusual patterns, ready for a human to check.",
              "غیر معمولی رجحانات، انسانی جانچ کے لیے۔",
            )}
          </p>
        </div>
        <span className="alerts-status">
          <strong>{alerts.length}</strong>
          {t("alerts to review", "جائزے کے لیے الرٹس")}
        </span>
      </div>
      {loading ? (
        <Skeleton />
      ) : error ? (
        <div className="error">
          {t("Alerts unavailable", "الرٹس دستیاب نہیں")}
          <RippleButton onClick={() => location.reload()}>
            {t("Retry", "دوبارہ کوشش")}
          </RippleButton>
        </div>
      ) : !alerts.length ? (
        <section className="alerts-empty">
          <EmptyState
            title={t(
              "No alerts have been generated.",
              "ابھی کوئی الرٹ جاری نہیں ہوا۔",
            )}
          />
          <p>
            {t(
              "Alerts use submitted reports and verified local baselines. No alerts does not mean no illness.",
              "الرٹس موصولہ رپورٹس اور تصدیق شدہ مقامی معمول سے بنتے ہیں۔ الرٹ نہ ہونے کا مطلب بیماری نہ ہونا نہیں۔",
            )}
          </p>
          <div className="center">
            <Link className="button" to="/map">
              {t("View reporting locations", "رپورٹنگ کے مقامات دیکھیں")}
            </Link>
          </div>
        </section>
      ) : (
        <div className="alerts-grid">
          {[...alerts]
            .sort((a, b) => b.createdAt - a.createdAt)
            .map((a) => (
              <AlertCard key={a.id} a={a} />
            ))}
        </div>
      )}
    </>
  );
}
