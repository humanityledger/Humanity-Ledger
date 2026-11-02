#!/usr/bin/env python3
"""Recalcula la nota de Humanity Ledger a partir de docs/antigravity/backlog.csv.

Uso:
  python3 score.py backlog.csv                 # nota actual
  python3 score.py backlog.csv --open-high 2   # hay 2 vulnerabilidades críticas/altas abiertas conocidas

Una tarea cuenta como terminada solo si su columna `estado` es exactamente "Hecha".
"""
import csv
import sys

BASE = {"SEG": 35, "MSG": 40, "ZK": 15, "SIM": 28, "UI": 70}
NAMES = {"SEG": "Seguridad, auth, no custodia", "MSG": "Mensajería, llamadas y escala",
         "ZK": "Rigor ZK (Aztec)", "SIM": "Cero simulaciones", "UI": "Marca, UI y móvil"}


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    open_high = 0
    if "--open-high" in sys.argv:
        open_high = int(sys.argv[sys.argv.index("--open-high") + 1])

    rows = list(csv.DictReader(open(sys.argv[1], encoding="utf-8")))
    done = {r["id"] for r in rows if r["estado"].strip() == "Hecha"}

    total, got = {}, {}
    for r in rows:
        p, w = r["pilar"], int(r["peso"])
        total[p] = total.get(p, 0) + w
        if r["id"] in done:
            got[p] = got.get(p, 0) + w

    score = {p: BASE[p] + (100 - BASE[p]) * got.get(p, 0) / total[p] for p in BASE}

    caps = []
    def cap(pillars, limit, reason):
        for p in pillars:
            if score[p] > limit:
                score[p] = limit
        caps.append(f"tope {limit} en {', '.join(pillars)}: {reason}")

    all_p = list(BASE)
    if any(r["id"].startswith("A-") and r["id"] not in done for r in rows):
        cap(["SEG"], 40, "queda abierta alguna tarea del bloque A")
    if open_high > 0:
        cap(["SEG"], 50, f"{open_high} vulnerabilidades críticas o altas abiertas")
    if not {"J-001", "J-002", "J-003", "J-004", "J-005"} <= done:
        cap(all_p, 80, "la CI no está en verde (J-001 a J-005)")
    if got.get("GATE", 0) / total["GATE"] < 0.8:
        cap(all_p, 85, "menos del 80 % del peso del bloque J terminado")
    if "B-039" not in done:
        cap(["SEG"], 90, "sin pentest externo cerrado (B-039)")
    if "H-037" not in done:
        cap(["ZK"], 90, "sin auditoría externa de contratos (H-037)")
    if "G-014" not in done:
        cap(["MSG"], 90, "sin prueba de carga con 200.000 clientes (G-014)")

    print(f"Tareas terminadas: {len(done)} de {len(rows)}")
    for p in BASE:
        print(f"  {NAMES[p]:32s} {score[p]:5.1f}")
    print(f"NOTA GLOBAL: {int(sum(score.values()) / len(score))}/100")
    lec = rows and sum(int(r['peso']) for r in rows if r['pilar'] == 'LEC' and r['id'] in done)
    print(f"Conferencias (aparte): {60 + 40 * lec / total['LEC']:.0f}/100")
    if caps:
        print("Topes activos:")
        for c in caps:
            print("  - " + c)


if __name__ == "__main__":
    main()
