class BuildModal {
    constructor() {
        this.modal = null;
        this.modalContent = null;
        this.title = null;
        this.statusText = null;
        this.progressContainer = null;
        this.progressBar = null;
        this.progressText = null;
        this.totalChunks = 0;
        this.currentState = 'initializing';
        this.creationTime = new Date().getTime();
        this.pollInterval = null;
        this.lastProcessedLine = '';
        this.createModal();
    }

    createModal() {
        this.modal = document.createElement('div');
        this.modal.style.position = 'fixed';
        this.modal.style.top = '0';
        this.modal.style.left = '0';
        this.modal.style.width = '100%';
        this.modal.style.height = '100%';
        this.modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
        this.modal.style.display = 'flex';
        this.modal.style.justifyContent = 'center';
        this.modal.style.alignItems = 'center';
        this.modal.style.zIndex = '10000';

        this.modalContent = document.createElement('div');
        this.modalContent.style.backgroundColor = '#e6d5bf';
        this.modalContent.style.padding = '20px';
        this.modalContent.style.borderRadius = '8px';
        this.modalContent.style.width = '60%';
        this.modalContent.style.maxWidth = '500px';
        this.modalContent.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';

        this.title = document.createElement('h3');
        this.title.textContent = 'Rebuilding Vector Store';
        this.title.style.color = '#964B00';
        this.title.style.marginTop = '0';
        this.title.style.textAlign = 'center';

        this.statusText = document.createElement('p');
        this.statusText.textContent = 'Initializing build process...';
        this.statusText.style.color = '#523A28';
        this.statusText.style.textAlign = 'center';
        this.statusText.style.margin = '20px 0';

        this.progressContainer = document.createElement('div');
        this.progressContainer.style.backgroundColor = '#e4d2ba';
        this.progressContainer.style.borderRadius = '4px';
        this.progressContainer.style.padding = '10px';
        this.progressContainer.style.marginBottom = '20px';

        this.progressBar = document.createElement('div');
        this.progressBar.style.height = '20px';
        this.progressBar.style.backgroundColor = '#523A28';
        this.progressBar.style.borderColor = '#523A28';
        this.progressBar.style.borderRadius = '4px';
        this.progressBar.style.width = '0%';
        this.progressBar.style.transition = 'width 0.3s ease';

        this.progressText = document.createElement('div');
        this.progressText.textContent = '';
        this.progressText.style.color = '#523A28';
        this.progressText.style.textAlign = 'center';
        this.progressText.style.marginTop = '5px';
        this.progressText.style.fontSize = '0.9em';

        this.progressContainer.appendChild(this.progressBar);
        this.modalContent.appendChild(this.title);
        this.modalContent.appendChild(this.statusText);
        this.modalContent.appendChild(this.progressContainer);
        this.modalContent.appendChild(this.progressText);
        this.modal.appendChild(this.modalContent);
        document.body.appendChild(this.modal);
    }

    startPolling() {
        this.pollInterval = setInterval(() => {
            fetch('assets/php/show_log.php')
                .then(response => {
                    if (!response.ok) throw new Error('Network response was not ok');
                    return response.json();
                })
                .then(data => {
                    if (data.line && data.line !== this.lastProcessedLine) {
                        this.lastProcessedLine = data.line;
                        this.processLogLine(data.line);
                    }
                })
                .catch(() => {
                    // Ignore fetch errors, keep polling
                });
        }, 1000);
    }

    parseLogTimestamp(logLine) {
        const timestampMatch = logLine.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}),\d{3}/);
        if (!timestampMatch) return 0;
        
        const dateParts = timestampMatch[1].split(/[- :]/);
        const date = new Date(
            parseInt(dateParts[0]),
            parseInt(dateParts[1]) - 1,
            parseInt(dateParts[2]),
            parseInt(dateParts[3]),
            parseInt(dateParts[4]),
            parseInt(dateParts[5])
        );
        
        return date.getTime();
    }

    processLogLine(line) {
        const lineTime = this.parseLogTimestamp(line);
        
        // Skip old log entries if we're still initializing
        if (this.currentState === 'initializing') {
            if (lineTime > this.creationTime) {
                this.currentState = 'processing';
            } else {
                return;
            }
        }

        // Extract INFO messages for status updates
        const infoMatch = line.match(/- INFO - (.*)/);
        if (infoMatch) {
            this.statusText.textContent = infoMatch[1];
        }

        // State transitions and processing
        switch (this.currentState) {

            case 'processing':
                // Handle batch processing updates
                const batchMatch = line.match(/Processed batch (\d+)\/(\d+)/);
                if (batchMatch) {
                    const currentBatch = parseInt(batchMatch[1]);
                    const totalBatches = parseInt(batchMatch[2]);
                    const percent = Math.min(Math.ceil((currentBatch / totalBatches) * 100), 100);
                    this.updateProgress(percent, `Processing batch ${currentBatch} of ${totalBatches}`);
                }
                
                // Handle completion
                if (line.includes('Build completed successfully')) {
                    this.updateProgress(100, 'Build completed successfully');
                    this.currentState = 'complete';
                    this.progressBar.style.backgroundColor = '#4CAF50';
                    
                    setTimeout(() => {
                        this.close();
                    }, 5000);
                }
                break;
        }
    }

    updateProgress(percent, status) {
        this.progressBar.style.width = `${percent}%`;
        this.progressText.textContent = `${percent}%`;
        this.statusText.textContent = status;
    }

    close() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }
        if (this.modal && this.modal.parentNode) {
            this.modal.remove();
        }
    }
}