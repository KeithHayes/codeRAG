// assets/js/build_modal.js
class BuildModal {
    constructor() {
        this.modal = null
        this.modalContent = null
        this.title = null
        this.statusText = null
        this.progressContainer = null
        this.progressBar = null
        this.progressText = null
        this.totalChunks = 0
        this.currentState = 'initializing'
        this.creationTime = new Date().getTime()
        this.pollInterval = null
        this.lastProcessedLine = ''
        this.lastProgressPercent = 0
        this.progressSteps = {
            'starting': 0,
            'loading_documents': 5,
            'splitting': 20,
            'creating_chunks': 30,
            'building_index': 50,
            'saving': 90,
            'complete': 100
        }
        this.createModal()
    }

    createModal() {
        this.modal = document.createElement('div')
        this.modal.style.position = 'fixed'
        this.modal.style.top = '0'
        this.modal.style.left = '0'
        this.modal.style.width = '100%'
        this.modal.style.height = '100%'
        this.modal.style.backgroundColor = 'rgba(0,0,0,0.5)'
        this.modal.style.display = 'flex'
        this.modal.style.justifyContent = 'center'
        this.modal.style.alignItems = 'center'
        this.modal.style.zIndex = '10000'

        this.modalContent = document.createElement('div')
        this.modalContent.style.backgroundColor = '#e6d5bf'
        this.modalContent.style.padding = '20px'
        this.modalContent.style.borderRadius = '8px'
        this.modalContent.style.width = '60%'
        this.modalContent.style.maxWidth = '500px'
        this.modalContent.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)'

        this.title = document.createElement('h3')
        this.title.textContent = 'Building FAISS Vector Store'
        this.title.style.color = '#964B00'
        this.title.style.marginTop = '0'
        this.title.style.textAlign = 'center'

        this.statusText = document.createElement('p')
        this.statusText.textContent = 'Initializing build process...'
        this.statusText.style.color = '#523A28'
        this.statusText.style.textAlign = 'center'
        this.statusText.style.margin = '20px 0'

        this.progressContainer = document.createElement('div')
        this.progressContainer.style.backgroundColor = '#e4d2ba'
        this.progressContainer.style.border = '1px solid #964B00'
        this.progressContainer.style.borderRadius = '4px'
        this.progressContainer.style.padding = '2px'
        this.progressContainer.style.marginBottom = '18px'

        this.progressBar = document.createElement('div')
        this.progressBar.style.height = '24px'
        this.progressBar.style.backgroundColor = '#523A28'
        this.progressBar.style.width = '0%'
        this.progressBar.style.transition = 'width 0.3s ease'
        this.progressBar.style.borderRadius = '4px'
        this.progressBar.style.textAlign = 'center'
        this.progressBar.style.lineHeight = '24px'
        this.progressBar.style.color = 'white'
        this.progressBar.style.fontSize = '12px'

        this.progressText = document.createElement('div')
        this.progressText.textContent = ''
        this.progressText.style.color = '#523A28'
        this.progressText.style.textAlign = 'center'
        this.progressText.style.marginTop = '5px'
        this.progressText.style.fontSize = '0.9em'

        this.progressContainer.appendChild(this.progressBar)
        this.modalContent.appendChild(this.title)
        this.modalContent.appendChild(this.statusText)
        this.modalContent.appendChild(this.progressContainer)
        this.modalContent.appendChild(this.progressText)
        this.modal.appendChild(this.modalContent)
        document.body.appendChild(this.modal)
    }

    startPolling() {
        this.pollInterval = setInterval(() => {
            fetch('assets/data/config.json')
                .then(res => res.json())
                .then(config => {
                    const profile = config.filesetconfig || 'ragcode'
                    return fetch('assets/php/show_log.php?profile=' + profile + '&_=' + Date.now())
                })
                .then(response => {
                    if (!response.ok) throw new Error('Network response was not ok')
                    return response.json()
                })
                .then(data => {
                    if (data.line && data.line !== this.lastProcessedLine) {
                        this.lastProcessedLine = data.line
                        this.processLogLine(data.line)
                    }
                    if (data.progress !== undefined) {
                        this.updateProgress(data.progress, data.line)
                    }
                })
                .catch(() => {})
        }, 800)
    }

    parseLogTimestamp(logLine) {
        const timestampMatch = logLine.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}),\d{3}/)
        if (!timestampMatch) return 0
        
        const dateParts = timestampMatch[1].split(/[- :]/)
        const date = new Date(
            parseInt(dateParts[0]),
            parseInt(dateParts[1]) - 1,
            parseInt(dateParts[2]),
            parseInt(dateParts[3]),
            parseInt(dateParts[4]),
            parseInt(dateParts[5])
        )
        
        return date.getTime()
    }

    getProgressFromLine(line) {
        const lowerLine = line.toLowerCase()
        
        if (lowerLine.includes('splitting') || lowerLine.includes('splitter')) {
            return { percent: this.progressSteps.splitting, status: 'Splitting documents into chunks...' }
        }
        
        if (lowerLine.includes('chunk')) {
            const chunkMatch = line.match(/(\d+)\s+chunks?/i)
            if (chunkMatch) {
                return { percent: this.progressSteps.creating_chunks, status: 'Creating ' + chunkMatch[1] + ' chunks...' }
            }
            return { percent: this.progressSteps.creating_chunks, status: 'Creating document chunks...' }
        }
        
        if (lowerLine.includes('embedding') || lowerLine.includes('faiss')) {
            return { percent: this.progressSteps.building_index, status: 'Building FAISS index with embeddings...' }
        }
        
        if (lowerLine.includes('saving') || lowerLine.includes('save')) {
            return { percent: this.progressSteps.saving, status: 'Saving FAISS index to disk...' }
        }
        
        if (lowerLine.includes('batch')) {
            const batchMatch = line.match(/batch\s+(\d+)\/(\d+)/i)
            if (batchMatch) {
                const current = parseInt(batchMatch[1])
                const total = parseInt(batchMatch[2])
                if (total > 0) {
                    const batchPercent = Math.floor((current / total) * 60)
                    const percent = Math.min(this.progressSteps.building_index + batchPercent, 89)
                    return { percent: percent, status: 'Processing batch ' + current + ' of ' + total + '...' }
                }
            }
        }
        
        return null
    }

    processLogLine(line) {
        const lineTime = this.parseLogTimestamp(line)
        const lowerLine = line.toLowerCase()
        
        if (this.currentState === 'initializing') {
            if (lineTime > this.creationTime) {
                this.currentState = 'processing'
            } else {
                return
            }
        }

        const infoMatch = line.match(/- INFO - (.*)/)
        if (infoMatch) {
            this.statusText.textContent = infoMatch[1]
        }

        const progressInfo = this.getProgressFromLine(line)
        if (progressInfo) {
            this.updateProgress(progressInfo.percent, progressInfo.status)
        }

        const createdMatch = lowerLine.match(/created\s+(\d+)\s+chunks?/)
        if (createdMatch && !this.totalChunks) {
            this.totalChunks = parseInt(createdMatch[1])
            this.updateProgress(this.progressSteps.creating_chunks, 'Created ' + this.totalChunks + ' chunks, building FAISS index...')
        }
        
        if (lowerLine.includes('documents')) {
            const docMatch = line.match(/(\d+)\s+documents?/i)
            if (docMatch) {
                this.updateProgress(this.progressSteps.starting, 'Loading ' + docMatch[1] + ' documents...')
            }
        }
        
        if (lowerLine.includes('build completed successfully')) {
            this.updateProgress(100, 'Build completed successfully!')
            this.currentState = 'complete'
            this.progressBar.style.backgroundColor = '#0f5e02'
            
            setTimeout(() => {
                this.close()
            }, 3000)
        }
        
        if (lowerLine.includes('loading') && lowerLine.includes('specification')) {
            this.updateProgress(this.progressSteps.loading_documents, 'Loading specification documents...')
        }
        
        if (lowerLine.includes('loading') && lowerLine.includes('pdf')) {
            this.updateProgress(this.progressSteps.loading_documents, 'Loading PDF documents...')
        }
        
        if (lowerLine.includes('error') || lowerLine.includes('failed')) {
            this.statusText.style.color = '#b90E0A'
            this.updateProgress(0, 'Build failed - check server logs')
            setTimeout(() => {
                this.close()
            }, 5000)
        }
    }

    updateProgress(percent, status) {
        let displayPercent = Math.min(Math.max(percent, 0), 100)
        
        if (displayPercent < this.lastProgressPercent && displayPercent < 90) {
            displayPercent = Math.max(displayPercent, this.lastProgressPercent)
        }
        
        this.lastProgressPercent = displayPercent
        
        this.progressBar.style.width = displayPercent + '%'
        this.progressBar.textContent = displayPercent + '%'
        this.progressText.textContent = displayPercent + '% complete'
        
        if (status) {
            this.statusText.textContent = status
        }
    }

    close() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval)
        }
        if (this.modal && this.modal.parentNode) {
            this.modal.remove()
        }
    }
}

window.BuildModal = BuildModal