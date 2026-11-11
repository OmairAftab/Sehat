import React, { lazy, Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  NavLink,
  Routes,
  Route,
  useLocation,
  Link,
  Navigate,
} from "react-router-dom";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { Mic, Map, Bell, Wifi, WifiOff, ArrowUpRight } from "lucide-react";
import {
  Language,
  useLang,
  DataProvider,
  Logo,
  DisclaimerBar,
  AuroraBackground,
  Skeleton,
  ErrorBoundary,
  RippleButton,
} from "./shared";
import "./style.css";
import { translate } from "./lib/i18n";
const Report = lazy(() => import("./pages/Report")),
  MapPage = lazy(() => import("./pages/Map")),
  Alerts = lazy(() => import("./pages/Alerts"));
const tabs = [
  { path: "/", en: "Report", ur: "رپورٹ", Icon: Mic },
  { path: "/map", en: "Village map", ur: "نقشہ", Icon: Map },
  { path: "/alerts", en: "Alerts", ur: "الرٹس", Icon: Bell },
];
function Shell() {
  const { t } = useLang(),
    location = useLocation(),
    [online, S] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => S(navigator.onLine);
    addEventListener("online", update);
    addEventListener("offline", update);
    return () => {
      removeEventListener("online", update);
      removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  useEffect(() => {
    const ripple = (event: PointerEvent) => {
      if (matchMedia("(prefers-reduced-motion:reduce)").matches) return;
      const target =
        event.target instanceof Element
          ? event.target.closest("a,summary")
          : null;
      if (!(target instanceof HTMLElement)) return;
      const rect = target.getBoundingClientRect(),
        dot = document.createElement("span");
      dot.className = "ripple";
      dot.style.left = `${event.clientX - rect.left}px`;
      dot.style.top = `${event.clientY - rect.top}px`;
      target.appendChild(dot);
      dot.addEventListener("animationend", () => dot.remove(), { once: true });
      dot.addEventListener("animationcancel", () => dot.remove(), {
        once: true,
      });
    };
    document.addEventListener("pointerdown", ripple);
    return () => document.removeEventListener("pointerdown", ripple);
  }, []);
  const nav = tabs.map(({ path, en, ur: label, Icon }) => (
    <NavLink key={path} to={path} end={path === "/"}>
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span className="active-pill" layoutId="navigation" />
          )}
          <Icon size={19} />
          <span>{t(en, label)}</span>
        </>
      )}
    </NavLink>
  ));
  return (
    <>
      <AuroraBackground />

      <div className="app" data-view={location.pathname}>
        <DisclaimerBar />
        <header>
          <Link className="brand" to="/">
            <Logo />
            <div>
              <strong>{t("Sehat Sipahi", "صحت سپاہی")}</strong>
              <small className="brand-tagline">
                {t("Community health · Pakistan", "کمیونٹی صحت · پاکستان")}
              </small>
            </div>
          </Link>
          <nav className="desktop-nav">{nav}</nav>
          <div className="header-tools">
            <span className="connection">
              {online ? <Wifi size={16} /> : <WifiOff size={16} />}
              <span>
                {online ? t("Online", "آن لائن") : t("Offline", "آف لائن")}
              </span>
            </span>
            <LanguageToggle />
          </div>
        </header>
        <main className={location.pathname === "/map" ? "main-map" : ""}>
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.24 }}
            >
              <Suspense fallback={<Skeleton />}>
                <Routes location={location}>
                  <Route path="/" element={<Report />} />
                  <Route path="/map" element={<MapPage />} />
                  <Route path="/alerts" element={<Alerts />} />
                  <Route
                    path="/prescription"
                    element={<Navigate to="/" replace />}
                  />
                  <Route path="/lab" element={<Navigate to="/" replace />} />
                  <Route
                    path="*"
                    element={
                      <div className="empty">
                        <h1>
                          {t(
                            "This path is a little off the map.",
                            "یہ صفحہ موجود نہیں۔",
                          )}
                        </h1>
                        <Link to="/">
                          {t("Back to report", "رپورٹ پر واپس")}{" "}
                          <ArrowUpRight />
                        </Link>
                      </div>
                    }
                  />
                </Routes>
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
        <footer>
          <span>© Sehat Sipahi</span>
          <small>
            {t(
              "Community reporting · Human verification",
              "کمیونٹی رپورٹنگ · انسانی تصدیق",
            )}
          </small>
        </footer>
        <nav className="bottom-nav">{nav}</nav>
      </div>
    </>
  );
}
const Switch = createLanguageSwitch();
function createLanguageSwitch() {
  return React.createContext<() => void>(() => {});
}
function LanguageToggle() {
  const toggle = React.useContext(Switch),
    { ur } = useLang();
  return (
    <RippleButton
      className="language"
      onClick={toggle}
      aria-label="Switch language / زبان بدلیں"
    >
      <span className={ur ? "selected" : ""}>اردو</span>
      <span className={!ur ? "selected" : ""}>EN</span>
    </RippleButton>
  );
}
function App() {
  const [ur, S] = useState(() => {
    try {
      return localStorage.getItem("sehat-language") !== "en";
    } catch {
      return true;
    }
  });
  useEffect(() => {
    document.documentElement.lang = ur ? "ur" : "en";
    document.documentElement.dir = ur ? "rtl" : "ltr";
    try {
      localStorage.setItem("sehat-language", ur ? "ur" : "en");
    } catch {}
  }, [ur]);
  return (
    <MotionConfig reducedMotion="user">
      <Language.Provider
        value={{ ur, t: (en, urdu) => translate(en, urdu, ur ? "ur" : "en") }}
      >
        <Switch.Provider value={() => S(!ur)}>
          <ErrorBoundary>
            <DataProvider>
              <BrowserRouter>
                <Shell />
              </BrowserRouter>
            </DataProvider>
          </ErrorBoundary>
        </Switch.Provider>
      </Language.Provider>
    </MotionConfig>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
