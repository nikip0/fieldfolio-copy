"""
Ingest data into a local Chroma collection using OpenAI embeddings.

Requirements:
  pip install chromadb openai

Usage:
  export OPENAI_API_KEY="sk-..."
  python3 scripts/ingest_chroma.py

This will create a Chroma collection named 'plantprofit' on the local Chroma (python) instance.
If you prefer to run the Chroma REST server instead, see Chroma docs and set CHROMA_SERVER_URL.
"""
import json
import os
from pathlib import Path

try:
    import chromadb
    from chromadb.config import Settings
except Exception as e:
    print("Missing chromadb Python package. Install with: pip install chromadb")
    raise

try:
    import openai
except Exception as e:
    print("Missing openai package. Install with: pip install openai")
    raise

OPENAI_KEY = os.getenv('OPENAI_API_KEY')
if not OPENAI_KEY:
    raise RuntimeError('Please set OPENAI_API_KEY environment variable')
openai.api_key = OPENAI_KEY

DATA_DIR = Path(__file__).resolve().parents[1] / 'data'
CROPS_FILE = DATA_DIR / 'crops.json'

if not CROPS_FILE.exists():
    raise RuntimeError(f'Missing data file: {CROPS_FILE}')

with open(CROPS_FILE, 'r') as f:
    crops = json.load(f)

# Flatten docs
docs = []
for section, items in crops.items():
    for key, val in items.items():
        docs.append({
            'id': f'{section}_{key}',
            'text': json.dumps(val),
            'metadata': { 'section': section, 'key': key }
        })

# Create embeddings using OpenAI
print(f'Creating embeddings for {len(docs)} docs...')
embeddings = []
for d in docs:
    r = openai.Embedding.create(model='text-embedding-3-small', input=d['text'])
    embeddings.append(r['data'][0]['embedding'])

# Create Chroma client and collection
client = chromadb.Client(Settings(chroma_db_impl="duckdb+parquet", persist_directory=str(DATA_DIR / 'chroma_db')))
collection = client.get_or_create_collection(name='plantprofit')

# Upsert documents into collection
ids = [d['id'] for d in docs]
metadatas = [d['metadata'] for d in docs]
documents = [d['text'] for d in docs]

collection.upsert(ids=ids, metadatas=metadatas, documents=documents, embeddings=embeddings)

# Persist and print summary
client.persist()
print('Ingest complete. Collection: plantprofit')
print(f'Indexed {len(ids)} documents.')
