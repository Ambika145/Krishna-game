# Makhan Catch — Little Krishna

A high-performance canvas game in **Next.js + Tailwind CSS**. Catch falling pots of makhan in a magical Vrindavan garden.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Controls

- **Keyboard:** ← → move · Space / ↑ jump · C / F chakra
- **Mouse / trackpad:** click-hold left or right side of the screen
- **Mobile:** on-screen ← → buttons · Jump · Chakra (when Putana appears)

## Deploy to Vercel

1. Install / login:

```bash
npx vercel login
```

2. Deploy production:

```bash
npx vercel --prod
```

Or import this folder at [vercel.com/new](https://vercel.com/new) (Framework: Next.js).

## Architecture

- Gameplay lives in `app/page.js` (client component).
- Mutable engine state is stored in `useRef`.
- A single `requestAnimationFrame` loop drives physics and canvas drawing.
- React `useState` is only for UI phases and HUD.
