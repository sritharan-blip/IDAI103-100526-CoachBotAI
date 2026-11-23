"""Run with: python -m streamlit run app.py"""

import base64
import os
from pathlib import Path
from time import monotonic

import streamlit as st

from coach import MODEL, MODES, OPTIONS, SCENARIOS, SPORTS, TUNING_OPTIONS, CoachError, generate_plan, parse_profile


ROOT = Path(__file__).resolve().parent
WEB = ROOT / "web"

st.set_page_config(page_title="CoachBot AI · Training Studio", page_icon="⚡", layout="wide")
st.html("""<style>
    html {scroll-behavior:smooth;color-scheme:dark}
    [data-testid="stHeader"], [data-testid="stToolbar"], #MainMenu {display:none}
    [data-testid="stAppViewContainer"] {background:#0d0e10}
    [data-testid="stMainBlockContainer"] {padding:0;max-width:none}
    [data-testid="stMainBlockContainer"] > div {gap:0}
</style>""")


def configured(name):
    value = os.getenv(name, "")
    if not value:
        try:
            value = st.secrets.get(name, "")
        except FileNotFoundError:
            value = ""
    return value.strip() if isinstance(value, str) else ""


def keys():
    return (st.session_state.get("coach_primary") or configured("GEMINI_API_KEY"),
            st.session_state.get("coach_backup") or configured("GEMINI_API_KEY_BACKUP"))


def configured_model():
    return configured("GEMINI_MODEL") or MODEL


def adult_demo_enabled():
    return configured("COACHBOT_ADULT_DEMO").lower() == "true"


def handle_event(event):
    action = event.get("type")
    if action in ("save_keys", "clear_keys"):
        if not adult_demo_enabled():
            return
        for slot in ("primary", "backup"):
            value = event.get(slot, "")
            state_key = f"coach_{slot}"
            key = value.strip() if isinstance(value, str) else ""
            if action == "clear_keys":
                st.session_state.pop(state_key, None)
            elif 12 <= len(key) <= 256 and all("!" <= char <= "~" for char in key):
                st.session_state[state_key] = key
        st.session_state.coach_settings_event = event.get("id")
        return
    if action != "generate":
        return
    start = monotonic()
    profile = None
    setting = None
    try:
        profile = parse_profile(event.get("profile"))
        live = adult_demo_enabled() and event.get("demo") is not True
        primary, backup = keys() if live else ("", "")
        plan, source, setting = generate_plan(
            profile, primary, backup, model=configured_model(), demo=not live, tuning=event.get("tuning"),
        )
        result = {"plan": plan, "source": source}
    except CoachError as error:
        result = {"error": str(error), "source": "Check needed"}

    elapsed = round(monotonic() - start, 2)
    history = st.session_state.get("coach_runs", [])
    if profile:
        history = [{"source": result["source"], "mode": MODES[profile["mode"]][0],
                    "sport": profile["sport"], "position": profile["position"],
                    "id": event["id"], "plan": result.get("plan"), "model": configured_model() if setting else None,
                    "setting": setting, "seconds": elapsed}, *history][:12]
    st.session_state.coach_runs = history
    st.session_state.coach_result = {**result, "id": event.get("id"), "seconds": elapsed}


@st.cache_data(show_spinner=False)
def image_data(name, modified):
    if not modified:
        return ""
    return "data:image/webp;base64," + base64.b64encode((WEB / name).read_bytes()).decode("ascii")


def web_image(name):
    path = WEB / name
    return image_data(name, path.stat().st_mtime_ns if path.exists() else 0)


live_enabled = adult_demo_enabled()
primary, backup = keys() if live_enabled else ("", "")
model = configured_model()
studio = st.components.v2.component(
    "coachbot_studio", html=(WEB / "studio.html").read_text(encoding="utf-8"),
    css=(WEB / "studio.css").read_text(encoding="utf-8"),
    js=(WEB / "studio.mjs").read_text(encoding="utf-8"),
)
studio_state = studio(key="coach_studio", on_action_change=lambda: None, data={
    "hero": web_image("athlete.webp"),
    "playbookArt": {scene: web_image(f"playbook-{scene}.webp")
                    for scene in ("training", "recovery", "game-iq", "fuel")},
    "sports": SPORTS, "options": OPTIONS,
    "scenarios": SCENARIOS,
    "modes": [{"id": key, "title": value[0], "group": value[1], "description": value[2]}
              for key, value in MODES.items()],
    "connection": {"enabled": live_enabled, "primary": bool(primary), "backup": bool(backup),
                   "distinct": bool(backup and backup != primary),
                   "session": bool(st.session_state.get("coach_primary") or st.session_state.get("coach_backup")),
                   "model": model},
    "tuning": TUNING_OPTIONS.get(model, {}) if live_enabled else {},
    "settingsEvent": st.session_state.get("coach_settings_event"),
    "result": st.session_state.get("coach_result"), "runs": st.session_state.get("coach_runs", []),
})
event = studio_state.action
if isinstance(event, dict):
    event_id = event.get("id")
    if isinstance(event_id, str) and event_id != st.session_state.get("coach_last_event"):
        st.session_state.coach_last_event = event_id
        handle_event(event)
        st.rerun()
