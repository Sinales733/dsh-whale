// Tool-row leading-icon animations (one per tool variant): each renderer returns SVG markup for a 16×16
// box at time t (seconds since the call started). Uses sfSeg (surface.js).
const f2 = (v) => Math.round(v * 100) / 100;
const g = (inner, extra = '') => `<g stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" ${extra}>${inner}</g>`;

const TOOL_ART = {
  // magnifier circling over the page, with a glint sweeping inside the lens
  search(t) {
    const cx = 6.6 + 1.3 * Math.cos(t * 2.6), cy = 6.6 + 1.3 * Math.sin(t * 2.6);
    const r = 3.5, a = t * 4.2;
    const hx = cx + r * 0.72, hy = cy + r * 0.72;
    const gx1 = cx + 2.1 * Math.cos(a), gy1 = cy + 2.1 * Math.sin(a);
    const gx2 = cx + 2.1 * Math.cos(a + 1.1), gy2 = cy + 2.1 * Math.sin(a + 1.1);
    return g(`<circle cx="${f2(cx)}" cy="${f2(cy)}" r="${r}"/>` +
      `<path d="M${f2(hx)} ${f2(hy)}L${f2(hx + 3)} ${f2(hy + 3)}"/>`) +
      g(`<path d="M${f2(gx1)} ${f2(gy1)}A2.1 2.1 0 0 1 ${f2(gx2)} ${f2(gy2)}"/>`, 'opacity="0.55" stroke-width="0.8"');
  },
  // a page whose lines light up as a scan bar passes
  read(t) {
    const k = (t * 0.85) % 1;
    const scan = 3.2 + k * 10.2;
    let lines = '';
    [5, 7.4, 9.8, 12.2].forEach((y, i) => {
      const lit = Math.exp(-(((y - scan) / 1.5) ** 2));
      lines += `<path d="M5.3 ${y}H${i === 3 ? 9.2 : 10.8}" opacity="${f2(0.35 + 0.65 * lit)}"/>`;
    });
    return g('<path d="M3.4 2.2h6.4l2.8 2.8v8.8a.8.8 0 0 1-.8.8H3.4a.8.8 0 0 1-.8-.8V3a.8.8 0 0 1 .8-.8z"/>') +
      g(lines, 'stroke-width="0.9"') +
      g(`<path d="M2.2 ${f2(scan)}H13.8"/>`, `opacity="${f2(0.7 * Math.sin(Math.PI * k))}" stroke-width="0.7"`);
  },
  // a prompt that types a command, character by character, with a blinking caret
  bash(t) {
    const k = (t * 0.7) % 1;
    const typed = Math.min(4, Math.floor(k * 6));
    let chars = '';
    for (let i = 0; i < typed; i++) chars += `<path d="M${f2(7.4 + i * 1.7)} 11.4h1"/>`;
    const caretX = 7.4 + typed * 1.7;
    const caret = Math.floor(t * 3) % 2 === 0 || typed < 4 ? `<path d="M${f2(caretX)} 6.8v4.6" stroke-width="1.3"/>` : '';
    return g('<path d="M2.6 4.8l3.4 3.2-3.4 3.2"/>' + chars + caret);
  },
  // a pencil gliding along, laying down a wavy stroke behind it
  write(t) {
    const k = (t * 0.6) % 1;
    const x = 2.5 + k * 9.5;
    const yAt = (xx) => 12.3 + 0.9 * Math.sin(xx * 1.4);
    let trail = `M2.5 ${f2(yAt(2.5))}`;
    for (let xx = 3; xx <= x; xx += 0.5) trail += `L${f2(xx)} ${f2(yAt(xx))}`;
    const tx = x, ty = yAt(x);
    const ang = -0.85 + 0.15 * Math.sin(t * 6);
    const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
    const P = (along, side) => `${f2(tx + dx * along + nx * side)} ${f2(ty + dy * along + ny * side)}`;
    const pencil = `M${P(0, 0)}L${P(2, -1)}L${P(8, -1)}L${P(8, 1)}L${P(2, 1)}Z M${P(2, -1)}L${P(2, 1)}`;
    return g(`<path d="${trail}"/>`, `opacity="${f2(1 - sfSeg(k, 0.85, 1))}"`) + g(`<path d="${pencil}" stroke-width="0.9"/>`);
  },
  // angle brackets breathing apart while the slash tips back and forth
  code(t) {
    const s = 0.9 * Math.sin(t * 3.2);
    const a = 0.25 * Math.sin(t * 3.2 + 1.2);
    const cx = 8, cy = 8, L = 4;
    const sx = Math.sin(0.35 + a) * L, sy = Math.cos(0.35 + a) * L;
    return g(`<path d="M${f2(5 - s)} 4.5L${f2(1.8 - s)} 8l${3.2} 3.5"/>` +
      `<path d="M${f2(11 + s)} 4.5L${f2(14.2 + s)} 8l-3.2 3.5"/>` +
      `<path d="M${f2(cx + sx)} ${f2(cy - sy)}L${f2(cx - sx)} ${f2(cy + sy)}"/>`);
  },
  // a four-point sparkle turning and pulsing, with satellites twinkling
  others(t) {
    const sc = 0.82 + 0.18 * Math.sin(t * 4);
    const rot = t * 70;
    const star = 'M8 1.8C8.6 6 10 7.4 14.2 8 10 8.6 8.6 10 8 14.2 7.4 10 6 8.6 1.8 8 6 7.4 7.4 6 8 1.8Z';
    const tw = (x, y, ph) => {
      const o = Math.max(0, Math.sin(t * 5 + ph));
      return `<path d="M${x - 1} ${y}h2M${x} ${y - 1}v2" opacity="${f2(o)}" stroke-width="0.8"/>`;
    };
    return g(`<path d="${star}" transform="rotate(${f2(rot)} 8 8) translate(8 8) scale(${f2(sc)}) translate(-8 -8)"/>`) +
      g(tw(13.2, 2.8, 0) + tw(2.8, 13.2, 2.1));
  },
};
TOOL_ART.edit = TOOL_ART.write;
