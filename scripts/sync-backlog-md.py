import csv

csv_data = {r['id']: r['estado'] for r in csv.DictReader(open('docs/antigravity/backlog.csv', encoding='utf-8'))}

with open('docs/antigravity/BACKLOG.md', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    stripped = line.strip()
    if stripped.startswith('| ID |') and 'Estado' not in stripped:
        new_lines.append(stripped + ' Estado |\n')
    elif stripped.startswith('| --- |') and stripped.count('|') == 6:
        new_lines.append(stripped + ' --- |\n')
    elif stripped.startswith('|') and stripped.endswith('|'):
        parts = [p.strip() for p in stripped.split('|')[1:-1]]
        if parts:
            task_id = parts[0]
            if task_id in csv_data and len(parts) == 5:
                status = 'Hecha' if csv_data[task_id] == 'Hecha' else 'Pendiente'
                new_lines.append(f"| {' | '.join(parts)} | {status} |\n")
            elif task_id in csv_data and len(parts) == 6:
                status = 'Hecha' if csv_data[task_id] == 'Hecha' else 'Pendiente'
                parts[5] = status
                new_lines.append(f"| {' | '.join(parts)} |\n")
            else:
                new_lines.append(line)
        else:
            new_lines.append(line)
    else:
        new_lines.append(line)

with open('docs/antigravity/BACKLOG.md', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print('BACKLOG.md synchronized successfully.')
