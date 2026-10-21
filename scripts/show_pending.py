import csv, sys

sys.stdout.reconfigure(encoding='utf-8')

with open('docs/antigravity/backlog.csv', encoding='utf-8') as f:
    rows = list(csv.DictReader(f))

prefixes = sys.argv[1:] if len(sys.argv) > 1 else ['B-', 'C-', 'D-', 'E-', 'F-', 'G-', 'H-', 'I-', 'J-', 'K-', 'L-', 'M-', 'N-', 'O-']

for prefix in prefixes:
    pending = [r for r in rows if r['id'].startswith(prefix) and r['estado'].strip() != 'Hecha']
    print(f"=== PENDING IN {prefix} ({len(pending)}) ===")
    for r in pending:
        print(f"  {r['id']} | peso={r['peso']} | {r['tarea']}")
        print(f"     archivos: {r['archivos']}")
        print(f"     aceptacion: {r['aceptacion']}")
