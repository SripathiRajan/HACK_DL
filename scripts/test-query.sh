#!/bin/bash
curl -s -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{"text":"What is the fine for no helmet"}'
