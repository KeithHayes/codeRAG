import os

def list_files_to_common_file(input_directory, output_directory, output_file):
    """
    Lists all target files (.py, requirements.txt, config.yaml/.yml) in the specified directory
    and writes their contents to an output file, separated by filename metadata.
    
    Args:
        directory (str): Path to the directory to search for files
        output_file (str): Path to the output file to be created/overwritten
    """
    target_files = []
    
    with open(output_file, 'w', encoding='utf-8') as out_f:
        # Get all files in the directory that match our targets
        for f in os.listdir(input_directory):
            lower_f = f.lower()
            if (lower_f.endswith('.py') or 
                lower_f == 'requirements.txt' or 
                lower_f in ('config.yaml', 'config.yml')):
                target_files.append(f)
        
        if not target_files:
            out_f.write("No target files found in the directory.\n")
            return
        
        for file in sorted(target_files):
            # Write separator and filename metadata
            out_f.write(f"\n{'=' * 25} {file} {'=' * 25}\n\n")
            
            # Write the content of the file
            file_path = os.path.join(output_directory, file)
            try:
                with open(file_path, 'r', encoding='utf-8') as in_f:
                    out_f.write(in_f.read())
                    out_f.write('\n')  # Add a newline after each file's content
            except Exception as e:
                out_f.write(f"Error reading {file}: {str(e)}\n")

if __name__ == "__main__":
    # Example usage - change these paths as needed
    # input_directory = '.'  # Current directory
    input_directory = '/home/kdog/text-generation-webui/extensions/simplerag'
    output_directory = '.'  # Current directory
    output_filename = 'combined_files.txt'
    
    list_files_to_common_file(input_directory, input_directory, output_filename)
    print(f"All target files in '{input_directory}' have been combined into '{output_filename}'")