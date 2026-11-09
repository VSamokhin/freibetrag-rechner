# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and versions follow `major.minor.build`, where the build part is derived from the git history
(see "Versioning" in README.md). Sections are kept per minor version.

## [Unreleased]

## [0.3.0] - 2026-11-09

### Added

- Account holders in joint mode (SOA-33): two name fields (default "Person 1" and "Person 2") appear when
  switching to joint and can be renamed at any time. A new institution is assigned to the holder picked next to
  its name, each institution card shows its holder and can be moved to the other one, and the results list is
  grouped by holder with a subtotal each; the overall total is unchanged. Renaming a holder updates every place
  the name appears. Older saves load with every institution assigned to the first holder.
- The app is hosted on GitHub Pages at https://vsamokhin.github.io/freibetrag-rechner/ (SOA-25), deployed only
  from published releases; Release Drafter keeps the next release as a draft.

### Fixed

- Scrolling no longer moves sliders by accident: a vertical swipe that starts on a slider scrolls the page and
  leaves the amount unchanged. A slider follows only a sideways drag, and a tap on its track jumps there when the
  finger is lifted in place.
- Reset amounts, Delete this year, removing a bank with an amount and scaling down when switching to Single
  ask in the app's own dialog instead of the browser's confirmation popup, which embedded pages such as previews
  block silently, so the buttons seemed to do nothing.

## [0.2.0] - 2026-11-09

### Added

- German translation of the whole interface (SOA-27). The app starts in German when the browser prefers German,
  in English otherwise; an EN/DE switch in the header changes it, and the choice is remembered on the device.

### Fixed

- Narrow phones (320 px): the amount row no longer pushes cards wider than the screen, the "max" label wraps
  instead of being cut off, and four-digit amounts fit the number field.

## [0.1.0] - 2026-11-09

### Changed

- The version is derived from the git history: base in `package.json` plus first-parent commits since it changed.

### Added

- Split the Sparerpauschbetrag across banks and brokers: 1.000 € (single) or 2.000 € (joint, shared).
- Add, rename and remove institutions; each gets a slider (10 € steps), −/+ buttons (1 € steps,
  hold to repeat), a number field and a "+ rest" button. No institution can exceed the free balance.
- Prominent free balance with progress bar.
- Results list of non-zero Freistellungsaufträge with total.
- Separate save per year; a new year can start as a copy of the most recent earlier year or empty.
- Offline support and Android installation as a Progressive Web App.
- App version shown in the footer.

[Unreleased]: https://github.com/VSamokhin/freibetrag-rechner/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/VSamokhin/freibetrag-rechner/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/VSamokhin/freibetrag-rechner/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/VSamokhin/freibetrag-rechner/releases/tag/v0.1.0
