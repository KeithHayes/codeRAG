#!/usr/bin/env python3
import os
import sys
import json
import argparse
from warnings import filterwarnings
from typing import List, Dict, Any
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_chroma import Chroma

# Suppress warnings
filterwarnings("ignore")

class VectorSearch:
    def __init__(self):
        self.config = {
            'vector_db_path': '/var/www/html/doomsteadRAG/assets/data',
            'embedding_model': 'sentence-transformers/all-mpnet-base-v2',
            'collection_name': 'doomstead_rag',
            'min_score': 0.25
        }
        self.embeddings = self._init_embeddings()
        self.vectordb = self._init_vector_db()

    def _init_embeddings(self) -> HuggingFaceEmbeddings:
        """Initialize HuggingFace embeddings model"""
        return HuggingFaceEmbeddings(
            model_name=self.config['embedding_model'],
            model_kwargs={'device': 'cpu'},
            encode_kwargs={'normalize_embeddings': True}
        )

    def _init_vector_db(self) -> Chroma:
        """Initialize Chroma vector database"""
        return Chroma(
            collection_name=self.config['collection_name'],
            persist_directory=self.config['vector_db_path'],
            embedding_function=self.embeddings
        )

    def search(self, query: str, k: int = 5) -> List[Dict[str, Any]]:
        """Perform similarity search with relevance scores"""
        try:
            docs = self.vectordb.similarity_search_with_relevance_scores(query, k=k)
            return [{
                'content': doc.page_content,
                'metadata': doc.metadata,
                'score': float(score)
            } for doc, score in docs if score > self.config['min_score']]
        except Exception as e:
            raise RuntimeError(f"Search failed: {str(e)}")

def main():
    parser = argparse.ArgumentParser(description='Doomstead RAG Vector Search')
    parser.add_argument('--query', required=True, help='Search query')
    parser.add_argument('--k', type=int, default=5, help='Number of results to return')
    
    try:
        args = parser.parse_args()
        searcher = VectorSearch()
        results = searcher.search(args.query, args.k)
        print(json.dumps(results[:args.k]))
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()