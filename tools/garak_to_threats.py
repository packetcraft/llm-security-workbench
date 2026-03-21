#!/usr/bin/env python3
"""
garak_to_threats.py
====================
Converts a garak LLM vulnerability scanner report (`.report.jsonl` or `.hitlog.jsonl`)
into a category block compatible with the LLM Security Workbench `sample_threats.json` format.

Usage:
    python scripts/garak_to_threats.py --input garak.XXXX.report.jsonl --output output.json

The output can then be appended to or merged with `test/sample_threats.json`.

Source: https://github.com/NVIDIA/garak
"""

import json
import argparse
import sys
from pathlib import Path


def parse_garak_jsonl(path: Path) -> list[dict]:
    """Extract all `attempt` entries from a garak JSONL file."""
    threats = []
    seen_prompts = set()

    with open(path, encoding="utf-8") as f:
        for lineno, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError as e:
                print(f"  [warn] Line {lineno}: skipping invalid JSON — {e}", file=sys.stderr)
                continue

            if entry.get("entry_type") != "attempt":
                continue

            # Extract prompt from multiple possible locations garak uses
            prompt = (
                entry.get("prompt")
                or (entry.get("inputs") or [None])[0]
                or next(
                    (m.get("content") for m in entry.get("messages", []) if m.get("role") == "user"),
                    None
                )
            )

            if not prompt:
                continue

            # Deduplicate by first 80 chars
            key = prompt[:80]
            if key in seen_prompts:
                continue
            seen_prompts.add(key)

            # Build a human-readable type label from the probe classname
            raw_type = entry.get("probe_classname") or entry.get("probe") or "Garak Probe"
            type_label = raw_type.removeprefix("garak.probes.").replace(".", " › ")

            threats.append({
                "type": type_label,
                "example": prompt,
            })

    return threats


def main():
    parser = argparse.ArgumentParser(description="Convert a garak JSONL report to sample_threats.json format.")
    parser.add_argument("--input", required=True, help="Path to garak .report.jsonl or .hitlog.jsonl")
    parser.add_argument("--output", required=True, help="Path to output JSON file")
    parser.add_argument(
        "--category-name",
        default="Garak Import",
        help="Category name for the imported threats (default: 'Garak Import')"
    )
    parser.add_argument(
        "--category-id",
        default="garak-import",
        help="categoryId slug for the imported threats (default: 'garak-import')"
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)

    if not input_path.exists():
        print(f"Error: File not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    print(f"Parsing {input_path} ...")
    threats = parse_garak_jsonl(input_path)

    if not threats:
        print("No 'attempt' entries found. Check that the file is a valid garak report.", file=sys.stderr)
        sys.exit(1)

    print(f"Extracted {len(threats)} unique probes.")

    category_block = {
        "category": args.category_name,
        "categoryId": args.category_id,
        "description": f"Imported from garak probe report: {input_path.name}",
        "threats": threats,
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump([category_block], f, indent=2, ensure_ascii=False)

    print(f"Written to {output_path}")
    print(f"\nTo merge into sample_threats.json, append the category block to that file's top-level array.")


if __name__ == "__main__":
    main()
