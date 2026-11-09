# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-11-09

### Added

- Split the Sparerpauschbetrag across banks and brokers: 1.000 € (single) or 2.000 € (joint, shared).
- Add, rename and remove institutions; each gets a slider (10 € steps), −/+ buttons (1 € steps,
  hold to repeat), a number field and a "+ rest" button. No institution can exceed the free balance.
- Prominent free balance with progress bar.
- Results list of non-zero Freistellungsaufträge with total.
- Separate save per year; a new year can start as a copy of the most recent earlier year or empty.
- Offline support and Android installation as a Progressive Web App.
- App version shown in the footer.

[Unreleased]: https://github.com/VSamokhin/freibetrag-rechner/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/VSamokhin/freibetrag-rechner/releases/tag/v0.1.0
