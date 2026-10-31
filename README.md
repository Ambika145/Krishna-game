# Makhan Catch — Little Krishna

A high-performance canvas game in **Next.js + Tailwind CSS**. Catch falling pots of makhan in a magical Vrindavan garden.

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Architecture

- Gameplay lives in `app/page.js` (client component).
- Mutable engine state is stored in `useRef` (positions, pots, fireflies).
- A single `requestAnimationFrame` loop drives physics, collision, and canvas drawing.
- React `useState` is used only for UI phases (`MENU` / `PLAYING` / `GAMEOVER`) and score HUD.

## Controls

- **Keyboard:** ← → arrow keys (smooth glide)
- **Touch / mouse:** hold left or right half of the screen
