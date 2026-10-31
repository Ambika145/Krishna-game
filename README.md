# Makhan Catch — Little Krishna

A mobile-friendly Next.js canvas game. Catch falling makhan pots in Vrindavan, jump for high pots, and defeat Putana with the Sudarshan Chakra.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Controls

| Device | Move | Jump | Chakra |
|---|---|---|---|
| Keyboard | ← → | Space / ↑ / W | C / F (or Space while Putana is up) |
| Mouse / trackpad | Click-hold left or right side | Jump button | Chakra button |
| Mobile | ← → buttons | Jump button | Chakra button |

## Push to GitHub (manual)

From this folder (after you create an empty repo on GitHub, e.g. `makhan-catch`):

```bash
git remote add origin https://github.com/Ambika145/makhan-catch.git
git branch -M main
git push -u origin main
```

Replace `makhan-catch` with whatever repo name you create under [Ambika145](https://github.com/Ambika145).

## Deploy on Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repo
3. Framework: **Next.js** (auto-detected)
4. Click **Deploy**

Or after the repo is on GitHub:

```bash
npx vercel login
npx vercel --prod
```

## Build check

```bash
npm run build
```
