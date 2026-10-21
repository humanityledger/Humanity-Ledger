# Mark multiple tasks at once
import sys

task_ids = sys.argv[1:]
path = 'docs/antigravity/backlog.csv'

with open(path, encoding='utf-8', newline='') as f:
    content = f.read()

lines = content.split('\n')
marked = []

for task_id in task_ids:
    for i, line in enumerate(lines):
        if line.startswith(task_id + ',') and ',Pendiente' in line:
            lines[i] = line.replace(',Pendiente', ',Hecha', 1)
            marked.append(task_id)
            break

with open(path, 'w', encoding='utf-8', newline='') as f:
    f.write('\n'.join(lines))

print(f'Marked as Hecha: {marked}')
