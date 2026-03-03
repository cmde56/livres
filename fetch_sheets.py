import json
import os
from typing import List, Dict, Any

from google.oauth2 import service_account
from googleapiclient.discovery import build


SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]


def get_service_account_credentials():
    raw = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON")
    if not raw:
        raise RuntimeError(
            "GOOGLE_SERVICE_ACCOUNT_JSON environment variable is not set"
        )

    try:
        info = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON") from exc

    return service_account.Credentials.from_service_account_info(info, scopes=SCOPES)


def fetch_sheet_values(
    service, spreadsheet_id: str, range_name: str
) -> List[Dict[str, Any]]:
    result = (
        service.spreadsheets()
        .values()
        .get(spreadsheetId=spreadsheet_id, range=range_name)
        .execute()
    )
    values = result.get("values", [])
    if not values:
        return []

    headers = values[0]
    rows = values[1:]

    mapped_rows: List[Dict[str, Any]] = []
    for row in rows:
        if not any(cell.strip() for cell in row if isinstance(cell, str)):
            continue

        row_dict = {
            header: row[idx] if idx < len(row) else ""
            for idx, header in enumerate(headers)
        }

        raw_priority = row_dict.get("Prioritaire", "").strip().lower()
        priority = raw_priority == "oui"

        mapped_rows.append(
            {
                "author": row_dict.get("Auteur", ""),
                "title": row_dict.get("Titre", ""),
                # New separate fields from columns C and D
                "provenance": row_dict.get("Provenance", ""),
                "format": row_dict.get("Format", ""),
                # Keep priority flag
                "priority": priority,
            }
        )

    return mapped_rows


def fetch_lus_values(
    service, spreadsheet_id: str, range_name: str
) -> List[Dict[str, Any]]:
    """Fetch the "lus" sheet and map to a minimal structure.

    The sheet is expected to expose at least two headers: "Auteur" and "Titre".
    """

    result = (
        service.spreadsheets()
        .values()
        .get(spreadsheetId=spreadsheet_id, range=range_name)
        .execute()
    )
    values = result.get("values", [])
    if not values:
        return []

    headers = values[0]
    rows = values[1:]

    mapped_rows: List[Dict[str, Any]] = []
    for row in rows:
        if not any(cell.strip() for cell in row if isinstance(cell, str)):
            continue

        row_dict = {
            header: row[idx] if idx < len(row) else ""
            for idx, header in enumerate(headers)
        }

        mapped_rows.append(
            {
                "author": row_dict.get("Auteur", ""),
                "title": row_dict.get("Titre", ""),
            }
        )

    return mapped_rows


def write_json(path: str, data) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\n")


def main() -> None:
    spreadsheet_id = os.getenv("SPREADSHEET_ID")
    if not spreadsheet_id:
        raise RuntimeError("SPREADSHEET_ID environment variable is not set")

    creds = get_service_account_credentials()
    service = build("sheets", "v4", credentials=creds, cache_discovery=False)

    # collection = fetch_sheet_values(service, spreadsheet_id, "collection!A:C")
    # Wishlist now uses separate Provenance (C) and Format (D) columns,
    # and may also include a Prioritaire column after that.
    wantlist = fetch_sheet_values(service, spreadsheet_id, "wishlist!A:E")
    lus = fetch_lus_values(service, spreadsheet_id, "lus!A:B")

    # write_json("collection.json", collection)
    write_json("wantlist.json", wantlist)
    write_json("lus.json", lus)


if __name__ == "__main__":
    main()
