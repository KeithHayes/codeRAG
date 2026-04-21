// JS assets/js/toolbar.js - Fixed status preservation
(function () {
  const statusDiv = document.createElement('div')
  
  let currentProfile = 'ragcode'
  let stackRunning = false
  let stackCheckInterval = null
  let isUpdatingStack = false
  let lastStatusCheck = 0
  let cachedStatus = false
  let modelLoadStatus = null // Track model load status separately
  let lastStatusUpdateTime = 0
  let statusLock = false // Prevent status from being overwritten temporarily
  
  function updateButtonVisibility() {
    const fullBuildButton = document.getElementById('button_full_build')
    if (fullBuildButton) {
      fullBuildButton.style.display = currentProfile === 'transcript' ? 'none' : ''
    }
    
    const refreshButton = document.getElementById('button_vectordb')
    if (refreshButton) {
      refreshButton.style.display = 'none'
    }
    
    const pasteButton = document.getElementById('button_pastetranscript')
    if (pasteButton) {
      pasteButton.style.display = currentProfile === 'transcript' ? '' : 'none'
    }
  }
  
  function updateStackButtonShift(isRunning) {
    const homeserverBtn = document.getElementById('homeserver')
    if (!homeserverBtn) return
    
    if (isRunning) {
      if (homeserverBtn.classList.contains('homeservershift')) {
        homeserverBtn.classList.remove('homeservershift')
      }
      stackRunning = true
      cachedStatus = true
      // Only update status if no model load status is active and not locked
      if (!modelLoadStatus && !statusLock) {
        updatestatus('Service accessible')
      }
    } else {
      if (!homeserverBtn.classList.contains('homeservershift')) {
        homeserverBtn.classList.add('homeservershift')
      }
      stackRunning = false
      cachedStatus = false
      // Only update status if no model load status is active and not locked
      if (!modelLoadStatus && !statusLock) {
        updatestatus('Starting service...')
      }
    }
  }
  
  function checkStackStatus() {
    if (isUpdatingStack) return
    
    // Don't check if status is locked (e.g., showing model loaded message)
    if (statusLock) return
    
    const now = Date.now()
    if (now - lastStatusCheck < 2000) {
      updateStackButtonShift(cachedStatus)
      return
    }
    
    lastStatusCheck = now
    
    fetch(`assets/php/ollama_api.php?action=status&_=${now}`, {
      method: 'GET',
      cache: 'no-cache',
      headers: { 'Cache-Control': 'no-cache' }
    })
      .then(response => response.json())
      .then(data => {
        const isRunning = !!(data.success && data.running)
        cachedStatus = isRunning
        updateStackButtonShift(isRunning)
      })
      .catch(() => {
        updateStackButtonShift(false)
        cachedStatus = false
      })
  }
  
  function startStackChecker() {
    if (stackCheckInterval) {
      clearInterval(stackCheckInterval)
    }
    
    // Set initial status
    updatestatus('Checking Ollama status...')
    
    checkStackStatus()
    
    stackCheckInterval = setInterval(() => {
      checkStackStatus()
    }, 3000)
  }
  
  function stopStackChecker() {
    if (stackCheckInterval) {
      clearInterval(stackCheckInterval)
      stackCheckInterval = null
    }
  }
  
  // Lock status for a period of time (e.g., to show model loaded message)
  function lockStatus(ms) {
    statusLock = true
    setTimeout(() => {
      statusLock = false
      // After lock expires, refresh the status based on current state
      if (!modelLoadStatus) {
        if (stackRunning) {
          updatestatus('Service accessible')
        } else {
          updatestatus('Starting service...')
        }
      }
    }, ms)
  }
  
  function handleStackButtonClick() {
    const homeserverBtn = document.getElementById('homeserver')
    const isShifted = homeserverBtn && homeserverBtn.classList.contains('homeservershift')
    
    if (isUpdatingStack) {
      updatestatus('Operation already in progress...')
      return
    }
    
    if (isShifted) {
      isUpdatingStack = true
      // Clear model load status when starting/stopping
      modelLoadStatus = null
      updatestatus('Starting stack...')
      if (homeserverBtn) homeserverBtn.style.pointerEvents = 'none'
      
      fetch(`assets/php/ollama_api.php?action=start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      .then(response => response.json())
      .then(data => {
        updatestatus(data.message || (data.success ? 'Stack started' : 'Start initiated'))
        setTimeout(() => {
          checkStackStatus()
          isUpdatingStack = false
          if (homeserverBtn) homeserverBtn.style.pointerEvents = ''
        }, 3000)
      })
      .catch(error => {
        console.error('Start error:', error)
        updatestatus('Error starting stack')
        isUpdatingStack = false
        if (homeserverBtn) homeserverBtn.style.pointerEvents = ''
      })
    } else {
      isUpdatingStack = true
      // Clear model load status when starting/stopping
      modelLoadStatus = null
      updatestatus('Stopping stack...')
      if (homeserverBtn) homeserverBtn.style.pointerEvents = 'none'
      
      fetch(`assets/php/ollama_api.php?action=stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      .then(response => response.json())
      .then(data => {
        updatestatus('Stack stopped')
        setTimeout(() => {
          checkStackStatus()
          isUpdatingStack = false
          if (homeserverBtn) homeserverBtn.style.pointerEvents = ''
        }, 2000)
      })
      .catch(error => {
        console.error('Stop error:', error)
        updatestatus('Error stopping stack')
        isUpdatingStack = false
        if (homeserverBtn) homeserverBtn.style.pointerEvents = ''
      })
    }
  }

  function handlePasteTranscriptClick() {
    updatestatus('Reading clipboard...')
    
    navigator.clipboard.readText()
      .then(text => {
        if (!text || text.trim() === '') {
          updatestatus('Clipboard is empty')
          alert('Clipboard is empty. Copy some text first.')
          return
        }
        
        updatestatus('Sending transcript...')
        
        fetch(`assets/php/process_transcript.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript: text })
        })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            updatestatus('Transcript saved')
          } else {
            updatestatus('Failed to save transcript')
            alert('Error: ' + (data.error || 'Unknown error'))
          }
        })
        .catch(error => {
          console.error('Error:', error)
          updatestatus('Error saving transcript')
          alert('Error: ' + error.message)
        })
      })
      .catch(err => {
        console.error('Clipboard read error:', err)
        updatestatus('Cannot read clipboard')
        alert('Unable to read clipboard. Please check browser permissions.')
      })
  }

  function loadtoolbar() {
    const bar = document.getElementById("coderagtoolbar")
    const buttonlist = document.createElement('ul')
    buttonlist.id = 'coderag_menu_buttons'
    buttonlist.classList.add('coderag-menu')

    buttonlist.appendChild(addbuttondropdown('fileload', 'fileloadBTN', 'left', ['RAGcode','Doomstead','Mainpage','RAGdocs','Transcripts']))
    buttonlist.appendChild(addbutton('line1', 'dividerBTN', 'left', true))
    buttonlist.appendChild(addbutton('homeserver', 'homeserverBTN', 'left', false))
    buttonlist.appendChild(addbutton('full_build', 'dbuploadBTN', 'left', false))
    buttonlist.appendChild(addbutton('pastetranscript', 'pasteBTN', 'left', false))
    buttonlist.appendChild(addbutton('vectordb', 'dbrefreshBTN', 'left', false))
    buttonlist.appendChild(addbutton('loadmodel', 'dogrunBTN', 'left', false))
    buttonlist.appendChild(addbutton('checkmodel', 'sailboatBTN', 'left', false))
    buttonlist.appendChild(addbutton('fastapi', 'horuseyeBTN', 'left', false))
    buttonlist.appendChild(addbutton('homepage', 'targetBTN', 'right', false))
    buttonlist.appendChild(addbutton('line5', 'dividerBTN', 'right', true))
    buttonlist.appendChild(addbutton('book', 'bookBTN', 'right', false))

    const statusLi = document.createElement('li')
    statusLi.style.float = 'right'

    statusDiv.id = 'status'
    statusDiv.className = 'status'
    statusDiv.textContent = 'Checking status...'

    statusLi.appendChild(statusDiv)

    const bookButton = buttonlist.querySelector('#button_book')
    if (bookButton?.parentNode?.nextSibling) {
      buttonlist.insertBefore(statusLi, bookButton.parentNode.nextSibling)
    } else {
      buttonlist.appendChild(statusLi)
    }

    bar.appendChild(buttonlist)
    loadtooltips()
    
    startStackChecker()

    const runButton = document.querySelector('#button_loadmodel a')
    if (runButton) {
      runButton.onclick = async function(e) {
        e.preventDefault()
        e.stopPropagation()
        
        const statusDivElem = document.getElementById('status')
        const promptInput = document.getElementById('userInput')
        const sendBtn = document.getElementById('sendButton')
        
        // Clear previous model load status
        modelLoadStatus = null
        
        if (statusDivElem) statusDivElem.textContent = "Loading model..."
        
        try {
          const response = await fetch(`assets/php/force_reload_model.php`)
          const data = await response.json()
          
          if (data.success) {
            const successMsg = `Model ready: ${data.new_model}`
            modelLoadStatus = successMsg
            if (statusDivElem) statusDivElem.textContent = successMsg
            if (promptInput) promptInput.disabled = false
            if (sendBtn) sendBtn.disabled = false
            // Lock status for 10 seconds to show the model loaded message
            lockStatus(10000)
          } else {
            modelLoadStatus = null
            if (statusDivElem) statusDivElem.textContent = data.message || "Failed to load"
            if (data.message && data.message.includes('not running')) {
              alert('Stack not running. Click homeserver button to start.')
            } else {
              alert(data.message || "Failed to load model")
            }
          }
        } catch (error) {
          console.error("Load model error:", error)
          modelLoadStatus = null
          if (statusDivElem) statusDivElem.textContent = "Error loading"
          alert("Error: " + error.message)
        }
        
        return false
      }
    }

    const checkButton = document.querySelector('#button_checkmodel a')
    if (checkButton) {
      checkButton.onclick = function(e) {
        e.preventDefault()
        e.stopPropagation()
        checkmodel()
        return false
      }
    }

    const fullBuildButton = document.querySelector('#button_full_build a')
    if (fullBuildButton) {
      fullBuildButton.onclick = function(e) {
        e.preventDefault()
        e.stopPropagation()
        rebuild_vectorstore()
        return false
      }
    }
    
    const refreshButton = document.querySelector('#button_vectordb a')
    if (refreshButton) {
      refreshButton.onclick = function(e) {
        e.preventDefault()
        e.stopPropagation()
        refresh_vectorstore()
        return false
      }
    }
    
    const stackButton = document.querySelector('#button_homeserver a')
    if (stackButton) {
      stackButton.onclick = function(e) {
        e.preventDefault()
        e.stopPropagation()
        handleStackButtonClick()
        return false
      }
    }
    
    const pasteTranscriptButton = document.querySelector('#button_pastetranscript a')
    if (pasteTranscriptButton) {
      pasteTranscriptButton.onclick = function(e) {
        e.preventDefault()
        e.stopPropagation()
        handlePasteTranscriptClick()
        return false
      }
    }

    updateButtonVisibility()
  }

  function addbutton(id, className, side, isIndicator) {
    const a = document.createElement('a')
    a.id = id
    a.className = className
    a.textContent = className
    if (isIndicator) {
      a.style = 'background-position: 0 0px; margin-top: 0px; margin-left: 0px;'
    } else {
      a.href = '#'
    }

    const li = document.createElement('li')
    li.style.float = side
    li.id = `button_${id}`
    li.appendChild(a)
    return li
  }

  function addbuttondropdown(id, className, side, items) {
    const dropdownfunctions = {
      RAGcode: ragcode,
      Doomstead: doomsteadcode,
      Mainpage: mainpagecode,
      RAGdocs: ragdocs,
      Transcripts: transcripts
    }
    const li = document.createElement('li')
    li.style.float = side
    li.id = `button_${id}`

    const a = document.createElement('a')
    a.id = id
    a.className = className
    a.textContent = className
    a.href = '#'
    li.appendChild(a)

    const content = document.createElement('div')
    content.id = `dropdown_${id}`
    content.classList.add('dropdown')
    content.style.display = 'none'
    content.style.position = 'absolute'

    const ul = document.createElement('ul')
    ul.id = `ul_${id}`

    items.forEach(item => {
      const itemLink = document.createElement('a')
      itemLink.href = '#'
      itemLink.textContent = item
      itemLink.style.color = '#964b00'
      const liItem = document.createElement('li')
      liItem.appendChild(itemLink)
      ul.appendChild(liItem)
    })

    ul.addEventListener('click', (e) => {
      e.preventDefault()
      const target = e.target
      if (target.tagName === 'A') {
        const func = dropdownfunctions[target.textContent.trim()]
        if (func) func()
      }
    })

    content.appendChild(ul)
    document.body.appendChild(content)
    
    a.addEventListener('mouseenter', () => {
      const rect = a.getBoundingClientRect()
      content.style.left = `${rect.left}px`
      content.style.top = `${rect.bottom}px`
      content.style.display = 'block'
    })

    a.addEventListener('mouseleave', () => {
      setTimeout(() => {
        if (!content.matches(':hover')) {
          content.style.display = 'none'
        }
      }, 100)
    })

    content.addEventListener('mouseleave', () => {
      content.style.display = 'none'
    })

    content.addEventListener('mouseenter', () => {
      content.style.display = 'block'
    })
    return li
  }

  function loadtooltips() {
    const tooltips = {
      fileload: 'File Set',
      full_build: 'Rebuild Vector Store',
      vectordb: 'Refresh Vector Store',
      homeserver: 'Start/Stop Stack',
      loadmodel: 'Load Model',
      checkmodel: 'Check Models',
      pastetranscript: 'Paste Transcript',
      fastapi: 'Ollama API Docs',
      homepage: 'Homepage',
      book: 'Documentation'
    }
    for (const id in tooltips) {
      const el = document.getElementById(id)
      if (el) el.setAttribute('title', tooltips[id])
    }
  }

  function colordropdowntext(content) {
    const dropdown = document.getElementById('dropdown_fileload')
    if (dropdown) {
      const ul = dropdown.querySelector('ul')
      if (ul) {
        const items = ul.querySelectorAll('li a')
        items.forEach(item => {
          item.style.color = item.textContent.trim() === content ? '#006400' : '#964b00'
        })
      }
    }
  }

  function ragcode() {
    const content = { "filesetconfig": "ragcode" }
    fetch(`assets/php/save_config.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(content)
    }).finally(() => {
      const dropdown = document.getElementById('dropdown_fileload')
      if (dropdown) dropdown.style.display = 'none'
      colordropdowntext("RAGcode")
      clearchatbox()
      currentProfile = 'ragcode'
      updateButtonVisibility()
      updatestatus('Switched to RAGcode profile. Click Run button to load model.')
      updatetooltitle('Retrieval Argumentation Generation for Code')
    })
  }

  function doomsteadcode() {
    const content = { "filesetconfig": "doomstead" }
    fetch(`assets/php/save_config.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(content)
    }).finally(() => {
      const dropdown = document.getElementById('dropdown_fileload')
      if (dropdown) dropdown.style.display = 'none'
      colordropdowntext("Doomstead")
      clearchatbox()
      currentProfile = 'doomstead'
      updateButtonVisibility()
      updatestatus('Switched to Doomstead profile. Click Run button to load model.')
      updatetooltitle('Retrieval Argumentation Generation for Code')
    })
  }

  function mainpagecode() {
    const content = { "filesetconfig": "mainpage" }
    fetch(`assets/php/save_config.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(content)
    }).finally(() => {
      const dropdown = document.getElementById('dropdown_fileload')
      if (dropdown) dropdown.style.display = 'none'
      colordropdowntext("Mainpage")
      clearchatbox()
      currentProfile = 'mainpage'
      updateButtonVisibility()
      updatestatus('Switched to Mainpage profile. Click Run button to load model.')
      updatetooltitle('Retrieval Argumentation Generation for Code')
    })
  }

  function ragdocs() {
    const content = { "filesetconfig": "ragdocs" }
    fetch(`assets/php/save_config.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(content)
    }).finally(() => {
      const dropdown = document.getElementById('dropdown_fileload')
      if (dropdown) dropdown.style.display = 'none'
      colordropdowntext("RAGdocs")
      clearchatbox()
      currentProfile = 'ragdocs'
      updateButtonVisibility()
      updatestatus('Switched to RAGdocs profile. Click Run button to load model.')
      updatetooltitle('Retrieval Argumentation Generation for Code')
    })
  }

  function transcripts() {
    const content = { "filesetconfig": "transcript" }
    fetch(`assets/php/save_config.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(content)
    }).finally(() => {
      const dropdown = document.getElementById('dropdown_fileload')
      if (dropdown) dropdown.style.display = 'none'
      colordropdowntext("Transcripts")
      clearchatbox()
      currentProfile = 'transcript'
      updateButtonVisibility()
      updatestatus('Switched to Transcript profile. Click Run button to load model.')
      updatetooltitle('Transcript Processor')
    })
  }

  function clearchatbox() {
    const chatbox = document.getElementById("chatbox")
    if (chatbox) chatbox.innerHTML = ""
  }

  function rebuild_vectorstore() {
    updatestatus('Building FAISS vector store...')
    const modal = new BuildModal()
    modal.startPolling()

    fetch(`assets/php/full_builder.php`, {
      method: 'POST',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/json'
      }
    }).catch((error) => {
      console.error('Build error:', error)
      updatestatus('Build failed - check logs')
    })
  }

  function refresh_vectorstore() {
    updatestatus('Refresh not implemented - use Full Build')
    alert('Use "Full Build" to rebuild the vector store completely.')
  }

  async function checkmodel() {
    updatestatus('Checking models...')
    
    try {
      const response = await fetch(`assets/php/ollama_api.php?action=list`)
      const data = await response.json()
      
      if (data.success && data.models) {
        if (data.models.length === 0) {
          alert('No models found.\n\nPull a model: ollama pull deepseek-coder:6.7b')
          updatestatus('No models available')
        } else {
          const modelList = data.models.map(m => `${m.name} (${(parseInt(m.size) / 1024 / 1024 / 1024).toFixed(1)} GB)`).join('\n')
          alert(`Available models:\n\n${modelList}`)
          updatestatus(`${data.models.length} model(s) available`)
        }
      } else {
        updatestatus('Cannot connect to Ollama')
        alert('Cannot connect to Ollama. Is the stack running?')
      }
    } catch (error) {
      console.error('Check model error:', error)
      updatestatus('Connection error')
      alert('Could not connect to Ollama. Is the stack running?')
    }
  }

  function fastapi() {
    window.open('https://github.com/ollama/ollama/blob/main/docs/api.md', '_blank', 'noopener,noreferrer')
  }

  function homepage() {
    window.open('https://chasingthesquirrel.com/doomstead/index.php', '_blank', 'noopener,noreferrer')
  }

  function book() {
    updatestatus('Documentation coming soon')
    alert('Documentation viewer will be implemented in future version')
  }

  function updatestatus(text) {
    if (statusDiv) {
      statusDiv.textContent = text
    }
  }

  function updatetooltitle(text) {
    let banner = document.getElementById("tooltitle")
    if (banner) banner.textContent = text
  }

  window.addEventListener('beforeunload', function() {
    stopStackChecker()
  })

  window.loadtoolbar = loadtoolbar
  window.updatestatus = updatestatus
  window.rebuild_vectorstore = rebuild_vectorstore
  window.checkmodel = checkmodel
})()

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (typeof window.loadtoolbar === 'function') {
      window.loadtoolbar()
    }
  })
} else {
  if (typeof window.loadtoolbar === 'function') {
    window.loadtoolbar()
  }
}