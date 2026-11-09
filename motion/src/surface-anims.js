// The surface loops (see surface.js). Both start and end on the built-in icon's pose, so they can follow /
// precede any other loop. Main motion is keyframed; everything that trails it (flukes lagging the stock,
// the stock bending, settling) is a damped spring, so the parts never move in lockstep.
// References: a southern right whale's fluke-up dive (Wikimedia Commons, Edith Schreurs, CC BY-SA 2.0)
// and Google's animated spouting-whale emoji (Noto Emoji Animation, CC BY 4.0).

const SF_DEFS = {
  // 举尾下潜 — takes a breath, rolls the tail up out of the water (water streaming off the flukes), turns
  // it to the light for a moment, slides straight down (notch first, the two tips slip in one after the
  // other), leaves a smooth patch and a couple of bubbles, then rises quietly back into place.
  fluke: {
    period: 4.3,
    track: [SF_TIP_L, SF_TIP_R, SF_NOTCH],
    drive(t, p, c) {
      const R = RIG_MODEL.rest;
      const dip = sfBump(t, 0.3, 0.78);
      const rise = sfEaseInOut(sfSeg(t, 0.55, 1.45));
      const sink = sfSmooth(sfSeg(t, 1.95, 3.1));
      const back = sfEaseOut3(sfSeg(t, 3.3, 4.1));
      const hold = sfEnv(t, 1.4, 2.05, 0.2);
      let ty;
      if (t < 1.95) ty = 0.45 * dip - 2.3 * rise - 0.12 * Math.sin(SF_TAU * 0.8 * (t - 1.4)) * hold;
      else if (t < 3.3) ty = sfLerp(-2.3, 14.4, sink);
      else ty = 14.4 * (1 - back);
      p.ty = ty;
      // rolls up leaning toward us, straightens and opens to face us at the top; leans back in on the way down
      const lean = -0.26 * sfBump(t, 0.5, 1.3);
      const face = sfSmooth(sfSeg(t, 0.95, 1.65)) * (1 - sfSmooth(sfSeg(t, 2.1, 3.0)));
      const reLean = t >= 3.3 ? -0.2 * (1 - sfEaseOut3(sfSeg(t, 3.3, 4.0))) : 0;
      p.pitch = R.pitch + lean + 0.26 * face + 0.05 * sfBump(t, 2.0, 3.1) + reLean;
      p.yaw = R.yaw + 0.11 * Math.sin(Math.PI * sfSeg(t, 1.25, 2.5));
      // the flukes trail the stock: they droop while it rises, lift while it sinks, then settle with a wobble
      const v = c.vel('ty', ty);
      p.flexP = c.spring('flex', Math.max(-0.3, Math.min(0.3, (v < 0 ? 0.012 : 0.005) * v)), 2.4, 0.3);
      p.dihed = c.spring('dihed', 0.1 * face - 0.12 * sfBump(t, 0.5, 0.9) - 0.16 * (t >= 3.3 ? 1 - sfSeg(t, 3.35, 3.9) : 0), 2.2, 0.32);
      // balancing at the top; tipped a little on the way in so one fluke tip lingers after the other
      p.asym = c.spring('asym', 0.05 * Math.sin(SF_TAU * 1.1 * (t - 1.4)) * hold + 0.1 * sfSeg(t, 2.35, 2.75) * (t < 3.3 ? 1 : 0), 2.6, 0.4);
      p.curl = 0.06 * Math.sin(SF_TAU * 0.9 * (t - 1.45)) * hold;
      p.rollT = R.rollT + c.spring('bend', -0.003 * v, 2.0, 0.4);
    },
    fx(t, fr, tail) {
      // water streaming off the flukes as they come out
      for (const [tt, idx] of [[0.98, SF_TIP_R], [1.04, SF_EDGE_R], [1.1, SF_TIP_L], [1.18, SF_NOTCH], [1.26, SF_EDGE_L],
        [1.34, SF_TIP_R], [1.45, SF_TIP_L], [1.6, SF_EDGE_R], [1.78, SF_TIP_R]]) {
        if (t < tt) continue;
        const q = tail(tt)[idx];
        if (q[1] < SF_WATER - 1) sfStreak(fr, t, tt, q[0], q[1] + 0.35, 0.8, 0.4);
      }
      // smooth patch where it went down, and two bubbles
      sfPrint(fr, t, 3.0, 1.2, 7.4, 3.2);
      sfBubble(fr, t, 3.12, 6.2, 0.48);
      sfBubble(fr, t, 3.34, 8.6, 0.36);
      // a few drops left behind as it comes back up (only those that land before the loop ends)
      for (const [tt, idx] of [[3.55, SF_EDGE_R], [3.62, SF_TIP_R], [3.7, SF_NOTCH], [3.78, SF_TIP_R]]) {
        if (t < tt) continue;
        const q = tail(tt)[idx];
        if (q[1] < SF_WATER - 1) sfStreak(fr, t, tt, q[0], q[1] + 0.35, 0.55, 0.3, 4.22);
      }
    },
  },

  // 喷水 — dives out of the way, the top of the head breaks the surface, the whale blows (the blow of
  // Google's animated spouting-whale emoji, drawn as solid water — noto-blow.js), the head sinks again and
  // the tail rises back into place. Kept sparse: one ring where things cross the water, and the blow.
  spout: {
    period: 4.2,
    track: [SF_NOTCH],
    tipFx: 'ring',
    collar: false,
    drive(t, p, c) {
      const R = RIG_MODEL.rest;
      const hop = sfBump(t, 0.28, 0.46);
      const dive = sfEaseIn(sfSeg(t, 0.42, 0.98));
      const back = sfEaseOut3(sfSeg(t, 3.15, 3.9));
      const ty = t < 3.15 ? -0.35 * hop + 14.4 * dive : 14.4 * (1 - back);
      p.ty = ty;
      p.pitch = R.pitch + (t < 3.15 ? 0.1 * dive : -0.2 * (1 - sfEaseOut3(sfSeg(t, 3.15, 3.85))));
      const v = c.vel('ty', ty);
      p.flexP = c.spring('flex', Math.max(-0.4, Math.min(0.4, 0.012 * v)) + 0.1 * hop, 2.4, 0.3);
      p.dihed = c.spring('dihed', 0.08 * hop - 0.22 * dive * (t < 3.15 ? 1 : 0) - 0.16 * (t >= 3.15 ? 1 - sfSeg(t, 3.2, 3.75) : 0), 2.2, 0.32);
      p.asym = c.spring('asym', 0.14 * sfSeg(t, 0.55, 0.8) * (t < 3.15 ? 1 : 0), 2.6, 0.4);
      p.rollT = R.rollT + c.spring('bend', -0.003 * v, 2.0, 0.4);
    },
    fx(t, fr) {
      // the head: the crown breaks the surface (with a small overshoot), squashes a touch as it blows,
      // rises on the in-breath and sinks away
      const HX = 7.6, R0 = 3.3;
      const height = (1.25 * sfBackOut(sfSeg(t, 1.36, 1.66), 1.6) - 0.16 * sfBump(t, 1.74, 1.92) + 0.14 * sfBump(t, 2.25, 2.6))
        * (1 - sfEaseIn(sfSeg(t, 2.55, 2.95)));
      if (t > 1.36 && t < 2.95 && height > 0.05) fr.shapes.push({ d: sfPoly(sfHump(HX, R0 - height, R0)) });
      sfRipple(fr, t, 1.38, 0.9, HX, 2.0, 6.5, 0.55, 0.18);
      sfRipple(fr, t, 2.8, 0.75, HX, 1.6, 5.5, 0.5, 0.2);
      // the water is hidden inside the head (it comes out of the blowhole) and under the surface
      const hole = height > 0.05 ? [HX, SF_WATER + R0 - height, R0] : null;
      sfNotoBlow(fr, t, 1.7, HX + 0.15, SF_WATER - 1.2, { scale: 0.034, lean: 0.06, clipY: SF_WATER, hole });
    },
  },
};
