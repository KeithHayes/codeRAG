(function () {
  /**
   * @function loadtoolbar
   * @description Initializes the application toolbar.
   */
  function loadtoolbar() {
    const bar = document.getElementById("coderagtoolbar")
    const buttonlist = document.createElement('ul')
    buttonlist.id = 'coderag_menu_buttons'
    buttonlist.classList.add('coderag-menu')

    buttonlist.appendChild(addbuttondropdown('fileload', 'fileloadBTN', 'left', ['RAGcode','Doomstead']))
    buttonlist.appendChild(addbutton('line1', 'dividerBTN', 'left', true))
    buttonlist.appendChild(addbutton('full_build', 'dbuploadBTN', 'left', false))
    buttonlist.appendChild(addbutton('vectordb', 'dbrefreshBTN', 'left', false))
    buttonlist.appendChild(addbutton('checkmodel', 'sailboatBTN', 'left', false))
    buttonlist.appendChild(addbutton('fastapi', 'horuseyeBTN', 'left', false))
    buttonlist.appendChild(addbutton('loadmodel', 'dogrunBTN', 'left', false))
    buttonlist.appendChild(addbutton('csvdata', 'filesaveBTN', 'left', false))
    buttonlist.appendChild(addbutton('homepage', 'targetBTN', 'right', false))
    buttonlist.appendChild(addbutton('line5', 'dividerBTN', 'right', true))
    buttonlist.appendChild(addbutton('book', 'bookBTN', 'right', false))

    const statusLi = document.createElement('li')
    statusLi.style.float = 'right'

    const statusDiv = document.createElement('div')
    statusDiv.id = 'status'
    statusDiv.className = 'status'
    statusDiv.textContent = 'Checking model status...'

    statusLi.appendChild(statusDiv)

    const bookButton = buttonlist.querySelector('#button_book')
    if (bookButton?.parentNode?.nextSibling) {
      buttonlist.insertBefore(statusLi, bookButton.parentNode.nextSibling)
    } else {
      buttonlist.appendChild(statusLi)
    }

    bar.appendChild(buttonlist)
    loadtooltips()

    const toolbarfunctions = {
      fileloadBTN: fileload,
      dbuploadBTN: rebuild_vectorstore,
      dbrefreshBTN: refresh_vectorstore,
      sailboatBTN: checkmodel,
      horuseyeBTN: fastapi,
      dogrunBTN: loadmodel,
      printerBTN: print,
      bookBTN: book,
      targetBTN: homepage
    }

    buttonlist.onclick = (e) => {
      e.preventDefault()
      toolbarfunctions[e.target.innerHTML]()
    }
    ragcode()
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
    const dropdownfunctions = { RAGcode: ragcode, Doomstead: doomsteadcode }
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
        dropdownfunctions[target.textContent.trim()]?.()
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

  function addtablearrow(id, className, text) {
    const bar = document.getElementById("coderagtoolbar")
    const list = bar.querySelector('.coderag-menu')
    const ref = list.querySelector('#button_book')

    const li = document.createElement('li')
    li.style.float = 'right'
    li.id = id
    li.innerHTML = `<a id="${className}" class="${className}" href="#">${text}</a>`

    ref?.insertAdjacentElement('beforebegin', li) || list.appendChild(li)
  }

  function addarrowleft() {
    addtablearrow('button_left', 'leftBTN', 'leftBTN')
  }

  function addarrowright() {
    addtablearrow('button_right', 'rightBTN', 'rightBTN')
  }

  function addpagescroll() {
    const list = document.getElementById("coderagtoolbar").querySelector('.coderag-menu')
    if (!list.querySelector('#button_up')) {
      const ref = list.querySelector('#button_book')
      ['down', 'up'].forEach(dir => {
        const li = document.createElement('li')
        li.style.float = 'right'
        li.id = `button_${dir}`
        li.innerHTML = `<a id="page${dir}" class="page${dir === 'up' ? 'in' : 'out'}BTN" href="#">page${dir === 'up' ? 'in' : 'out'}BTN</a>`
        ref.insertAdjacentElement('afterend', li)
      })
    }
  }

  function loadtooltips() {
    const tooltips = {
      fileload: 'File Set',
      full_build: 'Rebuild Vector Store',
      vectordb: 'Refresh Vector Store',
      checkmodel: 'Check Model',
      fastapi: 'Documentation',
      loadmodel: 'Load Model',
      print: 'Print Results',
      plot: 'Plot Results',
      csvdata: 'Print or Plot CSV File'
    }
    for (const id in tooltips) {
      document.getElementById(id)?.setAttribute('title', tooltips[id])
    }
  }

  function statusColor(StatusID, shift) {
    const el = document.getElementById(StatusID)
    if (el) {
      el.style.backgroundPosition = `0 ${shift}px`
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
    fetch('assets/php/save_config.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(content)
    }).finally(() => {
      const dropdown = document.getElementById('dropdown_fileload')
      if (dropdown) dropdown.style.display = 'none'
      colordropdowntext("RAGcode")
    })
  }

  function doomsteadcode() {
    const content = { "filesetconfig": "doomstead" }
    fetch('assets/php/save_config.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(content)
    }).finally(() => {
      const dropdown = document.getElementById('dropdown_fileload')
      if (dropdown) dropdown.style.display = 'none'
      colordropdowntext("Doomstead")
    })
  }

  function rebuild_vectorstore() {
    const modal = new BuildModal()
    modal.startPolling()

    fetch('assets/php/full_builder.php', {
      method: 'POST',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/json'
      }
    }).catch(() => {
      // Ignore fetch errors completely
    })
  }

  function refresh_vectorstore() {

  }

  function test() {
    const modal = new BuildModal()
    modal.startPolling()

    fetch('assets/php/test_query.php', {
      method: 'POST',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/json'
      }
    }).catch(() => {
      // Ignore fetch errors completely
    })
  }

  async function modelapi(action) {
      try {
          const response = await fetch(`assets/php/model_api.php?action=${action}`)
          const data = await response.json()
          if (data.success) {
              console.log(`Model ${action}: ${data.model} (Status: ${data.status}, Loader: ${data.loader})`)
              alert(`Model ${action}:\nModel: ${data.model}\nStatus: ${data.status}\nLoader: ${data.loader}`)
          } else {
              console.error(`Error in ${action}:`, data.error)
              alert(`Error in ${action}: ${data.error}`)
          }
      } catch (error) {
          console.error(`Failed to ${action} model:`, error)
          alert(`Failed to ${action} model - see console for details`)
      }
  }

  async function checkmodel() {
      modelapi('check')
  }

  function fastapi() {
    window.open('http://localhost:5000/docs', '_blank', 'noopener,noreferrer')
  }

  async function loadmodel() {
      modelapi('load')
  }

  function homepage() {
    window.open('https://chasingthesquirrel.com/doomstead/index.php', '_blank', 'noopener,noreferrer')
  }

  window.loadtoolbar = loadtoolbar
})()

window.loadtoolbar()