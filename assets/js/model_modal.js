// assets/js/model_modal.js
// assets/js/model_modal.js
class ModelModal {
    constructor() {
        this.dropdown = null
        this.hideTimeout = null
        this.button = null
        this.setupButton()
    }

    setupButton() {
        this.button = document.getElementById('choosemodel')
        if (!this.button) return

        this.button.addEventListener('mouseenter', (e) => {
            if (this.hideTimeout) {
                clearTimeout(this.hideTimeout)
                this.hideTimeout = null
            }
            this.showModels(e)
        })

        this.button.addEventListener('mouseleave', () => {
            this.hideTimeout = setTimeout(() => {
                this.hideDropdown()
            }, 300)
        })

        document.addEventListener('click', (e) => {
            if (this.dropdown && !this.dropdown.contains(e.target) && e.target !== this.button) {
                this.hideDropdown()
            }
        })
    }

    showModels(event) {
        if (this.dropdown) {
            this.hideDropdown()
        }

        if (window.updatestatus) {
            window.updatestatus('Loading models...')
        }

        fetch(`assets/php/ollama_api.php?action=list`)
            .then(response => response.json())
            .then(data => {
                if (data.success && data.models && data.models.length > 0) {
                    this.createDropdown(data.models)
                    if (window.updatestatus) {
                        window.updatestatus('Select a model')
                    }
                } else {
                    if (window.updatestatus) {
                        window.updatestatus('No models available')
                    }
                    this.showNoModelsMessage()
                }
            })
            .catch(error => {
                console.error('Error loading models:', error)
                if (window.updatestatus) {
                    window.updatestatus('Failed to load models')
                }
            })
    }

    createDropdown(models) {
        this.dropdown = document.createElement('div')
        this.dropdown.className = 'model-dropdown'
        this.dropdown.style.position = 'absolute'
        this.dropdown.style.backgroundColor = '#f1e8dc'
        this.dropdown.style.border = '2px solid #964b00'
        this.dropdown.style.borderRadius = '8px'
        this.dropdown.style.padding = '0'
        this.dropdown.style.margin = '0'
        this.dropdown.style.zIndex = '200'
        this.dropdown.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)'
        this.dropdown.style.minWidth = '200px'
        this.dropdown.style.maxHeight = '400px'
        this.dropdown.style.overflowY = 'auto'

        const rect = this.button.getBoundingClientRect()
        this.dropdown.style.left = `${rect.left}px`
        this.dropdown.style.top = `${rect.bottom}px`

        const ul = document.createElement('ul')
        ul.style.listStyle = 'none'
        ul.style.padding = '0'
        ul.style.margin = '0'

        models.forEach(model => {
            const li = document.createElement('li')
            li.style.padding = '4px 12px'
            li.style.cursor = 'pointer'
            li.style.color = '#964b00'
            li.style.whiteSpace = 'nowrap'
            li.textContent = `${model.name} (${(parseInt(model.size) / 1024 / 1024 / 1024).toFixed(1)} GB)`

            li.addEventListener('mouseenter', () => {
                li.style.backgroundColor = '#e6d9c5'
            })

            li.addEventListener('mouseleave', () => {
                li.style.backgroundColor = 'transparent'
            })

            li.addEventListener('click', (e) => {
                e.stopPropagation()
                this.selectModel(model.name)
                this.hideDropdown()
            })

            ul.appendChild(li)
        })

        this.dropdown.appendChild(ul)
        document.body.appendChild(this.dropdown)

        this.dropdown.addEventListener('mouseleave', () => {
            this.hideTimeout = setTimeout(() => {
                this.hideDropdown()
            }, 300)
        })

        this.dropdown.addEventListener('mouseenter', () => {
            if (this.hideTimeout) {
                clearTimeout(this.hideTimeout)
                this.hideTimeout = null
            }
        })
    }

    showNoModelsMessage() {
        const msgDiv = document.createElement('div')
        msgDiv.className = 'model-dropdown'
        msgDiv.style.position = 'absolute'
        msgDiv.style.backgroundColor = '#e6d5bf'
        msgDiv.style.border = '2px solid #964b00'
        msgDiv.style.borderRadius = '8px'
        msgDiv.style.padding = '8px 12px'
        msgDiv.style.color = '#964b00'
        msgDiv.style.fontSize = '12px'
        msgDiv.textContent = 'No models available'

        const rect = this.button.getBoundingClientRect()
        msgDiv.style.left = `${rect.left}px`
        msgDiv.style.top = `${rect.bottom}px`
        document.body.appendChild(msgDiv)

        setTimeout(() => {
            if (msgDiv && msgDiv.parentNode) {
                msgDiv.remove()
            }
        }, 2000)
    }

    selectModel(modelName) {
        if (window.updatestatus) {
            window.updatestatus(`Updating model to ${modelName}...`)
        }

        fetch(`assets/data/config.json?_=${Date.now()}`)
            .then(res => res.json())
            .then(config => {
                const profile = config.filesetconfig || 'ragcode'

                return fetch('assets/php/update_model.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        profile: profile,
                        model: modelName
                    })
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    if (window.updatestatus) {
                        window.updatestatus(`Model updated to ${modelName}. Click Load Model button to load.`)
                    }
                } else {
                    if (window.updatestatus) {
                        window.updatestatus('Failed to update model')
                    }
                    alert('Failed to update model: ' + (data.error || 'Unknown error'))
                }
            })
            .catch(error => {
                console.error('Error updating model:', error)
                if (window.updatestatus) {
                    window.updatestatus('Error updating model')
                }
                alert('Error updating model: ' + error.message)
            })
    }

    hideDropdown() {
        if (this.dropdown) {
            this.dropdown.remove()
            this.dropdown = null
        }
    }
}

window.ModelModal = ModelModal