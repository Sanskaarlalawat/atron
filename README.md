# ATCON website

A static marketing site — plain HTML, CSS and vanilla JS. No build step, no
dependencies, no framework.

## Structure

```
index.html          Home: hero, problem, positioning, services, process,
                    differentiators, stats, case stack, testimonials, CTA
insights.html       Article listing
careers.html        Culture + open roles
contact.html        Contact form and details
assets/css/styles.css
assets/js/main.js   Mobile nav, scroll reveal, case stack, testimonials,
                    stat counters,
                    hero video, form handler
assets/video/hero.mp4       Looping hero clip (audio stripped, 1.3 MB)
assets/img/hero-poster.jpg  First frame, used as the video poster
```

## Hero video

`index.html` plays `assets/video/hero.mp4` as a muted, looping, inline
autoplay background — the attributes browsers require to autoplay without a
user gesture. It was re-encoded from the source with:

```bash
ffmpeg -i source.mp4 -an -c:v libx264 -crf 24 -preset slow -movflags +faststart -pix_fmt yuv420p assets/video/hero.mp4
```

Above 1024px the hero is a full-page section — `min-height: calc(100svh - 74px)`
(74px being the header) so the hero and header together fill the viewport and the
logo strip below starts just off the fold. The clip is a full-bleed layer inside
it: absolutely positioned, inset 18% from the left, running to the top, right and
bottom edges with no frame, and the copy is overlaid on the left. A left-to-right
gradient in `.hero-media::after` dissolves the clip into the background so the
headline stays legible over it.
The hero background (`--hero-bg: #f8f8fa`) is sampled from the clip's own
background colour — that match is what makes the bleed look seamless, so change
both together if you swap the video.

At 1024px and below the two stack: copy first, then the clip full-width at 16:9.
The clip is first in the DOM (so it can sit behind the copy on desktop), so the
stacked order is set with `order` on the flex container.

If `prefers-reduced-motion` is set, `main.js` pauses it and the poster frame
shows instead. To swap the clip, replace both files and keep the same names.

## Case stack

The `#work` section is six slides that stack, modelled on
<https://www.s0animation.com/design>. Each slide rises from below, pins, and the
next one scrolls up and takes the position it held — the previous slide is never
pushed away, it is covered.

The stacking is pure CSS and rests on three things:

```css
.sl { position: sticky; top: 74px; height: calc(100vh - 74px); background: var(--cs-bg); }
```

- All six slides are **siblings in one container** (`.slides`). Sticky elements
  only stay put within their own containing block, so wrapping each slide in its
  own div would make each unpin at its wrapper's edge and break the stack.
- They share the **same `top`**, which is what makes slide N+1 land exactly where
  slide N sat rather than beside it.
- Each has an **opaque background**. A transparent slide would let the one
  underneath show through instead of replacing it.

Once slide 1 pins it stays pinned for the whole section; slides 2–6 simply paint
over it in DOM order.

`main.js` adds only depth on top of that. For each slide it computes `entered`
(how far it has climbed into view) and `covered` (how far the next slide has
risen over it), then lifts and slightly shrinks `[data-slide-inner]` as it is
covered, and settles the incoming slide's content up into place. Note that
opacity is keyed to `covered` alone and never to `entered`: fading in on entry
would leave every slide at `opacity: 0` until a scroll event arrived, so a
throttled or missed listener — a background tab, for instance — would hide the
whole section. Under `prefers-reduced-motion` the listener is never bound and the
slides unpin into plain stacked sections.

### Slide design

Each slide is composed inside an inset hairline rectangle (`.sl-box`) with the
`Case 0N` label above it and four registration ticks — a vertical mark centred in
the gap above and below the box, and a horizontal mark at half height in the gap
either side. The side ticks live on `.sl`, not `.sl-box`: the box sets
`overflow: hidden` to crop the device, which would clip its own pseudo-elements.

There are two layouts. `.sl--split` (cases 1, 3, 5) puts a phone beside the copy;
`.sl--wide` (cases 2, 4, 6) centres the copy at the top with a laptop below it,
cropped by the frame. Note the alternation selector: the split slides are #1, #3
and #5 — all odd — so `:nth-of-type(even)` matches none of them and every split
slide comes out on the same side. The sides alternate via
`.sl--split:nth-of-type(4n + 3)` instead.

The copy is centred in its half — a quiet row of partner marks with the client
emphasised in the case's accent, the headline in `--font` (the same stack as
every other heading on the site), letterspaced tags, then an outlined pill.

### Devices and their entrances

The mockups are real 3D, not tilted rectangles. Both sit on a shared stage —
`.sl-art` supplies `perspective`, `.dev` carries `transform-style: preserve-3d`
— and both settle at a three-quarter angle rather than flat.

Both are drawn as **line art**, matching the reference mockups: white bodies with
a thin outer stroke and a faint inner rim, no metallic fills or heavy shadows.
All the colour belongs to the screen — the shell is a contour drawing. If you
reach for a gradient on a device body, that is the thing to resist.

**iPhone** (`.iph`): white shell, home indicator, outlined side buttons, and a
genuine side wall — `.iph-edge` is a panel hinged on the body's edge and swung
back 90deg, so it is really there rather than painted on. Both walls are built:
slides that mirror the pose (positive `--ry1`) show the left one, and building
only the right would leave those phones looking flat.

**MacBook** (`.mb`): the lid stands up and `.mb-deck` lies back from its bottom
edge on a single `rotateX(74deg)`, carrying the key grid and trackpad. That one
rotation is what makes it read as a laptop rather than a picture of one.

The deck is absolutely positioned, so it adds no layout height. Centring would
centre the lid alone and push the deck out of the crop, so `.sl--wide .dev`
reserves its projected height as **padding** — a margin on `.mb` would collapse
straight out of `.dev`, and padding on `.mb` would move the deck, whose
`top: 100%` resolves against the padding box. Both that reservation and the
laptop's width read `--mbw`, so they cannot drift apart.

`main.js` writes `--enter` (0→1, eased) onto each slide as it climbs into view.
One rule on `.dev` turns that into six different arrivals, because each slide
declares its own start and settle values inline:

```html
<article class="sl sl--split ac-blue" style="--r0:-11;--r1:-4;--ry0:-40;--ry1:-19;--ty0:46px;--sc0:.92">
```

### Screen content scales with the device

`.iph-screen` is a **container** (`container-type: inline-size`) and the screens
inside set their base type in `cqw`, with everything else in `em` off that base.
This matters because the device width is fluid (`clamp(270px, 24vw, 380px)`)
while `rem` and `px` are not — fixed sizes look right at one viewport and drift
at every other, and the drift only shows up when you inspect the mockup large.
Size new screen elements in `em`, not `rem`.

All three phone screens are built to the same level of finish:

- **`.scr--intro`** (case 01) — a scene, not a backdrop. Three cards cascade down
  a tinted mesh and carry the case's own story: a document under review, an
  "Identity verified" check, then the outcome. The ground darkens toward the foot
  so the copy over it stays legible; Skip and progress dots sit at the top, the
  accent action at the bottom.
- **`.scr--chat`** (case 03) — segmented control, mascot, italic greeting over a
  bold question, floating emoji chips, raised input bar with a drawn mic. The
  mascot is inline SVG using `var(--ac)`, so it recolours per case for free.
- **`.scr--stats`** (case 05) — back chevron and title, a tinted hero figure with
  its delta, a charted card with a day axis, an activity list, and a tab bar.

Every accent on all three comes from `var(--ac)` via `color-mix`, so a new case
needs one class and nothing else.

Two things in the reference need real assets and are approximated here: the
avatar (a photograph) and the mascot (a rendered 3D character). Both are drop-in
replacements — an `<img>` in the same slot — and neither affects layout.

`--ry0/--ry1` are the y-rotation from and to, `--rx0/--rx1` the x-rotation,
`--r0/--r1` the flat z-rotation, `--ty0` the starting offset and `--sc0` the
starting scale. `--ty0` is `86vh` — the device starts a full frame-height away
and travels in, negative from above and positive from below. It is in `vh` so
the throw always clears the frame whatever the viewport; a small px nudge reads
as a twitch rather than an entrance. A `--r0` that
is negative and settles toward zero reads as a clockwise turn.

The six arrivals as set:

| Case | Device | Arrives |
|---|---|---|
| 1 | phone  | drops from above, turning as it comes |
| 2 | laptop | rises from below, rotating clockwise |
| 3 | phone  | rises from below, only a slight turn |
| 4 | laptop | rises from below, slight rotation |
| 5 | phone  | drops from above, same as case 1 |
| 6 | laptop | rises from below |

**Where the arrival is mapped matters.** The device sits in the middle of its
slide, so it only clears the bottom of the viewport around halfway through the
slide's travel from `vh` to the pinned `74px`. The arrival is therefore mapped to
`(entered - 0.45) / 0.55` — it starts as the device becomes visible and finishes
exactly as the slide pins. An earlier window (the first version used
`(entered - 0.12) / 0.66`) plays the first half off-screen and is over before the
slide settles, so every slide looks static by the time you are looking at it.

`main.js` also repaints on `visibilitychange`. Browsers suspend `requestAnimationFrame`
in a background tab, so a page scrolled or restored while hidden keeps whatever
`--enter` it was left with, and the copy would still be faded out on return.

The copy arrives on the same value. Each child of `.sl-copy` reads a shifted,
renormalised slice of `--enter`
(`clamp(0, calc((var(--enter) - var(--d) * .07) / .66), 1)`), so the client
marks, headline, tags and button cascade in that order. Doing it this way rather
than with transitions means the text cannot drift out of step with the device or
the scroll — scrub backwards and it reverses with everything else. The settle
values are deliberately non-zero — that resting angle is what keeps the devices
reading as objects. `--enter` defaults to `1`, so with no JS every device sits
finished and still.

## Testimonials

A profile list on the left drives an isometric row of five cards on the right.
Each card owns a **fixed slot** (`--k`, set in the HTML and never rewritten), and
picking a profile lifts that card straight up out of its own slot. The row never
reorders — pick the fourth name and the fourth card rises, back in the row where
it sits, not at the front.

Two things are load-bearing:

**The projection is orthographic — there is no `perspective`.** In the reference
the slab at the back is exactly the same size as the one at the front; adding
perspective shrinks the far ones and converges their edges, which makes the row
read as photographed rather than drafted. With `perspective` removed, CSS 3D
collapses to a parallel projection. `translateZ` still displaces each card,
because it is applied *inside* the rotated frame — along the card's own Z axis,
not the view axis. Measured: nearest and farthest cards are both 386px wide.

**`rotateX` is negative, and that is what puts the extrusion up-and-right.** The
sign decides which two side faces you see. With `rotateX(-38deg) rotateY(-26deg)`
the card's -Z projects to roughly `(+44, -55)` on screen — right and up — so the
**top** and **right** faces show, as in the reference. Flip `rotateX` positive
and you get the bottom face instead and the row falls the wrong way.

**The waiting slabs draw their back face too.** That is what makes them
see-through wireframes rather than solid-fronted boxes: `.tm-edge--back` sits at
`translateZ(-var(--thick))`, and every face on a non-selected card is stroked
with no fill. The solid, lifted card hides its back, left and bottom faces
instead. An earlier attempt at this used `backface-visibility: visible` on every
face and blanked the compositor entirely — drawing an explicit back face is the
version that works.

**The stack is flat, not `preserve-3d`.** Each card carries the isometric
rotation itself, so the cards composite by `z-index`. Under `preserve-3d`
siblings sort by real depth and `z-index` is ignored, which drew the lifted card
*behind* the slabs sitting in front of its slot.

The chosen card gets a one-shot `tm-rise` keyframe rather than the transition, so
it comes up from below its slot instead of sliding from wherever it was.
Restarting it needs the `void card.offsetWidth` reflow, or the class goes back on
in the same frame and the animation never replays.

Cards waiting in the row are empty outlines with both side walls built
(`.tm-edge--side` / `--side2`), so a slab never looks flat whichever way the pose
leans. Avatars and the card's portrait panel are monograms tinted from the
client's accent — the slot a real photograph drops into.

## Running it

Open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 8057
```

Then visit http://localhost:8057. (`.claude/launch.json` starts the same server
for the in-editor preview. It uses 8057 rather than 8000 only because browsers
cache `styles.css` aggressively on an origin you have already loaded — if edits
stop showing up, bump the port.)

## Notes

- Copy, case studies, client logos and article titles are placeholders written
  for this build — replace them with the real material.
- The contact form has no backend. `assets/js/main.js` intercepts the submit and
  shows a message; point it at a form endpoint (Formspree, a serverless
  function, your own API) when one exists.
- Colours, spacing and the type scale are CSS custom properties at the top of
  `styles.css`.
- The header logo is a CSS gradient square; swap it for a real logo image when
  available.
