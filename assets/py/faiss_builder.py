#!/usr/bin/env python3
import os
import sys
import json
import yaml
import logging
import hashlib
import sqlite3
from pathlib import Path
from typing import List, Dict, Any
import argparse

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_community.document_loaders import TextLoader, PyPDFLoader, DirectoryLoader

PROJECT_ROOT = Path("/var/www/html/doomsteadRAG")
DATA_DIR = PROJECT_ROOT / "assets/data"

def setup_logging(profile: str):
    LOG_DIR = PROJECT_ROOT / "assets/logs"
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    LOG_FILE = LOG_DIR / f"faiss_build_{profile}.log"
    if LOG_FILE.exists():
        LOG_FILE.unlink()
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[logging.FileHandler(LOG_FILE), logging.StreamHandler()]
    )
    return logging.getLogger("DoomsteadFAISS")

class FAISSBuilder:
    def __init__(self, profile: str):
        self.profile = profile
        self.logger = setup_logging(profile)
        self.config = self._load_config()
        self.profile_dir = DATA_DIR / profile
        self.faiss_dir = self.profile_dir / "faiss_index"
        
        # Get embedding model from config (default to all-mpnet-base-v2 for backwards compatibility)
        model_name = self.config.get('embedding_model', 'sentence-transformers/all-mpnet-base-v2')
        self.logger.info(f"Using embedding model: {model_name}")
        
        self.embeddings = HuggingFaceEmbeddings(
            model_name=model_name,
            model_kwargs={'device': 'cpu'},
            encode_kwargs={'normalize_embeddings': True}
        )
        
        chunk_size = self.config.get('chunk_size', 800)
        chunk_overlap = self.config.get('chunk_overlap', 150)
        
        # Use code-specific separators if available in config
        separators = self.config.get('separators', ["\n\n", "\n", ". ", "! ", "? ", " "])
        
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            separators=separators
        )
        
        self.profile_dir.mkdir(parents=True, exist_ok=True)
        self.faiss_dir.mkdir(parents=True, exist_ok=True)
        self.logger.info(f"=== FAISS Builder for profile: {profile} ===")
    
    def _load_config(self) -> Dict:
        config_path = PROJECT_ROOT / "assets" / "py" / f"{self.profile}.yaml"
        if not config_path.exists():
            raise FileNotFoundError(f"Config not found: {config_path}")
        with open(config_path, 'r') as f:
            config = yaml.safe_load(f)
        return config.get('doomsteadRAG', {})
    
    def _get_file_extensions(self, file_type: str) -> List[str]:
        extension_map = {
            'py': ['.py'],
            'php': ['.php', '.php3', '.php4', '.php5', '.phtml'],
            'js': ['.js', '.jsx', '.mjs', '.cjs'],
            'css': ['.css', '.scss', '.less'],
            'html': ['.html', '.htm', '.xhtml'],
            'txt': ['.txt', '.md', '.rst'],
            'pdf': ['.pdf']
        }
        return extension_map.get(file_type.lower(), [])
    
    def _should_skip_file(self, file_path: str) -> bool:
        skip_patterns = ['venv', '__pycache__', '.venv', 'minified_']
        return any(pattern in str(file_path) for pattern in skip_patterns)
    
    def _load_code_documents(self) -> List[Document]:
        documents = []
        code_dirs = self.config.get('code_dirs', {})
        
        if not code_dirs:
            return documents
        
        for file_type, dirs in code_dirs.items():
            extensions = self._get_file_extensions(file_type)
            if not extensions:
                continue
            
            for dir_path in dirs:
                path = Path(dir_path) if Path(dir_path).is_absolute() else PROJECT_ROOT / dir_path
                if not path.exists():
                    self.logger.warning(f"Directory not found: {path}")
                    continue
                
                self.logger.info(f"Loading {file_type.upper()} files from {path}")
                
                for ext in extensions:
                    for file_path in path.rglob(f"*{ext}"):
                        if self._should_skip_file(str(file_path)):
                            continue
                        
                        try:
                            with open(file_path, 'r', encoding='utf-8') as f:
                                content = f.read()
                            
                            doc = Document(
                                page_content=content,
                                metadata={
                                    'source': str(file_path),
                                    'file_type': file_type
                                }
                            )
                            documents.append(doc)
                            self.logger.debug(f"  Loaded: {file_path.name}")
                            
                        except Exception as e:
                            self.logger.error(f"Error reading {file_path}: {e}")
        
        return documents
    
    def _load_pdf_documents(self) -> List[Document]:
        documents = []
        pdf_dirs = self.config.get('pdf', [])
        
        if not pdf_dirs:
            return documents
        
        for pdf_dir in pdf_dirs:
            path = Path(pdf_dir) if Path(pdf_dir).is_absolute() else PROJECT_ROOT / pdf_dir
            if not path.exists():
                self.logger.warning(f"PDF directory not found: {path}")
                continue
            
            self.logger.info(f"Loading PDF files from {path}")
            
            try:
                loader = DirectoryLoader(
                    str(path),
                    glob="**/*.pdf",
                    loader_cls=PyPDFLoader,
                    show_progress=True
                )
                pdf_docs = loader.load()
                documents.extend(pdf_docs)
                self.logger.info(f"Loaded {len(pdf_docs)} PDF documents")
                
            except Exception as e:
                self.logger.error(f"Error loading PDFs from {path}: {e}")
        
        return documents
    
    def build_index(self):
        try:
            documents = []
            
            # Load code documents if code_dirs is configured
            if self.config.get('code_dirs'):
                code_docs = self._load_code_documents()
                documents.extend(code_docs)
                self.logger.info(f"Loaded {len(code_docs)} code documents")
            
            # Load PDF documents if pdf is configured
            if self.config.get('pdf'):
                pdf_docs = self._load_pdf_documents()
                documents.extend(pdf_docs)
                self.logger.info(f"Loaded {len(pdf_docs)} PDF documents")
            
            if not documents:
                self.logger.warning("No documents found to process")
                return False
            
            self.logger.info(f"Total documents loaded: {len(documents)}")
            
            # Split into chunks
            self.logger.info("Splitting documents into chunks...")
            chunks = self.splitter.split_documents(documents)
            self.logger.info(f"Created {len(chunks)} chunks")
            
            if not chunks:
                self.logger.warning("No chunks created")
                return False
            
            # Build FAISS index
            self.logger.info("Building FAISS index...")
            vectorstore = FAISS.from_documents(chunks, self.embeddings)
            
            # Save index
            self.logger.info(f"Saving FAISS index to {self.faiss_dir}")
            vectorstore.save_local(str(self.faiss_dir))
            
            # Save metadata
            metadata = {
                'profile': self.profile,
                'embedding_model': self.config.get('embedding_model', 'sentence-transformers/all-mpnet-base-v2'),
                'total_chunks': len(chunks),
                'total_documents': len(documents),
                'chunk_size': self.config.get('chunk_size', 800),
                'chunk_overlap': self.config.get('chunk_overlap', 150),
            }
            
            with open(self.faiss_dir / 'build_info.json', 'w') as f:
                json.dump(metadata, f, indent=2)
            
            self.logger.info("Build completed successfully!")
            return True
            
        except Exception as e:
            self.logger.error(f"Build failed: {e}", exc_info=True)
            return False

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--profile', required=True)
    args = parser.parse_args()
    builder = FAISSBuilder(args.profile)
    success = builder.build_index()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()