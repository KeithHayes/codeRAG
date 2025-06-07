# TODO

## Model definition

### Define the model to be loaded in the yaml

Each codebase has a vector store db and a sqlite db for file tracking.  Write the update function.

Loggin of errors should not be done when polling.

Does the process that loads the server end when it completes?  if not the process must die when the UI is closed.




In full_builder.py

Monitoring last line should not skip lines.  Initialize a counter, and process lines from the last line processed to 
the end of lines in every poll.