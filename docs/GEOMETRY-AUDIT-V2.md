# OPTIMIST LUDO 2.0 — repository geometry audit

Audit date: 2026-11-07  
Base: `main`  
Working branch: `geometry-v2-audit`  
Target: the approved three-board specification (Classic / Hexa / Royal)

## Executive result

The current repository is not yet an implementation of the approved 2.0 board set. It contains a working legacy Classic board plus the earlier PENTA and HEX radial-board implementation. Those extended boards cannot be relabelled as Hexa and Royal: their topology, route lengths, player counts and home-lane lengths differ.

No production geometry files were overwritten during this audit.

## Current repository state

| Area | Current implementation | Approved 2.0 target |
|---|---|---|
| Board IDs | `CLASSIC`, `PENTA`, `HEX` | `CLASSIC`, `HEXA`, `ROYAL` |
| Classic | 52 outer cells; 5 home cells | 52 outer cells; 5 home cells |
| PENTA | 5 players; 65 outer cells; 5 home cells | No PENTA mode |
| HEX | 6 players; 78 outer cells; 5 home cells | Hexa: 6 players; 72 outer cells; 6 home cells |
| Royal | Not implemented | 68 outer cells; 7 home cells |
| Coordinate export | SVG assets and runtime JS geometry | Canonical `Coordinates_Map.json` plus SVG and audit report |
| Engine progress | Legacy Classic and PENTA/HEX-specific step model | One documented `stepProgress` contract for all three boards |

Target movement metadata recorded in the approved specification:
- Classic: `maxOuterSteps=50`, `homePathLength=5`, `totalStepsToFinish=56`.
- Hexa: `maxOuterSteps=71`, `homePathLength=6`, `totalStepsToFinish=78`.
- Royal: `maxOuterSteps=66`, `homePathLength=7`, `totalStepsToFinish=74`.

## Findings

### G-01 — Extended board IDs and topology are obsolete

`src/extended-geometries.js` exports only `penta` and `hex`. It generates `sides * 13` route cells: 65 for PENTA and 78 for HEX. Each arm has a five-cell home lane. The approved Hexa and Royal geometries require different route counts and home-lane lengths.

**Impact:** a UI label change would leave the game rules, cell IDs, SVG coordinates and server validation inconsistent.

### G-02 — Server engine hard-codes the old board set

`src/game-geometries.js` exposes `CLASSIC`, `PENTA`, and `HEX`. `apps/backend/universal-engine.js` accepts only PENTA/HEX as extended modes and validates route metadata against the old geometry. The tests in `apps/backend/universal-engine.test.js` likewise cover only PENTA/HEX.

**Impact:** Hexa/Royal cannot be started or validated by the current authoritative server.

### G-03 — Existing geometry assertions are too narrow for the 2.0 contract

`assertExtendedGeometry` currently checks route-center uniqueness, route-center pitch, home-entry adjacency, base-slot containment in each triangle, and basic counts. It does not constitute the required full-board collision audit.

Missing checks include:
- square/tile footprint overlap, not only duplicate centers;
- track-to-home-lane, home-lane-to-home-lane and home-lane-to-finish intersections;
- base-slot and base-polygon collisions with route tiles and neighboring bases;
- central finish polygon/socket containment and overlap;
- consistent cell pitch and tile bounds across every generated board;
- coordinate-map/SVG/runtime-engine parity;
- route closure and the exact start, home-entry and finish semantics for each 2.0 board.

**Impact:** a center-point test can pass while visible cell rectangles or playable zones still overlap.

### G-04 — Existing tests certify the legacy topology, not the approved topology

`tests/extended-geometries.test.js` asserts 65/78 route cells and five home cells. Those assertions are valid for the old PENTA/HEX design but directly conflict with the new Hexa/Royal specification.

**Impact:** the current green test suite, by itself, cannot be treated as proof that the 2.0 boards are correct.

### G-05 — Royal has no geometry, assets or engine tests

There is no Royal geometry ID, no Royal coordinate map, no Royal SVG, and no Royal engine test coverage in the current tree.

**Impact:** Royal must be implemented as a new topology, not derived by renaming an existing file.

### G-06 — The progress-index contract needs an explicit boundary test

The approved movement metadata uses `maxOuterSteps` separately from `outerTrackLength`. In particular, Royal specifies 68 outer cells but `maxOuterSteps=66`. The implementation must preserve this distinction rather than silently assuming `maxOuterSteps === outerTrackLength - 1` for every board.

**Impact:** off-by-one errors can send a token into the wrong home-entry cell or finish one move too early/late. The generator and engine must share one explicit mapping from `stepProgress` to outer-route cell ID, home-lane cell ID and finished state.

## Required implementation sequence

1. Freeze the 2.0 geometry contract and board IDs in one canonical configuration.
2. Build a parameterized generator for Classic, Hexa and Royal.
3. Generate `Coordinates_Map.json` and SVGs from the same coordinate source.
4. Run geometric assertions on center points, cell footprints, polygons, zones and route adjacency.
5. Add independent expected-count and boundary tests for each board.
6. Update the shared game engine and server validation to use `stepProgress` as the sole progress value.
7. Regenerate assets and run the full existing test suite plus the new geometry and engine tests.
8. Only then switch the Mini App to the new board IDs/assets.

## Acceptance gates

A board is not accepted until all of the following are true:
- every route cell has a unique stable ID and coordinate;
- every required route transition is adjacent and the loop closes;
- no forbidden cell-footprint or zone collision exists;
- home lanes connect to their exact entry and finish destinations;
- all generated files derive from the same canonical coordinate map;
- SVG markers, JSON entries and engine cell lookups have identical counts and IDs;
- all three boards pass the same validation interface and board-specific expected-count tests.

## Scope of this audit

This document records source-level findings from the current repository. It does not claim that the 2.0 generator, coordinate map, new SVGs or engine migration have already been implemented.
