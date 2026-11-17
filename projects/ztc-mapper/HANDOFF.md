# ZTC Pathway Mapper — handoff (v4.1.0, 2026-11-16)

For whoever works on this next, person or AI model. Read this before changing anything
that affects a score. `README.md` has the architecture and commands; this file has the
decisions, the rules that must not break, and the step-by-step for recurring work.

## 1. What this is, in one paragraph

The app shows college leadership how close each degree, certificate and transfer pathway
is to being completable with Zero Textbook Cost (ZTC) courses. Pathway requirements are
read from the official catalog (built in, one catalog per academic year). The only upload
is the ZTC course dataset from Informer. Everything runs in the browser. `ztc-mapper/` is
production (published to GitHub Pages on every push to `main`). `ztc-mapper-rs/` is an
experimental Rust twin that must give the same scores and is not published.

## 2. Rules the owner has decided (do not change without asking him)

| # | Rule | Where it lives |
|---|------|----------------|
| 1 | A course is Chaffey ZTC at **75%+ of sections**. "Already working, so do not change it." | `ZTC_THRESHOLDS`, `optionIsZtc` |
| 2 | Chancellor's Office ZTC (at least one section) is **reporting only**; it never counts toward a pathway. | `coZtc` fields |
| 3 | A pathway is **green only at 100%**, yellow 75–99%, red below 75%. "Needs attention" is below 75%. | `pathwayTone`, `PATHWAY_HIGH_MIN` |
| 4 | "N units from the following" = the **fewest courses that reach N units**. | `min_count_for_units` (reader) |
| 5 | A laboratory section that re-lists courses (Cal-GETC Area 5 C) is **its own requirement**. | `labRule` slots |
| 6 | A general-education placeholder row counts as **one requirement**, met by any ZTC course in the matching GE area. | `ge_pool` (reader) |
| 7 | Academic year is **Fall → Spring → Summer** (2026–27 = 2026/FA, 2027/SP, 2027/SU). | `academicYearTerms` |
| 8 | For a year, a course must be 75%+ in **every term it was offered**. Departments made section-level commitments per term and leadership tracks misses. | `yearRecord` |
| 9 | Show the year's survey completion; label the year **"In progress"** under **90%** or when a term is missing. | `yearStatus`, `ACADEMIC_YEAR_SURVEY_MIN` |
| 10 | Each academic year is scored against **its own catalog**. | `changeYear`, `ZTC_CATALOGS` |
| 11 | **Keep the unit check strict.** A section is verified only when the units read equal the units printed. No "printed range sits inside the computed range" loosening. | `units_match` |
| 12 | A person can sign off a section that does not match; the sign-off is tied to the exact catalog text. | `catalog/reviewed-sections.json` |

Decisions made by the previous AI session that the owner has **not** explicitly confirmed.
Raise them if they matter:

- "Required CSU only" (IGETC Area 1 Group C, 2023–25) is counted as a requirement.
- "Language Other Than English" as a GE row is listed and not scored.
- A sign-off covers another year's catalog when the section text is identical (same hash).
- When List B and List C both borrow left-over courses from List A, List B claims first.
- "ASTRON 27 OR ASTRON 27L" in Cal-GETC Area 5 is read as AND (lecture with its lab).
- The alternatives of an Either/Or entry inside an "Any N courses" list are one pick.
- A course printed both in a list and in the section that list borrows from counts once.
- Survey completion is rounded down (89.5% reads 89% and the year stays "In progress").
- A variable-unit course ("1.00 - 4.00") counts at its top value toward "N units from".

## 3. Invariants — a change that breaks one of these is wrong

1. **Never drop a catalog section silently.** If the reader cannot understand a section it
   lists the courses, scores nothing, and marks it unverified.
2. **The denominator comes from the catalog,** not from what was offered. A requirement
   whose courses were not offered or have no data is unmet.
3. **Production and the twin give identical scores.** Any scoring change is made in both,
   and `ztc-mapper-rs/fixtures/parity/production-scores.sample.json` is regenerated.
4. **Generated files are never edited by hand.** `data/catalog-<year>.js` and the
   reconciliation files come only from `scripts/build-catalog-structure.py`; CI rebuilds
   them byte for byte.
5. **A reader change must not reduce the number of verified sections in any year** unless
   the previous reading was wrong, in which case say so in the commit.
6. **No institutional data in the repository.** Only the synthetic sample dataset and
   synthetic fixtures. The real Informer export stays on the owner's machine.
7. **Agents never `git push` and never open or merge pull requests.** Commit locally only
   when asked. A push to `main` publishes the app.
8. **Only CSS classes already in `vendor/tailwind.min.css` work.** Use inline styles for
   anything else, or regenerate the CSS.
9. **Accessibility is WCAG 2.1 AA.** Status is always stated in words, never colour alone.
   Re-run `scripts/run-axe-v3.py` after any UI change (14 states, 0 violations).

## 4. How correctness is checked (three independent layers)

1. **Unit reconciliation** (in the reader): every section's parsed structure must add up to
   the units the catalog prints. Catches most misreads.
2. **Independent count** (`scripts/test-independent-count.js`): a second, simple reader
   counts requirements straight from the catalog text and must agree with the app. Covers
   about three quarters of pathways each year (150 of 201 in 2026–27). Catches misreads
   that still add up, but only in the requirement count: the 2026-11-16 review found
   five misreads it had passed over, all in the kinds of section it skips.
3. **Pinned pathways** (`test-catalog-structure.js`, `test-academic-year.js`, twin
   `golden.rs`): specific pathways and rules with expected values read from the catalog.

The remaining quarter of pathways (general-education patterns, "one from each area",
minimum-unit rules with conditions) rest on layers 1 and 3 only. Extending layer 2 to
them is the most valuable testing work left.

## 5. Recurring job: add a new catalog year (for example 2027–28)

1. Get the Markdown export of the catalog's Degrees and Certificates pages and save it as
   `catalog/Chaffey_Catalog_2027-2028_Degrees_and_Certificates.md`.
2. Build it:
   `python3 scripts/build-catalog-structure.py catalog/Chaffey_Catalog_2027-2028_Degrees_and_Certificates.md --catalog-year 2027-2028`
3. Read the printed summary and `data/catalog-2027-2028-reconciliation.json`. Every section
   with status `unreconciled`, `no-printed-units` or `unscored` needs a look:
   - reading error → fix the reader (then rebuild **all** years and check none got worse);
   - the catalog disagrees with itself → add it to `catalog/OPEN-QUESTIONS.md`;
   - the reading is right but the printed units are nominal → the owner signs it off in
     `catalog/reviewed-sections.json`.
4. Add `<script src="data/catalog-2027-2028.js"></script>` to `index.html` beside the others.
5. Add `data/catalog-2027-2028.js` to the `data` list in `vendor/deps.json` with its
   sha384, and add the year wherever the four current years are listed. Find them all with
   `grep -rn "2026-2027" scripts ../.github/workflows ../ztc-mapper-rs/crates` (test
   `YEARS` lists, the CI rebuild loop, and `CATALOG_SOURCES` in the twin's
   `programs.rs`).
6. Regenerate the parity fixture (section 6), run every test, run axe.
7. Update the README's build numbers and the end-user guide's list of years.

An addendum to an existing year is the same job with the same year: replace the Markdown,
rebuild, review what changed in the reconciliation file. Sign-offs for sections whose text
changed will stop the build until they are reviewed again; that is intended.

## 6. Recurring job: change a scoring or reader rule

1. Write the failing test first (`test-catalog-structure.js` for 2026–27 rules,
   `test-academic-year.js` for rules only older catalogs exercise).
2. Change `index.html` (model code sits between `PRODUCTION MODEL TEST START` and `END`)
   and/or the reader. Rebuild all four catalogs if the reader changed; update the sha384
   values in `vendor/deps.json`.
3. Make the same change in `ztc-mapper-rs/crates/ztc_core/src/view.rs` (and `programs.rs`
   if the catalog shape changed).
4. Regenerate the parity fixture:
   `node ztc-mapper/scripts/dump-pathway-scores.js ztc-mapper/scripts/fixtures/ztc-course-dataset-sample.csv > ztc-mapper-rs/fixtures/parity/production-scores.sample.json`
5. Run: all `node scripts/test-*.js`, `python3 scripts/check-deps.py`, `ruff check` and
   `ruff format --check` on `scripts/`, `cargo test -p ztc_core -p ztc_bake -p ztc_app`,
   `cargo clippy ... -- -D warnings`.
6. If you have the real dataset locally, compare `dump-pathway-scores.js` output before and
   after and with `ztc-bake`'s output, and tell the owner which pathway scores moved and why.
7. Add the rule to the README's rule list.

## 7. Known gaps, honestly

- **Unverified sections:** 1 in 2026–27 (Biology AS-T List A), 3 in 2025–26, 9 in
  2024–25, 13 in 2023–24. All are listed with what each needs in
  `catalog/OPEN-QUESTIONS.md`. Two need the Curriculum Office (not expected before
  January 2027); most need an owner sign-off; one (Computer Information Systems
  "professional emphasis") needs a scoring decision.
- **One sign-off remains** (Business certificate, "Any two courses"); it carries the
  owner's name but he has not yet checked it against the catalog PDF. The other three
  (Political Science List A and B, Social Justice List A) were removed on 2026-11-16:
  the independent review showed they were masking a misread, and with the fix those
  sections verify on their own. Lesson: a section whose printed units sit *inside* the
  computed range usually means a rule was missed, not that the catalog is loose.
- **The twin's interface** was first seen in a browser on 2026-11-16; the owner noted a few
  things to fix later. Its scores are verified; its UI has had no line-by-line review.
- **No manual screen-reader pass** (JAWS/NVDA) has been done on v4.1.0.
- **The vault's Markdown copy of the end-user guide** is still the v3.5.7 text; the HTML in
  this folder is current.
- **2026–27 is in progress** in the data: Spring 2027 surveys were at 74% and Summer 2027
  was not in the dataset as of mid-November 2026. Scores for the year will move.
- **All four catalogs load at start-up** (about 360 KB compressed). Loading on demand was
  considered and left out: little gain, one more way for start-up to fail.

## 7a. Independent review of 2026-11-16: what was fixed and what is still open

A separate reviewer hand-checked 27 pathways against the catalog and attacked the scorer.
It found five pathways with a wrong score on the real dataset. All five are fixed and
pinned by tests: Art History AA-T (List C was dropped: 100% → 83%), Theatre Arts AA-T
(variable-unit practicum read as two courses: 71% → 83% in three years), Biology AS-T
(lecture AND lab read as two requirements), Social Justice Studies AA-T (one course
counted in Core and List A; "only one may be selected" ignored: 50% → 33%), History AA-T
(List B Group 2 did not receive List A left-overs: 33% → 50% in 2023–24).

Also fixed: Either/Or inside "Any N" lists (Political Science, Kinesiology, Correctional
Science), "from two of the following areas" without "at least" (Law, Public Policy, and
Society), "not selected from" (Geography), survey rounding at the 90% bar, and the "Met"
label on screen now uses the same count as the score.

**Still open from that review — none changes a score on today's data, each can under
other data. Listed in the order I would take them:**

1. **A course counts once per pathway (general rule).** Fixed only where one list borrows
   from another. Still double-counted: Accounting certificate ("ACCTG 430 and ACCTGFS 453
   may not be counted twice"), History List B Group 1 ("can include HIST 1 or HIST 2 if
   not used in List A"), and any pathway that prints the same course in two sections. The
   right fix is to assign courses to requirements as a matching problem, in both apps.
   Needs the owner's agreement that a course never fills two places in one pathway.
2. **Music AA-T, "each may be taken up to 4 times".** The app needs four different ZTC
   ensembles; one repeatable ZTC ensemble should be enough. Owner decision.
3. **"Two different disciplines" uses the subject code** (Cal-GETC Area 4). PSYC C1000
   and PSYCH 25 count as two disciplines, as do POLS C1000 and PS 2. Needs a subject alias
   list from the owner (common course numbering changed the prefixes).
4. **Physical Science A.S. (2023–24):** "minimum of three courses with laboratory" is not
   enforced.
5. **Twin input handling differs from production** on data the sample file lacks:
   percent cells with spaces or trailing text, `NaN`/`inf`, a quote in the middle of a
   field, and term codes that are not `YYYY/FA|SP|SU`. Scores agree on the real dataset.
   Fix before the twin is ever shown to anyone else.
6. **Input hygiene in production:** lower-case term codes (`2026/fa`) are not matched; a
   term row with zero sections counts as "offered" and fails the course for the year.
7. **Exports:** the all-pathways CSV has no "unverified" or "In progress" column, and its
   Required Units is the minimum, not the range shown on screen. Exporting from the
   Courses view uses the selected term, not the year rule.
8. **Tests:** the parity sample has three terms, so 2023–24 and 2024–25 are all zeros in
   it; a richer synthetic sample would make the parity check mean more. The independent
   count compares totals with no data loaded, so it checks denominators only.

## 8. Idea on the table: automatic dataset feed from Informer

Not approved, not started. Informer can deliver the dataset by SFTP on a schedule. The app
cannot receive it (it is a static page), so the shape would be:

1. Informer delivers to an SFTP location the college controls.
2. A scheduled job fetches the file, validates it exactly as the upload does, and writes a
   small derived file (course, term, ZTC %, survey completion, section counts).
3. The app loads that file on open; manual upload stays as an override.

Before building: this is the hosted-dataset feature (ticket ZTC-FEAT-001 in the vault),
which still needs end-user and data-owner approval because aggregate data would sit on a
public site. Publish only the derived file, never the raw export. The job must refuse to
replace a good file with a bad one (missing columns, sharp row-count drop, a term gone).
First questions for ITS: where may Informer's SFTP jobs deliver, and may an outside service
pull from there or must the college push?

## 9. Working with the owner

- He decides scoring rules; ask before assuming, and state any assumption you made.
- He wants plain confirmation of what was verified and what was not.
- Tell him when a score moves on real data, and why.
- Do not ask him to paste secrets. Do not write student or personal data anywhere.
