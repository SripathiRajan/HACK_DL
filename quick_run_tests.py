import sys
sys.path.append('i:/DriveLegal')
import json
import re

from backend.main import agent

test_cases_file = 'i:/DriveLegal/test_cases.txt'
results_file = 'i:/DriveLegal/test_results.txt'

with open(test_cases_file, 'r', encoding='utf-8') as f:
    lines = f.readlines()

history = []

with open(results_file, 'w', encoding='utf-8') as out_f:
    out_f.write('Test Results\n')
    out_f.write('=' * 50 + '\n\n')

    for line in lines:
        line = line.strip()
        match = re.match(r'^(\d+)\.\s+(.*)', line)
        if match:
            num = match.group(1)
            query = match.group(2)
            
            if num in ['1', '11', '17', '25', '33', '38', '43', '48']:
                history = []
            
            print(f'Running test {num}: {query}')
            
            gps = {'latitude': 13.01, 'longitude': 80.23} if '13.01' in query or 'GPS' in query else None
            
            try:
                # Force offline fallback for testing
                agent.ollama_available = False
                agent.gemini_available = False
                
                result = agent.run(query, gps)
                answer = result.get('response', 'No response')
                
                history.append({'role': 'user', 'parts': [query]})
                history.append({'role': 'model', 'parts': [answer]})
                
                out_f.write(f'Test {num}: {query}\n')
                out_f.write(f'Answer: {answer}\n')
                out_f.write('-' * 40 + '\n')
            except Exception as e:
                print(f'Error running test {num}: {e}')
                out_f.write(f'Test {num}: {query}\n')
                out_f.write(f'Error: {e}\n')
                out_f.write('-' * 40 + '\n')

print("Tests completed successfully!")
