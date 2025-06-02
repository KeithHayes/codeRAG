# TODO

## Codebase Separation

### data/doomstead data/coderag
- **doomstead**: `/var/www/html/doomsteadRAG/assets/data/doomstead`  
- **coderag**: `/var/www/html/doomsteadRAG/assets/data/coderag`  

Each directory will have a vector store db and a sqlite db for file tracking.  Begin 
by enhancing the metadata in config.yaml to mark which project files belongs to.



Using the API to read model

import requests

# Define the API endpoint (default is usually http://localhost:5000)
API_URL = "http://localhost:5000/api/v1/model"

def get_loaded_model():
    try:
        response = requests.get(API_URL)
        if response.status_code == 200:
            model_data = response.json()
            print("Currently loaded model:", model_data.get("model_name"))
        else:
            print("Failed to fetch model:", response.text)
    except Exception as e:
        print("Error:", e)

get_loaded_model()





Monitoring last line should not skip lines.  Initialize a counter, and process lines from the last line processed to 
the end of lines in every poll.