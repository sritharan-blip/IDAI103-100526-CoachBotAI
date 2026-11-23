import io
import json
import os
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError

from streamlit.components.v2.bidi_component.main import _make_trigger_id
from streamlit.proto.WidgetStates_pb2 import WidgetStates
from streamlit.testing.v1 import AppTest

import coach


def athlete(**overrides):
    return coach.parse_profile({
        "sport": "Football", "position": "Midfielder", "age": coach.OPTIONS["age"][1],
        "duration": "25 minutes", "goal": "Build stamina for a school match",
        "intensity": "Moderate", "style": "Conditioning", "mode": "stamina",
        "readiness": "Ready to train", "diet": "Vegetarian", **overrides,
    })


def response(plan):
    return io.BytesIO(json.dumps({"candidates": [{
        "finishReason": "STOP",
        "content": {"parts": [{"thought": True, "text": "Internal"}, {"text": json.dumps(plan)}]},
    }]}).encode())


def http_error(status, body=None):
    return HTTPError("https://generativelanguage.googleapis.com", status,
                     "Request failed", {}, io.BytesIO(json.dumps(body or {}).encode()))


class CoachTests(unittest.TestCase):
    def test_every_mode_builds_a_valid_sample_for_every_position(self):
        self.assertGreaterEqual(len(coach.MODES), 10)
        with patch.object(coach, "urlopen") as api:
            for sport, positions in coach.SPORTS.items():
                for position in positions:
                    for mode in coach.MODES:
                        with self.subTest(sport=sport, position=position, mode=mode):
                            plan, source, setting = coach.generate_plan(
                                athlete(sport=sport, position=position, mode=mode), "", "", demo=True
                            )
                            self.assertEqual(plan, coach.validate_plan(plan))
                            self.assertIn(position.lower(), plan["summary"])
                            self.assertEqual((source, setting), ("Sample plan", None))
            api.assert_not_called()

    def test_injury_and_clearance_take_local_paths(self):
        profiles = [
            (athlete(readiness="Injured, symptomatic or unsure",
                     injuries="Ankle sprain and shoulder strain"), "Safety check"),
            (athlete(goal="I am recovering from a knee strain"), "Safety check"),
            (athlete(readiness="Cleared with restrictions", injuries="No contact drills"),
             "Restrictions checklist"),
        ]
        with patch.object(coach, "urlopen") as api:
            for profile, expected in profiles:
                for sample in (True, False):
                    plan, source, setting = coach.generate_plan(profile, "test-primary", "", demo=sample)
                    self.assertEqual(plan, coach.validate_plan(plan))
                    self.assertEqual((source, setting), (expected, None))
            api.assert_not_called()

    def test_rejects_invalid_position_and_missing_restrictions(self):
        with self.assertRaisesRegex(coach.CoachError, "Choose a position"):
            athlete(sport="Cricket", position="Midfielder")
        with self.assertRaisesRegex(coach.CoachError, "Add the restrictions"):
            athlete(readiness="Cleared with restrictions")

    def test_current_model_uses_reasoning_without_sampling_fields(self):
        profile = athlete()
        plan = coach.sample_plan(profile)
        with patch.object(coach, "urlopen", return_value=response(plan)) as api:
            self.assertEqual(coach.generate_plan(profile, "test-primary", "", tuning="MEDIUM"),
                             (plan, "Gemini · Primary", "Medium reasoning"))
        request = api.call_args.args[0]
        config = json.loads(request.data)["generationConfig"]
        self.assertEqual(config["thinkingConfig"], {"thinkingLevel": "MEDIUM"})
        self.assertFalse({"temperature", "topP", "topK"} & config.keys())
        self.assertEqual(config["responseMimeType"], "application/json")
        self.assertNotIn("test-primary", request.full_url)

    def test_legacy_model_supports_controlled_temperature_comparison(self):
        profile = athlete(mode="tactics")
        plan = coach.sample_plan(profile)
        with patch.object(coach, "urlopen", side_effect=[response(plan), response(plan)]) as api:
            for value in ("0.3", "0.7"):
                _, _, setting = coach.generate_plan(
                    profile, "test-primary", "", model=coach.SAMPLING_MODEL, tuning=value
                )
                self.assertEqual(setting, f"Temperature {value}")
        settings = [json.loads(call.args[0].data)["generationConfig"] for call in api.call_args_list]
        self.assertEqual([config.pop("temperature") for config in settings], [0.3, 0.7])
        self.assertEqual(settings[0], settings[1])
        self.assertEqual(settings[0]["topP"], 0.9)

    def test_credential_quota_and_service_errors_use_the_backup(self):
        profile = athlete()
        plan = coach.sample_plan(profile)
        invalid_key = {"error": {"details": [{"reason": "API_KEY_INVALID"}]}}
        for status, body in ((400, invalid_key), (403, {}), (429, {}), (503, {})):
            with self.subTest(status=status), patch.object(
                coach, "urlopen", side_effect=[http_error(status, body), response(plan)]
            ) as api:
                self.assertEqual(coach.generate_plan(profile, "test-primary", "test-backup"),
                                 (plan, "Gemini · Backup", "Low reasoning"))
                requests = [call.args[0] for call in api.call_args_list]
                self.assertEqual([request.get_header("X-goog-api-key") for request in requests],
                                 ["test-primary", "test-backup"])
                self.assertEqual(requests[0].data, requests[1].data)

    def test_bad_request_and_duplicate_key_do_not_retry(self):
        for status, backup in ((400, "test-backup"), (429, "test-primary")):
            with self.subTest(status=status), patch.object(
                coach, "urlopen", side_effect=http_error(status)
            ) as api:
                with self.assertRaises(coach.CoachError):
                    coach.generate_plan(athlete(), "test-primary", backup)
                api.assert_called_once()

    def test_backup_alone_and_malformed_response(self):
        profile = athlete()
        with patch.object(coach, "urlopen", return_value=response(coach.sample_plan(profile))) as api:
            self.assertEqual(coach.generate_plan(profile, "", "test-backup")[1], "Gemini · Backup")
            api.assert_called_once()
        with patch.object(coach, "urlopen", return_value=response({"title": "Missing sections"})) as api:
            with self.assertRaisesRegex(coach.CoachError, "incomplete plan"):
                coach.generate_plan(profile, "test-primary", "test-backup")
            api.assert_called_once()


class SessionTests(unittest.TestCase):
    def setUp(self):
        self.app = AppTest.from_file(str(Path(__file__).resolve().parents[1] / "app.py"), default_timeout=15)

    def trigger(self, action, **data):
        component = self.app.get("bidi_component")[0].proto
        widget_states = WidgetStates()
        widget = widget_states.widgets.add()
        widget.id = _make_trigger_id(component.id, "events")
        widget.json_trigger_value = json.dumps([{"event": "action", "value": {"type": action, **data}}])
        self.app._run(widget_states)
        self.assertFalse(self.app.exception)

    def test_public_demo_is_sample_only_even_with_configured_key(self):
        with patch.dict(os.environ, {"COACHBOT_ADULT_DEMO": "false", "GEMINI_API_KEY": "mock-public-key"}):
            with patch.object(coach, "urlopen") as api:
                self.app.run()
                self.assertFalse(self.app.exception)
                self.trigger("generate", id="public-run", profile=athlete(), demo=False)
                result = self.app.session_state["coach_result"]
                self.assertEqual((result["id"], result["source"]), ("public-run", "Sample plan"))
                run = self.app.session_state["coach_runs"][0]
                self.assertEqual(run["id"], "public-run")
                self.assertEqual(run["plan"], result["plan"])
                api.assert_not_called()

    def test_private_demo_saves_keys_and_reports_backup_result(self):
        with patch.dict(os.environ, {"COACHBOT_ADULT_DEMO": "true"}):
            self.app.run()
            self.assertFalse(self.app.exception)
            self.trigger("save_keys", id="save", primary="dummy-primary-key", backup="dummy-backup-key")
            with patch.object(coach, "urlopen", side_effect=[
                http_error(429), response(coach.sample_plan(athlete()))
            ]) as api:
                self.trigger("generate", id="private-run", profile=athlete(), demo=False, tuning="MEDIUM")
            result = self.app.session_state["coach_result"]
            self.assertEqual(result["source"], "Gemini · Backup")
            self.assertEqual(self.app.session_state["coach_runs"][0]["setting"], "Medium reasoning")
            self.assertEqual(api.call_count, 2)
            self.assertNotIn("dummy-backup-key", str(self.app.get("bidi_component")[0].proto))
            self.trigger("clear_keys", id="clear")
            self.assertNotIn("coach_primary", self.app.session_state)
            self.assertNotIn("coach_backup", self.app.session_state)


if __name__ == "__main__":
    unittest.main()
