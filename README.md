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
| **Focus & drowsiness check** | MediaPipe Face Landmarker watches for eyes closed over 1.3 s, heavy blinking over the last minute (PERCLOS), yawning, looking down at a phone, or turning away. 1st warning: a FOCUS banner, a voice alert and the car eases off. 2nd: soft white pulses. 3rd within 2 minutes: the car stops and the game stays paused until a Focus meter reaches 100% (3 s of steady, eyes-open attention). Pulses stay under 3 flashes per second (photosensitivity guideline), and can be turned off. |
| **8 licence levels** | Learner Permit → Signals & Zebra → City Traffic → Speed Zones → Indicators → Night & Rain → Rush Hour → Final Driving Test (examiner mode). Each level has clear pass rules and 1–3 stars, and a map shows what is cleared, what is left, and your licence progress. Clear all 8 to earn the GestureKart licence. |
| **Learning by doing** | Slow-motion replay of the last 5 seconds after a serious mistake, a rule card (English + Roman Urdu) for every penalty, a forward collision warning, a skill radar (signals, lanes, speed, distance, pedestrians, focus) and a "practise this level next" tip. |
| **Motivation** | XP with combos (up to ×5), rank titles from Learner to Civic Hero, daily streaks 🔥, a daily challenge, "Perfect stop!" pop-ups, best moment of the drive, "better than last time" comparison, and a second chance in Free Drive. Share your card to WhatsApp or LinkedIn. |
| **Pakistan-specific road** | Ambulance (Rescue 1122) that you must give way to, wrong-way bikers, donkey carts, school and hospital speed zones, Urdu/Roman Urdu signboards, and an **Urdu voice coach** (Urdu voice in Edge, Hindi voice or Roman Urdu captions elsewhere). |
| **Real driving habits** | Seatbelt gesture before every drive, arm-out indicator before lane changes, night headlights, rain that lengthens braking, and fog. |
| **Step-by-step setup** | Short steps before you drive: **Driver** (name, age, CNIC; the demo accepts only the test CNIC `123456789` and shows just its last 4 digits), **Level**, **Car**, **View**, and **Learn** (how to drive + how scoring works). |
| **Settings** | Speed mode (Auto / wheel height / hand distance as in the brief / lean forward-back), arm rest cruise, one-hand mode, colour-blind STOP/WAIT/GO signals, flash off, replays, music, focus check. |
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
| Hold both hands in front of your chest and **turn the invisible wheel**. If your hands are out of view, **lean your torso** to steer (as in the brief). | `←` `→` or `A` `D` | Steer / change lanes |
| **Auto speed** (default): the car keeps a safe speed; **lower the wheel** to slow down. Other modes in Settings: wheel height, hand distance, lean forward/back. | `↑` `↓` or `W` `S` | Speed |
| Raise your **right hand above your head** | `Space` | Brake |
| Stretch your **left or right arm straight out** to the side | `Q` / `E` | Indicator |
| Right hand to the left shoulder, then pull down to the right hip | `B` | Seatbelt |
| | `C` | Driver seat / behind the car / wide angle |
| | `Enter` | Skip a replay |
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
| Hit a wrong-way biker | −15 |
| Blocked an ambulance | −8 |
| Focus warning (eyes closed, yawning, phone, looking away) | −5 |
| Lane change without indicator (levels 5+) | −3 |
| Stopped at red and waited for green | +8 |
| Gave way to an ambulance | +6 |
| Clean lane change | +4 |
| Dodged a wrong-way biker | +4 |
| Seatbelt fastened | +2 |

In a level, a score of 0 fails the level (just retry). Free Drive is the full 1.8 km Canal Road from Thokar Niaz Baig to Dharampura, with one second chance before your licence is suspended.

## Online leaderboard (shared across all devices)

Drives are always saved in the browser. On top of that, each finished drive is sent to a shared online leaderboard (one board per level plus Free Drive), so players on different laptops and phones are ranked together. Only the **name and drive results** go online, never age or CNIC.

The server part is a Vercel function, [`api/leaderboard.js`](api/leaderboard.js), backed by a free **Upstash Redis** database. One-time setup in the Vercel dashboard:

1. Open your project on vercel.com, then go to **Storage → Create Database → Upstash for Redis** (free plan).
2. Connect it to the `gesturekart` project. Vercel adds the `KV_REST_API_URL` / `KV_REST_API_TOKEN` environment variables automatically.
3. Redeploy. Until a database is connected, the game keeps working and the Online tab just says the leaderboard isn't set up.

The API validates every submission (score range, realistic speed, clean names) and rate-limits each address to 12 submissions a minute. Without player accounts it can't fully stop someone from posting a fake score, so treat it as a fun class leaderboard.

## Tests

```bash
npm test
```

55 automated tests (vitest) cover the online leaderboard API (with an in-memory Redis), the steering-wheel, brake, indicator, seatbelt and lean gestures, the 100% body lock, the focus/drowsiness detector, every licence level (a scripted careful driver must pass each one, a reckless one must fail), replays, history, XP, streaks and rankings.

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
│   │   ├── gestures.js       # Pure maths: virtual wheel, lean, brake, indicator, seatbelt, body lock
│   │   ├── focus.js          # Pure maths: eyes closed, PERCLOS drowsiness, yawn, phone/looking away
│   │   └── input.js          # Shared input state + keyboard fallback
│   ├── game/
│   │   ├── config.js         # Lanes, speed limit, route, points table, the 5 cars
│   │   ├── history.js        # Saved drives, rankings and leaderboard (localStorage)
│   │   ├── PlayerCar.jsx     # The 5 car models + shared cockpit and steering wheel
│   │   ├── state.js          # Physics, traffic AI, signals, pedestrians, rules engine, report
│   │   ├── World.jsx         # 3D scene (road, canal, scenery, signals, vehicles, kart, camera)
│   │   ├── levels.js         # The 8 licence levels + Free Drive, pass rules and stars
│   │   ├── progress.js       # XP, rank titles, streaks, daily challenge, unlocked levels
│   │   ├── rules.js          # Rule cards and skill scores
│   │   ├── settings.js       # Player settings
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
│   │   ├── LevelMap.jsx      # Road-to-licence map
│   │   ├── SettingsPanel.jsx
│   │   ├── SkillRadar.jsx
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

Built by **Rania Saleem (Roll No. 629)**, Web Design and Development Lab, 7th semester, Section F, who covered all four roles from the brief:

| Role | Member | Owns |
| --- | --- | --- |
| CV Lead | Rania Saleem (629) | `src/cv/` (MediaPipe pipeline, gesture mapping, calibration) |
| Game Dev | Rania Saleem (629) | `src/game/` (3D scene, traffic, signals, collisions) |
| UI/UX Lead | Rania Saleem (629) | `src/ui/`, `src/audio/`, `src/report/` (HUD, sound, score card) |
| DevOps & Submissions | Rania Saleem (629) | Deployment, GitHub, demo video, LinkedIn post |

## Submission checklist

- [x] Live HTTPS URL on Vercel: https://gesturekart.vercel.app
- [x] Public GitHub repository with this README
- [x] 2-minute screen recording showing live gesture control
- [ ] Google Classroom submission (template below)
- [ ] LinkedIn post tagging the organiser

**Google Classroom template**

```
📌 Project Name: GestureKart
🌐 Live App Link: https://gesturekart.vercel.app
💻 GitHub Repo: https://github.com/ranet5-design/gesturekart
🎥 Demo Video: <Loom / YouTube link>
👥 Team Members: Rania Saleem (Roll No. 629)
```
