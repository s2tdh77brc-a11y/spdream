const KEY = 'dream-city.v2'

const AI_KEY = 'dream-city.ai.v1'

const boundaryDefs = [
  ['power', '权力交换'],
  ['public', '虚构公开场景'],
  ['degrade', '贬低与羞辱'],
  ['restraint', '束缚'],
  ['pain', '疼痛'],
  ['marking', '留痕与标记']
]

const stories = [
  {
    id: 'original-room',
    title: '关灯后的房间',
    tone: '亲密 · 缓慢',
    prompt:
      '两位虚构成年角色在明确边界内进行亲密权力交换。先建立空间与关系，只推进一个动作，等待玩家回应。'
  },
  {
    id: 'original-contract',
    title: '午夜契约厅',
    tone: '规则 · 心理',
    prompt:
      '两位虚构成年人共同修订一份只在本次故事有效的契约。把允许、需询问、禁止写成可撤回条款，再从一条最轻的规则开始。'
  },
  {
    id: 'original-stage',
    title: '闭馆后的剧场',
    tone: '角色 · 表演',
    prompt:
      '闭馆后只剩两位虚构成年表演者。观众席为空，舞台规则由双方边界决定。用一段克制的开场邀请玩家进入角色。'
  }
]

const defaults = {
  phase: 'gate',
  boundaries: Object.fromEntries(
    boundaryDefs.map(([id]) => [id, 'ask'])
  ),
  story: null,
  review: null,
  stopped: false,
  messages: []
}

const defaultAI = {
  provider: 'deepseek',
  baseUrl: 'https://api.deepseek.com/v1',
  apiKey: '',
  model: 'deepseek-chat',
  temperature: 0.8,
  maxTokens: 4096
}

let state = load()
let aiConfig = loadAI()
let controller = null

function clone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

function load() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(KEY) || '{}'
    )

    return {
      ...clone(defaults),
      ...saved,
      boundaries: {
        ...defaults.boundaries,
        ...(saved.boundaries || {})
      },
      messages: Array.isArray(saved.messages)
        ? saved.messages
        : []
    }
  } catch {
    return clone(defaults)
  }
}

function save() {
  localStorage.setItem(
    KEY,
    JSON.stringify(state)
  )
}

function loadAI() {
  try {
    return {
      ...defaultAI,
      ...JSON.parse(
        localStorage.getItem(AI_KEY) || '{}'
      )
    }
  } catch {
    return { ...defaultAI }
  }
}

function saveAI() {
  localStorage.setItem(
    AI_KEY,
    JSON.stringify(aiConfig)
  )
}

function setPhase(phase) {
  state.phase = phase
  state.stopped = false
  save()
  render()
}

function cycle(v) {
  return v === 'allow'
    ? 'ask'
    : v === 'ask'
      ? 'block'
      : 'allow'
}

function label(v) {
  return v === 'allow'
    ? '允许'
    : v === 'block'
      ? '禁止'
      : '先问'
}

/* =========================================================
   Boundary
   ========================================================= */

function renderBoundaries() {
  const host = document.querySelector('#boundaries')

  if (!host) return

  host.replaceChildren()

  for (const [id, name] of boundaryDefs) {
    const row = document.createElement('div')
    row.className = 'boundary'

    const text = document.createElement('span')
    text.textContent = name

    const button = document.createElement('button')

    button.dataset.state =
      state.boundaries[id]

    button.textContent =
      label(state.boundaries[id])

    button.onclick = () => {
      state.boundaries[id] =
        cycle(state.boundaries[id])

      save()
      renderBoundaries()
    }

    row.append(text, button)
    host.append(row)
  }
}

/* =========================================================
   Stories
   ========================================================= */

function renderStories() {
  const host = document.querySelector('#stories')

  if (!host) return

  host.replaceChildren()

  for (const item of stories) {
    const button = document.createElement('button')

    button.className = 'story'

    button.innerHTML = `
      <small>${escapeHTML(item.tone)}</small>
      <b>${escapeHTML(item.title)}</b>
      <span>进入这一条主线</span>
    `

    button.onclick = () => {
      state.story = item
      state.messages = []
      setPhase('scene')

      setTimeout(() => {
        startAIStory()
      }, 100)
    }

    host.append(button)
  }
}

/* =========================================================
   HTML escape
   ========================================================= */

function escapeHTML(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

/* =========================================================
   AI SETTINGS
   ========================================================= */

function ensureSettingsUI() {
  if (document.querySelector('#dc-ai-settings')) {
    return
  }

  const panel = document.createElement('section')

  panel.id = 'dc-ai-settings'

  panel.innerHTML = `
    <div class="dc-ai-box">

      <div class="dc-ai-header">
        <div>
          <small>DREAM CITY AI</small>
          <h3>模型连接</h3>
        </div>

        <button
          type="button"
          id="dc-ai-close"
        >
          ×
        </button>
      </div>

      <label>
        模型供应商
        <select id="dc-ai-provider">
          <option value="deepseek">DeepSeek</option>
          <option value="openai">OpenAI Compatible</option>
        </select>
      </label>

      <label>
        API Base URL
        <input
          id="dc-ai-base"
          type="text"
          placeholder="https://api.deepseek.com/v1"
        />
      </label>

      <label>
        API Key
        <input
          id="dc-ai-key"
          type="password"
          autocomplete="off"
          placeholder="sk-..."
        />
      </label>

      <label>
        模型
        <select id="dc-ai-model">
          <option value="deepseek-chat">
            deepseek-chat
          </option>

          <option value="deepseek-reasoner">
            deepseek-reasoner
          </option>
        </select>
      </label>

      <label>
        Temperature
        <input
          id="dc-ai-temperature"
          type="number"
          min="0"
          max="2"
          step="0.1"
        />
      </label>

      <label>
        Max Tokens
        <input
          id="dc-ai-max"
          type="number"
          min="100"
          max="32000"
          step="100"
        />
      </label>

      <div class="dc-ai-actions">
        <button
          type="button"
          id="dc-ai-save"
        >
          保存设置
        </button>

        <button
          type="button"
          id="dc-ai-test"
        >
          测试 DeepSeek
        </button>
      </div>

      <p id="dc-ai-status">
        尚未测试模型连接。
      </p>

    </div>
  `

  document.body.append(panel)

  const provider =
    document.querySelector('#dc-ai-provider')

  const base =
    document.querySelector('#dc-ai-base')

  const key =
    document.querySelector('#dc-ai-key')

  const model =
    document.querySelector('#dc-ai-model')

  const temperature =
    document.querySelector('#dc-ai-temperature')

  const max =
    document.querySelector('#dc-ai-max')

  provider.value = aiConfig.provider

  base.value = aiConfig.baseUrl

  key.value = aiConfig.apiKey

  model.value = aiConfig.model

  temperature.value =
    aiConfig.temperature

  max.value =
    aiConfig.maxTokens

  provider.onchange = () => {
    if (
      provider.value === 'deepseek'
    ) {
      base.value =
        'https://api.deepseek.com/v1'

      model.innerHTML = `
        <option value="deepseek-chat">
          deepseek-chat
        </option>

        <option value="deepseek-reasoner">
          deepseek-reasoner
        </option>
      `
    }
  }

  document.querySelector(
    '#dc-ai-close'
  ).onclick = () => {
    panel.classList.remove('open')
  }

  document.querySelector(
    '#dc-ai-save'
  ).onclick = () => {
    readAIForm()
    saveAI()

    setAIStatus(
      '模型设置已保存。',
      false
    )
  }

  document.querySelector(
    '#dc-ai-test'
  ).onclick = async () => {
    readAIForm()
    saveAI()

    setAIStatus(
      '正在连接 DeepSeek...',
      false
    )

    try {
      const result =
        await callAI(
          [
            {
              role: 'system',
              content:
                '你是 Dream City 的测试助手。'
            },
            {
              role: 'user',
              content:
                '请只回答：DeepSeek 连接成功。'
            }
          ],
          {
            temperature: 0.2,
            maxTokens: 100
          }
        )

      setAIStatus(
        `✓ ${result.content}`,
        false
      )
    } catch (error) {
      setAIStatus(
        `连接失败：${error.message}`,
        true
      )
    }
  }
}

function readAIForm() {
  const provider =
    document.querySelector(
      '#dc-ai-provider'
    )

  const base =
    document.querySelector(
      '#dc-ai-base'
    )

  const key =
    document.querySelector(
      '#dc-ai-key'
    )

  const model =
    document.querySelector(
      '#dc-ai-model'
    )

  const temperature =
    document.querySelector(
      '#dc-ai-temperature'
    )

  const max =
    document.querySelector(
      '#dc-ai-max'
    )

  if (!provider) return

  aiConfig.provider =
    provider.value

  aiConfig.baseUrl =
    base.value.trim()

  aiConfig.apiKey =
    key.value.trim()

  aiConfig.model =
    model.value

  aiConfig.temperature =
    Number(temperature.value)

  aiConfig.maxTokens =
    Number(max.value)
}

function setAIStatus(message, error) {
  const el =
    document.querySelector(
      '#dc-ai-status'
    )

  if (!el) return

  el.textContent = message

  el.dataset.error =
    error ? 'true' : 'false'
}

function openAISettings() {
  ensureSettingsUI()

  const panel =
    document.querySelector(
      '#dc-ai-settings'
    )

  panel.classList.add('open')
}

/* =========================================================
   AI API
   ========================================================= */

async function callAI(messages, options = {}) {
  if (!aiConfig.apiKey) {
    throw new Error(
      '尚未设置 API Key。请先打开「模型连接」。'
    )
  }

  const baseUrl =
    aiConfig.baseUrl ||
    'https://api.deepseek.com/v1'

  const model =
    options.model ||
    aiConfig.model ||
    'deepseek-chat'

  const temperature =
    typeof options.temperature === 'number'
      ? options.temperature
      : Number(aiConfig.temperature)

  const maxTokens =
    options.maxTokens ||
    Number(aiConfig.maxTokens)

  controller =
    new AbortController()

  const response =
    await fetch(
      `${baseUrl.replace(/\/$/, '')}/chat/completions`,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',

          Authorization:
            `Bearer ${aiConfig.apiKey}`
        },

        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
          stream: false
        }),

        signal:
          controller.signal
      }
    )

  controller = null

  if (!response.ok) {
    let detail = ''

    try {
      const data =
        await response.json()

      detail =
        data?.error?.message ||
        data?.message ||
        ''
    } catch {
      detail =
        await response.text()
    }

    throw new Error(
      `API ${response.status}` +
      (detail
        ? `：${detail}`
        : '')
    )
  }

  const data =
    await response.json()

  const content =
    data?.choices?.[0]?.message?.content

  if (!content) {
    throw new Error(
      '模型没有返回有效内容。'
    )
  }

  return {
    content,
    model:
      data.model || model,
    usage:
      data.usage || null
  }
}

/* =========================================================
   Dream City AI Context
   ========================================================= */

function buildSystemPrompt() {
  const story =
    state.story

  const boundaryText =
    boundaryDefs
      .map(([id, name]) => {
        return `${name}：${label(
          state.boundaries[id]
        )}`
      })
      .join('\n')

  return `
你是 Dream City 的叙事引擎。

你正在运行一个持续性的互动文字游戏。

世界观必须保持 Dream City 原有设定。
不要擅自改变城市、角色、故事基础或游戏规则。

当前故事：
${story?.title || '尚未选择'}

当前故事提示：
${story?.prompt || ''}

玩家边界：
${boundaryText}

规则：

1. 所有角色均为虚构成年人。
2. 严格尊重玩家边界。
3. 「禁止」代表不可执行。
4. 「先问」代表必须先获得玩家明确回应。
5. 「允许」代表可以在当前故事范围内继续。
6. 一次只推进一个明显的剧情动作。
7. 不要替玩家决定玩家的想法、行动或回答。
8. 留出回应空间。
9. 保持角色连续性。
10. 记住已经发生的剧情。
11. 玩家说出停止、安全词或要求结束时立即停止推进。
12. 以沉浸式文字游戏方式回应，而不是解释系统规则。

当前时间：
${new Date().toLocaleString()}
`
}

/* =========================================================
   AI Story Start
   ========================================================= */

async function startAIStory() {
  if (!state.story) return

  if (!aiConfig.apiKey) {
    renderSceneAI()

    return
  }

  const system =
    buildSystemPrompt()

  try {
    setAIThinking(true)

    const result =
      await callAI([
        {
          role: 'system',
          content: system
        },
        {
          role: 'user',
          content:
            '故事刚刚开始。请用克制的方式开启当前场景，并等待玩家回应。'
        }
      ])

    state.messages.push({
      role: 'assistant',
      content: result.content,
      at: new Date().toISOString()
    })

    save()

    renderSceneAI()
  } catch (error) {
    renderSceneAI(
      `AI 连接失败：${error.message}`
    )
  } finally {
    setAIThinking(false)
  }
}

/* =========================================================
   Scene Chat
   ========================================================= */

function ensureSceneChat() {
  const scene =
    document.querySelector(
      '#scene-card'
    )

  if (!scene) return

  let chat =
    document.querySelector(
      '#dc-chat'
    )

  if (chat) return

  chat =
    document.createElement('div')

  chat.id = 'dc-chat'

  chat.innerHTML = `
    <div
      id="dc-chat-messages"
      class="dc-chat-messages"
    ></div>

    <div class="dc-chat-actions">

      <button
        type="button"
        id="dc-ai-open"
      >
        ⚙ 模型
      </button>

      <button
        type="button"
        id="dc-ai-stop"
      >
        ■ 停止
      </button>

      <button
        type="button"
        id="dc-ai-regenerate"
      >
        ↻ 重生成
      </button>

    </div>

    <div class="dc-chat-input">

      <textarea
        id="dc-chat-text"
        rows="3"
        placeholder="输入你想说的话……"
      ></textarea>

      <button
        type="button"
        id="dc-chat-send"
      >
        发送
      </button>

    </div>

    <div
      id="dc-chat-status"
      class="dc-chat-status"
    ></div>
  `

  scene.append(chat)

  document.querySelector(
    '#dc-ai-open'
  ).onclick =
    openAISettings

  document.querySelector(
    '#dc-ai-stop'
  ).onclick =
    stopAI

  document.querySelector(
    '#dc-ai-regenerate'
  ).onclick =
    regenerateAI

  document.querySelector(
    '#dc-chat-send'
  ).onclick =
    sendPlayerMessage

  const textarea =
    document.querySelector(
      '#dc-chat-text'
    )

  textarea.addEventListener(
    'keydown',
    event => {
      if (
        event.key === 'Enter' &&
        !event.shiftKey
      ) {
        event.preventDefault()

        sendPlayerMessage()
      }
    }
  )
}

function renderSceneAI(errorMessage = '') {
  ensureSceneChat()

  const host =
    document.querySelector(
      '#dc-chat-messages'
    )

  if (!host) return

  host.replaceChildren()

  for (const message of state.messages) {
    const bubble =
      document.createElement('div')

    bubble.className =
      `dc-message ${message.role}`

    const label =
      message.role === 'user'
        ? '你'
        : 'Dream City'

    bubble.innerHTML = `
      <small>${label}</small>
      <div>${escapeHTML(
        message.content
      ).replaceAll('\n', '<br>')}</div>
    `

    host.append(bubble)
  }

  if (errorMessage) {
    const error =
      document.createElement('div')

    error.className =
      'dc-message error'

    error.textContent =
      errorMessage

    host.append(error)
  }

  host.scrollTop =
    host.scrollHeight
}

async function sendPlayerMessage() {
  const textarea =
    document.querySelector(
      '#dc-chat-text'
    )

  if (!textarea) return

  const text =
    textarea.value.trim()

  if (!text) return

  if (
    text.includes('安全词') ||
    text.includes('停止') ||
    text.includes('结束')
  ) {
    stopStory()

    return
  }

  if (!aiConfig.apiKey) {
    openAISettings()

    return
  }

  state.messages.push({
    role: 'user',
    content: text,
    at: new Date().toISOString()
  })

  textarea.value = ''

  save()
  renderSceneAI()

  try {
    setAIThinking(true)

    const messages = [
      {
        role: 'system',
        content: buildSystemPrompt()
      },

      ...state.messages
        .slice(-30)
        .map(message => ({
          role:
            message.role === 'assistant'
              ? 'assistant'
              : 'user',

          content:
            message.content
        }))
    ]

    const result =
      await callAI(messages)

    if (state.stopped) {
      return
    }

    state.messages.push({
      role: 'assistant',
      content: result.content,
      at: new Date().toISOString()
    })

    save()

    renderSceneAI()
  } catch (error) {
    if (
      error.name ===
      'AbortError'
    ) {
      return
    }

    renderSceneAI(
      `AI 请求失败：${error.message}`
    )
  } finally {
    setAIThinking(false)
  }
}

/* =========================================================
   Regenerate
   ========================================================= */

async function regenerateAI() {
  if (!state.messages.length) {
    return
  }

  const last =
    state.messages[
      state.messages.length - 1
    ]

  if (
    last.role === 'assistant'
  ) {
    state.messages.pop()
  }

  save()
  renderSceneAI()

  if (!aiConfig.apiKey) {
    openAISettings()

    return
  }

  try {
    setAIThinking(true)

    const result =
      await callAI([
        {
          role: 'system',
          content: buildSystemPrompt()
        },

        ...state.messages
          .slice(-30)
          .map(message => ({
            role: message.role,
            content: message.content
          }))
      ])

    state.messages.push({
      role: 'assistant',
      content: result.content,
      at: new Date().toISOString()
    })

    save()

    renderSceneAI()
  } catch (error) {
    renderSceneAI(
      `重新生成失败：${error.message}`
    )
  } finally {
    setAIThinking(false)
  }
}

/* =========================================================
   Stop
   ========================================================= */

function stopAI() {
  state.stopped = true

  if (controller) {
    controller.abort()
    controller = null
  }

  setAIThinking(false)
}

function stopStory() {
  stopAI()

  state.phase = 'gate'

  save()

  const dialog =
    document.querySelector(
      '#stop-dialog'
    )

  if (
    dialog &&
    typeof dialog.showModal === 'function'
  ) {
    dialog.showModal()
  }

  render()
}

function setAIThinking(value) {
  const status =
    document.querySelector(
      '#dc-chat-status'
    )

  if (!status) return

  status.textContent =
    value
      ? 'Dream City 正在回应……'
      : ''
}

/* =========================================================
   Render
   ========================================================= */

function render() {
  document
    .querySelectorAll(
      '[data-panel]'
    )
    .forEach(el => {
      el.hidden =
        el.dataset.panel !==
        state.phase
    })

  document
    .querySelectorAll(
      '[data-phase]'
    )
    .forEach(el => {
      el.toggleAttribute(
        'aria-current',
        el.dataset.phase ===
          state.phase
      )
    })

  const title =
    state.story
      ? state.story.title
      : '从城门开始'

  const currentTitle =
    document.querySelector(
      '#current-title'
    )

  if (currentTitle) {
    currentTitle.textContent =
      state.phase === 'leave'
        ? '把这一晚好好收住'
        : title
  }

  const currentCopy =
    document.querySelector(
      '#current-copy'
    )

  if (currentCopy) {
    currentCopy.textContent =
      state.story
        ? `旅程停在「${title}」。继续时会沿用已经画好的边界。`
        : '先画边界，再选故事。城市会记住你走到哪里。'
  }

  const continueButton =
    document.querySelector(
      '#continue'
    )

  if (continueButton) {
    continueButton.textContent =
      state.story
        ? '继续这里'
        : '从城门开始'
  }

  const scene =
    document.querySelector(
      '#scene-card'
    )

  if (scene) {
    scene.innerHTML =
      state.story
        ? `
          <p class="eyebrow">
            ORIGINAL PROMPT
          </p>

          <h3>
            ${escapeHTML(
              state.story.title
            )}
          </h3>

          <p>
            ${escapeHTML(
              state.story.prompt
            )}
          </p>

          <p class="hint">
            AI 会同时读取当前故事、
            边界状态与对话历史。
          </p>
        `
        : '<p>还没有选择故事。</p>'
  }

  renderBoundaries()
  renderStories()

  if (state.phase === 'scene') {
    setTimeout(() => {
      ensureSceneChat()
      renderSceneAI()
    }, 0)
  }
}

/* =========================================================
   Buttons
   ========================================================= */

document
  .querySelectorAll('[data-next]')
  .forEach(button => {
    button.onclick = () =>
      setPhase(
        button.dataset.next
      )
  })

document
  .querySelectorAll('[data-phase]')
  .forEach(button => {
    button.onclick = () =>
      setPhase(
        button.dataset.phase
      )
  })

const continueButton =
  document.querySelector(
    '#continue'
  )

if (continueButton) {
  continueButton.onclick = () =>
    setPhase(
      state.story
        ? state.phase
        : 'gate'
    )
}

const reset =
  document.querySelector(
    '#reset'
  )

if (reset) {
  reset.onclick = () => {
    state =
      clone(defaults)

    save()

    render()
  }
}

const sceneBack =
  document.querySelector(
    '#scene-back'
  )

if (sceneBack) {
  sceneBack.onclick = () =>
    setPhase('story')
}

const saveExit =
  document.querySelector(
    '#save-exit'
  )

if (saveExit) {
  saveExit.onclick = () => {
    const liked =
      document.querySelector(
        '#liked'
      )

    const adjust =
      document.querySelector(
        '#adjust'
      )

    state.review = {
      liked:
        liked?.value?.trim() ||
        '',

      adjust:
        adjust?.value?.trim() ||
        '',

      at:
        new Date().toISOString()
    }

    state.story = null
    state.messages = []
    state.phase = 'gate'

    save()

    render()
  }
}

const safeWord =
  document.querySelector(
    '#safeword'
  )

if (safeWord) {
  safeWord.onclick = () =>
    stopStory()
}

const closeStop =
  document.querySelector(
    '#close-stop'
  )

if (closeStop) {
  closeStop.onclick = () => {
    const dialog =
      document.querySelector(
        '#stop-dialog'
      )

    if (dialog) {
      dialog.close()
    }

    render()
  }
}

/* =========================================================
   AI settings button
   ========================================================= */

function addSettingsButton() {
  if (
    document.querySelector(
      '#dc-ai-settings-button'
    )
  ) {
    return
  }

  const button =
    document.createElement(
      'button'
    )

  button.id =
    'dc-ai-settings-button'

  button.type = 'button'

  button.textContent =
    '⚙ 模型设置'

  button.onclick =
    openAISettings

  button.style.position =
    'fixed'

  button.style.right =
    '16px'

  button.style.bottom =
    '16px'

  button.style.zIndex =
    '9999'

  document.body.append(button)
}

/* =========================================================
   Start
   ========================================================= */

ensureSettingsUI()
addSettingsButton()
render()
