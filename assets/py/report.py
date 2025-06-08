import os
import subprocess

def git_save_changes(commit_message="dev code saved"):
    try:
        # Stage all modified and untracked files
        subprocess.run(["git", "add", "."], check=True)

        # Check if anything is staged (i.e., added to the index)
        result = subprocess.run(["git", "diff", "--cached", "--quiet"])
        if result.returncode == 0:
            print("⚠️ Nothing staged for commit.")
            return False

        # Proceed with commit
        subprocess.run(["git", "commit", "-m", commit_message], check=True)
        print("✅ Git commit completed.")
        return True

    except subprocess.CalledProcessError as e:
        print(f"❌ Git command failed: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error during Git operation: {e}")
        return False


def create_report():
    # Base directory for the project
    base_path = '/var/www/html/doomsteadRAG'

    # Paths to include in the report
    boilerplate_files = [
        os.path.join(base_path, 'assets', 'docs', 'task.txt'),
        os.path.join(base_path, 'assets', 'docs', 'error.txt'),
        os.path.join(base_path, 'assets', 'docs', 'requirements.txt'),
        os.path.join(base_path, 'assets', 'docs', 'boilerplate.txt'),
        #os.path.join(base_path, 'assets', 'docs', 'README.md'),
    ]

    css_files = [
        os.path.join(base_path, 'assets', 'css', 'rag.css'),
        os.path.join(base_path, 'assets', 'css', 'toolbar.css')
    ]

    log_files = [
        #os.path.join(base_path, 'assets', 'logs', 'vector_build.log'),
        #os.path.join(base_path, 'assets', 'logs', 'test_query.log'),
        #os.path.join(base_path, 'assets', 'logs', 'query_doomstead.log')
    ]

    js_files = [
        os.path.join(base_path, 'assets', 'js', 'rag.js'),
        os.path.join(base_path, 'assets', 'js', 'toolbar.js'),
        os.path.join(base_path, 'assets', 'js', 'build_modal.js')
    ]

    php_files = [
        os.path.join(base_path, 'assets', 'php', 'rag.php'),
        os.path.join(base_path, 'assets', 'php', 'show_log.php'),
        os.path.join(base_path, 'assets', 'php', 'full_builder.php'),
        #os.path.join(base_path, 'assets', 'php', 'incremental_builder.php'),
        os.path.join(base_path, 'assets', 'php', 'save_config.php'),
        os.path.join(base_path, 'assets', 'php', 'load_server.php'),
        os.path.join(base_path, 'assets', 'php', 'model_api.php'),
        os.path.join(base_path, 'assets', 'php', 'test_query.php'),
        os.path.join(base_path, 'assets', 'php', 'kill_process.php'),
    ]

    py_files = [
        os.path.join(base_path, 'assets', 'py', 'chunker.py'),
        os.path.join(base_path, 'assets', 'py', 'document_loader.py'),
        os.path.join(base_path, 'assets', 'py', 'full_builder.py'),
        #os.path.join(base_path, 'assets', 'py', 'incremental_builder.py'),
        os.path.join(base_path, 'assets', 'py', 'listfiles.py'),
        os.path.join(base_path, 'assets', 'py', 'logger.py'),
        os.path.join(base_path, 'assets', 'py', 'query_doomstead.py'),
        os.path.join(base_path, 'assets', 'py', 'model_reader.py'),
        os.path.join(base_path, 'assets', 'py', 'model_loader.py'),
        os.path.join(base_path, 'assets', 'py', 'doomstead.yaml'),
        os.path.join(base_path, 'assets', 'py', 'ragcode.yaml'),
        os.path.join(base_path, 'assets', 'py', 'ragdocs.yaml')
    ]

    # Report file path
    report_file = os.path.join(base_path, 'assets', 'logs', 'report.txt')

    try:
        with open(report_file, 'w', encoding='utf-8') as report:
            report.write("=== doomstead rag web page ===\n\n")

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
            for log_file in log_files:
                if os.path.exists(log_file):
                    with open(log_file, 'r', encoding='utf-8') as f:
                        report.write(f"=== LOGS assets/logs/{os.path.basename(log_file)} ===\n")
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
                        report.write(f"=== PHP assets/php/{os.path.basename(php_file)} ===\n")
                        report.write(f.read())
                        report.write("\n\n")

            # Python section
            for py_file in py_files:
                if os.path.exists(py_file):
                    with open(py_file, 'r', encoding='utf-8') as f:
                        report.write(f"=== PY assets/py/{os.path.basename(py_file)} ===\n")
                        report.write(f.read())
                        report.write("\n\n")

        print(f"✅ Created report at: {report_file}")

        # Call git save after successful report creation
        git_save_changes()

        return True

    except FileNotFoundError as e:
        print(f"❌ File not found: {str(e)}")
        return False
    except Exception as e:
        print(f"❌ An error occurred: {str(e)}")
        return False

if __name__ == "__main__":
    create_report()
