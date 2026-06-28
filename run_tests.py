import os
import re
import time
import requests
import asyncio
import aiohttp

TEST_FILE = "test_cases_500.md"
OUTPUT_FILE = "C:\\Users\\DK11\\.gemini\\antigravity-ide\\brain\\fd263f38-1b73-46e8-b827-72dcc345236f\\test_results_500.md"
API_URL = "https://13.50.138.113.nip.io/query"

async def fetch_answer(session, num, question):
    start = time.time()
    try:
        payload = {
            "text": question,
            "conversation_history": [],
            "location": None
        }
        async with session.post(API_URL, json=payload, timeout=45) as response:
            if response.status == 200:
                data = await response.json()
                answer = data.get("response", "No response field in JSON")
            else:
                text = await response.text()
                answer = f"Error {response.status}: {text}"
    except Exception as e:
        answer = f"Exception: {str(e)}"
    
    elapsed = time.time() - start
    return num, question, answer, elapsed

async def main():
    if not os.path.exists(TEST_FILE):
        print(f"File not found: {TEST_FILE}")
        return

    with open(TEST_FILE, "r", encoding="utf-8") as f:
        content = f.read()

    # Extract all questions like "1. What is..."
    pattern = re.compile(r'^(\d+)\.\s+(.+)$', re.MULTILINE)
    matches = pattern.findall(content)
    
    if not matches:
        print("No questions found!")
        return
        
    print(f"Found {len(matches)} test cases.")

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write("# DriveLegal AI - 500 Test Case Results\n\n")

    # Run in batches to avoid overwhelming the Ollama local instance (concurrency=2)
    # Since Ollama on EC2 is a single GPU, running too many concurrent requests will queue or crash it.
    CONCURRENCY = 2
    
    async with aiohttp.ClientSession() as session:
        for i in range(0, len(matches), CONCURRENCY):
            batch = matches[i:i+CONCURRENCY]
            tasks = []
            for num, q in batch:
                tasks.append(fetch_answer(session, num, q.strip()))
            
            results = await asyncio.gather(*tasks)
            
            # Write results incrementally
            with open(OUTPUT_FILE, "a", encoding="utf-8") as f:
                for num, q, a, elapsed in results:
                    f.write(f"### {num}. {q}\n")
                    f.write(f"**Answer:** {a}\n")
                    f.write(f"*(Time: {elapsed:.2f}s)*\n\n")
                    f.write("---\n\n")
            
            print(f"Completed batch {i} to {i+len(batch)-1}. Progress: {i+len(batch)}/{len(matches)}")
            
            # Tiny sleep to let server breathe
            await asyncio.sleep(0.5)

if __name__ == "__main__":
    asyncio.run(main())
