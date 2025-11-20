#!/usr/bin/env python3
"""
Utility script to pare down the Homo_sapiens.GRCh38.cdna.all.xlsx spreadsheet
to one canonical, protein-coding transcript per gene. Mirrors the logic in
src/lib/ensembl.ts (canonical -> is_canonical -> MANE -> APPRIS -> longest).

Now includes verbose progress logging so you can tell exactly which stage
the script is working on (loading, filtering, fetching, writing, etc.).
"""

import argparse
import time
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

import pandas as pd
import requests


ENSEMBL_URL = "https://rest.ensembl.org/lookup/id"
HEADERS = {"Content-Type": "application/json", "Accept": "application/json"}
BATCH_SIZE = 100  # keep modest to respect Ensembl rate limits


def log(message: str) -> None:
    """Print a status message with a consistent prefix."""
    print(f"[filter_cdna_excel] {message}", flush=True)


def chunked(seq: List[str], size: int) -> Iterable[List[str]]:
    for i in range(0, len(seq), size):
        yield seq[i : i + size]


def normalize_transcript_id(value: Optional[str]) -> Optional[str]:
    if not value or not isinstance(value, str):
        return None
    return value.split(".")[0]


def pick_transcript(gene: Dict) -> Tuple[Optional[str], str]:
    transcripts = (
        gene.get("transcripts")
        or gene.get("Transcript")
        or gene.get("transcript")
        or []
    )

    def find(predicate, reason: str):
        for tr in transcripts:
            try:
                if predicate(tr):
                    return normalize_transcript_id(tr.get("id")), reason
            except Exception:
                continue
        return None, ""

    canonical = normalize_transcript_id(gene.get("canonical_transcript"))
    if canonical:
        return canonical, "canonical_transcript"

    tid, reason = find(lambda tr: tr.get("is_canonical") == 1, "transcript_is_canonical")
    if tid:
        return tid, reason

    tid, reason = find(lambda tr: tr.get("is_mane_select") == 1, "mane_select")
    if tid:
        return tid, reason

    tid, reason = find(
        lambda tr: (tr.get("appris") or "").startswith("principal")
        or tr.get("appris") in ("P1", "P2"),
        "appris_principal",
    )
    if tid:
        return tid, reason

    protein = [
        tr for tr in transcripts if (tr.get("biotype") or "").lower() == "protein_coding"
    ]
    protein.sort(key=lambda tr: tr.get("length") or 0, reverse=True)
    if protein:
        return normalize_transcript_id(protein[0].get("id")), "longest_protein_coding"

    transcripts.sort(key=lambda tr: tr.get("length") or 0, reverse=True)
    if transcripts:
        return normalize_transcript_id(transcripts[0].get("id")), "longest_any"

    return None, "no_transcripts"


def fetch_batch(batch_ids: List[str]) -> Dict[str, Dict]:
    while True:
        resp = requests.post(
            ENSEMBL_URL,
            params={"expand": 1},
            json={"ids": batch_ids},
            headers=HEADERS,
            timeout=120,
        )
        if resp.status_code in (429, 503):
            wait = float(
                resp.headers.get("Retry-After")
                or resp.headers.get("x-ratelimit-reset")
                or 1.0
            )
            wait = min(max(wait, 0.5), 10.0)
            log(f"Rate limited (HTTP {resp.status_code}). Sleeping {wait:.1f}s…")
            time.sleep(wait)
            continue
        resp.raise_for_status()
        data = resp.json()
        if isinstance(data, list):
            data = {entry["id"]: entry for entry in data if isinstance(entry, dict)}
        return data


def main(input_path: Path, output_path: Path) -> None:
    log(f"Reading Excel from {input_path} …")
    usecols = [
        "ENST transcript ID",
        "ENSG gene ID",
        "gene_symbol",
        "gene_biotype",
        "transcript_biotype",
        "Full description",
        "Sequence",
    ]
    df = pd.read_excel(input_path, usecols=usecols, dtype=str)
    log(f"Excel loaded with {len(df):,} rows.")

    mask = (df["gene_biotype"] == "protein_coding") & (
        df["transcript_biotype"] == "protein_coding"
    )
    df = df.loc[mask].copy()
    df["ENSG_base"] = df["ENSG gene ID"].str.split(".").str[0]
    df["ENST_base"] = df["ENST transcript ID"].str.split(".").str[0]
    df = df.dropna(subset=["ENSG_base", "ENST_base"])
    df["seq_len"] = df["Sequence"].str.len()
    log(
        f"Filtered to protein-coding rows: {len(df):,} rows covering "
        f"{df['ENSG_base'].nunique():,} genes."
    )

    unique_genes = sorted(df["ENSG_base"].unique())
    canonical_map: Dict[str, Dict[str, Optional[str]]] = {}

    log("Fetching canonical transcripts from Ensembl …")
    for idx, batch in enumerate(chunked(unique_genes, BATCH_SIZE), start=1):
        data = fetch_batch(batch)
        for ensg in batch:
            gene = data.get(ensg)
            if not gene or isinstance(gene, dict) and gene.get("error"):
                reason = (
                    gene.get("error")
                    if isinstance(gene, dict)
                    else "not_found_in_batch"
                )
                canonical_map[ensg] = {"transcript": None, "reason": reason}
                continue
            transcript_id, reason = pick_transcript(gene)
            canonical_map[ensg] = {"transcript": transcript_id, "reason": reason}

        processed = min(idx * BATCH_SIZE, len(unique_genes))
        log(
            f"Resolved {processed:,}/{len(unique_genes):,} genes "
            f"({processed / len(unique_genes) * 100:.1f}%)."
        )
        time.sleep(0.05)

    log("Applying canonical selections to spreadsheet rows …")
    df["api_transcript"] = df["ENSG_base"].map(
        lambda g: canonical_map.get(g, {}).get("transcript")
    )
    df["api_reason"] = df["ENSG_base"].map(
        lambda g: canonical_map.get(g, {}).get("reason", "")
    )
    df["matches_api_selection"] = df["api_transcript"].notna() & (
        df["ENST_base"] == df["api_transcript"]
    )

    df_sorted = df.sort_values(
        ["ENSG_base", "matches_api_selection", "seq_len"],
        ascending=[True, False, False],
        kind="mergesort",
    )
    selected = df_sorted.drop_duplicates(subset="ENSG_base", keep="first").copy()
    selected["selection_reason"] = selected.apply(
        lambda row: "api_selection"
        if row["matches_api_selection"]
        else "longest_available",
        axis=1,
    )

    log(f"Writing {len(selected):,} rows to {output_path} …")
    output_cols = [
        "ENSG gene ID",
        "ENST transcript ID",
        "gene_symbol",
        "Full description",
        "Sequence",
        "gene_biotype",
        "transcript_biotype",
        "seq_len",
        "api_transcript",
        "api_reason",
        "matches_api_selection",
        "selection_reason",
    ]
    selected.to_excel(output_path, index=False, columns=output_cols)
    log("All done!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Filter Ensembl cDNA spreadsheet down to canonical protein-coding transcripts."
    )
    parser.add_argument(
        "--input",
        required=True,
        help="Path to Homo_sapiens.GRCh38.cdna.all.xlsx",
    )
    parser.add_argument(
        "--output",
        required=True,
        help="Where to write the canonical-only spreadsheet.",
    )
    args = parser.parse_args()
    main(Path(args.input).expanduser(), Path(args.output).expanduser())
