# GestureKart 🚦

**A physical gesture-controlled traffic rule training simulator.**
Drive a kart down Lahore's Canal Road using only your body, tracked live through your webcam. Lean to steer, raise your right hand to stop at red lights, and spread your hands to speed up. Every traffic violation is logged, a spoken coach talks you through the drive, and at the end you download your **Civic Driving Score Card** as a PDF or image.

> Built for the GestureKart Hackathon. Traditional traffic safety campaigns in Pakistan struggle to engage young drivers. GestureKart turns the rules into something you physically practise.

🌐 **Live demo:** `https://<your-project>.vercel.app`
🎥 **Demo video:** `<Loom / YouTube link>`

---

## Features

| Area | What it does |
| --- | --- |
| **Computer vision** | MediaPipe Pose Landmarker (33 body points) runs in the browser on the GPU. Torso lean, hand height and hand distance become steering, braking and throttle. A short calibration learns your neutral posture. |
| **3D world** | React Three Fiber scene of Canal Road: three-lane carriageway, the canal with tree-lined banks, bridges at junctions, rooftop water tanks, billboards with Urdu/English road safety messages. The road scenery is generated without end as you drive. |
| **Traffic** | Cars, green rickshaws and red buses that keep their distance and obey signals. Pedestrians cross the zebra when the light is red. |
| **Rules engine** | Red light running, pedestrian hits, collisions, over-speeding (limit 60 km/h), tailgating, lane straddling and unsafe lane changes are penalised. Proper stops at red and clean lane changes earn points back. |
| **Voice coach** | Real-time spoken cues ("Red light ahead! Raise your right hand to stop.", "Too close! Back off.", "Clean lane change.") with on-screen captions. |
| **HUD** | Live Civic Score and grade, route progress, next-signal distance and colour, speedometer with limit sign, webcam view with skeleton, gesture meters and an event feed. |
| **Score card** | Final score out of 100, grade (A+ to F), 12 stats, a speed-over-time graph with violations marked, a drive log and coach's notes. Download it as a **PDF** or **PNG**. |
| **Accessibility** | Full keyboard fallback, works without a camera, respects reduced-motion settings, sound and voice can be muted. |

## Controls

| Gesture (webcam) | Keyboard | Action |
| --- | --- | --- |
| Lean your torso left / right | `←` `→` or `A` `D` | Steer / change lanes |
| Raise your **right hand above your head** | `Space` | Halt (brake hard) |
| Distance between your hands (like gripping a wheel) | `↑` `↓` or `W` `S` | Speed |
| | `P` / `Esc` | Pause |
| | `M` | Mute |

Tip: sit or stand about 1.5 m from the webcam with your shoulders and both hands visible, in good light.

## Scoring

You start at **100**. The score is capped at 100.

| Event | Points |
| --- | --- |
| Hit a pedestrian on the zebra | −30 |
| Ran a red light | −25 |
| Collision with a vehicle | −20 |
| Over-speeding (above 60 km/h for over 2.5 s) | −5 |
| Unsafe lane change (cut in close, or at a junction) | −4 |
| Lane straddling (between lanes for over 2.5 s) | −3 |
| Tailgating (under ~1 s gap) | −3 |
| Stopped at red and waited for green | +8 |
| Clean lane change | +4 |

The route is 1.8 km, from Thokar Niaz Baig to Dharampura. If your score hits 0, your licence is suspended and the drive ends.

| Grade | Score |
| --- | --- |
| A+ Model Citizen | 95+ |
| A Responsible Driver | 85+ |
| B Mostly Civic | 70+ |
| C Needs Practice | 55+ |
| D Risky Driver | 40+ |
| F Licence Suspended | below 40 |

## Tech stack

- **React 18** + **Vite 5**
- **Three.js** via **@react-three/fiber**
- **@mediapipe/tasks-vision**: Pose Landmarker (lite, float16, GPU delegate with CPU fallback)
- **Web Audio API** for the engine sound and effects, all generated in code with no audio files
- **Web Speech API** for the voice coach
- **jsPDF** for the score card PDF

## Getting started

Requirements: Node.js 18+ and a webcam. Chrome or Edge is recommended.

```bash
git clone https://github.com/<your-username>/gesturekart.git
cd gesturekart
npm install
npm run dev
```

Open http://localhost:5173. Browsers allow webcam access on `localhost` and on HTTPS sites.

Production build:

```bash
npm run build
npm run preview
```

## Deploying to Vercel

1. Push this folder to a public GitHub repository.
2. On [vercel.com](https://vercel.com), choose **Add New → Project**, then import the repository.
3. Vercel detects Vite automatically: build command `npm run build`, output directory `dist`.
4. Deploy. Vercel serves the site over HTTPS, which the browser requires for webcam access.

Netlify and Render work the same way, with the same build command and `dist` as the publish directory.

## Project structure

```
gesturekart/
├── index.html
├── src/
│   ├── main.jsx              # React entry
│   ├── App.jsx               # Game flow: menu → calibrate → countdown → play → score card
│   ├── styles.css            # HUD, menus and score card styling
│   ├── cv/
│   │   ├── pose.js           # Webcam + MediaPipe Pose → steer / halt / throttle
│   │   └── input.js          # Shared input state + keyboard fallback
│   ├── game/
│   │   ├── config.js         # Lanes, speed limit, route length, points table
│   │   ├── state.js          # Physics, traffic AI, signals, pedestrians, rules engine, report
│   │   ├── World.jsx         # 3D scene (road, canal, scenery, signals, vehicles, kart, camera)
│   │   └── textures.js       # Procedural canvas textures (no image assets)
│   ├── audio/
│   │   ├── sound.js          # Web Audio engine hum + effects
│   │   └── voice.js          # Spoken coach with cooldowns and captions
│   ├── ui/
│   │   ├── StartScreen.jsx
│   │   ├── HUD.jsx
│   │   ├── CameraPanel.jsx   # Mirrored webcam view with skeleton overlay
│   │   └── ScoreCard.jsx
│   └── report/
│       └── card.js           # Score card canvas → PDF / PNG
└── vite.config.js
```

## How the gesture detection works

1. **Steering:** the angle of the shoulder line (one shoulder drops when you lean) is blended with how far your shoulders sit to the side of your hips. The result is offset by your calibrated neutral posture, passed through a dead zone so small wobbles don't steer, and smoothed.
2. **Halt:** your right wrist must be above your nose for 3 frames in a row to brake, and below it for 6 frames to release. This filters out flicker.
3. **Throttle:** the distance between your wrists, divided by your shoulder width, works at any distance from the camera. Around one shoulder-width apart is slow; about 2.6 shoulder-widths is full speed. If your hands leave the frame, the kart holds a steady cruise speed.

All video processing happens on your device. Nothing is uploaded.

## Team

| Role | Member | Owns |
| --- | --- | --- |
| CV Lead | Member 1 | `src/cv/` (MediaPipe pipeline, gesture mapping, calibration) |
| Game Dev | Member 2 | `src/game/` (3D scene, traffic, signals, collisions) |
| UI/UX Lead | Member 3 | `src/ui/`, `src/audio/`, `src/report/` (HUD, sound, score card) |
| DevOps & Submissions | Member 4 | Deployment, GitHub, demo video, LinkedIn post |

## Submission checklist

- [ ] Live HTTPS URL on Vercel / Netlify / Render
- [ ] Public GitHub repository with this README
- [ ] 2-minute screen recording showing live gesture control
- [ ] Google Classroom submission (template below)
- [ ] LinkedIn post tagging the organiser

**Google Classroom template**

```
📌 Project Name: GestureKart
🌐 Live App Link: https://<your-project>.vercel.app
💻 GitHub Repo: https://github.com/<your-username>/gesturekart
🎥 Demo Video: <Loom / YouTube link>
👥 Team Members: <Member 1>, <Member 2>, <Member 3>, <Member 4>
```
