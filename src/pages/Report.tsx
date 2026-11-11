import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Mic,
  Square,
  Send,
  ArrowUpRight,
  ShieldCheck,
  Check,
  Activity,
} from "lucide-react";
import {
  useLang,
  useData,
  GlassCard,
  RippleButton,
  ConfidenceMeter,
  SeverityPill,
  Skeleton,
  syndrome,
} from "../shared";
import { ingestCase, assignCaseLocation, type CaseRecord } from "../lib/api";
import { serviceError } from "../lib/errors";
import { useServiceStatus } from "../lib/useServiceStatus";
export default function Report() {
  const service = useServiceStatus();
  const { t, ur } = useLang(),
    { villages, error: storeError } = useData();
  const [text, T] = useState(""),
    [state, S] = useState("idle"),
    [error, E] = useState(""),
    [result, R] = useState<CaseRecord | null>(null),
    [seconds, Q] = useState(0),
    [bars, B] = useState<number[]>(Array(24).fill(5)),
    [status, K] = useState(0);
  const lastInput = useRef<Parameters<typeof ingestCase>[0] | null>(null);
  const recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    audio = useRef<AudioContext | null>(null),
    frame = useRef(0),
    chunks = useRef<Blob[]>([]),
    alive = useRef(true),
    stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cleanup = () => {
    stream.current?.getTracks().forEach((tr) => tr.stop());
    stream.current = null;
    void audio.current?.close();
    audio.current = null;
    cancelAnimationFrame(frame.current);
    if (stopTimer.current) clearTimeout(stopTimer.current);
  };
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (recorder.current?.state === "recording") {
        recorder.current.onstop = null;
        recorder.current.stop();
      }
      cleanup();
    };
  }, []);
  useEffect(() => {
    if (state !== "recording") return;
    const timer = setInterval(() => Q((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [state]);
  useEffect(() => {
    if (state !== "processing") return;
    const timer = setInterval(() => K((n) => (n + 1) % 3), 1500);
    return () => clearInterval(timer);
  }, [state]);
  const submit = async (input: Parameters<typeof ingestCase>[0]) => {
    lastInput.current = input;
    S("processing");
    E("");
    try {
      const c = await ingestCase(input);
      if (alive.current) {
        R(c);
        S("success");
      }
    } catch (error) {
      if (alive.current) {
        E(serviceError(error, t));
        S("error");
      }
    }
  };
  const stop = () => {
    if (recorder.current?.state === "recording") recorder.current.stop();
    navigator.vibrate?.(30);
    cleanup();
  };
  const start = async () => {
    lastInput.current = null;
    E("");
    S("requesting");
    Q(0);
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
        throw Error("unsupported");
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current) {
        mic.getTracks().forEach((tr) => tr.stop());
        return;
      }
      stream.current = mic;
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find(
        (m) => MediaRecorder.isTypeSupported(m),
      );
      const rec = new MediaRecorder(mic, mime ? { mimeType: mime } : undefined);
      recorder.current = rec;
      chunks.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data);
      };
      rec.onstop = () => {
        cleanup();
        if (!alive.current) return;
        const blob = new Blob(chunks.current, { type: rec.mimeType });
        if (blob.size === 0) {
          E(
            t(
              "No sound was captured. Try typing below.",
              "آواز محفوظ نہیں ہوئی۔ نیچے لکھیں۔",
            ),
          );
          S("error");
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          if (alive.current)
            void submit({
              audioBase64: String(reader.result).split(",")[1],
              mimeType: blob.type,
            });
        };
        reader.onerror = () => {
          E(
            t(
              "Could not read audio. Try again.",
              "آواز نہیں پڑھی جا سکی۔ دوبارہ کوشش کریں۔",
            ),
          );
          S("error");
        };
        reader.readAsDataURL(blob);
      };
      rec.onerror = () => {
        rec.onstop = null;
        cleanup();
        if (alive.current) {
          E(
            t(
              "Recording stopped unexpectedly. Try typing below.",
              "ریکارڈنگ رک گئی۔ نیچے رپورٹ لکھیں۔",
            ),
          );
          S("error");
        }
      };
      rec.start();
      S("recording");
      navigator.vibrate?.(30);
      stopTimer.current = setTimeout(stop, 30000);
      try {
        const ctx = new AudioContext();
        audio.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        ctx.createMediaStreamSource(mic).connect(analyser);
        const values = new Uint8Array(analyser.frequencyBinCount);
        const draw = () => {
          analyser.getByteFrequencyData(values);
          B(Array.from({ length: 24 }, (_, i) => Math.max(4, values[i] / 5)));
          frame.current = requestAnimationFrame(draw);
        };
        draw();
      } catch {
        /* Recording works without waveform support. */
      }
    } catch {
      cleanup();
      E(
        t(
          "Microphone unavailable. You can type your report below.",
          "مائیک دستیاب نہیں۔ نیچے اپنی رپورٹ لکھیں۔",
        ),
      );
      S("error");
    }
  };
  const busy =
    state === "processing" || state === "requesting" || state === "recording";
  return (
    <>
      <div className="report-workspace">
        <aside className="report-guidance">
          <div className="editorial-kicker">
            <span className="field-rule" />
            {t("FIELD REPORT / PAKISTAN", "فیلڈ رپورٹ / پاکستان")}
          </div>
          <section className="report-heading">
            <h1>
              {t("Every village,", "ہر گاؤں،")}
              <em>{t("heard.", "ہر آواز۔")}</em>
            </h1>
            <p>
              {t(
                "A voice report can be the first sign. Share what you have noticed, in Urdu or Punjabi.",
                "آواز سے رپورٹ پہلی اطلاع بن سکتی ہے۔ جو علامات دیکھی ہیں، اردو یا پنجابی میں بتائیں۔",
              )}
            </p>
          </section>
          <div className="connection-panel">
            <span>
              <span
                className={
                  service === "connected" ? "status-dot" : "status-dot pending"
                }
              />
              {service === "connected"
                ? t("Voice service configured", "آواز کی سروس تیار ہے")
                : service === "checking"
                  ? t(
                      "Checking voice service…",
                      "آواز کی سروس دیکھی جا رہی ہے…",
                    )
                  : t(
                      "Voice service needs connection",
                      "آواز کی سروس کا رابطہ درکار ہے",
                    )}
            </span>
          </div>
          <h2>{t("What to include", "رپورٹ میں کیا بتائیں")}</h2>
          <p>
            {t(
              "A clear report helps a health worker follow up. Mention these details if you know them.",
              "واضح رپورٹ صحت کارکن کی مدد کرتی ہے۔ جو تفصیلات معلوم ہوں، بتائیں۔",
            )}
          </p>
          <dl>
            <div>
              <dt>{t("Location", "مقام")}</dt>
              <dd>
                {t("Village or town, and district", "گاؤں یا قصبہ اور ضلع")}
              </dd>
            </div>
            <div>
              <dt>{t("People affected", "متاثرہ افراد")}</dt>
              <dd>
                {t("How many, and their age group", "تعداد اور عمر کا گروپ")}
              </dd>
            </div>
            <div>
              <dt>{t("Symptoms", "علامات")}</dt>
              <dd>
                {t("What you noticed, and for how long", "کیا دیکھا اور کب سے")}
              </dd>
            </div>
          </dl>
          <div className="review-note">
            <ShieldCheck size={20} />
            <p>
              {t(
                "A health worker must verify every report. This service does not diagnose.",
                "ہر رپورٹ کی تصدیق صحت کارکن کرے گا۔ یہ سروس تشخیص نہیں کرتی۔",
              )}
            </p>
          </div>
          <Link to="/map" className="text-link">
            {t("Explore the Pakistan map", "پاکستان کا نقشہ دیکھیں")}
            <ArrowUpRight size={17} />
          </Link>
        </aside>
        <GlassCard className="report-card">
          <div className="recorder-heading">
            <span>
              <span className="status-dot" />
              {t("New report", "نئی رپورٹ")}
            </span>
            <span>{t("30 seconds maximum", "زیادہ سے زیادہ ۳۰ سیکنڈ")}</span>
          </div>
          {!result ? (
            <>
              <h2>{t("Report by voice", "آواز سے رپورٹ کریں")}</h2>
              <p className="center muted">
                {t(
                  "Tell us the location, symptoms, and people affected.",
                  "مقام، علامات اور متاثرہ افراد کی تعداد بتائیں۔",
                )}
              </p>
              <div
                className={`record-area ${state === "recording" ? "recording" : ""}`}
              >
                <div className="record-halo" />
                <RippleButton
                  className="record-button"
                  disabled={state === "processing" || state === "requesting"}
                  onClick={state === "recording" ? stop : start}
                  aria-label={
                    state === "recording"
                      ? t("Stop recording", "ریکارڈنگ روکیں")
                      : t("Tap to record", "ریکارڈ کرنے کے لیے دبائیں")
                  }
                >
                  {state === "recording" ? (
                    <Square size={36} />
                  ) : (
                    <Mic size={46} strokeWidth={1.6} />
                  )}
                </RippleButton>
                {state === "recording" && (
                  <svg className="progress-ring" viewBox="0 0 160 160">
                    <circle
                      cx="80"
                      cy="80"
                      r="76"
                      pathLength="100"
                      strokeDasharray={`${(seconds / 30) * 100} 100`}
                    />
                  </svg>
                )}
              </div>
              <strong className="record-label">
                {state === "recording"
                  ? `${t("Stop", "روکیں")} · 00:${String(seconds).padStart(2, "0")}`
                  : state === "requesting"
                    ? t("Allow microphone access", "مائیک کی اجازت دیں")
                    : state === "processing"
                      ? t("Reading your report…", "آپ کی رپورٹ پڑھی جا رہی ہے…")
                      : t("Tap to record", "ریکارڈ کرنے کے لیے دبائیں")}
              </strong>
              <div className="waveform" aria-hidden="true">
                {bars.map((height, i) => (
                  <i
                    key={i}
                    style={{
                      transform: `scaleY(${state === "recording" ? height / 25 : 0.12})`,
                    }}
                  />
                ))}
              </div>
              <p className="center tiny">
                {t(
                  "Urdu or Punjabi · Up to 30 seconds",
                  "اردو یا پنجابی · زیادہ سے زیادہ ۳۰ سیکنڈ",
                )}
              </p>
              {state === "processing" && (
                <>
                  <Skeleton />
                  <p role="status">
                    {
                      [
                        t("Listening…", "سن رہے ہیں…"),
                        t("Understanding symptoms…", "علامات سمجھ رہے ہیں…"),
                        t("Checking village…", "گاؤں دیکھ رہے ہیں…"),
                      ][status]
                    }
                  </p>
                </>
              )}
              {error && (
                <div className="error" role="alert">
                  {error}
                  <RippleButton
                    onClick={() =>
                      lastInput.current
                        ? void submit(lastInput.current)
                        : void start()
                    }
                  >
                    {t("Retry", "دوبارہ کوشش")}
                  </RippleButton>
                </div>
              )}
              <div className="divider">
                <span>{t("OR TYPE YOUR REPORT", "یا اپنی رپورٹ لکھیں")}</span>
              </div>
              <label htmlFor="report-text" className="sr-only">
                {t("Or type here", "یا یہاں لکھیں")}
              </label>
              <textarea
                id="report-text"
                value={text}
                onChange={(e) => T(e.target.value)}
                placeholder={t(
                  "Village and district, people affected, symptoms, and how long they have had them…",
                  "گاؤں اور ضلع، متاثرہ افراد، علامات اور علامات کا دورانیہ…",
                )}
                disabled={busy}
                rows={3}
                maxLength={4000}
              />
              <RippleButton
                className="primary send"
                disabled={!text.trim() || busy}
                onClick={() => void submit({ text })}
              >
                <Send size={18} />
                {t("Send report", "رپورٹ بھیجیں")}
                <ArrowUpRight size={18} />
              </RippleButton>
              <p className="tiny center muted">
                {t(
                  "Do not include names, phone numbers or personal addresses.",
                  "نام، فون نمبر یا ذاتی پتے شامل نہ کریں۔",
                )}
              </p>
            </>
          ) : (
            <motion.div
              className="result-card"
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6 }}
            >
              <span className="badge safe">
                <Check size={16} />
                {t("Report received", "رپورٹ موصول ہوئی")}
              </span>
              <h2>
                {ur
                  ? villages.find((v) => v.id === result.villageId)?.nameUr ||
                    result.locationText ||
                    t("Location needs review", "مقام کی تصدیق درکار ہے")
                  : villages.find((v) => v.id === result.villageId)?.name ||
                    result.locationText ||
                    t("Location needs review", "مقام کی تصدیق درکار ہے")}
              </h2>
              {!result.villageId && (
                <label>
                  {t("Choose village", "گاؤں منتخب کریں")}
                  <select
                    onChange={async (e) => {
                      E("");
                      try {
                        R(await assignCaseLocation(result.id, e.target.value));
                      } catch (error) {
                        E(serviceError(error, t));
                      }
                    }}
                  >
                    <option value="">—</option>
                    {villages.map((v) => (
                      <option key={v.id} value={v.id}>
                        {ur ? v.nameUr : v.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <div className="patient-count">
                {result.numPatients ?? "—"}
                <span>
                  {result.numPatients === null
                    ? t("Count not mentioned", "تعداد بیان نہیں ہوئی")
                    : t("people reported", "افراد کی اطلاع")}
                </span>
              </div>
              <div className="chips">
                {result.symptoms.map((s) => (
                  <span className="badge" key={s}>
                    <Activity size={14} />
                    {t(
                      s,
                      (
                        {
                          fever: "بخار",
                          vomiting: "الٹی",
                          cough: "کھانسی",
                          "yellow eyes": "پیلی آنکھیں",
                          weakness: "کمزوری",
                        } as Record<string, string>
                      )[s] || s,
                    )}
                  </span>
                ))}
              </div>
              <p>{syndrome(result.syndromeGroup, t)}</p>
              <SeverityPill value={result.severity} />
              <ConfidenceMeter value={result.confidence} />
              {result.needsReview && (
                <p className="warning">
                  {t("Needs human verification", "انسانی تصدیق ضروری ہے")}
                </p>
              )}
              {result.synthetic && (
                <span className="badge">{t("Synthetic", "مصنوعی")}</span>
              )}
              <details>
                <summary>{t("English transcript", "انگریزی متن")}</summary>
                <p dir="ltr">{result.transcriptEn}</p>
              </details>
              <div className="button-row">
                <RippleButton
                  className="primary"
                  onClick={() => {
                    R(null);
                    S("idle");
                    T("");
                  }}
                >
                  {t("New report", "نئی رپورٹ")}
                </RippleButton>
                <Link
                  className="button"
                  to={`/map?village=${result.villageId}`}
                >
                  {t("See on map", "نقشے پر دیکھیں")}
                  <ArrowUpRight size={16} />
                </Link>
              </div>
            </motion.div>
          )}
        </GlassCard>
      </div>
      {storeError && (
        <p className="error">
          {t(
            "Data connection failed. Reload to retry.",
            "ڈیٹا سے رابطہ نہیں ہوا۔ دوبارہ صفحہ کھولیں۔",
          )}
        </p>
      )}
    </>
  );
}
