// 画面の下に固定する再生バー。シークバーには原曲の波形とカバーの音の多さを重ねて描く。
// 原曲 / 採譜 MIDI / カバー の 3 つを別々の音量で重ねて聴き比べられる。
// 携帯では 3 本を並べると場所を取りすぎるので、アイコンを押して開くパネルに入れる
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { useT } from "../i18n";
import { formatTime } from "../params";
import { DEFAULT_VOLUME, TRACKS, type Player, type TrackName } from "../player";
import { Icon } from "./Icon";

type Props = { player: Player; title: string; subtitle: string };

export function usePlayerState(player: Player) {
  useSyncExternalStore(player.subscribe, player.getVersion);
  return player;
}

export function PlayerBar({ player, title, subtitle }: Props) {
  usePlayerState(player);
  const t = useT();
  const timeRef = useRef<HTMLSpanElement>(null);
  const [mixOpen, setMixOpen] = useState(false);
  const mixRef = useRef<HTMLDivElement>(null);

  // 開いている間は、外を押すか Esc で閉じる
  useEffect(() => {
    if (!mixOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!mixRef.current?.contains(e.target as Node)) setMixOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMixOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [mixOpen]);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (timeRef.current) timeRef.current.textContent = formatTime(player.position());
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [player]);

  const trackLabel: Record<TrackName, string> = {
    original: t.original,
    transcribed: t.transcribed,
    cover: t.cover,
  };
  const pianoNote =
    player.pianoState === "loading"
      ? t.pianoLoading(Math.round(player.pianoProgress * 100))
      : player.pianoState === "fallback"
        ? t.pianoFallback
        : null;

  return (
    <footer className="player">
      <div className="player-info">
        <div className="player-title">{title}</div>
        <div className="player-sub">{pianoNote ?? subtitle}</div>
      </div>
      <div className="player-main">
        <div className="player-controls">
          <button className="icon-btn" onClick={() => player.seek(player.position() - 5)} title={t.back5}>
            <Icon name="back" />
          </button>
          <button className="play-btn" onClick={() => player.toggle()} title={t.playPause}>
            <Icon name={player.playing ? "pause" : "play"} />
          </button>
          <button className="icon-btn" onClick={() => player.seek(player.position() + 5)} title={t.forward5}>
            <Icon name="forward" />
          </button>
          <button
            className={`icon-btn ${player.loopOn ? "on" : ""}`}
            onClick={() => player.toggleLoop()}
            disabled={!player.loop}
            title={t.loopHelp}
          >
            <Icon name="loop" />
          </button>
        </div>
        <div className="player-seek">
          <span className="mono" ref={timeRef}>
            0:00
          </span>
          <Overview player={player} />
          <span className="mono">{formatTime(player.duration)}</span>
        </div>
      </div>
      <div className={`player-mix ${mixOpen ? "open" : ""}`} ref={mixRef}>
        <div className="player-tracks">
          <TrackVolumes player={player} label={trackLabel} />
        </div>
        {/* 携帯だけに出る。押すと上のパネルが開く */}
        <button
          className={`icon-btn mix-btn ${mixOpen ? "on" : ""}`}
          onClick={() => setMixOpen(!mixOpen)}
          aria-expanded={mixOpen}
          aria-label={t.mixerHelp}
          title={t.mixerHelp}
        >
          <Icon name="mixer" />
        </button>
        <div className="mixer-pop" role="dialog" aria-label={t.mixerHelp}>
          <div className="mixer-title">{t.mixer}</div>
          <TrackVolumes player={player} label={trackLabel} />
        </div>
      </div>
    </footer>
  );
}

/** 3 つの音量つまみ。広い画面では再生バーに、携帯ではアイコンで開くパネルに入る */
function TrackVolumes({ player, label }: { player: Player; label: Record<TrackName, string> }) {
  const t = useT();
  return (
    <>
      {TRACKS.map((track) => {
        const volume = player.volumes[track];
        return (
          <label key={track} className={`player-track ${player.has(track) ? "" : "off"}`}>
            <span>{label[track]}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              style={{ "--fill": `${Math.round(volume * 100)}%` } as CSSProperties}
              onChange={(e) => player.setVolume(track, Number(e.target.value))}
              onDoubleClick={() => player.setVolume(track, DEFAULT_VOLUME[track])}
              aria-label={t.trackVolume(label[track])}
              title={t.trackVolumeHelp}
            />
          </label>
        );
      })}
    </>
  );
}

function Overview({ player }: { player: Player }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragging = useRef(false);
  usePlayerState(player);

  // 原曲の波形のピーク (横 600 区間)
  const peaks = useMemo(() => {
    const buffer = player.original;
    if (!buffer) return null;
    const data = buffer.getChannelData(0);
    const bins = 600;
    const out = new Float32Array(bins);
    const step = Math.max(1, Math.floor(data.length / bins));
    for (let i = 0; i < bins; i++) {
      let m = 0;
      const start = i * step;
      for (let j = start; j < Math.min(start + step, data.length); j += 16) m = Math.max(m, Math.abs(data[j]));
      out[i] = m;
    }
    return out;
  }, [player.original]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr);
      if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const style = getComputedStyle(canvas);
      const duration = player.duration || 1;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = style.getPropertyValue("--seek-bg");
      ctx.fillRect(0, 0, w, h);
      if (peaks && player.original) {
        ctx.fillStyle = style.getPropertyValue("--seek-wave");
        const scale = player.original.duration / duration;
        for (let i = 0; i < peaks.length; i++) {
          const x = (i / peaks.length) * w * scale;
          const ph = Math.max(1, peaks[i] * h * 0.9);
          ctx.fillRect(x, (h - ph) / 2, Math.max(1, (w * scale) / peaks.length - 0.5), ph);
        }
      }
      // カバーの音の多さ (1 秒ごと)
      const notes = player.notes;
      if (notes.length) {
        const bins = Math.max(1, Math.ceil(duration));
        const counts = new Uint16Array(bins);
        for (const n of notes) counts[Math.min(bins - 1, Math.floor(n[0]))]++;
        let max = 1;
        for (const c of counts) max = Math.max(max, c);
        ctx.fillStyle = style.getPropertyValue("--accent");
        ctx.globalAlpha = 0.75;
        for (let i = 0; i < bins; i++) {
          if (!counts[i]) continue;
          const ch = (counts[i] / max) * (h * 0.45);
          ctx.fillRect((i / duration) * w, h - ch, Math.max(1, w / duration - 0.5), ch);
        }
        ctx.globalAlpha = 1;
      }
      if (player.loop) {
        ctx.fillStyle = style.getPropertyValue("--loop");
        const [a, b] = player.loop;
        ctx.fillRect((a / duration) * w, 0, ((b - a) / duration) * w, h);
      }
      const x = (player.position() / duration) * w;
      ctx.fillStyle = style.getPropertyValue("--playhead");
      ctx.fillRect(x - 1, 0, 2, h);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [player, peaks]);

  const seekAt = (clientX: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    player.seek(((clientX - rect.left) / rect.width) * player.duration);
  };

  return (
    <canvas
      ref={canvasRef}
      className="overview"
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        dragging.current = true;
        seekAt(e.clientX);
      }}
      onPointerMove={(e) => dragging.current && seekAt(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
    />
  );
}
