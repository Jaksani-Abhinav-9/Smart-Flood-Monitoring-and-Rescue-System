## Additional Source: uiGradients

For a broader palette pool beyond the flood-rescue-specific values already in
this skill, pull from https://github.com/ghosh/uiGradients (MIT, 6k+ stars) -
a community-curated JSON list of named 2-3 color gradients.

- Raw data: `https://raw.githubusercontent.com/ghosh/uiGradients/master/gradients.json`
- Format per entry: `{ "name": "...", "colors": ["#hex1", "#hex2", ...] }`
- Fetch on demand and filter/adapt to the project's existing HSL palette rather
  than using an entry's colors verbatim - uiGradients skews toward vivid,
  high-saturation pairs that may not match a project's tone (e.g. dashboards
  wanting muted/professional gradients should still pull from this skill's own
  HSL system as the primary source).

Suggested pairing: use uiGradients for quick creative/marketing-facing
surfaces (banners, landing hero backgrounds); keep dashboards, data displays,
and safety/alert UI on the fixed semantic palette already defined above in
this skill (Deep Midnight / Electric Ocean / Emerald Safety / Crimson
Emergency / Amber Warning) so status colors stay consistent and predictable.
