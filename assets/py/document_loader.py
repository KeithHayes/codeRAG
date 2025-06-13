import os
from langchain_community.document_loaders import TextLoader

def load_code_documents(root_dir):
    docs = []
    for dirpath, _, filenames in os.walk(root_dir):
        for file in filenames:
            if file.endswith(('.py', '.js', '.php', '.css', '.html')):
                path = os.path.join(dirpath, file)
                try:
                    loader = TextLoader(path)
                    docs.extend(loader.load())
                except Exception as e:
                    print(f"Error loading {path}: {e}")
    return docs
