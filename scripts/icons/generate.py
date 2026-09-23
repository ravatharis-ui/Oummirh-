#!/usr/bin/env python3
"""Génère les icônes PWA d'Oummi RH.

Pas de dépendance : un encodeur PNG minimal suffit, parce que l'icône est une
forme géométrique — un anneau clair sur un carré terracotta, qui se lit « O ».

Les fichiers produits sont versionnés dans `public/`. Ce script est là pour
qu'on sache d'où ils viennent et qu'on puisse les refaire après un changement de
couleur de marque :

    python3 scripts/icons/generate.py
"""

import struct
import zlib
from pathlib import Path

# Terracotta chaud — la couleur d'accent de `globals.css`, convertie en sRGB.
BRAND = (177, 79, 66)
LIGHT = (252, 250, 247)

PUBLIC = Path(__file__).resolve().parents[2] / "public"


def png(width: int, height: int, pixels: bytes) -> bytes:
    """Encode un PNG RGBA sans filtrage. Les icônes sont petites : inutile d'optimiser."""

    def chunk(kind: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + kind
            + data
            + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)
        )

    raw = b"".join(
        b"\x00" + pixels[y * width * 4 : (y + 1) * width * 4] for y in range(height)
    )

    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


def icon(size: int, *, padding: float = 0.0, radius_ratio: float = 0.22) -> bytes:
    """Un carré arrondi terracotta, un anneau clair au centre.

    `padding` réserve la zone de sécurité qu'Android rogne sur une icône
    « maskable » : sans elle, l'anneau se ferait couper sur certains téléphones.
    """
    pixels = bytearray()

    inset = size * padding
    box = size - 2 * inset
    corner = box * radius_ratio

    centre = size / 2
    outer = box * 0.30
    inner = box * 0.19

    for y in range(size):
        for x in range(size):
            px, py = x + 0.5, y + 0.5

            # Hors du carré arrondi : transparent.
            dx = max(inset + corner - px, px - (size - inset - corner), 0)
            dy = max(inset + corner - py, py - (size - inset - corner), 0)
            in_square = (
                inset <= px <= size - inset
                and inset <= py <= size - inset
                and (dx * dx + dy * dy) <= corner * corner
            )

            if not in_square:
                pixels += bytes((0, 0, 0, 0))
                continue

            distance = ((px - centre) ** 2 + (py - centre) ** 2) ** 0.5
            colour = LIGHT if inner <= distance <= outer else BRAND
            pixels += bytes((*colour, 255))

    return png(size, size, bytes(pixels))


def main() -> None:
    PUBLIC.mkdir(exist_ok=True)

    files = {
        "icon-192.png": icon(192),
        "icon-512.png": icon(512),
        # Android rogne jusqu'à 20 % sur les bords d'une icône maskable.
        "icon-maskable-512.png": icon(512, padding=0.0, radius_ratio=0.5),
        "apple-icon.png": icon(180, radius_ratio=0.0),
    }

    for name, data in files.items():
        (PUBLIC / name).write_bytes(data)
        print(f"   {name} — {len(data) // 1024} ko")


if __name__ == "__main__":
    main()
