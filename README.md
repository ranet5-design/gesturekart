# GestureKart 🚦

**A physical gesture-controlled traffic rule training simulator.**
Drive a kart down Lahore's Canal Road using only your body, tracked live through your webcam. Lean to steer, raise your right hand to stop at red lights, and spread your hands to speed up. Every traffic violation is logged, a spoken coach talks you through the drive, and at the end you download your **Civic Driving Score Card** as a PDF or image.

> Built for the GestureKart Hackathon. Traditional traffic safety campaigns in Pakistan struggle to engage young drivers. GestureKart turns the rules into something you physically practise.

🌐 **Live demo:** https://gesturekart.vercel.app
💻 **Code:** https://github.com/ranet5-design/gesturekart
🎥 **Demo video:** `<Loom / YouTube link>`

---

## Features

| Area | What it does |
| --- | --- |
| **Computer vision** | MediaPipe Pose Landmarker (33 body points) runs in the browser on the GPU. Your two hands become an invisible steering wheel: turn it to steer, lift it to speed up, raise your right hand to brake. Works sitting down. |
| **100% body lock** | The drive never starts until the camera has locked on to your head, shoulders, elbows and hands for 1.5 s straight, with live hints ("Move back a little", "Move to the centre"). If the lock is lost mid-drive, the game pauses itself and resumes when you're back. |
| **Step-by-step setup** | Four short steps before you drive: **Driver** (name, age, CNIC; the demo accepts only the test CNIC `123456789` and shows just its last 4 digits), **Car**, **View**, and **Learn** (how to drive + how scoring works). |
| **5 cars** | GK Kart, City Hatch, Sedan, Rickshaw and Pickup, each with its own 3D model, top speed, pickup, brakes and turning. |
| **3 camera views** | Driver seat (a 3D steering wheel with gloved hands turns exactly as your real hands do), behind the car, or a high wide angle. Press `C` to switch during a drive. |
| **History & leaderboard** | Every drive is saved in your browser with its date and time. You see your rank among your own drives and on the leaderboard (each player's best), your best and average score, and your score trend. |
| **Guided practice** | Before each drive you practise every move (hold, left, right, lift, brake), with instructions in English and Roman Urdu. |
| **3D world** | React Three Fiber scene of Canal Road: three-lane carriageway, the canal with tree-lined banks, bridges at junctions, rooftop water tanks, billboards with Urdu/English road safety messages. The road scenery is generated without end as you drive. |
| **Traffic** | Cars, green rickshaws and red buses that keep their distance and obey signals. Pedestrians cross the zebra when the light is red. |
| **Rules engine** | Red light running, pedestrian hits, collisions, over-speeding (limit 60 km/h), tailgating, lane straddling and unsafe lane changes are penalised. Proper stops at red and clean lane changes earn points back. |
| **Voice coach** | Real-time spoken cues ("Red light ahead! Raise your right hand to stop.", "Too close! Back off.", "Clean lane change.") with on-screen captions. |
| **HUD** | Live Civic Score and grade, route progress, next-signal distance and colour, speedometer with limit sign, webcam view with skeleton, gesture meters and an event feed. |
| **Score card** | Final score out of 100 and grade (A+ to F), why the drive ended, your rank, stats, a speed graph with every mistake and good habit marked on the line, "where your points went", the full drive log with your running score, and coach's notes. Download it as a **PDF** or **PNG**. |
| **Accessibility** | Full keyboard fallback, works without a camera, respects reduced-motion settings, sound and voice can be muted. |

## Controls

| Gesture (webcam) | Keyboard | Action |
| --- | --- | --- |
| Hold both hands in front of your chest and **turn the invisible wheel** (leaning into the turn adds a little extra) | `←` `→` or `A` `D` | Steer / change lanes |
| **Lift the wheel** toward your shoulders (lower it to slow down) | `↑` `↓` or `W` `S` | Speed |
| Raise your **right hand above your head** | `Space` | Brake |
| Let go of the wheel | | Car rolls to a stop |
| | `C` | Driver's seat / behind-the-car view |
| | `P` / `Esc` | Pause |
| | `M` | Mute |

Tip: sit or stand 1–1.5 m from the webcam with your head, shoulders and both hands visible, in good light.

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
git clone https://github.com/ranet5-design/gesturekart.git
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
│   ├── App.jsx               # Game flow: menu → body lock + practice → countdown → play → score card
│   ├── styles.css            # HUD, menus and score card styling
│   ├── cv/
│   │   ├── pose.js           # Webcam + MediaPipe Pose loop, smoothing, calibration
│   │   ├── gestures.js       # Pure maths: virtual wheel, lean, brake, body lock
│   │   └── input.js          # Shared input state + keyboard fallback
│   ├── game/
│   │   ├── config.js         # Lanes, speed limit, route, points table, the 5 cars
│   │   ├── history.js        # Saved drives, rankings and leaderboard (localStorage)
│   │   ├── PlayerCar.jsx     # The 5 car models + shared cockpit and steering wheel
│   │   ├── state.js          # Physics, traffic AI, signals, pedestrians, rules engine, report
│   │   ├── World.jsx         # 3D scene (road, canal, scenery, signals, vehicles, kart, camera)
│   │   └── textures.js       # Procedural canvas textures (no image assets)
│   ├── audio/
│   │   ├── sound.js          # Web Audio engine hum + effects
│   │   └── voice.js          # Spoken coach with cooldowns and captions
│   ├── ui/
│   │   ├── StartScreen.jsx   # 4-step setup: driver, car, view, learn
│   │   ├── History.jsx       # History & leaderboard
│   │   ├── HUD.jsx
│   │   ├── Practice.jsx      # 100% body lock + step-by-step gesture practice
│   │   ├── Widgets.jsx       # Steering wheel, lock ring, speed gauge
│   │   ├── CameraPanel.jsx   # Mirrored webcam view, skeleton and virtual wheel overlay
│   │   └── ScoreCard.jsx
│   └── report/
│       └── card.js           # Score card canvas → PDF / PNG
└── vite.config.js
```

## How the gesture detection works

The maths lives in `src/cv/gestures.js` as plain functions, so it can be tested without a camera.

1. **Body lock:** each frame checks that the nose, both shoulders, both elbows and both wrists are clearly visible inside the frame, with the player centred and at a sensible distance. Good frames fill the lock meter over 1.5 s, and every bad frame knocks it back hard, so shaky tracking never reaches 100%. Once locked, only losing the head and shoulders breaks the lock, so raising a hand to brake is fine.
2. **Wheel held:** both wrists are visible, about a wheel-width apart and not resting in the lap.
3. **Steering:** the angle of the line between your wrists, as seen in a mirror. Turning clockwise (left hand up, right hand down) steers right. It is offset by your "hold it straight" calibration, has a small dead zone, and reaches full lock at about 40°. Leaning your torso into the turn adds up to 50% extra, but only past a large dead zone, so sitting normally adds nothing.
4. **Speed:** the height of the wheel relative to your shoulders, measured in shoulder-widths, so it works at any distance. Chest height is a normal ~45 km/h, and shoulder height is fast. Let go and the car rolls to a stop.
5. **Brake:** your right wrist is above your nose (or your right elbow is raised high if the hand leaves the top of the frame). It must hold for 3 frames to brake and drop for 6 frames to release, which filters out flicker.

All video processing happens on your device. Nothing is uploaded.

## Team

| Role | Member | Owns |
| --- | --- | --- |
| CV Lead | Member 1 | `src/cv/` (MediaPipe pipeline, gesture mapping, calibration) |
| Game Dev | Member 2 | `src/game/` (3D scene, traffic, signals, collisions) |
| UI/UX Lead | Member 3 | `src/ui/`, `src/audio/`, `src/report/` (HUD, sound, score card) |
| DevOps & Submissions | Member 4 | Deployment, GitHub, demo video, LinkedIn post |

## Submission checklist

- [x] Live HTTPS URL on Vercel: https://gesturekart.vercel.app
- [x] Public GitHub repository with this README
- [ ] 2-minute screen recording showing live gesture control
- [ ] Google Classroom submission (template below)
- [ ] LinkedIn post tagging the organiser

**Google Classroom template**

```
📌 Project Name: GestureKart
🌐 Live App Link: https://gesturekart.vercel.app
💻 GitHub Repo: https://github.com/ranet5-design/gesturekart
🎥 Demo Video: <Loom / YouTube link>
👥 Team Members: <Member 1>, <Member 2>, <Member 3>, <Member 4>
```
