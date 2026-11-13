# UI Buttons Catalog (youneslaaroussi/ui-buttons)

Source: https://github.com/youneslaaroussi/ui-buttons - MIT licensed, 100 pure-CSS button styles.
Live previews: https://ui-buttons.web.app/<slug> (slug given per entry below).

Fetch a specific style's source with:
`https://raw.githubusercontent.com/youneslaaroussi/ui-buttons/main/buttons/<folder-name>/index.html`
(folder names are numbered, e.g. `1-basic`, `10-inverted-triangles` - browse
`https://github.com/youneslaaroussi/ui-buttons/tree/main/buttons` for exact folder names before fetching.)

## Slide / Fill backgrounds
| Slug | Mechanism |
|---|---|
| slide-right | Background slides in from the left on hover/click |
| slide-down | Background slides down from the top |
| in-and-out | Background slides right, then further right on repeat interaction |
| bubble-right | Circular background slides in from the left |
| diagonal-swipe | Diagonal background sweeps across |
| double-horizontal / double-vertical / double-diagonal | Two backgrounds slide in from opposite sides to meet in the middle |
| cover-over | Background layer slides fully over then off |
| tilted-diagonal | Increasingly tilted diagonal sweep |
| enlarge | Radial fill from center + scale up |
| material-ripple | Radial fill from center, then fades (Material Design ripple) |

## 3D & tilt
| Slug | Mechanism |
|---|---|
| 3d-button-click / 3d-button-2 | Button presses down in 3D space on click |
| 3d-float | Large box-shadow, tilts down in 3D on hover |
| 3d-rotate-down/right/left | Rotates on the given axis via 3D transforms |
| fold-middle / fold-one-side | Folds like paper using 3D transforms |
| 3d-progress | Tilts in 3D to reveal a progress bar |

## Neumorphism / soft shadow
| Slug | Mechanism |
|---|---|
| neumorphism-1 to neumorphism-4 | Fluffy outer shadow moves to an inset/pressed shadow on interaction |

## Text & character effects
| Slug | Mechanism |
|---|---|
| letter-dance / letter-dance-2 / letter-dance-3 | Characters animate individually (slide, alternate, elastic) |
| text-slide | Duplicate text slides in vertically with a new color |
| rotate-reveal | New text rotates in from bottom-left |
| split-reveal (+ alternate/horizontal variants) | Text splits and reveals new content |
| slide-reveal (+ text-down variant) | New text slides in from the side |
| zoom-in-and-text-rotate | Zoom + text rotation combo |

## Border & outline
| Slug | Mechanism |
|---|---|
| focus-in | Border scales/focuses inward |
| border-snake | Border fills up sequentially, snake-like |
| snakes-alternate / snakes-meet / snakes-center | Border fills from different directions/points |
| neon | Border fills, then reveals a neon glow shadow |
| icon-focus | Border scales in around an icon |

## Attention / motion (animate.css-derived)
| Slug | Mechanism |
|---|---|
| pulse / i-want-attention | Continuous pulsing scale |
| tada / jello / rubberband / wobble / head-shake / heart-beat / flash | Classic animate.css motion presets applied to a button |

## Novelty / shape-morph
| Slug | Mechanism |
|---|---|
| shapeshifter / double-shapeshifter / x-shapeshifter | Border morphs into triangle(s) forming new shapes |
| gooey | Two circles merge with a gooey/slimy liquid effect |
| seizure-glitch | RGB channel-split glitch (use sparingly - can trigger photosensitivity; avoid rapid flashing for accessibility-sensitive contexts) |
| handdrawn-1 / handdrawn-2 | Hand-drawn-style wavy borders |
| alternate-blocks / quadruple-corners | Geometric blocks/corners converge to center |

## Progress-style
| Slug | Mechanism |
|---|---|
| progress-fill-right / progress-fill-up | Background fills like a loading bar |
| progress-shrink-vertical | Button shrinks into a progress bar |
| elastic-progress | Elastic/springy shrink into a progress bar |
| progress-fold | Paper-fold reveal of a progress bar |
| circular-charge | Circular border clips and fills, then fills the whole background |

## Misc
| Slug | Mechanism |
|---|---|
| basic | Simple color change on hover/click |
| glow-button | Moving, glowing border |
| striped-zebra | Scrolling striped background |
| backdrop-blur | Blur overlay on interaction |
| offset | Background resets/snaps back into place |
| icon-pulse / icon-slide / icon-zoom | Icon-focused hover interactions |
| pill-shrink / pill-halo | Pill-shaped scale/focus effects |
| rainbow-fill | Rainbow gradient fill inside a rainbow gradient border |
| sandwish | Stacked shadows move up successively |
| slicer / slicer-and-marquee | Background slices in half, optional vertical text cycling |
| marquee-sign | Text copies move horizontally at an angle |
| don't-cross-the-line | Crossing lines expand on interaction |
| overfold | Corner peels from bottom-right to top-left |
| rush-triangle | Triangular background rushes in |
| double-triangle / inverted-triangles | Triangle shapes slide to meet in the center |
| arrow-slide-+-text-rotate / bubble-up-+-text-rotate | Combined background motion + text rotation |
| line-slide | Underline slides in |
