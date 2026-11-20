# Phase 12 — AETHER Command (proposal)

Status: **proposal for review.** Nothing here is implemented, and DESIGN.md is not changed
until this is agreed.

## Recommendation first

**Don't build a second hub. Grow the Observatory into Command.** AETHER already has most of
what this brief asks for, spread across three places that each work well:

| Brief asks for | Already exists | Where |
|----------------|----------------|-------|
| Navigator: systems, planets, destinations | The planisphere dial (the real system from the zenith), selecting worlds, *Explore* | Observatory, first view |
| Mission control: expeditions, objectives, progress | Expeditions with derived progress, objectives, places, records, replay | Expedition Journal |
| Celestial database | Planet records, archives by world and category (60 discoveries), orbital records, moons, events | Observatory: Worlds, Archives, Sky |
| Navigation to scenes | *Explore*, *Revisit*, galaxy travel, descents | Observatory, galaxy, `exploreDirector` |
| Exploration log | Discovery timeline with "new since last visit" | Observatory: Timeline |
| Contextual interface | The record changes with the selected world | Observatory: reading panel |

Building "AETHER Command" as a new dashboard would duplicate all of it, and the visitor
would need to learn which one to use. The brief itself says not to duplicate the
Observatory, the archives or the journal.

**So Command = the Observatory, extended**, with four genuinely new capabilities:

1. **Universe level** for the navigator (depends on Phase 11's map);
2. a **search** across everything known (the database);
3. **milestones** in the log;
4. **one contextual panel** that adapts to any kind of selection: system, world, moon,
   location, discovery, event, expedition.

The journal stays the journal; Command links into it rather than copying it.

## Navigation structure

```
Command (today's Observatory; key O)
├── Navigator   [first view]  — the dial; zoom out to the universe map (Phase 11)
│     selection → Contextual panel
├── Missions                   — opens the Expedition Journal (the same component), focused
│                                on the selected expedition; the journal stays reachable with J everywhere
├── Database                   — search + browse (worlds, moons, locations, discoveries,
│                                events, systems, story records)
└── Log                        — today's Timeline + milestones
```

- Section links as today ("Sky · Worlds · Discoveries · Timeline" becomes "Navigator ·
  Missions · Database · Log"). The scroll structure stays: one continuous page over the
  live scene, not tabs on a panel.
- **The contextual panel** replaces the fixed world record. It is one component with a
  layout per kind:
  - world: today's record + orbital record;
  - moon: period, size, eclipses coming;
  - location / discovery: archive entry + *Revisit*;
  - event: *Show on the dial*;
  - expedition: progress + *Open in journal*;
  - system: what is known + *Travel*.

  Every action calls an existing director (`exploreFromObservatory`, `revisitDiscovery`,
  `showEvent`, `replayStory`, and Phase 11's transit). No new navigation code paths.

## The new pieces

### Database (search)

- **An index built from existing data, not a new store:** `PLANETS`, `MOONS`,
  `LOCATIONS`, `DISCOVERIES`, expeditions and fragments, the current event solve and (after
  Phase 11) `SystemMeta`. About 120 entries today, so in-memory and recomputed when
  progress changes.
- **The visitor only finds what they have found.** Unfound discoveries appear under the
  same "Unidentified signal / object" names the surface uses; sealed expeditions and
  systems show only how they open. The rule from Phase 6 stays: search never spoils.
- **Interface:** one search field at the top of Database, and below it typed groups
  (Worlds, Moons, Places, Discoveries, Events, Records), each a hairline list in the
  archive style. Selecting a result puts it in the contextual panel and turns the dial to
  it. Keyboard: `/` focuses search, arrows move, Enter selects.

### Log (milestones)

Derived, like everything else, from timestamps that already exist:
- first landing per world (`visited`);
- every discovery (`discovered`);
- expedition opened and completed (`expeditionStates`);
- story records received (`story`);
- systems reached (after Phase 11).

Milestones such as "All six worlds visited" or "Expedition I complete" are computed
facts, not stored achievements. No badges or points, in keeping with the "no generic quest
UI" rule from Phase 8.

### Universe navigator

The Phase 11 universe map, entered by zooming the dial out. Until Phase 11 exists, the
navigator is simply today's dial.

## UI direction

- **No dashboard grammar:** no cards in a grid, KPI tiles, sidebars of icons or charts that
  restate a number. Command stays a page of type over the live sky, as the Observatory is.
- **Hierarchy through position, not chrome:**
  - the dial is the place;
  - the contextual panel is what you're looking at;
  - the sections below are the records.
- **One accent per meaning, as today:** ion for "now/live/selected", violet for
  "story/records", world accents only as dots.
- **Motion:** the dial turns to selections (it already does); panels cross-fade by kind.
  Nothing new to learn.

## Integration plan and order

| Step | Scope | Depends on |
|------|-------|------------|
| **12a — Contextual panel** | Generalise the Observatory record into one panel with per-kind layouts; worlds and events first | — (works on Elys today) |
| **12b — Database** | Search index + Database section + `/` shortcut | 12a |
| **12c — Log milestones** | Derived milestones in the Timeline | — |
| **12d — Missions link** | Section that opens the journal on the selected expedition | — |
| **12e — Universe navigator** | Dial zoom-out into the map | Phase 11b |
| 12f — Rename | "Observatory" → "Command" (or keep the name; see below) | All of the above |

12a–12d can be built before Phase 11 and are useful immediately. 12e waits for 11b.

## What gets reused vs. built

- **Reused as is:**
  - the dial and its camera (`GalaxyRig` observatory mode);
  - archives, the timeline and the Sky section;
  - JournalUI;
  - every director action;
  - all progress derivations (`state/progress.ts`, `state/expeditions.ts`, `state/sky.ts`);
  - persistence.
- **Generalised:** the reading panel becomes the contextual panel.
- **New:**
  - a search index (one pure module);
  - the Database section;
  - milestone derivation;
  - the map zoom (Phase 11).
- **Not built:** a separate Command screen, a second expedition view, a second archive.

## Decisions needed from you

1. **The name.** Keep "Observatory" (it fits the astronomical tone, and visitors already
   know it) or rename to "Command". My recommendation is to keep **Observatory** and use
   "Command" only if Phase 11 makes it a ship's bridge in the story.
2. **Should search also find things not yet discovered** (as unidentified entries) to hint
   at what remains, or only what has been found?
3. **Order.** Build 12a–12d before Phase 11 (they improve today's experience), or wait and
   do both together?
