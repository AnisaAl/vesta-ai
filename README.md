# Vesta AI (Fashion Companion)

Local-first AI fashion companion: chat styling advice, DeepFashion image suggestions, wardrobe/trends tabs, and demo virtual try-on. Shoppable affiliate catalog is planned next — **online-only, no owned inventory**.

## Features

- **AI Fashion Assistant**: Claude-powered chat with structured outfit / color / accessory responses
- **Image Analysis**: Upload clothing photos for styling advice
- **DeepFashion catalog**: Local image corpus for recommendations (`server/data/DeepFashion-MultiModal`)
- **Chat History**: Persisted in PostgreSQL for the local MVP user
- **Virtual Try-On (demo)**: UI + API; results are explicitly labeled demo until Kolors/production VTO is wired
- **Fallback**: Rule-based + DeepFashion responses when the Anthropic API is unavailable

## Technology Stack

- **Frontend**: React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Express.js, Node.js
- **Database**: PostgreSQL with Drizzle ORM
- **AI**: Anthropic Claude (`ANTHROPIC_API_KEY`) via `server/services/fashionAi.ts`
- **Mobile**: Expo subset (chat-focused)

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL
- Anthropic API key

### Environment Variables

Copy `.env.example` to `.env`:

```
DATABASE_URL=postgresql://username:password@localhost:5432/vesta_ai
ANTHROPIC_API_KEY=your_anthropic_api_key
PORT=3000
# Optional — Python try-on sidecar
# PYTHON_SERVICE_URL=http://localhost:5001
```

### Install and run (web)

```
npm install
npm run dev
```

App: `http://localhost:3000`

### DeepFashion images (local only)

Place the DeepFashion-MultiModal `images/` folder and `captions.json` under `server/data/DeepFashion-MultiModal/`. Do not commit that dataset (see `.gitignore`).

### Virtual try-on

See `KOLORS_SETUP.md`. Until configured, the UI shows **demo mode** labeling.

### Mobile

```
cd client/mobile
npm install
npm start
```

Update the API URL in `src/lib/api.js` for your machine.

## Cursor agent roles

Project rules live in `.cursor/rules/` (`orchestrator`, `analyst`, `developer`, `debugger`). Mention them with `@` when working a milestone.

## Milestone 0 cleanup

See [docs/MILESTONE_0_NOTES.md](docs/MILESTONE_0_NOTES.md) for what was fixed and removed.

## License

MIT
