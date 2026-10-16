"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { joinWaitlist } from "./actions";

const AREAS = ["Profesional", "Finanzas", "Salud", "Relaciones", "Personal", "Estilo de vida"];
const KEY = "fy-waitlist-v1";
const VID = "JFD6Yy8aqfI";
const START = 4101;
const FADE_IN_MS = 3000;
const FADE_OUT_MS = 1200;

type Joined = { name: string; pos: number };

type YTPlayer = { playVideo(): void; pauseVideo(): void; setVolume(v: number): void; seekTo(s: number, a: boolean): void; destroy(): void };
type YTNamespace = { Player: new (el: HTMLElement, opts: object) => YTPlayer };
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

function loadYouTubeApi(): Promise<YTNamespace> {
  return new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT!);
    };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(s);
    }
  });
}

function storage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function store(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {}
}

export default function Waitlist() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [area, setArea] = useState("Profesional");
  const [areaOpen, setAreaOpen] = useState(false);
  const [ent, setEnt] = useState("Sí");
  const [joined, setJoined] = useState<Joined | null>(null);
  const [err, setErr] = useState("");
  const [pending, setPending] = useState(false);
  const [sound, setSoundState] = useState(false);
  const [vol, setVol] = useState(35);
  const [eq, setEq] = useState<number[] | null>(null);

  const yt = useRef<YTPlayer | null>(null);
  const ytReady = useRef(false);
  const wantPlay = useRef(false);
  const volRef = useRef(vol);
  const curVol = useRef(0);
  const fadeRaf = useRef(0);
  const soundRef = useRef(sound);
  const cardRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLIFrameElement>(null);
  const heroRef = useRef<HTMLElement>(null);

  // Ramp the player's volume to `target` over `ms`, then run `done`.
  const fadeTo = useCallback((target: number, ms: number, done?: () => void) => {
    cancelAnimationFrame(fadeRaf.current);
    const from = curVol.current;
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      const eased = p * p * (3 - 2 * p);
      curVol.current = from + (target - from) * eased;
      yt.current?.setVolume(Math.round(curVol.current));
      if (p < 1) fadeRaf.current = requestAnimationFrame(step);
      else done?.();
    };
    fadeRaf.current = requestAnimationFrame(step);
  }, []);

  const startPlayback = useCallback(() => {
    if (!yt.current) return;
    curVol.current = 0;
    yt.current.setVolume(0);
    yt.current.playVideo();
    fadeTo(volRef.current, FADE_IN_MS);
  }, [fadeTo]);

  const setSound = useCallback((on: boolean) => {
    wantPlay.current = on;
    soundRef.current = on;
    if (ytReady.current && yt.current) {
      if (on) startPlayback();
      else fadeTo(0, FADE_OUT_MS, () => yt.current?.pauseVideo());
    }
    store("fy-sound", on ? "on" : "off");
    setSoundState(on);
    setEq(null);
  }, [fadeTo, startPlayback]);

  // Equalizer bars animate while music plays.
  useEffect(() => {
    if (!sound) return;
    const t = setInterval(() => setEq([0, 1, 2].map(() => 4 + Math.round(Math.random() * 9))), 300);
    return () => clearInterval(t);
  }, [sound]);

  // Restore saved state after hydration (localStorage is client-only).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const j = JSON.parse(storage(KEY) || "null");
      // Older local-only entries had no server position; ignore them.
      if (j && typeof j.pos === "number" && j.pos > 0) setJoined(j);
      else if (j) store(KEY, null);
    } catch {}
    const v = parseInt(storage("fy-vol") ?? "", 10);
    if (!isNaN(v)) {
      setVol(v);
      volRef.current = v;
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Background music: hidden YouTube player, started on first user gesture unless muted before.
  useEffect(() => {
    let cancelled = false;
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;left:-9999px;top:0;width:200px;height:200px;opacity:0;pointer-events:none";
    const slot = document.createElement("div");
    host.appendChild(slot);
    document.body.appendChild(host);

    loadYouTubeApi().then((YT) => {
      if (cancelled) return;
      yt.current = new YT.Player(slot, {
        width: 200,
        height: 200,
        videoId: VID,
        playerVars: { start: START, controls: 0, disablekb: 1, playsinline: 1, loop: 1, playlist: VID },
        events: {
          onReady: () => {
            ytReady.current = true;
            yt.current?.setVolume(0);
            if (wantPlay.current) startPlayback();
          },
          onStateChange: (e: { data: number }) => {
            if (e.data === 0) {
              yt.current?.seekTo(START, true);
              yt.current?.playVideo();
            }
          },
        },
      });
    });

    const firstGesture = (e: Event) => {
      document.removeEventListener("pointerdown", firstGesture, true);
      document.removeEventListener("keydown", firstGesture, true);
      const target = e.target as Element | null;
      if (target?.closest?.("[data-sound-toggle]")) return;
      if (storage("fy-sound") !== "off" && !soundRef.current) setSound(true);
    };
    document.addEventListener("pointerdown", firstGesture, true);
    document.addEventListener("keydown", firstGesture, true);

    return () => {
      cancelled = true;
      cancelAnimationFrame(fadeRaf.current);
      document.removeEventListener("pointerdown", firstGesture, true);
      document.removeEventListener("keydown", firstGesture, true);
      yt.current?.destroy();
      yt.current = null;
      ytReady.current = false;
      host.remove();
    };
  }, [setSound, startPlayback]);

  // Drive the avatar's scroll zoom from page scroll.
  useEffect(() => {
    const onScroll = () => {
      const fr = avatarRef.current;
      const hero = heroRef.current;
      if (!fr?.contentWindow || !hero) return;
      const r = hero.getBoundingClientRect();
      fr.contentWindow.postMessage({ avatarScroll: Math.min(1, Math.max(0, -r.top / r.height)) }, "*");
    };
    const fr = avatarRef.current;
    fr?.addEventListener("load", onScroll);
    window.addEventListener("scroll", onScroll, true);
    onScroll();
    return () => {
      fr?.removeEventListener("load", onScroll);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, []);

  const onVol = (v: number) => {
    setVol(v);
    volRef.current = v;
    // Slider wins over any fade in progress, but never unmutes a paused player.
    if (ytReady.current && soundRef.current) {
      cancelAnimationFrame(fadeRaf.current);
      curVol.current = v;
      yt.current?.setVolume(v);
    }
    store("fy-vol", String(v));
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return;
    if (!name.trim()) return setErr("Escribe tu nombre.");
    if (!/\S+@\S+\.\S+/.test(email)) return setErr("Revisa tu correo electrónico.");
    const website = String(new FormData(e.currentTarget).get("website") ?? "");
    setPending(true);
    try {
      const res = await joinWaitlist({ name, email, area, ent, website });
      if (!res.ok) return setErr(res.error);
      const j: Joined = { name: res.name, pos: res.pos };
      setJoined(j);
      store(KEY, JSON.stringify(j));
    } catch {
      setErr("No pudimos conectar. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setPending(false);
    }
  };

  const reset = () => {
    store(KEY, null);
    setJoined(null);
    setName("");
    setEmail("");
  };

  const cardMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--mx", x * 100 + "%");
    el.style.setProperty("--my", y * 100 + "%");
    el.style.setProperty("--ry", (x - 0.5) * 14 + "deg");
    el.style.setProperty("--rx", (0.5 - y) * 10 + "deg");
    el.style.setProperty("--glare", "1");
  };

  const cardLeave = () => {
    const el = cardRef.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    el.style.setProperty("--glare", "0");
  };

  const pos = joined ? joined.pos : 0;
  const firstName = joined ? joined.name.split(/\s+/)[0] : "";
  const soundLabel = sound ? "Silenciar música" : "Activar música";

  return (
    <>
      <div className="fy-nav">
        <a href="#top" className="fy-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/logo-v2.png" alt="" />
          FuturoYo
        </a>
        <div className="fy-sound" data-sound-toggle="1">
          <button className="fy-sound-btn" onClick={() => setSound(!sound)} aria-label={soundLabel} title={soundLabel}>
            {sound ? (
              (eq || [6, 10, 7]).map((h, i) => <span key={i} className="fy-eq" style={{ height: h }} />)
            ) : (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="#fff" style={{ marginLeft: 2 }}>
                <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z" />
              </svg>
            )}
          </button>
          <div className="fy-vol">
            <div className="fy-vol-track" />
            <div className="fy-vol-fill" style={{ width: vol + "%" }} />
            <div className="fy-vol-thumb" style={{ left: vol + "%" }} />
            <input
              type="range"
              min={0}
              max={100}
              value={vol}
              onChange={(e) => onVol(+e.target.value)}
              aria-label="Volumen"
            />
          </div>
        </div>
      </div>

      <section id="top" ref={heroRef} className="fy-hero">
        <div className="fy-hero-bg">
          <iframe
            ref={avatarRef}
            src="/assets/avatar-atardecer-scroll.html"
            title="FuturoYo al atardecer"
            tabIndex={-1}
          />
        </div>
        <div className="fy-hero-shade" />
        <div className="fy-hero-inner">
          <div className="fy-hero-copy">
            <h1>
              Tu yo de dentro de 10 años <em>ya conoce el camino.</em>
            </h1>
            <p className="fy-hero-lead">
              FuturoYo convierte a la persona que quieres ser en metas, hábitos y acciones para hoy. Entra a la lista y
              sé de los primeros en usarlo.
            </p>
            <div id="unete" className="fy-join">
              {!joined ? (
                <form className="fy-form" onSubmit={submit} noValidate>
                  <div className="fy-fields">
                    <div className="fy-field">
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#4a4f99" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="8" r="4" />
                        <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
                      </svg>
                      <input
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          setErr("");
                        }}
                        placeholder="Tu nombre"
                        aria-label="Nombre"
                        autoComplete="name"
                      />
                    </div>
                    <div className="fy-field">
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#4a4f99" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="5" width="18" height="14" rx="2" />
                        <path d="M3 7l9 6 9-6" />
                      </svg>
                      <input
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setErr("");
                        }}
                        type="email"
                        placeholder="Tu correo electrónico"
                        aria-label="Email"
                        autoComplete="email"
                        style={{ borderColor: err ? "rgba(255,140,140,.6)" : "rgba(150,180,255,.2)" }}
                      />
                    </div>
                  </div>
                  <div className="fy-row">
                    <div className="fy-area">
                      <button
                        type="button"
                        className="fy-area-btn"
                        onClick={() => setAreaOpen(!areaOpen)}
                        aria-haspopup="listbox"
                        aria-expanded={areaOpen}
                      >
                        <span className="lbl">Quiero mejorar:</span>
                        <span className="val">{area}</span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4a4f99" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: areaOpen ? "rotate(180deg)" : "none" }}>
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </button>
                      {areaOpen && (
                        <div role="listbox" className="fy-listbox">
                          {AREAS.map((l) => (
                            <button
                              key={l}
                              type="button"
                              role="option"
                              aria-selected={area === l}
                              className="fy-option"
                              onClick={() => {
                                setArea(l);
                                setAreaOpen(false);
                              }}
                            >
                              {l}
                              <span className="mark">{area === l ? "✓" : ""}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="fy-ent">
                      <span>¿Emprendes?</span>
                      <div className="fy-seg">
                        {["Sí", "No"].map((l) => (
                          <button key={l} type="button" aria-pressed={ent === l} onClick={() => setEnt(l)}>
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {err && <div className="fy-err" role="alert">{err}</div>}
                  <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="fy-hp" />
                  <button type="submit" className="fy-submit" disabled={pending} aria-busy={pending}>
                    {pending ? "Uniéndote…" : "Quiero unirme a la lista de espera"}
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </button>
                </form>
              ) : (
                <div className="fy-joined">
                  <div className="fy-joined-title">Ya estás dentro, {firstName}.</div>
                  <div ref={cardRef} className="fy-card" onMouseMove={cardMove} onMouseLeave={cardLeave}>
                    <div className="fy-card-fx fy-glare" />
                    <div className="fy-card-fx fy-sheen" />
                    <div className="fy-card-fx fy-streaks" />
                    <div className="fy-card-fx fy-orb-w" />
                    <div className="fy-card-fx fy-orb-b" />
                    <div className="fy-card-body">
                      <div className="fy-card-head">
                        <div className="fy-card-brand">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src="/assets/logo-v2.png" alt="" />
                          FuturoYo
                        </div>
                        <span className="fy-label">LISTA DE ESPERA</span>
                      </div>
                      <div className="fy-chip" />
                      <div className="fy-card-foot">
                        <div style={{ minWidth: 0 }}>
                          <div className="fy-label">MIEMBRO</div>
                          <div className="fy-member">{joined.name}</div>
                        </div>
                        <div style={{ textAlign: "right", flex: "none" }}>
                          <div className="fy-label">PUESTO</div>
                          <div className="fy-pos">#{pos.toLocaleString("es-MX")}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <button className="fy-reset" onClick={reset}>
                    No soy {firstName}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
