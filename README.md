# CoachBot AI

![Animated CoachBot AI banner with a sprinter and moving track lines](docs/coachbot-banner.gif)

**CRS Artificial Intelligence · Generative AI Summative Assessment 3 · Scenario 2**  
Sritharan N S · Jain Vidyalaya IB World School

[Run locally](#run-the-app) · [Screenshots](#app-walkthrough) · [Validation](#validation) · [Storyboard PDF](docs/CoachBot_AI_Storyboard.pdf)

CoachBot is a youth sports coaching prototype. It turns a fictional athlete's sport, position, goal and equipment into a session with concrete next steps. It covers six sports and 26 positions. The app includes 13 coaching modes, four ready-to-run assessment scenarios, plan download, and a Review Lab for comparing outputs and exporting run evidence.

## Run the app

On Windows, double-click `Launch-CoachBot.cmd` after installing Python and the requirements. From a terminal in this folder:

```bash
python -m pip install -r requirements.txt
python -m streamlit run app.py --server.address 127.0.0.1
```

Open the local URL if your browser does not open automatically. Choose **Try an example**, then **Generate session** for a football midfielder's stamina session. The sample works without credentials. Choose **Save plan** to download the result as text. **Review Lab** keeps up to 12 runs while the session is open and exports a JSON evidence file.

## App walkthrough

| Screen | What to try |
| --- | --- |
| [Landing screen](docs/screenshots/home.jpg) | Pause or play the live animated background, then open an example. |
| [Scenario gallery](docs/screenshots/scenarios.jpg) | Load a midfielder, fast bowler, badminton doubles player, or point guard. |
| [Athlete profile and playbook](docs/screenshots/builder.jpg) | Adjust the examples or build a profile from scratch. Filter 13 modes by coaching goal. |
| [Sample plan](docs/screenshots/plan.jpg) | Read the action cards and download the plan. |
| [Readiness check](docs/screenshots/readiness.jpg) | Run the fast-bowler case and see the local check-in checklist. |
| [Review Lab](docs/screenshots/review.jpg) | Select two runs, compare the outputs and export run evidence. |
| [390 px mobile view](docs/screenshots/mobile.jpg) | Use the same profile form and playbook on a narrow screen. |

![CoachBot athlete profile and coaching playbook](docs/screenshots/builder.jpg)

![CoachBot Review Lab comparing a safety check with a sample plan](docs/screenshots/review.jpg)

## Coaching playbook

| Mode | Prompt task |
| --- | --- |
| Position workout | Build a session with role-specific work, warm-up, cooldown and rest. |
| Stamina builder | Match conditioning and recovery intervals to the demands of the position. |
| Warm-up & cooldown | Suggest progressive preparation and a gradual finish for the sport. |
| Return to training | Give a coach discussion checklist for resuming a routine after a break. |
| Mobility routine | Suggest comfortable movement for a healthy athlete. |
| Tactical playbook | Describe a role-specific scenario, the cues to read and a decision to practise. |
| Technique drills | Give two progressive drills with an observable cue for each. |
| Match-day mindset | Write a short visualization, a process goal and a reset cue. |
| Sports nutrition | Suggest flexible food ideas respecting diet and stated allergies. |
| Hydration routine | Plan water breaks and coach-led adjustments for heat. |
| Small-space practice | Use limited space and listed equipment. Include a no-equipment alternative. |
| Decision rehearsal | Practise two position-specific if-then decisions and an example where the other option fits. |
| Practice debrief | Choose an observable success measure, a feedback question and one adjustment. |

The exact prompts and sample templates are in [coach.py](coach.py). The six sports are football, cricket, basketball, athletics, volleyball and badminton, with 26 listed positions or disciplines.

## From athlete profile to plan

1. The Streamlit component sends the profile, selected mode and requested source to [app.py](app.py). Python validates the position against the selected sport and checks the form values.
2. The readiness check comes first. Symptoms or unclear clearance return a local pause-and-check-in plan. Declared clinician restrictions return a local discussion checklist. Those paths skip the external service.
3. Sample mode builds a plan from local templates. In a private, adult-operated live demo, the server combines the fictional profile and mode task with a shared instruction and sends that request to the Gemini API.
4. The live request specifies structured JSON. The backend validates the title, summary, ordered sections, and safety note before the interface displays the result.
5. On an eligible key, quota, model access, or temporary service error, the server retries once with a distinct backup key if one is configured. The result shows which source was used. Review Lab keeps the output, sport, position, mode, source, model setting and duration for the session.

## Model configuration and comparison

The ordinary installation starts in sample mode. Google limits Gemini API use to adults and restricts its use in apps directed toward people under 18. Use live integration in a private, adult-operated assessment demo with fictional profiles. Keep the public classroom demo in sample mode. [Gemini API Additional Terms](https://aistudio.google.com/docs/terms#age-requirements)

For a private demo, copy [.streamlit/secrets.toml.example](.streamlit/secrets.toml.example) to `.streamlit/secrets.toml` and set `COACHBOT_ADULT_DEMO = "true"`. Configure `GEMINI_API_KEY` and optionally `GEMINI_API_KEY_BACKUP` there, or enter the keys in **Model settings** for that browser session. Keep actual keys out of Git, screenshots, and hand-ins. Keys from the same Google project may draw on the same quota.

| Configured model | Comparison control in Review Lab |
| --- | --- |
| `gemini-3.8-flash` (default) | Low versus medium reasoning. Google deprecated sampling controls for this model. |
| `gemini-2.5-flash-lite` | Temperature 0.3, 0.5, or 0.7, with top-p fixed at 0.9. |

The assessment names Gemini 1.5. This build uses currently listed models. For a comparison, keep the same fictional profile and coaching mode, change one setting in **Review Lab**, and assess position relevance, clarity, and whether the output follows the selected constraints. The result cards show the source, model setting, and runtime. [Gemini model reference](https://aistudio.google.com/docs/models) · [Gemini 3.8 migration notes](https://aistudio.google.com/docs/whats-new-gemini-3.8#migrate-to-gemini-3-8-flash)

## Validation

```bash
python -m unittest discover -s tests -v
```

| Scenario | Evidence in the tests |
| --- | --- |
| All 13 modes across 26 positions | Each of the 338 combinations returns a valid sample with the selected position. |
| Multiple injuries, recent injury in a goal, clinician restrictions | The server returns the appropriate local response without contacting Gemini. |
| Invalid sport and position combination or missing restrictions | Input validation returns a specific message. |
| Key failure, quota limit or service error | Mocked HTTP responses exercise retry with the backup, backup-only operation, and avoiding repeat calls with the same key. |
| Reasoning and temperature settings | The outgoing request uses settings supported by the configured model. |
| Incomplete JSON | The app handles a response that is missing required fields. |
| Streamlit form and Model settings events | The tests submit the component events, check the sample result, simulate a private backup-key run, and clear the session keys. |

The four fictional scenarios were also run in a local Streamlit browser session. The sports nutrition sample showed allergy cross-contact guidance, and the Review Lab displayed two different outcomes side by side. The layout fit a 390 px viewport. Provider access and the quality of freshly generated Gemini outputs still need a private live demo.

## Research and design

- Youth conditioning benefits from matching training intensity and volume to the athlete and allowing regular recovery. That informed the profile's intensity, equipment, goal and recovery inputs. [IOC consensus on youth athletic development](https://doi.org/10.1136/bjsports-2015-094962)
- The youth resistance training consensus informed the emphasis on supervision, technique and gradual progression. [International consensus on youth resistance training](https://doi.org/10.1136/bjsports-2013-092952)
- The return-to-training path sends possible concussion and current symptoms to a check-in with an adult or healthcare professional. [CDC HEADS UP](https://www.cdc.gov/heads-up/guidelines/returning-to-sports.html)
- The visual direction draws on oversized typography and layered motion from [Made to Disrupt](https://madetodisrupt.com/). CoachBot uses original runner artwork, animated track lines, and a canvas particle background. Animation can be paused and respects the device's reduced-motion preference.

## Streamlit Community Cloud

Use `app.py` as the entry point and include `coach.py`, `requirements.txt`, `.streamlit/config.toml` and `web/` in the repository. The public demo runs with the default sample-mode configuration. The deployment page can show the app URL once publishing is complete. [Streamlit deployment and secrets](https://docs.streamlit.io/deploy/streamlit-community-cloud/deploy-your-app/secrets-management)
