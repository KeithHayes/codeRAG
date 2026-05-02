import os
import subprocess

def git_save_changes(commit_message="dev code saved"):
    try:
        # Stage all modified and untracked files.
        # Removed 'check=True' here. If 'git add .' exits with status 1 due to ignored files,
        # it will now proceed without raising an exception, but it will still stage other non-ignored files.
        # Capture output to check for warnings/errors later.
        add_result = subprocess.run(["git", "add", "."], capture_output=True, text=True)

        # Check for stderr from 'git add' to see if there were warnings about ignored files.
        if add_result.stderr:
            # You can make this message more specific if desired, e.g.,
            # if "ignored by one of your .gitignore files" in add_result.stderr:
            print(f"⚠️ Git add completed with warnings (e.g., ignored files): {add_result.stderr.strip()}")

        # Check if anything is actually staged (i.e., added to the index)
        # This correctly checks for changes *that were successfully staged*,
        # regardless of whether some files were ignored by 'git add .'.
        diff_result = subprocess.run(["git", "diff", "--cached", "--quiet"])
        if diff_result.returncode == 0:
            print("⚠️ Nothing staged for commit.")
            return False

        # Proceed with commit. This *should* have check=True to ensure the commit itself succeeds.
        subprocess.run(["git", "commit", "-m", commit_message], check=True)
        print("✅ Git commit completed.")
        return True

    except subprocess.CalledProcessError as e:
        # This block will now primarily catch errors from 'git commit' or other critical failures
        # not related to 'git add' ignoring files.
        print(f"❌ Git command failed: {e}. Stderr: {e.stderr.strip() if e.stderr else 'N/A'}")
        print(f"Stdout: {e.stdout.strip() if e.stdout else 'N/A'}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error during Git operation: {e}")
        return False


def create_report():
    # Base directory for the project
    base_path = '/var/www/html/doomsteadRAG'
    ollama_path = '/home/kdog/openwebui'

    # Paths to include in the report
    boilerplate_files = [
        os.path.join(base_path, 'assets', 'docs', 'task.txt'),
        #os.path.join(base_path, 'assets', 'docs', 'backannotate.txt'),
        os.path.join(base_path, 'assets', 'docs', 'boilerplate.txt'),
        #os.path.join(base_path, 'assets', 'docs', 'as-built-specification.txt'),
        #os.path.join(base_path, 'assets','data','transcripts', 'rawtranscript.txt'),
        os.path.join(base_path, 'assets','data','transcripts', 'sanstimestamps.txt'),
        os.path.join(base_path, 'assets','data','transcripts', 'sansdisfluencies.txt'),
        #os.path.join(base_path, 'assets','data','transcripts', 'transcriptoutput.txt'),
    ]

    debug_files = [
        #os.path.join(base_path, 'assets', 'data', 'debug', 'after_timestamp_removal_output.txt'),
    ]

    css_files = [
        #os.path.join(base_path, 'assets', 'css', 'rag.css'),
        #os.path.join(base_path, 'assets', 'css', 'toolbar.css'),
        #os.path.join(base_path, 'assets', 'css', 'toolbarbuttons.css'),
        #os.path.join(base_path, 'assets', 'css', 'w3.css'),
    ]

    js_files = [
        #os.path.join(base_path, 'assets', 'js', 'build_modal.js'),
        #os.path.join(base_path, 'assets', 'js', 'clipboard_modal.js'),
        #os.path.join(base_path, 'assets', 'js', 'model_modal.js'),
        os.path.join(base_path, 'assets', 'js', 'rag.js'),
        #os.path.join(base_path, 'assets', 'js', 'toolbar.js'),
        os.path.join(base_path, 'assets', 'js', 'processtranscript.js'),
    ]

    php_files = [
        os.path.join(base_path, 'index.php'),
        #os.path.join(base_path, 'assets', 'php', 'auto_load_model.php'),
        os.path.join(base_path, 'assets', 'php', 'clean_disfluencies.php'),
        #os.path.join(base_path, 'assets', 'php', 'force_reload_model.php'),
        #os.path.join(base_path, 'assets', 'php', 'fullbuilder.php'),
        #os.path.join(base_path, 'assets', 'php', 'ollama_api.php'),
        os.path.join(base_path, 'assets', 'php', 'process_transcript.php'),
        os.path.join(base_path, 'assets', 'php', 'rag.php'),
        os.path.join(base_path, 'assets', 'php', 'remove_timestamps.php'),
        #os.path.join(base_path, 'assets', 'php', 'save_config.php'),
        #os.path.join(base_path, 'assets', 'php', 'save_debug.php'),
        os.path.join(base_path, 'assets', 'php', 'save_disfluencies.php'),
        #os.path.join(base_path, 'assets', 'php', 'show_log.php'),
        #os.path.join(base_path, 'assets', 'php', 'update_model.php'),
        os.path.join(base_path, 'assets', 'php', 'save_transcript_output.php'),
    ]

    py_files = [
        #os.path.join(base_path, 'assets', 'py', 'api_server.py'),
        #os.path.join(base_path, 'assets', 'py', 'chunker.py'),
        os.path.join(base_path, 'assets', 'py', 'disfluencies.py'),
        #os.path.join(base_path, 'assets', 'py', 'document_loader.py'),
        #os.path.join(base_path, 'assets', 'py', 'faiss_builder.py'),
        #os.path.join(base_path, 'assets', 'py', 'faiss_query_wrapper.py'),
        #os.path.join(base_path, 'assets', 'py', 'faiss_query.py'),
        #os.path.join(base_path, 'assets', 'py', 'logger.py'),
        #os.path.join(base_path, 'assets', 'py', 'remove_timestamps.py'),
        #os.path.join(base_path, 'assets', 'py', 'report.py'),
        #os.path.join(base_path, 'assets', 'py', 'simple_text_loader.py'),
        #os.path.join(base_path, 'assets', 'py', 'start_api_server.py'),
        #os.path.join(base_path, 'assets', 'py', 'gpu_monitor.py'),
        #os.path.join(base_path, 'assets', 'py', 'requirements.txt'),
        #os.path.join(base_path, 'assets', 'py', 'youtube_rag.py'),
    ]

    yaml_files = [
        #os.path.join(base_path, 'assets', 'yaml', 'doomstead.yaml'),
        #os.path.join(base_path, 'assets', 'yaml', 'mainpage.yaml'),
        #os.path.join(base_path, 'assets', 'yaml', 'ragcode.yaml'),
        #os.path.join(base_path, 'assets', 'yaml', 'ragdocs.yaml '),
        os.path.join(base_path, 'assets', 'yaml', 'transcript.yaml '),
        #os.path.join(base_path, 'assets', 'yaml', 'plantdiseases.yaml '),
        #os.path.join(base_path, 'assets', 'yaml', 'socialism.yaml '),
    ]

    file_files = [
        #os.path.join(base_path, 'assets', 'files', 'source.html'),
    ]

    # Report file path
    report_file = os.path.join(base_path, 'assets', 'logs', 'report.txt')

    try:
        with open(report_file, 'w', encoding='utf-8') as report:
            report.write("=== homedog ===\n\n")

            # DOC section
            for doc_file in boilerplate_files:
                if os.path.exists(doc_file):
                    with open(doc_file, 'r', encoding='utf-8') as f:
                        report.write(f"=== DOCS {os.path.basename(doc_file)} ===\n")
                        report.write(f.read())
                        report.write("\n\n")

            # CSS section
            for css_file in css_files:
                if os.path.exists(css_file):
                    with open(css_file, 'r', encoding='utf-8') as f:
                        report.write(f"=== CSS assets/css/{os.path.basename(css_file)} ===\n")
                        report.write(f.read())
                        report.write("\n\n")

            # LOG section
            for debug_file in debug_files:
                if os.path.exists(debug_file):
                    with open(debug_file, 'r', encoding='utf-8') as f:
                        report.write(f"=== LOGS assets/data/debug/{os.path.basename(debug_file)} ===\n")
                        report.write(f.read())
                        report.write("\n\n")
            # JS section
            for js_file in js_files:
                if os.path.exists(js_file):
                    with open(js_file, 'r', encoding='utf-8') as f:
                        report.write(f"=== JS assets/js/{os.path.basename(js_file)} ===\n")
                        report.write(f.read())
                        report.write("\n\n")

            # PHP section
            for php_file in php_files:
                if os.path.exists(php_file):
                    with open(php_file, 'r', encoding='utf-8') as f:
                        report.write(f"=== PHP doomstead/{os.path.basename(php_file)} ===\n")
                        report.write(f.read())
                        report.write("\n\n")

            # Python section
            for py_file in py_files:
                if os.path.exists(py_file):
                    with open(py_file, 'r', encoding='utf-8') as f:
                        report.write(f"=== PY assets/py/{os.path.basename(py_file)} ===\n")
                        report.write(f.read())
                        report.write("\n\n")

            # Yaml section
            for yaml_file in yaml_files:
                if os.path.exists(yaml_file):
                    with open(yaml_file, 'r', encoding='utf-8') as f:
                        report.write(f"=== YAML assets/yaml/{os.path.basename(yaml_file)} ===\n")
                        report.write(f.read())
                        report.write("\n\n")

            # Files section
            for file_file in file_files:
                if os.path.exists(file_file):
                    with open(file_file, 'r', encoding='utf-8') as f:
                        report.write(f"=== PY assets/files/{os.path.basename(file_file)} ===\n")
                        report.write(f.read())
                        report.write("\n\n")

        print(f"✅ Created report at: {report_file}")

        # Call git save after successful report creation
        # git_save_changes()

        return True

    except FileNotFoundError as e:
        print(f"❌ File not found: {str(e)}")
        return False
    except Exception as e:
        print(f"❌ An error occurred: {str(e)}")
        return False

if __name__ == "__main__":
    create_report()