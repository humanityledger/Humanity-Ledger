import csv

tasks_to_mark = [
    'J-001', 'J-005', 'J-007', 'J-022', 'J-023', 'J-025', 'J-033',
    'C-009', 'C-017', 'N-007', 'G-001', 'G-020', 'G-028',
    'H-034', 'H-038', 'D-029', 'M-004', 'K-001', 'K-003'
]

with open('docs/antigravity/backlog.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    fieldnames = reader.fieldnames
    rows = list(reader)

count = 0
for r in rows:
    if r['id'] in tasks_to_mark and r['estado'] != 'Hecha':
        r['estado'] = 'Hecha'
        count += 1
        print(f"Marked {r['id']}: {r['tarea'][:50]}")

with open('docs/antigravity/backlog.csv', 'w', encoding='utf-8', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)

print(f"Total newly marked: {count}")
