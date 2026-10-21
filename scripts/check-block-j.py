import csv
with open('docs/antigravity/backlog.csv', 'r', encoding='utf-8') as f:
    rows = list(csv.DictReader(f))

j_tasks = [r for r in rows if r['bloque'].startswith('J')]
total_w = sum(int(r['peso']) for r in j_tasks)
done_w = sum(int(r['peso']) for r in j_tasks if r['estado'] == 'Hecha')
print(f"Block J weight: {done_w} / {total_w} ({done_w/total_w*100:.1f}%)")
print("Remaining J tasks:")
for r in j_tasks:
    if r['estado'] != 'Hecha':
        print(f"  {r['id']} (peso {r['peso']}): {r['tarea'][:65]}")
