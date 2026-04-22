// assets/js/clipboard_modal.js
class ClipboardModal {
    constructor(onSave, onCancel) {
        this.modal = null
        this.onSave = onSave
        this.onCancel = onCancel
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

        const dialog = document.createElement('div')
        dialog.style.backgroundColor = '#e6d5bf'
        dialog.style.padding = '20px'
        dialog.style.borderRadius = '8px'
        dialog.style.width = '80%'
        dialog.style.maxWidth = '600px'
        dialog.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)'

        const title = document.createElement('h3')
        title.textContent = 'Paste Transcript'
        title.style.color = '#964B00'
        title.style.marginTop = '0'
        title.style.marginBottom = '15px'
        title.style.textAlign = 'center'

        this.textarea = document.createElement('textarea')
        this.textarea.style.width = '100%'
        this.textarea.style.height = '300px'
        this.textarea.style.padding = '10px'
        this.textarea.style.backgroundColor = '#ffedd4'
        this.textarea.style.border = '2px solid #523A28'
        this.textarea.style.borderRadius = '4px'
        this.textarea.style.fontFamily = 'monospace'
        this.textarea.style.fontSize = '14px'
        this.textarea.style.resize = 'vertical'
        this.textarea.placeholder = 'Press Ctrl+V to paste your transcript here...'

        const buttonContainer = document.createElement('div')
        buttonContainer.style.display = 'flex'
        buttonContainer.style.justifyContent = 'space-between'
        buttonContainer.style.marginTop = '15px'
        buttonContainer.style.gap = '10px'

        const saveBtn = document.createElement('button')
        saveBtn.textContent = 'Save Transcript'
        saveBtn.style.backgroundColor = '#523A28'
        saveBtn.style.color = '#ffedd4'
        saveBtn.style.border = 'none'
        saveBtn.style.padding = '8px 16px'
        saveBtn.style.borderRadius = '4px'
        saveBtn.style.cursor = 'pointer'
        saveBtn.style.flex = '1'

        const cancelBtn = document.createElement('button')
        cancelBtn.textContent = 'Cancel'
        cancelBtn.style.backgroundColor = '#964b00'
        cancelBtn.style.color = '#ffedd4'
        cancelBtn.style.border = 'none'
        cancelBtn.style.padding = '8px 16px'
        cancelBtn.style.borderRadius = '4px'
        cancelBtn.style.cursor = 'pointer'
        cancelBtn.style.flex = '1'

        buttonContainer.appendChild(saveBtn)
        buttonContainer.appendChild(cancelBtn)

        dialog.appendChild(title)
        dialog.appendChild(this.textarea)
        dialog.appendChild(buttonContainer)
        this.modal.appendChild(dialog)
        document.body.appendChild(this.modal)

        setTimeout(() => this.textarea.focus(), 100)

        saveBtn.onclick = () => {
            const transcript = this.textarea.value.trim()
            if (!transcript) {
                alert('Please paste some text first')
                return
            }
            if (this.onSave) this.onSave(transcript)
            this.close()
        }

        cancelBtn.onclick = () => {
            if (this.onCancel) this.onCancel()
            this.close()
        }

        this.modal.onclick = (e) => {
            if (e.target === this.modal) {
                if (this.onCancel) this.onCancel()
                this.close()
            }
        }
    }

    close() {
        if (this.modal && this.modal.parentNode) {
            this.modal.remove()
        }
    }
}

window.ClipboardModal = ClipboardModal