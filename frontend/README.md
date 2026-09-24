# Agentic AI Course — Frontend

Standalone modern web user interface for the **Building Enterprise AI Agents** course.

## Architecture

```
frontend/
├── index.html       # Standalone SPA with editorial dark/light theme, interactive curriculum,
                     # capstone showcase, tech stack cards, and modal deep-dives.
└── README.md        # Frontend documentation and run instructions
```

## Features
- **Design Aesthetic**: Minimalist, high-contrast editorial typography (Inter & JetBrains Mono) inspired by modern high-end portfolio builders.
- **Dynamic Theming**: Dark mode (default) and Light mode with persistent state (`localStorage`).
- **Curriculum Timeline**: Full 6-week breakdown with 12 in-depth class modules, learning objectives, and terminal run commands.
- **Capstone Project Showcase**: Architectural breakdowns for Healthcare, Legal, AIOps, and Supply Chain agents.
- **Modal Drill-Downs**: Interactive popups with code snippets and class objectives.
- **Zero Build Step**: Native HTML5, CSS3, and modern ES6 JavaScript. No Node.js build process required.

## How to Run

### Option 1: Via Python HTTP Server (Frontend only)
```bash
python -m http.server 8080 --directory frontend
```
Then visit: [http://localhost:8080](http://localhost:8080)

### Option 2: Served via FastAPI Backend
When the backend is running, the frontend is also accessible directly at:
```bash
python backend/run.py
```
Then visit: [http://localhost:8000](http://localhost:8000)
