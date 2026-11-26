const data = JSON.parse(document.querySelector('#playback-data').textContent)
const footNames = ['near', 'far']
const frameAt = (frames, time) => {
  let end = 0
  return frames.findIndex(frame => { end += frame.durationMs; return time < end })
}

function walk(actor, time, cycle = 0) {
  const index = frameAt(actor.walk.frames, time)
  const frame = actor.walk.frames[index]
  const motion = actor.walk.rootMotion.frames[index]
  return { stage: 'walk', index, delay: frame.durationMs, source: actor.images.strip, rect: frame.rect,
    root: cycle * actor.walk.rootMotion.cyclePx + motion.rootX, worldCycle: cycle, feet: motion.feet, phase: motion.phase }
}

function rest(actor, time, root, stage) {
  const index = frameAt(actor.idle.timing.frames, time)
  return { stage, index, delay: actor.idle.timing.frames[index].durationMs, source: actor.idle.image,
    rect: actor.idle.timing.frames[index].rect, root }
}

function journey(actor, elapsed, cycles) {
  let time = elapsed
  const idleMs = actor.idle.timing.totalDurationMs
  const { totalDurationMs: cycleMs, rootMotion: { cyclePx } } = actor.walk
  const bridge = (stage, root) => ({ stage, index: 0, source: actor.images.bridge, rect: { x: 0, y: 0, w: 64, h: 64 },
    root, delay: actor.bridgeMs })
  if (time < idleMs) return rest(actor, time, 0, 'idle')
  time -= idleMs
  if (time < actor.bridgeMs) return bridge('entry', 0)
  time -= actor.bridgeMs
  if (time < cycles * cycleMs) return walk(actor, time % cycleMs, Math.floor(time / cycleMs))
  time -= cycles * cycleMs
  const root = cycles * cyclePx
  const hold = actor.walk.frames[0].durationMs
  if (time < hold) return { ...walk(actor, 0, cycles), stage: 'stop-contact' }
  time -= hold
  if (time < actor.bridgeMs) return bridge('exit', root)
  time -= actor.bridgeMs
  return time < idleMs ? rest(actor, time, root, 'idle-return') : rest(actor, 0, root, 'done')
}

const labels = { idle: 'Idle', entry: 'Vào bước', walk: 'Walk', 'stop-contact': 'Chạm đất để dừng',
  exit: 'Thu chân', 'idle-return': 'Idle sau khi dừng', done: 'Hoàn tất' }
const describe = sample => labels[sample.stage] + (sample.phase ? ' · ' + sample.phase + ' · khung ' + (sample.index + 1) : '') +
  ' · root +' + sample.root + ' px'

function draw(ctx, image, rect, x, y, scale = 1) {
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h, x, y, rect.w * scale, rect.h * scale)
}
const buttonState = (buttons, playing) => {
  buttons.forEach(button => { button.disabled = button.dataset.run === 'pause' ? !playing : false })
}

function controls(element, render) {
  const buttons = [...element.querySelectorAll('button[data-run]')]
  let request = 0, start = 0, elapsed = 0, mode = 'loop'
  function pause() {
    cancelAnimationFrame(request)
    request = 0
    buttonState(buttons, false)
  }
  function show(nextMode, nextTime) {
    pause()
    mode = nextMode
    elapsed = nextTime
    render(mode, elapsed)
  }
  function tick(now) {
    elapsed = Math.max(0, now - start)
    if (render(mode, elapsed)) pause()
    else request = requestAnimationFrame(tick)
  }
  for (const button of buttons) button.addEventListener('click', () => {
    const command = button.dataset.run
    if (command === 'pause') { pause(); return }
    if (command === 'reset') { show('journey', 0); return }
    const resume = command === mode && request === 0 && elapsed > 0 && !render(mode, elapsed)
    mode = command
    start = performance.now() - (resume ? elapsed : 0)
    cancelAnimationFrame(request)
    buttonState(buttons, true)
    request = requestAnimationFrame(tick)
  })
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause() })
  buttonState(buttons, false)
  return { show }
}

const image = async src => {
  const decoded = new Image()
  decoded.src = src
  await decoded.decode()
  return decoded
}

function review(section, actors, scenes) {
  const names = section.dataset.actors.split(' ')
  const panel = names.map(id => {
    const card = section.querySelector('[data-clip="' + id + '"]')
    const canvas = card.querySelector('canvas')
    return { actor: actors[id], canvas, ctx: canvas.getContext('2d'), output: card.querySelector('output') }
  })
  const mode = section.querySelector('select')
  const step = section.querySelector('input[type="range"]')
  function repaint(playMode, elapsed) {
    let complete = true
    const view = mode.value
    const zoom = view === 'zoom' || view === 'marks'
    const scene = scenes[view]
    section.querySelector('.panels').classList.toggle('zoom', zoom)
    for (const { actor, canvas, ctx, output } of panel) {
      const time = elapsed % actor.walk.totalDurationMs
      const sample = playMode === 'journey' ? journey(actor, elapsed, 1) : walk(actor, time)
      complete &&= sample.stage === 'done'
      const w = scene ? scene.review.width : zoom ? 256 : 64
      const h = scene ? scene.review.height : zoom ? 256 : 64
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h }
      ctx.clearRect(0, 0, w, h)
      if (scene) {
        ctx.drawImage(scene.review, 0, 0)
        draw(ctx, sample.source, sample.rect, scene.anchor[0] - actor.walk.pivot[0] + sample.root, scene.anchor[1] - actor.walk.pivot[1])
      } else if (view === 'marks' && sample.stage === 'walk') {
        draw(ctx, actor.images.marks, { x: sample.index * 256, y: 0, w: 256, h: 256 }, 0, 0)
      } else draw(ctx, sample.source, sample.rect, 0, 0, zoom ? 4 : 1)
      output.textContent = describe(sample)
      output.dataset.stage = sample.stage
      output.dataset.frame = sample.index
      output.dataset.root = sample.root
    }
    if (playMode === 'loop') step.value = String(frameAt(panel[0].actor.walk.frames, elapsed % panel[0].actor.walk.totalDurationMs))
    return complete
  }
  const clock = controls(section, repaint)
  const manual = () => clock.show('loop', panel[0].actor.walk.frames.slice(0, Number(step.value)).reduce((t, frame) => t + frame.durationMs, 0))
  step.addEventListener('input', manual)
  mode.addEventListener('change', manual)
  clock.show('loop', 0)
}

function runtime(section, actors, scenes) {
  const canvas = section.querySelector('canvas')
  const ctx = canvas.getContext('2d')
  const environment = section.querySelector('#environment')
  const clip = section.querySelector('#surveyor-clip')
  const marks = section.querySelector('#show-contact')
  const outputs = [...section.querySelectorAll('output')]
  const cycles = 5
  let snapshot
  function repaint(_mode, elapsed) {
    const scene = scenes[environment.value]
    if (canvas.width !== scene.stage.width || canvas.height !== scene.stage.height) {
      canvas.width = scene.stage.width
      canvas.height = scene.stage.height
    }
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(scene.stage, 0, 0)
    const state = [actors[clip.value], actors.courier].map((actor, i) => {
      const sample = journey(actor, elapsed, cycles)
      const [x, y] = scene.tracks[i]
      const origin = [x - actor.walk.pivot[0] + sample.root, y - actor.walk.pivot[1]]
      draw(ctx, sample.source, sample.rect, ...origin)
      const feet = Object.fromEntries(footNames.flatMap(side => {
        if (!sample.feet) return []
        const { canvas: [px, py], state } = sample.feet[side]
        const world = [origin[0] + px, origin[1] + py]
        if (marks.checked) {
          ctx.fillStyle = state === 'planted' ? '#ffbc70' : '#83baff'
          ctx.fillRect(world[0] - 2, world[1] - 1, 5, 1)
        }
        return [[side, { state, world }]]
      }))
      if (marks.checked) {
        ctx.fillStyle = '#a1e8c7'
        ctx.fillRect(x + sample.root, y + 3, 1, 4)
      }
      outputs[i].textContent = describe(sample)
      return { id: actor.id, stage: sample.stage, frame: sample.index, root: sample.root, feet, origin,
        cycle: sample.worldCycle, phase: sample.phase }
    })
    snapshot = { elapsed: Math.floor(elapsed), environment: environment.value, camera: [canvas.width, canvas.height], cycles, actors: state }
    return state.every(actor => actor.stage === 'done')
  }
  const clock = controls(section, repaint)
  for (const select of [environment, clip]) select.addEventListener('change', () => clock.show('journey', 0))
  marks.addEventListener('change', () => repaint('journey', snapshot.elapsed))
  window.e53Runtime = { snapshot: () => structuredClone(snapshot), sample: ms => { clock.show('journey', ms); return structuredClone(snapshot) } }
  clock.show('journey', 0)
}

async function main() {
  const actors = Object.fromEntries(await Promise.all(data.actors.map(async actor => {
    const images = Object.fromEntries(await Promise.all(Object.entries(actor.images).map(async ([id, src]) => [id, await image(src)])))
    const idle = { timing: actor.idle.timing, image: await image(actor.idle.image) }
    const { canvas, frames } = actor.walk
    if (images.strip.width !== canvas.w * frames.length || images.strip.height !== canvas.h ||
        frames.some(({ rect }, i) => rect.x !== i * canvas.w || rect.y !== 0 || rect.w !== canvas.w || rect.h !== canvas.h)) {
      throw new Error(actor.id + ' có strip hoặc rect sai.')
    }
    if (actor.walk.totalDurationMs !== frames.reduce((n, f) => n + f.durationMs, 0) ||
        actor.walk.rootMotion.frames.length !== frames.length) throw new Error(actor.id + ' có timing hoặc root sai.')
    return [actor.id, { ...actor, images, idle }]
  })))
  const scenes = Object.fromEntries(await Promise.all(data.scenes.map(async s => [
    s.id, { ...s, review: await image(s.review), stage: await image(s.stage) },
  ])))
  for (const section of document.querySelectorAll('[data-actors]')) review(section, actors, scenes)
  const stage = document.querySelector('#runtime')
  if (stage) runtime(stage, actors, scenes)
  document.body.dataset.ready = 'true'
}

main().catch(error => {
  document.body.dataset.ready = 'error'
  document.querySelector('#load-error').textContent = error.message
})

for (const form of document.querySelectorAll('form[data-rubric]')) {
  form.addEventListener('submit', event => {
    event.preventDefault()
    const blob = new Blob([JSON.stringify(Object.fromEntries(new FormData(form)), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'e53-' + form.dataset.rubric + '-review.json'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 3000)
  })
}
