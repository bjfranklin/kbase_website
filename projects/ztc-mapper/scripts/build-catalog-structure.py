#!/usr/bin/env python3
"""Build the ZTC Pathway Mapper program structure from the official catalog export.

Input:  catalog/<name>.md  (Markdown export of the catalog's Degrees and Certificates
        section: one `###` heading per program, requirement tables with `↳` nesting).
Output: data/catalog-<year>.js  (`window.ZTC_CATALOGS[year] = {...}`; loads from file:// too)
        data/catalog-<year>-reconciliation.json  (every block's parsed vs printed units)

Every requirement block is reconciled against the unit figure the catalog prints for
it. A block that does not reconcile is kept but marked `reconciled: false`, and the
app shows it as unverified. Standard library only; deterministic output.

Usage: build-catalog-structure.py CATALOG.md --catalog-year 2026-2027 [--out-dir data]
"""

from __future__ import annotations

import argparse
import hashlib
import itertools
import json
import math
import re
import sys
from pathlib import Path

NUMBER_WORDS = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6,
    "seven": 7, "eight": 8, "nine": 9, "ten": 10, "eleven": 11, "twelve": 12,
}  # fmt: skip
NUM = r"(\d+(?:\.\d+)?|" + "|".join(NUMBER_WORDS) + ")"
COURSE = re.compile(r"^([A-Z][A-Z&]{1,9}) ([A-Z]?\d+[A-Z]{0,6})\*?$")
GROUP_N = re.compile(r"^group\s*\d", re.IGNORECASE)
# Bold lines that introduce courses the catalog lists but does not require:
# "Strongly recommended:", "Recommended (Optional):", "Optional Course:",
# "This course is recommended, but not required:".
RECOMMENDED = re.compile(
    r"^(?:(?:strongly\s+)?recommended|optional)\b|\bnot required\b", re.IGNORECASE
)
AT_MOST_ONE_EACH = re.compile(r"maximum of one from each", re.IGNORECASE)
AT_LEAST_GROUPS = re.compile(
    rf"from at least {NUM} (?:of the following |different )?(areas|disciplines)",
    re.IGNORECASE,
)
GE_PATTERN = re.compile(
    r"General Education Transfer Curriculum|California State University - General Education",
    re.IGNORECASE,
)
LOTE = re.compile(r"language other than english", re.IGNORECASE)
CSU_ONLY = re.compile(r"\bCSU only\b", re.IGNORECASE)
NOT_TAKEN_FROM = re.compile(r"\bnot taken from\s+(.+)$", re.IGNORECASE)
IGNORED_HEADINGS = {"notes", "note"}
SUB_AREA = re.compile(r"^[A-Z] - ")
GE_AREA = re.compile(
    r"^(?:(?:GE |IGETC )?Area [A-F1-6][A-C1-5]?\b|General Education: )", re.IGNORECASE
)
CONTROL = re.compile(r"^Program Control Number:\s*(\S+)")
UNITS = re.compile(r"^(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?$")


def to_number(token: str) -> float:
    return float(NUMBER_WORDS[token]) if token in NUMBER_WORDS else float(token)


def parse_units(cell: str):
    text = cell.replace("**Units:**", "").replace("Total:", "").strip()
    match = UNITS.match(text)
    if not match:
        return None
    low = float(match.group(1))
    return [low, float(match.group(2)) if match.group(2) else low]


def clean(text: str) -> str:
    return re.sub(r"\s+", " ", text.replace("\\*", "*")).strip()


def heading(text: str) -> str:
    """A block or group title without its trailing colon."""
    return re.sub(r"\s*:\s*$", "", clean(text))


# ---------------------------------------------------------------- reading
def read_programs(path: Path) -> list[dict]:
    programs: list[dict] = []
    current = None
    in_requirements = False
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("### "):
            current = {"name": clean(line[4:]), "rows": [], "total": None, "notes": []}
            programs.append(current)
            in_requirements = False
            continue
        if current is None:
            continue
        if line.startswith("#### "):
            in_requirements = (
                line[5:].strip().lower().startswith("program requirements")
            )
            continue
        if not in_requirements:
            control = CONTROL.match(line.strip())
            if control:
                current["control"] = control.group(1)
            continue
        stripped = line.strip()
        bold_line = re.fullmatch(r"\*\*(.+?)\*\*:?", stripped)
        if bold_line and not stripped.startswith("|"):
            title = heading(bold_line.group(1))
            if title.lower() in IGNORED_HEADINGS or title.lower().startswith(
                "csu graduation requirement"
            ):
                # Notes, and the separate CSU American Institutions requirement that older
                # general-education patterns print after their last area, are not part of
                # the units the catalog prints for the pathway.
                current["rows"].append({"kind": "end"})
            elif any(row["kind"] == "block" for row in current["rows"]):
                current["rows"].append({"kind": "subblock", "title": title})
            else:
                current["heading"] = title
            continue
        if not stripped.startswith("|"):
            continue
        cells = [cell.strip() for cell in stripped.strip("|").split("|")]
        if len(cells) < 3 or cells[0] in ("Course", "---"):
            continue
        first = cells[0]
        depth = first.count("↳")
        first = first.replace("↳", "").strip()
        if first == "" and cells[2].startswith("Total:"):
            current["total"] = parse_units(cells[2])
            continue
        if (
            first.startswith("**")
            and parse_units(cells[2]) is None
            and SUB_AREA.match(heading(first.strip("*")))
        ):
            # "C - Laboratory Science:" is printed as a header row without units: it is a
            # sub-area of the block above, not a block of its own.
            current["rows"].append(
                {"kind": "subblock", "title": heading(first.strip("*"))}
            )
            continue
        if first.startswith("**"):
            current["rows"].append(
                {
                    "kind": "block",
                    "title": heading(first.strip("*")),
                    "units": parse_units(cells[2]),
                }
            )
            continue
        if first in ("OR", "AND"):
            current["rows"].append({"kind": first, "depth": depth})
            continue
        course = COURSE.match(first)
        if course:
            current["rows"].append(
                {
                    "kind": "course",
                    "depth": depth,
                    "subject": course.group(1),
                    "number": course.group(2),
                    "title": clean(cells[1]).rstrip("*").strip(),
                    "starred": first.endswith("*") or clean(cells[1]).endswith("*"),
                    "units": parse_units(cells[2]),
                }
            )
            continue
        if re.fullmatch(r"\*[^*].*\*", first):
            current["rows"].append(
                {
                    "kind": "group",
                    "depth": depth,
                    "title": heading(first.strip("*")),
                    "units": parse_units(cells[2]),
                }
            )
            continue
        if first and parse_units(cells[2]) is not None:
            ge_area = GE_AREA.match(clean(first))
            if ge_area:
                # "Area 5B/5C: Biological Sciences | 4.00": a general-education area named
                # without courses. Resolved against the Cal-GETC pattern's own areas.
                current["rows"].append(
                    {
                        "kind": "ge",
                        "depth": depth,
                        "title": clean(first),
                        "units": parse_units(cells[2]),
                    }
                )
                continue
            # A row with units that is not a recognizable course must not vanish silently.
            current["rows"].append(
                {"kind": "unknown", "depth": depth, "title": clean(first)}
            )
        elif first:
            current["rows"].append({"kind": "note", "text": clean(first)})
    return programs


def nest(
    rows: list[dict], heading: str | None = None, program_notes: list[str] | None = None
) -> list[dict]:
    """Rows -> blocks -> sub-blocks -> nested items."""
    program_notes = program_notes if program_notes is not None else []
    blocks: list[dict] = []
    block = None
    sub = None
    stack: list[tuple[int, dict]] = []
    ended = False
    for row in rows:
        if row["kind"] == "end":
            ended = True
            continue
        if row["kind"] == "block":
            ended = False
            block = {"title": row["title"], "units": row["units"], "subs": []}
            blocks.append(block)
            sub = None
            continue
        if ended:
            continue  # table rows under a Notes heading are prose, not requirements
        if row["kind"] == "note":
            target = sub if sub is not None else block
            if target is None:
                program_notes.append(row["text"])
            else:
                target.setdefault("notes", []).append(row["text"])
            continue
        if block is None:
            block = {"title": heading or "Requirements", "units": None, "subs": []}
            blocks.append(block)
        if row["kind"] == "subblock":
            sub = {"title": row["title"], "items": []}
            block["subs"].append(sub)
            stack = [(-1, sub)]
            continue
        if sub is None:
            sub = {"title": None, "items": []}
            block["subs"].append(sub)
            stack = [(-1, sub)]
        node = dict(row)
        node["items"] = []
        while stack and stack[-1][0] >= row["depth"]:
            stack.pop()
        stack[-1][1]["items"].append(node)
        if row["kind"] == "group":
            stack.append((row["depth"], node))
    return blocks


# ---------------------------------------------------------------- rules
def title_rule(title: str | None) -> tuple:
    """('all',) | ('choose', n) | ('units', low, high) from a block or group title."""
    text = (title or "").lower()
    units = re.search(rf"\b{NUM}(?:\s*(?:to|-)\s*(\d+))?\s+units?\b", text)
    if units and not re.search(r"\(\d+(?:\.\d+)? units?\)", text):
        low = to_number(units.group(1))
        return ("units", low, float(units.group(2)) if units.group(2) else low)
    if (
        "choose one group" in text
        or re.search(r"\bchoose (one|both)\b", text)
        or text in ("either", "or")
    ):
        return ("all",) if "both" in text else ("choose", 1)
    count = re.search(
        rf"\b(?:any|choose|select|complete|required -)\s+(?:a minimum of\s+)?{NUM}\b",
        text,
    )
    if count:
        return ("choose", int(to_number(count.group(1))))
    count = re.search(rf"\b{NUM}\s+courses?\b", text)
    if count:
        return ("choose", int(to_number(count.group(1))))
    return ("all",)


class Unverifiable(Exception):
    pass


LAB_CONTEXT = {"on": False}
CORRECTIONS: list[str] = []
OPTIONAL_UNITS = {"max": 0.0}


def course_of(node: dict) -> dict:
    starred = bool(node.get("starred"))
    lab = starred and LAB_CONTEXT["on"]
    return {
        "key": f"{node['subject']}-{node['number']}",
        "subject": node["subject"],
        "number": node["number"],
        # Outside a lab block an asterisk is a footnote mark: keep it on the title.
        "courseTitle": node["title"] + ("*" if starred and not lab else ""),
        "lab": lab,
        "units": node["units"][0] if node["units"] else None,
        "unitsMax": node["units"][1] if node["units"] else None,
        "headerId": "*" if lab else "",
        "groupTitle": "",
        "condition": "",
    }


def split_parts(items: list[dict]) -> tuple[list[list[dict]], bool]:
    """Split a group's children on OR. Returns (parts, had_or)."""
    parts: list[list[dict]] = [[]]
    had_or = False
    for item in items:
        if item["kind"] == "OR":
            had_or = True
            parts.append([])
        elif item["kind"] != "AND":
            parts[-1].append(item)
    return [part for part in parts if part], had_or


def bundle(items: list[dict]) -> list[dict]:
    """All of these items together (an AND bundle of courses)."""
    courses: list[dict] = []
    for item in items:
        if item["kind"] == "unknown":
            raise Unverifiable(f"unrecognized row with units ({item['title']})")
        if item["kind"] == "course":
            courses.append(course_of(item))
        elif item["kind"] == "group":
            _, had_or = split_parts(item["items"])
            has_and = any(child["kind"] == "AND" for child in item["items"])
            if had_or or (title_rule(item["title"])[0] != "all" and not has_and):
                raise Unverifiable(f"a choice nested inside a bundle ({item['title']})")
            courses.extend(bundle(item["items"]))
    return courses


def alternatives(group: dict) -> list[list[dict]]:
    """A choice group's alternatives, each an AND bundle of courses."""
    parts, had_or = split_parts(group["items"])
    found: list[list[dict]] = []
    if had_or:
        found = [bundle(part) for part in parts]
    else:
        # No OR rows: each child is its own alternative. A nested choice contributes its
        # own alternatives ("Either: X / Or: X AND X-lab" = X alone, or X with its lab);
        # any other nested group is a bundle taken together.
        for item in group["items"]:
            if item["kind"] == "course":
                found.append(bundle([item]))
            elif item["kind"] == "group":
                _, nested_or = split_parts(item["items"])
                nested_choice = title_rule(item["title"])[0] == "choose"
                has_and = any(child["kind"] == "AND" for child in item["items"])
                pair = [child for child in item["items"] if child["kind"] == "course"]
                lecture_lab = (
                    nested_or
                    and len(pair) == 2
                    and len(item["items"]) == 3
                    and pair[0]["subject"] == pair[1]["subject"]
                    and pair[1]["number"] == pair[0]["number"] + "L"
                )
                if lecture_lab:
                    # The catalog prints "X OR X-lab" where every sibling entry prints
                    # "X AND X-lab". Read it as the lecture with its lab, and say so.
                    CORRECTIONS.append(
                        f"catalog prints '{pair[0]['subject']} {pair[0]['number']} OR "
                        f"{pair[1]['subject']} {pair[1]['number']}'; read as AND (lecture with its lab)"
                    )
                    found.append(bundle(pair))
                elif nested_or or (nested_choice and not has_and):
                    found.extend(alternatives(item))
                else:
                    found.append(bundle(item["items"]))
    unique, seen = [], set()
    for alt in found:
        signature = tuple(course["key"] for course in alt)
        if signature and signature not in seen:
            seen.add(signature)
            unique.append(alt)
    return unique


def min_count_for_units(unit_sums: list[float], target: float) -> int:
    total = 0.0
    for count, value in enumerate(sorted(unit_sums, reverse=True), start=1):
        total += value
        if total + 1e-9 >= target:
            return count
    return max(1, len(unit_sums))


def build_sub(
    sub: dict, block_rule: tuple, notes: list[str], block_title: str = ""
) -> dict:
    """One sub-block -> options + slots."""
    options: list[dict] = []
    slots: list[dict] = []
    rule = title_rule(sub["title"]) if sub["title"] else block_rule
    # "Choose two courses (one from each group)": every labelled group is its own choice of one.
    one_from_each = "one from each" in block_title.lower() and any(
        i["kind"] == "group" for i in sub["items"]
    )
    if one_from_each:
        rule = ("all",)
    if sub["title"] and rule == ("all",):
        # Titled sub-areas such as "1C - Oral Communication (Required)" ask for one course.
        rule = ("choose", 1)

    def add(courses: list[dict], label: str | None, choice: str | None = None) -> int:
        option = {"label": label, "courses": courses}
        if choice:
            # Alternatives the catalog prints as one "Either ... Or ..." entry inside a
            # longer list: scored as separate options, displayed together.
            option["choice"] = choice
        options.append(option)
        return len(options) - 1

    for item in sub["items"]:
        if item["kind"] == "unknown":
            raise Unverifiable(f"unrecognized row with units ({item['title']})")
    items = [item for item in sub["items"] if item["kind"] in ("course", "group", "ge")]
    if not items and sub["title"] and "laborator" in sub["title"].lower():
        # "C - Laboratory Science": met by any lab course of the sibling sub-areas.
        # Filled in by build_program once the siblings exist.
        return {
            "title": sub["title"],
            "rule": ["lab"],
            "options": [],
            "slots": [],
            "labRelist": True,
            "notes": sub.get("notes", []),
        }
    if any(item["kind"] == "ge" for item in items) and rule[0] != "all":
        raise Unverifiable("a general-education area row inside a choice list")
    if rule[0] == "all":
        for item in items:
            if item["kind"] == "ge" and item["units"] and item["units"][0] == 0:
                # "0.00-4.00": can be met without coursework, so it is not a course requirement.
                notes.append(
                    f"{item['title']}: can be met without coursework; not scored"
                )
                continue
            if item["kind"] == "ge" and LOTE.search(item["title"]):
                # The language requirement can be met by high-school work: its units
                # are the top of the printed range only, and it is not scored.
                notes.append(
                    f"{item['title']}: can be met without coursework; not scored"
                )
                OPTIONAL_UNITS["max"] += item["units"][1]
                continue
            if item["kind"] == "ge":
                slots.append(
                    {
                        "need": 1,
                        "label": item["title"],
                        "summary": True,
                        "geArea": item["title"],
                        "unitsTarget": item["units"],
                        "options": [],
                    }
                )
                continue
            if item["kind"] == "course":
                slots.append({"need": 1, "options": [add([course_of(item)], None)]})
                continue
            group_rule = title_rule(item["title"])
            _, had_or = split_parts(item["items"])
            if group_rule[0] != "units" and (
                had_or or group_rule[0] == "choose" or one_from_each
            ):
                alts = alternatives(item)
                need = group_rule[1] if group_rule[0] == "choose" else 1
                slots.append(
                    {
                        "need": need,
                        "label": item["title"],
                        "options": [add(alt, None) for alt in alts],
                    }
                )
            elif group_rule[0] == "units":
                alts = alternatives(item)
                sums = [sum(c["units"] or 0 for c in alt) for alt in alts]
                slots.append(
                    {
                        "need": min_count_for_units(sums, group_rule[1]),
                        "label": item["title"],
                        "unitsTarget": [group_rule[1], group_rule[2]],
                        "options": [add(alt, None) for alt in alts],
                    }
                )
            else:
                for course in bundle([item]):
                    slots.append({"need": 1, "options": [add([course], item["title"])]})
    else:
        pool: list[int] = []
        for item in items:
            if item["kind"] == "course":
                pool.append(add([course_of(item)], None))
                continue
            _, had_or = split_parts(item["items"])
            nested_rule = title_rule(item["title"])
            if had_or or nested_rule[0] != "all":
                # A choice inside a pool: its alternatives join the pool.
                if rule[0] == "choose" and rule[1] > 1:
                    notes.append(
                        f"choice '{item['title']}' flattened into a choose-{rule[1]} pool"
                    )
                alts = alternatives(item)
                choice = f"e{len(options)}" if len(alts) > 1 else None
                for alt in alts:
                    pool.append(add(alt, item["title"], choice))
            elif GROUP_N.match(item["title"]) or "both" in item["title"].lower():
                pool.append(add(bundle([item]), item["title"]))  # all of these together
            else:
                # A labelled sub-list (e.g. "Area 1 - Audio"): its courses join the pool.
                notes.append(f"sub-list '{item['title']}' merged into the pool")
                for course in bundle([item]):
                    pool.append(add([course], item["title"]))
        if rule[0] == "choose":
            slots.append({"need": rule[1], "pool": True, "options": pool})
        else:
            sums = [sum(c["units"] or 0 for c in options[i]["courses"]) for i in pool]
            slots.append(
                {
                    "need": min_count_for_units(sums, rule[1]),
                    "pool": True,
                    "unitsTarget": [rule[1], rule[2]],
                    "options": pool,
                }
            )
    return {
        "title": sub["title"],
        "rule": list(rule),
        "options": options,
        "slots": slots,
        "notes": sub.get("notes", []),
    }


def section_name(title: str) -> str:
    """'List A - Any three courses' -> 'List A'."""
    return re.split(r"\s+-\s+|:", title, maxsplit=1)[0].strip()


def names_section(reference: str, title: str) -> bool:
    """Does 'List A or B' / 'Required Core, List A, or List B' name this section?"""
    name = section_name(title).lower()
    text = reference.lower()
    if name == "required core":
        return "required core" in text
    letter = re.fullmatch(r"list ([a-z])", name)
    if not letter:
        return False
    for match in re.finditer(
        r"list ([a-z])((?:\s*(?:,|or|and)\s*(?:list\s+)?[a-z]\b)*)", text
    ):
        letters = {match.group(1)} | set(re.findall(r"\b([a-z])\b", match.group(2)))
        if letter.group(1) in letters - {"o", "r"}:
            return True
    return False


def achievable_units(slot: dict, options: list[dict]) -> list[float] | None:
    """Unit totals a student can end with under "N units from the following".

    Whole courses rarely add up to exactly N. The catalog prints the range of totals
    for selections that reach N with no course to spare (dropping any one course
    would fall below N)."""
    sums = []
    for index in slot["options"]:
        courses = options[index]["courses"]
        if any(c["units"] is None or c["units"] != c["unitsMax"] for c in courses):
            return None
        sums.append(sum(c["units"] for c in courses))
    target = slot["unitsTarget"][0]
    totals = [
        sum(chosen)
        for size in range(1, len(sums) + 1)
        for chosen in itertools.combinations(sums, size)
        if sum(chosen) + 1e-9 >= target and sum(chosen) - min(chosen) + 1e-9 < target
    ]
    return [min(totals), max(totals)] if totals else None


def slot_units(
    slot: dict,
    options: list[dict],
    with_spare: bool = False,
    achievable: bool = False,
) -> list[float] | None:
    if "unitsTarget" in slot:
        if achievable and slot.get("pool") and 0 < len(slot["options"]) <= 16:
            return achievable_units(slot, options) or list(slot["unitsTarget"])
        return list(slot["unitsTarget"])
    lows, highs = [], []
    spare = (
        [i for group in slot.get("spare", []) for i in group["options"]]
        if with_spare
        else []
    )
    for index in slot["options"] + spare:
        courses = options[index]["courses"]
        if any(c["units"] is None for c in courses):
            return None
        lows.append(sum(c["units"] for c in courses))
        highs.append(sum(c["unitsMax"] for c in courses))
    if len(lows) < slot["need"]:
        return None
    lows.sort()
    highs.sort()
    return [sum(lows[: slot["need"]]), sum(highs[-slot["need"] :])]


def block_units(
    subgroups: list[dict], with_spare: bool, achievable: bool = False
) -> list[float] | None:
    """Unit range of a block's requirements; None when a course has no units."""
    total = [0.0, 0.0]
    for sg in subgroups:
        values = [
            slot_units(slot, sg["options"], with_spare, achievable)
            for slot in sg["slots"]
        ]
        if any(value is None for value in values):
            return None
        count = sg.get("slotsNeeded", len(values))
        # "Required CSU only": students bound for UC skip it, so the printed range
        # starts without it.
        if not (sg.get("title") and CSU_ONLY.search(sg["title"])):
            total[0] += sum(sorted(value[0] for value in values)[:count])
        total[1] += sum(sorted(value[1] for value in values)[len(values) - count :])
    return total


def units_match(units: list[float] | None, printed: list[float] | None) -> bool:
    return bool(
        units and printed and all(abs(units[i] - printed[i]) < 0.01 for i in (0, 1))
    )


def all_courses(items: list[dict]) -> list[dict]:
    found = []
    for item in items:
        if item["kind"] == "course":
            found.append(course_of(item))
        elif item.get("items"):
            found.extend(all_courses(item["items"]))
    return found


GE_KEYWORDS = [
    # (words in the row title, Cal-GETC area number, sub-area letters or None for the whole area)
    (("english composition",), 1, ["A"]),
    (("critical thinking", "oral communication"), 1, ["B", "C"]),
    (("critical thinking",), 1, ["B"]),
    (("oral communication",), 1, ["C"]),
    (("mathematical",), 2, None),
    (("quantitative",), 2, None),
    (("art", "humanities"), 3, None),
    (("humanities",), 3, None),
    (("social",), 4, None),
    (("physical science",), 5, ["A"]),
    (("biological",), 5, ["B"]),
    (("ethnic",), 6, None),
    (("language other than english",), 6, None),
]


def ge_pool(title: str, ge_areas: dict) -> tuple[list[dict], str] | None:
    """Options of the matching Cal-GETC area for a row such as 'Area 5B/5C: Biological Sciences'."""
    text = title.lower()
    pattern_name = ge_areas.get("name", "Cal-GETC")
    csu = re.match(r"^area ([a-f])(\d)?\b", text)
    if csu and ge_areas.get("csu", {}).get(csu.group(1).upper()):
        # "Area C2 - Humanities": a CSU General Education area, when this catalog prints that pattern.
        letter, digit = csu.group(1).upper(), csu.group(2)
        options = [
            option
            for sub_title, sub_options in ge_areas["csu"][letter]
            if not digit or (sub_title or "").upper().startswith(letter + digit)
            for option in sub_options
        ]
        return (
            (options, f"CSU General Education Area {letter}{digit or ''}")
            if options
            else None
        )
    for words, number, letters in GE_KEYWORDS:
        if all(word in text for word in words):
            break
    else:
        return None
    if words[0] in ("ethnic", "language other than english"):
        # These two areas are numbered differently in IGETC and Cal-GETC.
        number = next(
            (n for n, text_ in ge_areas.get("titles", {}).items() if words[0] in text_),
            None,
        )
    area = ge_areas.get(number)
    if not area:
        return None
    want_lab = bool(re.search(r"\b5[a-b]?/5c\b|\b5c\b", text))
    options = []
    for sub_title, sub_options in area:
        letter = (
            re.match(r"^(?:Group )?(?:\d)?([A-C])(?: -|:)", sub_title or "")
            or [None, None]
        )[1]
        if letters and letter not in letters:
            continue
        for option in sub_options:
            if want_lab and not any(course["lab"] for course in option["courses"]):
                continue
            options.append(option)
    label = f"{pattern_name} Area {number}" + (
        "".join(letters) if letters and len(letters) == 1 else ""
    )
    if letters and len(letters) > 1:
        label = f"{pattern_name} Area " + " or ".join(
            f"{number}{letter}" for letter in letters
        )
    if want_lab:
        label += " with a laboratory"
    return (options, label) if options else None


def lab_constrained_units(pools: list[list[list[float]]], labs: list[list[bool]]):
    """Min/max units of one option per pool where at least one chosen option is a lab."""
    best = None

    def walk(index: int, low: float, high: float, has_lab: bool):
        nonlocal best
        if index == len(pools):
            if has_lab:
                best = (
                    [low, high]
                    if best is None
                    else [min(best[0], low), max(best[1], high)]
                )
            return
        for units, lab in zip(pools[index], labs[index]):
            walk(index + 1, low + units[0], high + units[1], has_lab or lab)

    walk(0, 0.0, 0.0, False)
    return best


def build_program(
    index: int, raw: dict, ge_areas: dict | None = None
) -> tuple[dict, list[dict]]:
    areas = []
    report = []
    ge_areas = ge_areas or {}
    program_notes: list[str] = list(raw["notes"])
    for a_index, block in enumerate(
        nest(raw["rows"], raw.get("heading"), program_notes)
    ):
        notes: list[str] = []
        block_sha = hashlib.sha256(
            json.dumps(block, sort_keys=True, ensure_ascii=False).encode("utf-8")
        ).hexdigest()
        block_text = " ".join(
            [block["title"]]
            + block.get("notes", [])
            + [
                text
                for sub in block["subs"]
                for text in [sub["title"] or ""] + sub.get("notes", [])
            ]
        ).lower()
        LAB_CONTEXT["on"] = "laborator" in block_text and "asterisk" in block_text
        CORRECTIONS.clear()
        OPTIONAL_UNITS["max"] = 0.0
        block_rule = title_rule(block["title"])
        # A bold line with nothing under it is a caption, not a sub-area.
        captions = [
            sub
            for sub in block["subs"]
            if sub["title"]
            and not sub["items"]
            and "laborator" not in sub["title"].lower()
        ]
        for caption in captions:
            block.setdefault("notes", []).append(caption["title"])
            block["notes"].extend(caption.get("notes", []))
        block["subs"] = [
            sub for sub in block["subs"] if not any(sub is c for c in captions)
        ]
        # "**Strongly recommended:**" under a block lists suggestions, not requirements:
        # the catalog's printed units count only the courses above it.
        for sub in block["subs"]:
            sub["suggested"] = bool(sub["title"] and RECOMMENDED.search(sub["title"]))
        titled = [sub for sub in block["subs"] if sub["title"] and not sub["suggested"]]
        # "**Choose one group:** / **Group 1:** X OR Y / **Group 2:** P AND Q": one
        # requirement whose options are X, Y, or P with Q.
        caption_groups = (
            block_rule == ("all",)
            and len(titled) > 1
            and all(GROUP_N.match(sub["title"]) for sub in titled)
            and any(
                "choose one group" in text.lower() for text in block.get("notes", [])
            )
        )
        if block_rule == ("all",):
            # Older general-education patterns state the count in the first instruction
            # row: "Three courses. Choose at least one course from each area."
            for text in list(block.get("notes", []))[:1]:
                stated = re.match(rf"^(?:choose\s+)?{NUM}\s+courses?\b", text.lower())
                if stated:
                    block_rule = ("choose", int(to_number(stated.group(1))))
        if (
            block_rule == ("all",)
            and not titled
            and GE_PATTERN.search(raw["name"])
            and block["title"].upper().startswith("AREA ")
        ):
            # A general-education area never requires every course listed: with no
            # count in its title it is one course (IGETC "AREA 7: Ethnic Studies").
            block_rule = ("choose", 1)
        subgroups = []
        error = None
        one_each = "one from each" in block["title"].lower()
        group_subs = (
            bool(titled)
            and not one_each
            and block_rule[0] == "choose"
            and all(GROUP_N.match(sub["title"] or "") for sub in titled)
        )
        try:
            if group_subs:
                options = [
                    {"label": sub["title"], "courses": bundle(sub["items"])}
                    for sub in titled
                ]
                courses = [course for option in options for course in option["courses"]]
                subgroups.append(
                    {
                        "id": f"a{a_index}-0",
                        "title": None,
                        "requirement": {"choice": None, "n": None},
                        "courses": courses,
                        "options": options,
                        "slots": [
                            {
                                "need": block_rule[1],
                                "pool": True,
                                "options": list(range(len(options))),
                            }
                        ],
                        "isLabReference": False,
                    }
                )
            if caption_groups:
                group_options: list[dict] = []
                # A block can hold several "Choose one group:" captions; the group
                # numbering restarts with each, and each is its own requirement.
                group_sets: list[list[int]] = []
                last_number = None
                for sub in titled:
                    number = int(re.search(r"\d+", sub["title"]).group())
                    if last_number is None or number <= last_number:
                        group_sets.append([])
                    last_number = number
                    parts, had_or = split_parts(sub["items"])
                    for part in parts if had_or else [sub["items"]]:
                        group_sets[-1].append(len(group_options))
                        group_options.append(
                            {"label": sub["title"], "courses": bundle(part)}
                        )
            for s_index, sub in enumerate([] if group_subs else block["subs"]):
                if caption_groups and sub["title"]:
                    continue
                built = build_sub(
                    sub, block_rule if not titled else ("all",), notes, block["title"]
                )
                if sub["title"] and CSU_ONLY.search(sub["title"]):
                    built["notes"] = [
                        *built["notes"],
                        "Required for transfer to CSU only. The app counts it as a requirement.",
                    ]
                if sub["suggested"]:
                    built["slots"] = []
                    built["notes"] = [
                        *built["notes"],
                        "Suggested courses; not a requirement and not scored.",
                    ]
                courses, seen = [], set()
                for option in built["options"]:
                    for course in option["courses"]:
                        if course["key"] not in seen:
                            seen.add(course["key"])
                            courses.append(course)
                subgroups.append(
                    {
                        "id": f"a{a_index}-{s_index}",
                        "title": built["title"],
                        "requirement": {"choice": None, "n": None},
                        "courses": courses,
                        "options": built["options"],
                        "slots": built["slots"],
                        "notes": built["notes"],
                        "labRelist": bool(built.get("labRelist")),
                        "isLabReference": False,
                    }
                )
            if caption_groups:
                listed, seen_keys = [], set()
                for option in group_options:
                    for course in option["courses"]:
                        if course["key"] not in seen_keys:
                            seen_keys.add(course["key"])
                            listed.append(course)
                subgroups.append(
                    {
                        "id": f"a{a_index}-{len(subgroups)}",
                        "title": None,
                        "requirement": {"choice": None, "n": None},
                        "courses": listed,
                        "options": group_options,
                        "slots": [
                            {
                                "need": 1,
                                "label": "Choose one group",
                                "options": indexes,
                            }
                            for indexes in group_sets
                        ],
                        "notes": [],
                        "isLabReference": False,
                    }
                )
            # "Any three courses (maximum of one from each category)": every category is
            # its own choice of one, and only N of the categories are required.
            capped = AT_MOST_ONE_EACH.search(block["title"])
            if capped and block_rule[0] == "choose":
                for sg in subgroups:
                    if len(sg["slots"]) > block_rule[1] and all(
                        slot["need"] == 1 for slot in sg["slots"]
                    ):
                        sg["slotsNeeded"] = block_rule[1]
            # "... or any course not taken from List A": options of the named sections
            # that are left over once those sections are met also count here.
            borrow = NOT_TAKEN_FROM.search(block["title"])
            target = next(
                (
                    (sg, slot)
                    for sg in subgroups
                    for slot in sg["slots"]
                    if slot.get("pool") and not slot.get("summary")
                ),
                None,
            )
            if borrow and target:
                target_sg, target_slot = target
                for area in areas:
                    if not names_section(borrow.group(1), area["title"]):
                        continue
                    for sg in area["subgroups"]:
                        for slot_index, slot in enumerate(sg["slots"]):
                            own = [
                                i
                                for i in slot["options"]
                                if not sg["options"][i].get("pooled")
                            ]
                            if slot.get("summary") or len(own) <= slot["need"]:
                                continue  # nothing can be left over
                            start = len(target_sg["options"])
                            target_sg["options"].extend(
                                {
                                    "label": None,
                                    "courses": sg["options"][i]["courses"],
                                    "pooled": True,
                                }
                                for i in own
                            )
                            target_slot.setdefault("spare", []).append(
                                {
                                    "from": section_name(area["title"]),
                                    # Identifies the lending requirement, so a left-over
                                    # course is claimed by one later section only.
                                    "source": f"{sg['id']}:{slot_index}",
                                    "options": list(range(start, start + len(own))),
                                    "used": slot["need"],
                                }
                            )
            # "Any three courses from at least two of the following areas" / "Choose three
            # courses from at least two different disciplines": the courses may not all
            # come from one area (sub-list) or one discipline (subject).
            spread = AT_LEAST_GROUPS.search(
                " ".join([block["title"], *block.get("notes", [])])
            )
            if spread:
                for sg in subgroups:
                    for slot in sg["slots"]:
                        if slot.get("pool") and not slot.get("summary"):
                            slot["distinct"] = {
                                "min": int(to_number(spread.group(1).lower())),
                                "by": "subject"
                                if "discipline" in spread.group(2).lower()
                                else "label",
                            }
            if RECOMMENDED.search(block["title"]):
                # "Recommended (Optional)": listed for reference, never a requirement.
                for sg in subgroups:
                    sg["slots"] = []
            # "At least one course from each area" with more courses required than areas:
            # the remaining courses come from any of the areas. (Scored as "enough ZTC
            # options exist"; it does not check they differ from the ones used above.)
            each = [sg for sg in subgroups if sg["slots"]]
            if (
                len(each) > 1
                and not group_subs
                and all("at least one" in (sg["title"] or "").lower() for sg in each)
            ):
                have = sum(slot["need"] for sg in each for slot in sg["slots"])
                extra = 0
                if block_rule[0] == "choose":
                    extra = block_rule[1] - have
                elif block["units"]:
                    spans = [
                        slot_units(slot, sg["options"])
                        for sg in each
                        for slot in sg["slots"]
                    ]
                    if all(spans):
                        high = sum(span[1] for span in spans)
                        if block["units"][0] > high:
                            extra = math.ceil(
                                (block["units"][0] - high) / (high / have)
                            )
                if extra > 0:
                    pooled = [
                        {"label": None, "courses": option["courses"], "pooled": True}
                        for sg in each
                        for option in sg["options"]
                    ]
                    subgroups.append(
                        {
                            "id": f"a{a_index}-{len(subgroups)}",
                            "title": "Additional course" + ("s" if extra > 1 else ""),
                            "requirement": {"choice": None, "n": None},
                            "courses": [],
                            "options": pooled,
                            "slots": [
                                {
                                    "need": extra,
                                    "pool": True,
                                    "summary": True,
                                    "summaryLabel": f"Any {extra} more course"
                                    + ("s" if extra > 1 else "")
                                    + " from the areas above",
                                    "options": list(range(len(pooled))),
                                }
                            ],
                            "notes": [],
                            "isLabReference": False,
                        }
                    )
            if block["units"] and block["units"][0] == 0:
                # "0-4 units": the catalog allows this to be met without coursework,
                # so the courses are listed and nothing is scored.
                for sg in subgroups:
                    sg["slots"] = []
                notes.append("can be met without coursework; listed, not scored")
            # General-education area rows: any course of the matching Cal-GETC area.
            for sg in subgroups:
                for slot in sg["slots"]:
                    if "geArea" not in slot:
                        continue
                    match = ge_pool(slot["geArea"], ge_areas)
                    if match is None:
                        raise Unverifiable(
                            f"no general-education area matches '{slot['geArea']}'"
                        )
                    pool_options, pool_label = match
                    start = len(sg["options"])
                    sg["options"].extend(
                        {"label": None, "courses": option["courses"], "pooled": True}
                        for option in pool_options
                    )
                    slot["options"] = list(range(start, start + len(pool_options)))
                    slot["summaryLabel"] = f"Any course from {pool_label}"
                    del slot["geArea"]
            # "C - Laboratory Science": one requirement, met by any lab option of its siblings.
            for sg in subgroups:
                if not sg.get("labRelist"):
                    continue
                lab_options = [
                    {"label": None, "courses": option["courses"]}
                    for other in subgroups
                    if other is not sg
                    for option in other["options"]
                    if any(course["lab"] for course in option["courses"])
                ]
                if not lab_options:
                    raise Unverifiable(
                        f"no laboratory courses found for '{sg['title']}'"
                    )
                sg["options"] = lab_options
                sg["slots"] = [
                    {
                        "need": 1,
                        "pool": True,
                        "summary": True,
                        "labRule": True,
                        "summaryLabel": "Any course above marked with a laboratory (*)",
                        "options": list(range(len(lab_options))),
                    }
                ]
        except Unverifiable as exc:
            error = str(exc)
            # Never drop a block: list its courses, score nothing, and say so.
            listed, seen_keys = [], set()
            for sub in block["subs"]:
                for course in all_courses(sub["items"]):
                    if course["key"] not in seen_keys:
                        seen_keys.add(course["key"])
                        listed.append(course)
            subgroups = [
                {
                    "id": f"a{a_index}-0",
                    "title": None,
                    "requirement": {"choice": None, "n": None},
                    "courses": listed,
                    "options": None,
                    "slots": [],
                    "notes": [
                        text for sub in block["subs"] for text in sub.get("notes", [])
                    ],
                    "isLabReference": False,
                }
            ]
        computed = [0.0, 0.0]
        computable = error is None
        unit_based = any(
            "unitsTarget" in slot for sg in subgroups for slot in sg["slots"]
        )
        lab_area = error is None and any(sg.get("labRelist") for sg in subgroups)
        if lab_area:
            # One option per sibling sub-area, at least one of them a lab: the lab
            # requirement adds no units of its own.
            pools, labs = [], []
            for sg in subgroups:
                if sg.get("labRelist"):
                    continue
                for slot in sg["slots"]:
                    if slot["need"] != 1:
                        computable = False
                    chosen = [sg["options"][i]["courses"] for i in slot["options"]]
                    pools.append(
                        [
                            [
                                sum(c["units"] or 0 for c in cs),
                                sum(c["unitsMax"] or 0 for c in cs),
                            ]
                            for cs in chosen
                        ]
                    )
                    labs.append([any(c["lab"] for c in cs) for cs in chosen])
            constrained = lab_constrained_units(pools, labs) if computable else None
            if constrained is None:
                computable = False
            else:
                computed = constrained
        if not lab_area:
            own = block_units(subgroups, False)
            if own is None:
                computable = False
            else:
                # Requirements that can be met without coursework widen the range only.
                own[1] += OPTIONAL_UNITS["max"]
                computed = own
                if not units_match(computed, block["units"]) and any(
                    "spare" in slot for sg in subgroups for slot in sg["slots"]
                ):
                    # The printed range may count courses left over from the named
                    # sections ("or any course not taken from List A").
                    widened = block_units(subgroups, True)
                    if units_match(widened, block["units"]):
                        computed = widened
                if not units_match(computed, block["units"]) and unit_based:
                    exact = block_units(subgroups, False, achievable=True)
                    if exact is not None:
                        exact[1] += OPTIONAL_UNITS["max"]
                    if units_match(exact, block["units"]):
                        computed = exact
        printed = block["units"]
        notes.extend(dict.fromkeys(CORRECTIONS))
        # A correction the reader made to the catalog text is shown with the section.
        for correction in dict.fromkeys(CORRECTIONS):
            block.setdefault("notes", []).append(f"Note from the app: {correction}.")
        if (
            lab_area
            and computable
            and printed
            and abs(computed[0] - printed[0]) < 0.01
            and computed[0] <= printed[1] < computed[1]
        ):
            # The printed range is not a strict maximum here; the minimum and structure agree.
            notes.append(
                f"printed maximum {printed[1]:g} is below the {computed[1]:g} units the listed courses allow"
            )
            computed = [computed[0], printed[1]]
        has_slots = any(sg["slots"] for sg in subgroups)
        if error is not None:
            status = "unscored"  # courses are listed; nothing is counted
        elif RECOMMENDED.search(block["title"]):
            status = "optional"  # listed for reference; never counted
        elif not has_slots:
            status = (
                "no-courses"  # e.g. "Cal-GETC General Education Requirements: 22 units"
            )
        elif printed is None:
            status = "no-printed-units"
        elif (
            computable
            and abs(computed[0] - printed[0]) < 0.01
            and (
                abs(computed[1] - printed[1]) < 0.01
                or (unit_based and printed[1] >= computed[1])
            )
        ):
            # A unit-based block prints the range its course sizes allow (e.g. 9.00-11.00).
            status = "reconciled"
        else:
            status = "unreconciled"
        if notes and status == "reconciled":
            status = "approximated"
        choice = block_rule[0] != "all" and (not titled or group_subs) and not one_each
        if status == "optional":
            rule_label = "Optional"
        elif any("slotsNeeded" in sg for sg in subgroups):
            rule_label = f"Any {block_rule[1]}, at most one from each group"
        elif one_each:
            rule_label = "One course from each group"
        elif titled and not group_subs:
            rule_label = "Requirements by sub-area"
        elif block_rule[0] == "choose":
            rule_label = "Choose one group" if group_subs else f"Choose {block_rule[1]}"
        elif block_rule[0] == "units":
            rule_label = f"{block_rule[1]:g} units from this list"
        else:
            rule_label = "All required"
        areas.append(
            {
                "id": f"a{a_index}",
                "title": block["title"],
                "requirement": {
                    "choice": bool(choice),
                    "n": block_rule[1]
                    if block_rule[0] == "choose" and (not titled or group_subs)
                    else None,
                },
                "isHeaderArea": bool(titled) and not group_subs,
                "ruleLabel": rule_label,
                "notes": block.get("notes", []),
                "subgroups": subgroups,
                "catalogUnits": printed,
                "reconciliation": status,
            }
        )
        report.append(
            {
                "program": raw["name"],
                "block": block["title"],
                "status": status,
                "sectionSha256": block_sha,
                "printedUnits": printed,
                "parsedUnits": computed if computable else None,
                "notes": notes + ([error] if error else []),
            }
        )
    # Noncredit certificates print hours for the pathway only. When every other section
    # is verified, the pathway total verifies the one section that prints no units.
    unprinted = [
        i for i, row in enumerate(report) if row["status"] == "no-printed-units"
    ]
    verified = {"reconciled", "approximated", "no-courses", "optional"}
    if (
        len(unprinted) == 1
        and raw["total"]
        and report[unprinted[0]]["parsedUnits"]
        and all(
            row["status"] in verified
            for i, row in enumerate(report)
            if i != unprinted[0]
        )
    ):
        row = report[unprinted[0]]
        others = [r["printedUnits"] for i, r in enumerate(report) if i != unprinted[0]]
        low = row["parsedUnits"][0] + sum(units[0] for units in others if units)
        high = row["parsedUnits"][1] + sum(units[1] for units in others if units)
        if abs(low - raw["total"][0]) < 0.01 and abs(high - raw["total"][1]) < 0.01:
            row["status"] = areas[unprinted[0]]["reconciliation"] = "approximated"
            row["notes"].append(
                "no units printed for the section; verified against the pathway total"
            )
    program = {
        "name": raw["name"],
        "areas": areas,
        "catalogTotalUnits": raw["total"],
        "catalogNotes": program_notes,
    }
    return program, report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("catalog", type=Path)
    parser.add_argument("--catalog-year", required=True)
    parser.add_argument(
        "--out-dir", type=Path, default=Path(__file__).resolve().parent.parent / "data"
    )
    parser.add_argument(
        "--reviewed",
        type=Path,
        default=Path(__file__).resolve().parent.parent
        / "catalog"
        / "reviewed-sections.json",
        help="Sections a person has confirmed although their units do not reconcile.",
    )
    args = parser.parse_args()

    source = args.catalog.read_bytes()
    raw_programs = [p for p in read_programs(args.catalog) if p["rows"]]
    programs, report, seen = [], [], set()
    duplicates = []
    by_control: dict[str, list] = {}
    # The Cal-GETC pattern's own areas resolve "Area 3: Arts and Humanities" style rows
    # in other pathways, so it is built first.
    # Catalogs before Cal-GETC print IGETC and CSU General Education instead.
    ge_areas: dict = {}

    def pattern_areas(raw: dict, regex: str) -> dict:
        pattern, _ = build_program(0, raw)
        found = {}
        for area in pattern["areas"]:
            key = re.match(regex, area["title"])
            if key:
                found[key.group(1)] = [
                    (sg["title"], sg["options"])
                    for sg in area["subgroups"]
                    if sg["options"]
                    and not sg.get("labRelist")
                    and not any(option.get("pooled") for option in sg["options"])
                ]
        return found

    for wanted, label in (
        ("cal-getc", "Cal-GETC"),
        ("intersegmental general education", "IGETC"),
    ):
        for raw in raw_programs:
            name = raw["name"].lower()
            if wanted in name and "curriculum" in name:
                for key, value in pattern_areas(raw, r"^AREA (\d)").items():
                    ge_areas[int(key)] = value
                ge_areas["titles"] = {
                    int(m.group(1)): row["title"].lower()
                    for row in raw["rows"]
                    if row["kind"] == "block"
                    and (m := re.match(r"^AREA (\d)", row["title"]))
                }
                ge_areas["name"] = label
                break
        if "name" in ge_areas:
            break
    for raw in raw_programs:
        if (
            raw["name"]
            .lower()
            .startswith("california state university - general education")
        ):
            ge_areas["csu"] = pattern_areas(raw, r"^AREA ([A-F])")
            break
    for index, raw in enumerate(raw_programs):
        # The catalog prints every program twice, occasionally under two spellings of its
        # name: the same state control number with the same requirement rows is the copy.
        control = raw.get("control")
        words = set(re.findall(r"[a-z0-9]+", raw["name"].lower()))
        same = control and any(
            raw["rows"] == rows or words <= other or other <= words
            for rows, other in by_control.get(control, [])
        )
        if raw["name"] in seen or same:
            duplicates.append(raw["name"])
            continue
        seen.add(raw["name"])
        if control:
            by_control.setdefault(control, []).append((raw["rows"], words))
        program, rows = build_program(index, raw, ge_areas)
        programs.append(program)
        report.extend(rows)
    # A person can sign off a section whose units do not reconcile. The sign-off is tied
    # to the exact catalog text of that section: if the text changes, the build stops.
    reviewed = (
        json.loads(args.reviewed.read_text(encoding="utf-8"))
        if args.reviewed.is_file()
        else {}
    )
    by_section = {(row["program"], row["block"]): row for row in report}
    areas_by_section = {
        (program["name"], area["title"]): area
        for program in programs
        for area in program["areas"]
    }
    for entry in reviewed.get("sections", []):
        key = (entry["pathway"], entry["section"])
        row = by_section.get(key)
        # A sign-off is a decision about exact catalog text. Another year's catalog
        # that prints the same pathway section word for word is covered by it; any
        # difference in the text and it is not.
        if entry["catalogYear"] != args.catalog_year and (
            row is None or row["sectionSha256"] != entry["sectionSha256"]
        ):
            continue
        if row is None:
            parser.error(
                f"reviewed section not found in the {args.catalog_year} catalog: {key}"
            )
        if row["sectionSha256"] != entry["sectionSha256"]:
            parser.error(
                f"the catalog text of a reviewed section has changed: {key}. Review it again "
                f"and update sectionSha256 to {row['sectionSha256']} in {args.reviewed.name}."
            )
        if row["status"] in ("unreconciled", "no-printed-units"):
            row["status"] = areas_by_section[key]["reconciliation"] = "reviewed"
            row["notes"].append(
                f"verified by review: {entry['decidedBy']}, {entry['decidedOn']}"
            )
            areas_by_section[key]["review"] = {
                "decidedBy": entry["decidedBy"],
                "decidedOn": entry["decidedOn"],
                "basis": entry["basis"],
            }
    counts: dict[str, int] = {}
    for row in report:
        counts[row["status"]] = counts.get(row["status"], 0) + 1
    verified = {"reconciled", "approximated", "no-courses", "optional", "reviewed"}
    fully = sum(
        1 for p in programs if all(a["reconciliation"] in verified for a in p["areas"])
    )
    meta = {
        "catalogYear": args.catalog_year,
        "source": args.catalog.name,
        "sourceSha256": hashlib.sha256(source).hexdigest(),
        "programs": len(programs),
        "blocks": len(report),
        "blockStatus": dict(sorted(counts.items())),
        "programsFullyReconciled": fully,
        "duplicateHeadingsSkipped": duplicates,
        "schemaVersion": 1,
    }
    args.out_dir.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(
        {"meta": meta, "programs": programs}, ensure_ascii=False, separators=(",", ":")
    )
    year = args.catalog_year
    if not re.fullmatch(r"\d{4}-\d{4}", year):
        parser.error("--catalog-year must look like 2026-2027")
    (args.out_dir / f"catalog-{year}.js").write_text(
        "// Generated by scripts/build-catalog-structure.py - do not edit by hand.\n"
        "window.ZTC_CATALOGS = window.ZTC_CATALOGS || {};\n"
        f'window.ZTC_CATALOGS["{year}"] = {payload};\n',
        encoding="utf-8",
    )
    (args.out_dir / f"catalog-{year}-reconciliation.json").write_text(
        json.dumps({"meta": meta, "blocks": report}, ensure_ascii=False, indent=1)
        + "\n",
        encoding="utf-8",
    )
    print(json.dumps(meta, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
