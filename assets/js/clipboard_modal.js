// assets/js/clipboard_modal.js
class ClipboardModal {
    constructor(onSave, onCancel) {
        this.onSave = onSave
        this.onCancel = onCancel
        this.modal = null
        this.textarea = null
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

        const modalContent = document.createElement('div')
        modalContent.style.backgroundColor = '#e6d5bf'
        modalContent.style.padding = '20px'
        modalContent.style.borderRadius = '8px'
        modalContent.style.width = '60%'
        modalContent.style.maxWidth = '600px'
        modalContent.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)'

        const title = document.createElement('h3')
        title.textContent = 'Paste Transcript'
        title.style.color = '#964B00'
        title.style.marginTop = '0'
        title.style.textAlign = 'center'

        this.textarea = document.createElement('textarea')
        this.textarea.placeholder = 'Paste your transcript here (Ctrl+V)...'
        this.textarea.style.width = '100%'
        this.textarea.style.height = '300px'
        this.textarea.style.padding = '10px'
        this.textarea.style.backgroundColor = '#ffedd4'
        this.textarea.style.border = '2px solid #523A28'
        this.textarea.style.borderRadius = '4px'
        this.textarea.style.color = '#523A28'
        this.textarea.style.fontFamily = 'monospace'
        this.textarea.style.fontSize = '14px'
        this.textarea.style.resize = 'vertical'
        this.textarea.style.marginBottom = '15px'
        this.textarea.style.boxSizing = 'border-box'

        const buttonContainer = document.createElement('div')
        buttonContainer.style.display = 'flex'
        buttonContainer.style.gap = '10px'
        buttonContainer.style.justifyContent = 'flex-end'

        const saveButton = document.createElement('button')
        saveButton.textContent = 'Save'
        saveButton.style.padding = '8px 16px'
        saveButton.style.backgroundColor = '#523A28'
        saveButton.style.color = '#ffedd4'
        saveButton.style.border = 'none'
        saveButton.style.borderRadius = '4px'
        saveButton.style.cursor = 'pointer'
        saveButton.onclick = () => this.handleSave()

        const cancelButton = document.createElement('button')
        cancelButton.textContent = 'Cancel'
        cancelButton.style.padding = '8px 16px'
        cancelButton.style.backgroundColor = '#964B00'
        cancelButton.style.color = '#ffedd4'
        cancelButton.style.border = 'none'
        cancelButton.style.borderRadius = '4px'
        cancelButton.style.cursor = 'pointer'
        cancelButton.onclick = () => this.handleCancel()

        buttonContainer.appendChild(saveButton)
        buttonContainer.appendChild(cancelButton)

        modalContent.appendChild(title)
        modalContent.appendChild(this.textarea)
        modalContent.appendChild(buttonContainer)
        this.modal.appendChild(modalContent)
        document.body.appendChild(this.modal)

        this.textarea.focus()
        
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.handleCancel()
            }
        })
    }

    handleSave() {
        const transcript = this.textarea.value.trim()
        if (!transcript) {
            alert('Please paste some transcript content before saving.')
            return
        }
        if (this.onSave) {
            this.onSave(transcript)
        }
        this.close()
    }

    handleCancel() {
        if (this.onCancel) {
            this.onCancel()
        }
        this.close()
    }

    close() {
        if (this.modal && this.modal.parentNode) {
            this.modal.remove()
        }
    }
}

window.ClipboardModal = ClipboardModal