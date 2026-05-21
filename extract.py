import json
import os

log_path = r'C:\Users\admin\.gemini\antigravity\brain\da597b11-6afa-4173-a08c-98f6f2deb42b\.system_generated\logs\overview.txt'
output_path = r'C:\Users\admin\.gemini\antigravity\scratch\vocab-app\extracted_prompt.md'

try:
    with open(log_path, 'r', encoding='utf-8') as f:
        first_line = f.readline()
        parsed = json.loads(first_line)
        with open(output_path, 'w', encoding='utf-8') as out:
            out.write(parsed['content'])
    print(f"Successfully extracted full untruncated prompt to {output_path}")
except Exception as e:
    print(f"Error extracting prompt: {e}")
