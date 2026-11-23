const ROOTS = new WeakMap();
const MODE_ICONS = {
  workout: 'M3 9v6m3-9v12m12-12v12m3-9v6M6 12h12',
  stamina: 'M3 12h4l3-7 4 14 3-7h4',
  warmup: 'M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2 2m8 8 2 2m0-12-2 2M8 16l-2 2',
  recovery: 'M12 21 4.8 13.8a4.4 4.4 0 0 1 6.2-6.2l1 1 1-1a4.4 4.4 0 0 1 6.2 6.2Z',
  mobility: 'M7 17 17 7m-6 0h6v6m-4 4H7v-6',
  tactics: 'M4 19 9 14l3 3 7-10M14 7h5v5',
  technique: 'M12 3v3m0 12v3M3 12h3m12 0h3M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  mindset: 'M12 2v5m0 10v5M2 12h5m10 0h5M6 6l3 3m6 6 3 3m0-12-3 3m-6 6-3 3',
  nutrition: 'M7 3v7m3-7v7M4 3v7c0 2 1.5 3 3 3s3-1 3-3M7 13v8m11-1V3c-3 3-4 6-4 11h4',
  hydration: 'M12 3C9 7 5 11 5 15a7 7 0 0 0 14 0c0-4-4-8-7-12Zm-3 13a3 3 0 0 0 3 3',
  'small-space': 'M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5m-3-12v8m-4-4h8',
  decision: 'M5 5v3c0 2 2 4 4 4h6m-3-3 3 3-3 3m-7-3v7m13-14h1v14h-1',
  review: 'M7 4h10m-8-1v3h6V3M6 6H4v15h16V6h-2m-9 7 2 2 4-4',
};
const PLAYBOOK_SCENES = {
  Training: 'training',
  Recovery: 'recovery',
  'Game IQ': 'game-iq',
  Fuel: 'fuel',
};

function node(tag, className, content) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (content !== undefined) element.textContent = content;
  return element;
}

function button(title, className, handler) {
  const item = node('button', className, title);
  item.type = 'button';
  item.addEventListener('click', handler);
  return item;
}

function listOptions(select, options, value) {
  select.replaceChildren(...options.map(option => new Option(option)));
  if (options.includes(value)) select.value = value;
}

function createMotion(hero, canvas, toggle) {
  const context = canvas.getContext('2d');
  if (!context) {
    hero.dataset.paused = 'true';
    toggle.hidden = true;
    return () => {};
  }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const particles = Array.from({length: 68}, () => ({
    x: Math.random(), y: Math.random(), speed: .035 + Math.random() * .14,
    alpha: .12 + Math.random() * .53, size: .38 + Math.random() * 1.2,
    trail: Math.random() > .87,
  }));
  let paused = reduced.matches;
  let visible = true;
  let width = 1, height = 1, frame = 0, previous = 0;
  const controller = new AbortController();
  const {signal} = controller;

  function draw(time = 0) {
    const delta = previous ? Math.min(.036, (time - previous) / 1000) : 0;
    previous = time;
    context.clearRect(0, 0, width, height);
    for (const particle of particles) {
      particle.x = (particle.x + delta * particle.speed) % 1;
      particle.y = (particle.y + 1 - delta * particle.speed * .21) % 1;
      const x = particle.x * width, y = particle.y * height;
      context.globalAlpha = particle.alpha * (.24 + particle.x * .76);
      if (particle.trail) {
        const length = (10 + particle.size * 25) * (width < 580 ? .55 : 1);
        const fade = context.createLinearGradient(x - length, y + length * .2, x, y);
        fade.addColorStop(0, 'transparent');
        fade.addColorStop(1, '#ff7754');
        context.strokeStyle = fade;
        context.lineWidth = particle.size;
        context.beginPath();
        context.moveTo(x - length, y + length * .2);
        context.lineTo(x, y);
        context.stroke();
      } else {
        context.fillStyle = particle.x > .52 ? '#ff9372' : '#f7c6b6';
        context.beginPath();
        context.arc(x, y, particle.size, 0, Math.PI * 2);
        context.fill();
      }
    }
    context.globalAlpha = 1;
    frame = !paused && visible && !document.hidden ? requestAnimationFrame(draw) : 0;
  }

  function refresh() {
    cancelAnimationFrame(frame);
    previous = 0;
    draw();
    toggle.setAttribute('aria-pressed', String(paused));
    hero.dataset.paused = String(paused);
    toggle.setAttribute('aria-label', paused ? 'Play background animation' : 'Pause background animation');
    toggle.firstElementChild.textContent = paused ? '▷' : 'Ⅱ';
    if (paused) resetParallax();
  }
  function resetParallax() {
    hero.style.removeProperty('--px');
    hero.style.removeProperty('--py');
  }
  const resize = new ResizeObserver(() => {
    const scale = Math.min(devicePixelRatio || 1, 2);
    width = hero.clientWidth;
    height = hero.clientHeight;
    canvas.width = Math.max(1, width * scale);
    canvas.height = Math.max(1, height * scale);
    context.setTransform(scale, 0, 0, scale, 0, 0);
    refresh();
  });
  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    refresh();
  });
  resize.observe(hero);
  intersection.observe(hero);
  toggle.addEventListener('click', () => { paused = !paused; refresh(); }, {signal});
  reduced.addEventListener('change', () => { paused = reduced.matches; refresh(); }, {signal});
  document.addEventListener('visibilitychange', refresh, {signal});
  hero.addEventListener('pointermove', event => {
    if (paused || event.pointerType === 'touch') return;
    const rect = hero.getBoundingClientRect();
    hero.style.setProperty('--px', (0.5 - (event.clientX - rect.left) / rect.width) * 16 + 'px');
    hero.style.setProperty('--py', (0.5 - (event.clientY - rect.top) / rect.height) * 10 + 'px');
  }, {signal});
  hero.addEventListener('pointerleave', resetParallax, {signal});
  return () => {
    controller.abort();
    resize.disconnect();
    intersection.disconnect();
    cancelAnimationFrame(frame);
  };
}

function mount(root, component) {
  const $ = (selector) => root.querySelector(selector);
  const form = $('#profile-form');
  const fields = form.elements;
  const modes = $('#modes');
  const filters = $('#filters');
  const stage = $('.mode-stage');
  const stageVisual = $('.mode-visual');
  const stageCopy = $('.stage-copy');
  const stageToggle = $('.stage-toggle');
  const stagePrevious = $('#mode-prev');
  const stageNext = $('#mode-next');
  const sportList = $('#sport-list');
  const sample = $('#sample-mode');
  const submit = $('.submit');
  const output = $('#output');
  const keyForm = $('#key-form');
  const tuning = $('#model-tuning');
  const comparison = $('.compare-controls');
  const compareFirst = $('#compare-first');
  const compareSecond = $('#compare-second');
  const compareResults = $('#compare-results');
  const exportRuns = $('.export-runs');
  let data = component.data;
  let send = component.setTriggerValue;
  let filter = 'All';
  let mode = 'workout';
  let pending = null;
  let settingsPending = null;
  let shown = null;
  let previousConnection = null;
  let renderedMode = null;
  let copyAnimation;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let stagePaused = reducedMotion.matches;
  const stageView = new IntersectionObserver(([entry]) => {
    stage.dataset.visible = String(entry.isIntersecting);
  });
  stageView.observe(stage);

  function syncStageMotion() {
    const paused = stagePaused || reducedMotion.matches;
    const label = paused ? 'Play playbook animation' : 'Pause playbook animation';
    stage.dataset.paused = String(paused);
    stageToggle.hidden = reducedMotion.matches;
    stageToggle.setAttribute('aria-label', label);
    stageToggle.title = label;
    stageToggle.firstElementChild.textContent = paused ? '▷' : 'Ⅱ';
    if (paused) {
      copyAnimation?.cancel();
      resetStageParallax();
    }
  }

  function resetStageParallax() {
    stage.style.removeProperty('--stage-x');
    stage.style.removeProperty('--stage-y');
  }

  function setMotionPreference() {
    stagePaused = reducedMotion.matches;
    syncStageMotion();
  }

  stageToggle.addEventListener('click', () => {
    if (reducedMotion.matches) return;
    stagePaused = !stagePaused;
    syncStageMotion();
  });
  reducedMotion.addEventListener('change', setMotionPreference);
  syncStageMotion();
  stage.addEventListener('pointermove', event => {
    if (stagePaused || reducedMotion.matches || event.pointerType === 'touch') return;
    const bounds = stage.getBoundingClientRect();
    stage.style.setProperty('--stage-x', ((event.clientX - bounds.left) / bounds.width - .5) * -16 + 'px');
    stage.style.setProperty('--stage-y', ((event.clientY - bounds.top) / bounds.height - .5) * -12 + 'px');
  });
  stage.addEventListener('pointerleave', resetStageParallax);

  function notify(type, values) {
    const id = crypto.randomUUID();
    send('action', {id, type, ...values});
    return id;
  }

  function goTo(id) {
    const target = $('#' + id);
    if (target) target.scrollIntoView({
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      block: 'start',
    });
  }

  function setSport(sport, position) {
    fields.sport.value = sport;
    listOptions(fields.position, data.sports[sport], position);
    $('#profile-tag').textContent = sport;
    for (const choice of sportList.children) {
      choice.setAttribute('aria-pressed', String(choice.textContent === sport));
    }
  }

  function updateReadiness() {
    const visible = fields.readiness.value !== 'Ready to train';
    $('#injury-field').hidden = !visible;
    fields.injuries.disabled = !visible;
    fields.injuries.required = fields.readiness.value === 'Cleared with restrictions';
  }

  function chooseMode(item) {
    mode = item.id;
    $('#selected-mode').textContent = item.title;
    modes.setAttribute('aria-label', 'Select a coaching mode. Selected: ' + item.title);
    for (const card of modes.children) {
      const selected = card.dataset.mode === mode;
      card.setAttribute('aria-pressed', String(selected));
      card.lastElementChild.textContent = selected ? '✓' : '↗';
    }
    if (renderedMode === mode) return;
    renderedMode = mode;
    stage.dataset.scene = PLAYBOOK_SCENES[item.group];
    for (const picture of stageVisual.children) {
      picture.dataset.active = String(picture.dataset.scene === stage.dataset.scene);
    }
    $('#stage-group').textContent = item.group;
    $('#stage-title').textContent = item.title;
    $('#stage-description').textContent = item.description;
    copyAnimation?.cancel();
    if (!stagePaused && !reducedMotion.matches) {
      copyAnimation = stageCopy.animate([
        {opacity: .28, transform: 'translateY(9px)'},
        {opacity: 1, transform: 'translateY(0)'},
      ], {duration: 350, easing: 'cubic-bezier(.22,.68,.25,1)'});
    }
  }

  function activateMode(item) {
    chooseMode(item);
    if (item.id === 'recovery' || item.group === 'Fuel') $('.profile-details').open = true;
  }

  function visibleModes() {
    return data.modes.filter(item => filter === 'All' || item.group === filter);
  }

  function navigateMode(direction, from = mode) {
    const list = visibleModes();
    const current = list.findIndex(item => item.id === from);
    const index = current < 0 ? (direction < 0 ? list.length - 1 : 0)
      : (current + direction + list.length) % list.length;
    activateMode(list[index]);
    const card = modes.children[index];
    const listBounds = modes.getBoundingClientRect();
    const bounds = card.getBoundingClientRect();
    const delta = bounds.top < listBounds.top ? bounds.top - listBounds.top
      : Math.max(0, bounds.bottom - listBounds.bottom);
    if (delta) modes.scrollBy({top:delta,behavior:reducedMotion.matches ? 'instant' : 'smooth'});
    return card;
  }

  function renderModes() {
    const shownModes = visibleModes();
    modes.replaceChildren(...shownModes.map(item => {
      const card = button('', 'mode', () => activateMode(item));
      card.dataset.mode = item.id;
      card.setAttribute('aria-pressed', String(item.id === mode));
      const icon = node('span', 'mode-icon');
      icon.setAttribute('aria-hidden', 'true');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const path = document.createElementNS(svg.namespaceURI, 'path');
      svg.setAttribute('viewBox', '0 0 24 24');
      path.setAttribute('d', MODE_ICONS[item.id]);
      svg.append(path);
      icon.append(svg);
      const arrow = node('span', 'mode-arrow', item.id === mode ? '✓' : '↗');
      arrow.setAttribute('aria-hidden', 'true');
      card.append(icon, node('strong', '', item.title), arrow);
      return card;
    }));
    modes.scrollTop = 0;
    const selected = data.modes.find(item => item.id === mode);
    $('#mode-count').textContent = shownModes.length + (shownModes.length === 1 ? ' mode' : ' modes');
    chooseMode(selected);
  }

  function chooseFilter(value) {
    filter = value;
    for (const choice of filters.children) choice.setAttribute('aria-pressed', String(choice.textContent === value));
    renderModes();
  }

  stagePrevious.addEventListener('click', () => navigateMode(-1));
  stageNext.addEventListener('click', () => navigateMode(1));
  modes.addEventListener('keydown', event => {
    const delta = {ArrowUp: -1, ArrowDown: 1}[event.key];
    if (!delta || event.target.parentElement !== modes) return;
    event.preventDefault();
    navigateMode(delta, event.target.dataset.mode).focus({preventScroll:true});
  });

  function sourceNote() {
    $('#source-note').textContent = sample.checked
      ? 'Samples use built-in plans and work without a key.'
      : 'Gemini receives the profile fields you submit. Enter fictional details only.';
  }

  function renderConnection() {
    const {enabled, primary, backup, distinct, session, model} = data.connection;
    const live = primary || backup;
    const connection = $('.connection');
    connection.dataset.live = String(live);
    $('#connection-label').textContent = live ? 'Gemini configured' : 'Sample mode';
    keyForm.hidden = !enabled;
    sample.closest('label').hidden = !enabled;
    $('#key-description').textContent = enabled
      ? 'CoachBot tries the primary Gemini key first, then the backup after an eligible key, quota, or service error.'
      : 'This demo uses built-in plans. A private, adult-operated installation can enable live Gemini for fictional profiles.';
    $('#primary-state').textContent = primary ? 'Configured' : '';
    $('#backup-state').textContent = backup ? (distinct ? 'Configured' : 'Matches primary') : '';
    $('#clear-keys').disabled = !session;
    $('#settings-status').textContent = 'Model · ' + model;
    if (previousConnection !== live) {
      sample.checked = !live;
      previousConnection = live;
    }
    sourceNote();
    if (settingsPending && data.settingsEvent === settingsPending) {
      $('#settings-status').textContent = 'Settings updated · ' + model;
      settingsPending = null;
    }
  }

  function planText(plan, label) {
    const parts = ['CoachBot AI', label, plan.title, plan.summary, ''];
    for (const section of plan.sections) parts.push(section.heading, ...section.steps.map(step => '• ' + step), 'Why: ' + section.why, '');
    parts.push('Safety: ' + plan.safety);
    return parts.join('\n');
  }

  function download(content, filename, type = 'text/plain;charset=utf-8') {
    const url = URL.createObjectURL(new Blob([content], {type}));
    const link = node('a');
    link.download = filename;
    link.href = url;
    root.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function renderOutput(result) {
    output.hidden = false;
    const title = node('h2', '', result.plan?.title || (result.error ? 'Check your session' : 'Building your session…'));
    title.id = 'output-title';
    const intro = node('div');
    intro.append(node('p', 'eyebrow', result.source || 'SESSION PLAN'), title);
    const top = node('div', 'output-top');
    top.append(intro);
    output.replaceChildren(top);
    if (!result.plan) {
      output.append(node('p', 'output-summary', result.error || 'Preparing your coaching plan.'));
      return;
    }
    const plan = result.plan;
    top.append(button('Save plan ↓', 'button ghost', () =>
      download(planText(plan, result.source), 'coachbot-session.txt')));
    output.append(node('p', 'output-summary', plan.summary));
    const grid = node('div', 'output-grid');
    for (const section of plan.sections) {
      const card = node('article', 'output-card');
      const list = node('ul');
      list.append(...section.steps.map(step => node('li', '', step)));
      card.append(node('h3', '', section.heading), list, node('p', '', section.why));
      grid.append(card);
    }
    output.append(grid, node('p', 'output-safety', plan.safety));
  }

  function renderRuns() {
    const log = $('#run-log');
    log.replaceChildren(...data.runs.map(run => {
      const row = node('div', 'run');
      const assignment = node('div');
      assignment.append(node('strong', '', run.mode), node('span', '', run.sport + ' · ' + run.position));
      const setting = run.setting ? ' · ' + run.setting : '';
      row.append(assignment, node('span', '', run.source + setting), node('span', '', run.seconds + ' s'));
      return row;
    }));
    if (!data.runs.length) log.append(node('p', 'form-note', 'Generate a session to see it here.'));
    exportRuns.hidden = !data.runs.length;
    const plans = data.runs.filter(run => run.plan && run.id);
    comparison.hidden = plans.length < 2;
    const previous = compareSecond.value ? [compareFirst.value, compareSecond.value] : [];
    for (const [index, picker] of [compareFirst, compareSecond].entries()) {
      picker.replaceChildren(...plans.map((run, order) =>
        new Option((order + 1) + '. ' + run.plan.title + ' · ' + run.position, run.id)));
      picker.value = plans.some(run => run.id === previous[index]) ? previous[index] : plans[index]?.id || '';
    }
    renderComparison();
  }

  function renderComparison() {
    compareResults.replaceChildren();
    if (comparison.hidden) return;
    const pair = [compareFirst.value, compareSecond.value];
    if (pair[0] === pair[1]) {
      compareResults.append(node('p', 'form-note', 'Choose two different runs to compare.'));
      return;
    }
    for (const id of pair) {
      const run = data.runs.find(item => item.id === id);
      const card = node('article', 'output-card');
      card.append(node('p', 'compare-meta', [run.source, run.model, run.setting, run.seconds + ' s'].filter(Boolean).join(' · ')),
        node('h3', '', run.plan.title), node('p', '', run.plan.summary));
      for (const section of run.plan.sections) {
        const list = node('ul');
        list.append(...section.steps.map(step => node('li', '', step)));
        card.append(node('h4', '', section.heading), list);
      }
      card.append(node('p', 'output-safety', run.plan.safety));
      compareResults.append(card);
    }
  }

  function loadExample(example) {
    setSport(example.sport, example.position);
    const defaults = {age: data.options.age[1], duration: data.options.duration[1], intensity: 'Easy',
      style: 'Mixed session', equipment: '', readiness: 'Ready to train', injuries: '',
      diet: 'No preference', allergies: '', fuel_goal: '', goal: ''};
    for (const [key, value] of Object.entries(defaults)) fields[key].value = example[key] ?? value;
    updateReadiness();
    $('.profile-details').open = Boolean(example.injuries || example.allergies);
    mode = example.mode;
    chooseFilter('All');
    sample.checked = true;
    sourceNote();
    goTo('profile-form');
  }

  const sports = Object.keys(data.sports);
  // Each scene has one image layer so the previous scene can dissolve into the current one.
  for (const name of Object.values(PLAYBOOK_SCENES)) {
    const picture = node('div', 'mode-picture');
    picture.dataset.scene = name;
    const source = data.playbookArt?.[name] || data.hero;
    if (source) picture.style.backgroundImage = 'url("' + source + '")';
    stageVisual.append(picture);
  }
  tuning.append(new Option('Automatic by coaching mode', ''),
    ...Object.entries(data.tuning).map(([value, label]) => new Option(label, value)));
  tuning.closest('label').hidden = !Object.keys(data.tuning).length;
  listOptions(fields.sport, sports);
  for (const [name, options] of Object.entries(data.options)) listOptions(fields[name], options);
  fields.age.value = '13–15';
  fields.duration.value = '25 minutes';
  const groups = ['All', ...new Set(data.modes.map(item => item.group))];
  filters.append(...groups.map(group => button(group, '', () => chooseFilter(group))));
  sportList.append(...sports.map(sport => button(sport, 'sport-choice', () => {
    setSport(sport);
    goTo('builder');
  })));
  setSport(sports[0]);
  chooseFilter(filter);
  updateReadiness();
  fields.sport.addEventListener('change', () => setSport(fields.sport.value));
  fields.readiness.addEventListener('change', updateReadiness);
  sample.addEventListener('change', sourceNote);
  $('#load-example').addEventListener('click', () => loadExample(data.scenarios[0]));
  $('#scenario-grid').append(...data.scenarios.map(example => {
    const card = button('', 'scenario', () => loadExample(example));
    card.append(node('small', '', example.sport + ' · ' + example.position),
      node('strong', '', example.title), node('span', '', 'Load profile ↗'));
    return card;
  }));
  compareFirst.addEventListener('change', renderComparison);
  compareSecond.addEventListener('change', renderComparison);
  exportRuns.addEventListener('click', () => download(
    JSON.stringify({runs: data.runs}, null, 2), 'coachbot-run-evidence.json', 'application/json'));
  for (const link of root.querySelectorAll('a[href^="#"]')) {
    link.addEventListener('click', event => {
      event.preventDefault();
      goTo(link.getAttribute('href').slice(1));
    });
  }
  for (const open of root.querySelectorAll('[data-open]')) {
    open.addEventListener('click', () => $('#' + open.dataset.open).showModal());
  }
  for (const close of root.querySelectorAll('.modal .close')) close.addEventListener('click', () => close.closest('dialog').close());
  keyForm.addEventListener('submit', event => {
    event.preventDefault();
    const primary = keyForm.elements.primary.value.trim();
    const backup = keyForm.elements.backup.value.trim();
    if (!primary && !backup) {
      $('#settings-status').textContent = 'Enter a primary or backup key to save.';
      return;
    }
    if ([primary, backup].some(key => key && !/^[!-~]{12,256}$/.test(key))) {
      $('#settings-status').textContent = 'Paste the full key without spaces.';
      return;
    }
    if (primary && primary === backup) {
      $('#settings-status').textContent = 'Use two different keys to enable fallback.';
      return;
    }
    keyForm.reset();
    $('#settings-status').textContent = 'Saving…';
    settingsPending = notify('save_keys', {primary, backup});
  });
  $('#clear-keys').addEventListener('click', () => {
    keyForm.reset();
    settingsPending = notify('clear_keys', {});
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (pending) return;
    const profile = {...Object.fromEntries(new FormData(form)), mode};
    submit.disabled = true;
    submit.firstElementChild.textContent = 'Generating…';
    renderOutput({});
    goTo('output');
    pending = notify('generate', {profile, demo: sample.checked, tuning: tuning.value});
  });
  const dispose = createMotion($('.hero'), $('.motion'), $('.motion-toggle'));

  return {
    dispose() {
      dispose();
      stageView.disconnect();
      copyAnimation?.cancel();
      reducedMotion.removeEventListener('change', setMotionPreference);
    },
    update(next) {
      data = next.data;
      send = next.setTriggerValue;
      if (data.hero) $('.hero-image').style.setProperty('--hero-image', 'url("' + data.hero + '")');
      renderConnection();
      renderRuns();
      if (data.result && data.result.id !== shown && (!pending || pending === data.result.id)) {
        const justSubmitted = pending !== null;
        shown = data.result.id;
        pending = null;
        submit.disabled = false;
        submit.firstElementChild.textContent = 'Generate session';
        renderOutput(data.result);
        if (justSubmitted) requestAnimationFrame(() => goTo('output'));
      }
    },
  };
}

export default function render(component) {
  const root = component.parentElement.querySelector('.studio');
  if (!root || !component.data) return;
  let app = ROOTS.get(root);
  if (!app) {
    app = mount(root, component);
    ROOTS.set(root, app);
  }
  app.update(component);
  return () => {
    queueMicrotask(() => {
      if (!root.isConnected) {
        app.dispose();
        ROOTS.delete(root);
      }
    });
  };
}
