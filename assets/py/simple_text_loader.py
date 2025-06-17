from langchain_community.document_loaders import TextLoader
from typing import List
from langchain.schema import Document
import os

class SimpleTextLoader:
    def __init__(self, file_path: str):
        self.file_path = file_path

    def load(self) -> List[Document]:
        try:
            with open(self.file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                return [Document(
                    page_content=content,
                    metadata={
                        'source': self.file_path,
                        'file_type': 'text'
                    }
                )]
        except UnicodeDecodeError:
            with open(self.file_path, 'r', encoding='latin-1') as f:
                content = f.read()
                return [Document(
                    page_content=content,
                    metadata={
                        'source': self.file_path,
                        'file_type': 'text'
                    }
                )]
        except Exception as e:
            print(f"Error loading {self.file_path}: {str(e)}")
            return []

def load_text_documents(directory: str) -> List[Document]:
    docs = []
    for root, _, files in os.walk(directory):
        for file in files:
            if file.endswith('.txt'):
                file_path = os.path.join(root, file)
                try:
                    loader = SimpleTextLoader(file_path)
                    docs.extend(loader.load())
                except Exception as e:
                    print(f"Error loading text file {file_path}: {str(e)}")
    return docs
