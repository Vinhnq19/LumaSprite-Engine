const spec = JSON.parse(document.querySelector('#clip-data').textContent)
const viewer = document.querySelector('#viewer')
const mode = viewer.querySelector('#view-mode')
const frame = viewer.querySelector('#frame')
const toggle = viewer.querySelector('#toggle')
const output = viewer.querySelector('output')
const canvases = [...viewer.querySelectorAll('canvas')]
const contexts = canvases.map(canvas => canvas.getContext('2d'))
let images = []
let index = 0
let playing = false
let request = 0
let epoch = 0
let loadVersion = 0
const starts = spec.delays.map((delay, i) => spec.delays.slice(0, i).reduce((a, b) => a + b, 0))
const total = starts.at(-1) + spec.delays.at(-1)

function draw() {
  const view = spec.views[mode.value]
  frame.value = index
  output.textContent = (index + 1) + '/' + spec.delays.length + ' · ' + spec.phases[index] + ' · ' + spec.delays[index] + ' ms'
  if (!images.length) return
  contexts.forEach((context, i) => {
    context.imageSmoothingEnabled = false
    context.clearRect(0, 0, view.w, view.h)
    context.drawImage(images[i], index * view.w, 0, view.w, view.h, 0, 0, view.w, view.h)
  })
}

function pause() {
  playing = false
  cancelAnimationFrame(request)
  toggle.textContent = 'Phát'
}

function tick(now) {
  const elapsed = Math.max(0, now - epoch) % total
  const next = starts.findLastIndex(start => start <= elapsed)
  if (next !== index) {
    index = next
    draw()
  }
  request = requestAnimationFrame(tick)
}

async function loadView() {
  pause()
  toggle.disabled = true
  images = []
  const version = ++loadVersion
  const view = spec.views[mode.value]
  const layout = viewer.querySelector('.loops').classList
  layout.toggle('zoom', view.w > 160)
  layout.toggle('scene', view.w === 144)
  canvases.forEach(canvas => {
    canvas.width = view.w
    canvas.height = view.h
  })
  try {
    const next = await Promise.all(view.images.map(async src => {
      const image = new Image()
      image.src = src
      await image.decode()
      return image
    }))
    if (version !== loadVersion) return
    images = next
    toggle.disabled = false
    draw()
  } catch {
    if (version === loadVersion) output.textContent = 'Không đọc được ảnh vòng lặp.'
  }
}

mode.addEventListener('change', loadView)
frame.addEventListener('input', () => {
  pause()
  index = Number(frame.value)
  draw()
})
toggle.addEventListener('click', () => {
  if (playing) {
    pause()
    return
  }
  playing = true
  epoch = performance.now() - starts[index]
  toggle.textContent = 'Tạm dừng'
  request = requestAnimationFrame(tick)
})
document.addEventListener('visibilitychange', () => { if (document.hidden) pause() })
loadView()

for (const form of document.querySelectorAll('form.score')) {
  form.addEventListener('submit', event => {
    event.preventDefault()
    const result = Object.fromEntries(new FormData(form))
    const blob = new Blob([JSON.stringify({ experiment: form.dataset.experiment, ...result }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'art-review-' + form.dataset.experiment + '.json'
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 3000)
  })
}
