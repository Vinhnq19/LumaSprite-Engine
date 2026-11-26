const pack = JSON.parse(document.querySelector('#preview-data').textContent)
const section = document.querySelector('#playback')
const sceneSelect = section.querySelector('#scene')
const speed = section.querySelector('#speed')
const seek = section.querySelector('#seek')
const zoom = section.querySelector('#zoom')
const contacts = section.querySelector('#contacts')
const play = section.querySelector('#play')
const pause = section.querySelector('#pause')
const panels = [...section.querySelectorAll('figure')]
const clocks = panels.map(panel => panel.querySelector('output'))
const ctx = panels.map(panel => panel.querySelector('canvas').getContext('2d'))
let raf = 0
let epoch = 0
let clock = 0
let end = 0
let assets = null
const full = { x: 0, y: 0, w: 64, h: 64 }

function cell(timing, ms) {
  let elapsed = ms
  for (const [index, frame] of timing.frames.entries()) {
    if (elapsed < frame.durationMs) return { index, frame, phase: elapsed }
    elapsed -= frame.durationMs
  }
  throw new Error('Frame timing out of range')
}
function walk(actor, time, cycle, smooth) {
  const { index, frame, phase } = cell(actor.walk, time)
  const motion = actor.walk.rootMotion.frames[index]
  const root = cycle * actor.walk.rootMotion.cyclePx + motion.rootX
  const offset = smooth ? Math.floor(phase * motion.advancePx / frame.durationMs + .5) : 0
  return { stage: 'walk', index, cycle, root: root + offset, offset, motion, frame: frame.rect, image: actor.images.walk, phase }
}
function idle(actor, time, root, stage) {
  const { index, frame } = cell(actor.idle, time)
  return { stage, index, root, frame: frame.rect, image: actor.images.idle }
}
function sample(actor, time, smooth) {
  if (time < actor.idle.totalDurationMs) return idle(actor, time, 0, 'idle')
  if (time < actor.enter) return { stage: 'entry', root: 0, image: actor.images.bridge, frame: full, index: 0 }
  if (time < actor.stop) {
    const passing = time - actor.enter
    return walk(actor, passing % actor.walk.totalDurationMs, Math.floor(passing / actor.walk.totalDurationMs), smooth)
  }
  const reset = actor.stop + actor.walk.frames[0].durationMs
  if (time < reset) return { ...walk(actor, 0, 3, false), stage: 'stop-contact' }
  const root = 3 * actor.walk.rootMotion.cyclePx
  if (time < reset + actor.bridgeMs) return { stage: 'exit', root, image: actor.images.bridge, frame: full, index: 0 }
  if (time < actor.end) return idle(actor, time - reset - actor.bridgeMs, root, 'idle-return')
  return idle(actor, 0, root, 'done')
}

const label = { idle: 'Idle', entry: 'Vào bước', walk: 'Walk', 'stop-contact': 'Chạm đất để dừng',
  exit: 'Thu chân', 'idle-return': 'Về idle', done: 'Hoàn tất' }
function render(ms) {
  if (!assets) return []
  clock = ms
  seek.value = Math.floor(clock)
  const scene = assets.scenes[sceneSelect.value]
  return [false, true].map((smooth, panel) => {
    const surface = ctx[panel]
    surface.imageSmoothingEnabled = false
    surface.drawImage(scene.image, 0, 0)
    const state = assets.actors.map((actor, i) => {
      const s = sample(actor, clock, smooth)
      const [x, y] = scene.anchors[i]
      const ox = x - actor.walk.pivot[0] + s.root
      const oy = y - actor.walk.pivot[1]
      const { x: sx, y: sy, w, h } = s.frame
      surface.drawImage(s.image, sx, sy, w, h, ox, oy, w, h)
      if (contacts.checked && s.motion) for (const f of Object.values(s.motion.feet)) {
        if (f.state !== 'planted') continue
        surface.fillStyle = '#ffbf7b'
        surface.fillRect(ox + f.canvas[0] - 1, oy + f.canvas[1] - 1, 3, 1)
      }
      return { id: actor.id, stage: s.stage, index: s.index, root: s.root, phase: s.phase, offset: s.offset ?? 0 }
    })
    clocks[panel].textContent = state.map(s => (s.id === 'surveyor' ? 'Surveyor' : 'Courier') +
      ' · ' + label[s.stage] + ' · +' + s.root + ' px').join('  /  ')
    return state
  })
}

function stop() {
  if (raf) cancelAnimationFrame(raf)
  raf = 0
  pause.disabled = true
}
function frame(now) {
  const ms = Math.min(end, Math.max(clock, (now - epoch) * Number(speed.value)))
  render(ms)
  if (ms === end) stop()
  else raf = requestAnimationFrame(frame)
}
play.addEventListener('click', () => {
  if (raf) return
  if (clock >= end) clock = 0
  epoch = performance.now() - clock / Number(speed.value)
  pause.disabled = false
  raf = requestAnimationFrame(frame)
})
pause.addEventListener('click', stop)
seek.addEventListener('input', () => { stop(); render(Number(seek.value)) })
sceneSelect.addEventListener('change', () => render(clock))
speed.addEventListener('change', () => { if (raf) epoch = performance.now() - clock / Number(speed.value) })
zoom.addEventListener('change', () => section.classList.toggle('zoom', zoom.checked))
contacts.addEventListener('change', () => render(clock))
document.addEventListener('visibilitychange', () => { if (document.hidden) stop() })

async function load(uri) {
  const image = new Image()
  image.src = uri
  await image.decode()
  return image
}
async function start() {
  const actors = await Promise.all(pack.actors.map(async a => {
    const enter = a.idle.totalDurationMs + a.bridgeMs
    const stop = enter + 3 * a.walk.totalDurationMs
    const end = stop + a.walk.frames[0].durationMs + a.bridgeMs + a.idle.totalDurationMs
    const images = Object.fromEntries(await Promise.all(Object.entries(a.images).map(async ([id, uri]) => [id, await load(uri)])))
    return { ...a, enter, stop, end, images }
  }))
  const scenes = Object.fromEntries(await Promise.all(pack.scenes.map(async s => [s.id, { ...s, image: await load(s.uri) }])))
  assets = { actors, scenes }
  end = Math.max(...actors.map(a => a.end))
  seek.max = end
  play.disabled = seek.disabled = false
  window.e54Preview = { seek: ms => { stop(); return render(ms) } }
  render(0)
  document.body.dataset.ready = 'true'
}
start().catch(error => { document.querySelector('#status').textContent = error.message })

const form = document.querySelector('#rating')
form.addEventListener('submit', e => {
  e.preventDefault()
  const data = Object.fromEntries(new FormData(form))
  const href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = href
  a.download = 'e54-final-owner-review.json'
  a.click()
  setTimeout(() => URL.revokeObjectURL(href), 3000)
})
