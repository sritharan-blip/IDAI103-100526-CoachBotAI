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
const SCENARIO_SCENES = {
  stamina: 'training',
  injury: 'recovery',
  fuel: 'fuel',
  space: 'game-iq',
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

function createFilmMotion(root, films) {
  const hero = root.querySelector('.hero');
  const toggle = root.querySelector('.motion-toggle');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const controller = new AbortController();
  const {signal} = controller;
  const visible = new Set();
  let paused = false;
  let frame = 0;

  const clips = [...root.querySelectorAll('[data-film]')].map(host => {
    const film = films[host.dataset.film];
    if (film?.poster) host.style.backgroundImage = `url("${film.poster}")`;
    if (!film?.video) return {host};
    const video = node('video', 'film-media');
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'none';
    video.setAttribute('aria-hidden', 'true');
    video.addEventListener('playing', () => { host.dataset.playing = 'true'; }, {signal});
    video.addEventListener('error', () => { delete host.dataset.playing; }, {signal});
    host.append(video);
    return {host, video, source: film.video};
  });

  function refresh() {
    const motion = !paused && !reduced.matches;
    const label = motion ? 'Pause motion' : 'Play motion';
    root.dataset.motion = motion ? 'on' : 'off';
    toggle.hidden = reduced.matches;
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
    toggle.firstElementChild.textContent = motion ? 'Ⅱ' : '▶';
    for (const {host, video, source} of clips) {
      if (!video) continue;
      if (!motion || document.hidden || !visible.has(host) || host.dataset.active === 'false') {
        video.pause();
        continue;
      }
      if (!video.src) video.src = source;
      if (video.paused) video.play().catch(() => {});
    }
    updateScroll();
  }

  function updateScroll() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (root.dataset.motion !== 'on') {
        hero.style.removeProperty('--reel-progress');
        return;
      }
      const {top, height} = hero.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, -top / height));
      hero.style.setProperty('--reel-progress', progress.toFixed(3));
    });
  }

  const screen = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.intersectionRatio >= .12) visible.add(entry.target);
      else visible.delete(entry.target);
    }
    refresh();
  }, {threshold: .12});
  for (const {host, video} of clips) if (video) screen.observe(host);

  const chapters = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('in-view');
      chapters.unobserve(entry.target);
    }
  }, {threshold: .16});
  for (const chapter of root.querySelectorAll('.case-preview,.mode-stage')) chapters.observe(chapter);
  document.addEventListener('scroll', updateScroll, {capture: true, passive: true, signal});
  document.addEventListener('visibilitychange', refresh, {signal});
  reduced.addEventListener('change', refresh, {signal});
  toggle.addEventListener('click', () => { paused = !paused; refresh(); }, {signal});
  refresh();

  return {
    refresh,
    dispose() {
      controller.abort();
      screen.disconnect();
      chapters.disconnect();
      cancelAnimationFrame(frame);
      for (const {video} of clips) video?.pause();
    },
  };
}

function mount(root, component) {
  const $ = (selector) => root.querySelector(selector);
  const form = $('#profile-form');
  const fields = form.elements;
  const goalLength = $('.goal-length');
  const profileDetails = $('.profile-details');
  const profileScenario = $('#profile-scenario');
  const modes = $('#modes');
  const filters = $('#filters');
  const stage = $('.mode-stage');
  const stageVisual = $('.mode-visual');
  const stageCopy = $('.stage-copy');
  const stagePrevious = $('#mode-prev');
  const stageNext = $('#mode-next');
  const sportList = $('#sport-list');
  const sample = $('#sample-mode');
  const submit = $('.submit');
  const output = $('#output');
  const keyForm = $('#key-form');
  const testGemini = $('#test-gemini');
  const clearKeys = $('#clear-keys');
  const saveKeys = keyForm.querySelector('button[type=submit]');
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
  let selectedScenario = data.scenarios[0];
  let shown = null;
  let previousConnection = null;
  let renderedMode = null;
  let copyAnimation;

  function notify(type, values) {
    const id = crypto.randomUUID();
    send('action', {id, type, ...values});
    return id;
  }

  function goTo(id, focus = false) {
    const target = $('#' + id);
    if (!target) return;
    if (focus) {
      target.tabIndex = -1;
      target.focus({preventScroll: true});
    }
    target.scrollIntoView({
      behavior: root.dataset.motion === 'off' ? 'instant' : 'smooth',
      block: 'start',
    });
  }

  function updateProfilePreview() {
    $('#profile-athlete').textContent = [fields.sport.value, fields.position.value].filter(Boolean).join(' · ');
    $('#profile-timing').textContent = [fields.duration.value, fields.intensity.value].filter(Boolean).join(' · ');
    const used = fields.goal.value.length;
    goalLength.hidden = used < fields.goal.maxLength - 35;
    goalLength.textContent = `${used} / ${fields.goal.maxLength}`;
  }

  function setSport(sport, position) {
    fields.sport.value = sport;
    listOptions(fields.position, data.sports[sport], position);
    for (const choice of sportList.children) {
      choice.setAttribute('aria-pressed', String(choice.textContent === sport));
    }
    updateProfilePreview();
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
    const list = visibleModes();
    $('#stage-position').textContent = `${list.findIndex(option => option.id === mode) + 1} of ${list.length}`;
    modes.dataset.scene = PLAYBOOK_SCENES[item.group];
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
      picture.dataset.active = String(picture.dataset.film === stage.dataset.scene);
    }
    $('#stage-group').textContent = item.group;
    $('#stage-title').textContent = item.title;
    $('#stage-description').textContent = item.description;
    copyAnimation?.cancel();
    filmPlayer.refresh();
    if (root.dataset.motion === 'on') {
      copyAnimation = stageCopy.animate([
        {opacity: .28, transform: 'translateY(9px)'},
        {opacity: 1, transform: 'translateY(0)'},
      ], {duration: 350, easing: 'cubic-bezier(.22,.68,.25,1)'});
    }
  }

  function activateMode(item) {
    chooseMode(item);
    if (item.group === 'Fuel') profileDetails.open = true;
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
    if (delta) modes.scrollBy({top: delta, behavior: root.dataset.motion === 'off' ? 'instant' : 'smooth'});
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
    const available = visibleModes();
    if (!available.some(item => item.id === mode)) mode = available[0].id;
    for (const choice of filters.children) choice.setAttribute('aria-pressed', String(choice.textContent === value));
    renderModes();
    if (value === 'Fuel') profileDetails.open = true;
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
    $('#settings-status').textContent = settingsPending ? 'Updating session keys…' : 'Model · ' + model;
    if (previousConnection !== live) {
      sample.checked = !live;
      previousConnection = live;
    }
    sourceNote();
    if (settingsPending && data.settingsEvent === settingsPending) {
      $('#settings-status').textContent = 'Settings updated · ' + model;
      settingsPending = null;
    }
    testGemini.disabled = !live || Boolean(settingsPending);
    clearKeys.disabled = !session || Boolean(settingsPending);
    saveKeys.disabled = Boolean(settingsPending);
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
    output.dataset.state = result.error ? 'error' : result.plan ? 'ready' : 'loading';
    output.dataset.source = result.source || '';
    const title = node('h2', '', result.plan?.title || (result.error ? 'Check your session' : 'Building your session…'));
    title.id = 'output-title';
    const intro = node('div');
    intro.append(node('p', 'output-source', result.source || 'Session plan'), title);
    const top = node('div', 'output-top');
    top.append(intro);
    output.replaceChildren(top);
    if (!result.plan) {
      output.append(node('p', 'output-summary', result.error || 'Preparing your coaching plan.'));
      return;
    }
    const plan = result.plan;
    const actions = node('div', 'output-actions');
    actions.append(
      button('Save plan ↓', 'button primary', () => download(planText(plan, result.source), 'coachbot-session.txt')),
      button('Review Lab', 'button ghost', () => $('#review').showModal()),
    );
    top.append(actions);
    const run = data.runs.find(item => item.id === result.id);
    if (run) {
      const context = node('ul', 'output-context');
      context.setAttribute('aria-label', 'Session details');
      const labels = [run.sport, run.position, run.mode];
      if (run.model) labels.push(run.model, `${run.seconds} s`);
      for (const label of labels) context.append(node('li', '', label));
      output.append(context);
    }

    const guidanceOnly = ['Safety check', 'Restrictions checklist'].includes(result.source);
    const workspace = node('div', 'session-workspace');
    const overview = node('div', 'session-overview');
    overview.append(node('p', 'output-summary', plan.summary));

    const grid = node('div', 'output-grid');
    if (!guidanceOnly) {
      const stepCount = plan.sections.reduce((count, section) => count + section.steps.length, 0);
      const stepProgress = node('progress');
      stepProgress.max = stepCount;
      stepProgress.setAttribute('aria-label', 'Session progress');
      const progressCount = node('p', 'progress-count');
      function updateProgress() {
        const checked = grid.querySelectorAll('input:checked').length;
        stepProgress.value = checked;
        progressCount.textContent = `${checked} of ${stepCount} steps complete`;
      }
      const tracker = node('div', 'session-progress');
      tracker.append(node('h3', '', 'Session progress'), stepProgress, progressCount);
      overview.append(tracker);
      grid.addEventListener('change', updateProgress);
      updateProgress();
    }
    const safety = node('div', 'output-safety');
    safety.append(node('strong', '', 'Safety note'), node('p', '', plan.safety));
    overview.append(safety);

    for (const section of plan.sections) {
      const card = node('article', 'output-card plan-section');
      const list = node('ul', guidanceOnly ? '' : 'plan-checklist');
      for (const step of section.steps) {
        const item = node('li');
        if (guidanceOnly) {
          item.textContent = step;
        } else {
          const check = node('input');
          check.type = 'checkbox';
          const label = node('label');
          label.append(check, node('span', '', step));
          item.append(label);
        }
        list.append(item);
      }
      card.append(node('h3', '', section.heading), list, node('p', '', section.why));
      grid.append(card);
    }
    workspace.append(overview, grid);
    output.append(workspace);
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

  function exampleProfile(example) {
    const defaults = {sport: example.sport, position: example.position, mode: example.mode,
      age: data.options.age[1], duration: data.options.duration[1], intensity: 'Easy',
      style: 'Mixed session', equipment: '', readiness: 'Ready to train', injuries: '',
      diet: 'No preference', allergies: '', fuel_goal: '', goal: ''};
    return Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, example[key] ?? value]));
  }

  function loadExample(example) {
    const {sport, position, mode: exampleMode, ...values} = exampleProfile(example);
    setSport(sport, position);
    for (const [key, value] of Object.entries(values)) fields[key].value = value;
    updateReadiness();
    updateProfilePreview();
    profileScenario.textContent = 'Example · ' + example.title;
    profileScenario.hidden = false;
    profileDetails.open = Boolean(example.equipment || example.allergies || example.fuel_goal);
    mode = exampleMode;
    chooseFilter('All');
    sample.checked = true;
    sourceNote();
    goTo('athlete-profile', true);
  }

  const sports = Object.keys(data.sports);
  const caseFilm = $('.case-film');
  const caseCaption = $('.case-caption');
  const scenarioGrid = $('#scenario-grid');

  for (const scene of Object.values(PLAYBOOK_SCENES)) {
    const stagePicture = node('div', 'mode-picture');
    stagePicture.dataset.film = scene;
    stagePicture.dataset.active = 'false';
    stageVisual.append(stagePicture);

    const casePicture = node('div', 'case-picture');
    casePicture.dataset.film = scene;
    casePicture.dataset.active = 'false';
    caseFilm.append(casePicture);
  }

  const filmPlayer = createFilmMotion(root, data.films);

  function previewScenario(example) {
    selectedScenario = example;
    const scene = SCENARIO_SCENES[example.id];
    caseFilm.parentElement.dataset.scene = scene;
    for (const picture of caseFilm.children) picture.dataset.active = String(picture.dataset.film === scene);
    for (const row of scenarioGrid.children) row.setAttribute('aria-pressed', String(row.dataset.scenario === example.id));
    caseCaption.textContent = example.sport + ' / ' + example.position;
    $('#case-title').textContent = example.title;
    $('#case-goal').textContent = example.goal;
    filmPlayer.refresh();
  }

  tuning.append(new Option('Automatic by coaching mode', ''),
    ...Object.entries(data.tuning).map(([value, label]) => new Option(label, value)));
  tuning.closest('label').hidden = !Object.keys(data.tuning).length;
  listOptions(fields.sport, sports);
  for (const [name, options] of Object.entries(data.options)) listOptions(fields[name], options);
  fields.age.value = data.options.age[1];
  fields.duration.value = data.options.duration[1];
  const groups = ['All', ...new Set(data.modes.map(item => item.group))];
  filters.append(...groups.map(group => button(group, '', () => chooseFilter(group))));
  sportList.append(...sports.map(sport => button(sport, 'sport-choice', () => {
    setSport(sport);
    goTo('builder', true);
  })));
  setSport(sports[0]);
  chooseFilter(filter);
  updateReadiness();
  fields.sport.addEventListener('change', () => setSport(fields.sport.value));
  fields.readiness.addEventListener('change', updateReadiness);
  form.addEventListener('input', updateProfilePreview);
  sample.addEventListener('change', sourceNote);
  $('#load-example').addEventListener('click', () => loadExample(data.scenarios[0]));
  $('#use-scenario').addEventListener('click', () => loadExample(selectedScenario));
  scenarioGrid.append(...data.scenarios.map(example => {
    const card = button('', 'scenario', () => previewScenario(example));
    card.dataset.scenario = example.id;
    card.dataset.scene = SCENARIO_SCENES[example.id];
    const text = node('span', 'scenario-copy');
    text.append(node('small', '', example.sport + ' · ' + example.position), node('strong', '', example.title));
    const arrow = node('span', 'scenario-arrow', '↗');
    arrow.setAttribute('aria-hidden', 'true');
    card.append(text, arrow);
    return card;
  }));
  previewScenario(data.scenarios[0]);
  compareFirst.addEventListener('change', renderComparison);
  compareSecond.addEventListener('change', renderComparison);
  exportRuns.addEventListener('click', () => download(
    JSON.stringify({runs: data.runs}, null, 2), 'coachbot-run-evidence.json', 'application/json'));
  for (const link of root.querySelectorAll('a[href^="#"]')) {
    link.addEventListener('click', event => {
      event.preventDefault();
      goTo(link.getAttribute('href').slice(1), true);
    });
  }
  for (const open of root.querySelectorAll('[data-open]')) {
    open.addEventListener('click', () => $('#' + open.dataset.open).showModal());
  }
  for (const close of root.querySelectorAll('.modal .close')) close.addEventListener('click', () => close.closest('dialog').close());
  keyForm.addEventListener('submit', event => {
    event.preventDefault();
    if (settingsPending) return;
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
    settingsPending = notify('save_keys', {primary, backup});
    renderConnection();
  });
  clearKeys.addEventListener('click', () => {
    if (settingsPending) return;
    keyForm.reset();
    settingsPending = notify('clear_keys', {});
    renderConnection();
  });

  function startGeneration(profile, demo) {
    if (pending) return;
    submit.disabled = true;
    submit.firstElementChild.textContent = 'Generating…';
    renderOutput({});
    goTo('output');
    pending = notify('generate', {profile, demo, tuning: tuning.value});
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    startGeneration({...Object.fromEntries(new FormData(form)), mode}, sample.checked);
  });
  testGemini.addEventListener('click', () => {
    $('#settings').close();
    startGeneration(exampleProfile(data.scenarios[0]), false);
  });

  return {
    dispose() {
      filmPlayer.dispose();
      copyAnimation?.cancel();
    },
    update(next) {
      data = next.data;
      send = next.setTriggerValue;
      renderConnection();
      renderRuns();
      if (data.result && data.result.id !== shown && (!pending || pending === data.result.id)) {
        const justSubmitted = pending !== null;
        shown = data.result.id;
        pending = null;
        submit.disabled = false;
        submit.firstElementChild.textContent = 'Generate session';
        renderOutput(data.result);
        if (justSubmitted) requestAnimationFrame(() => goTo('output', true));
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
