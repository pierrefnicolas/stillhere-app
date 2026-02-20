# stillhere ✦

> A global anonymous space to send and receive kindness.
> No accounts. No tracking. Just warmth.

## Stack
- React + Vite — frontend
- Supabase — backend messages (étape 2)
- Vercel — hébergement + HTTPS auto

## Lancer en local
```bash
npm install
npm run dev
```
→ http://localhost:5173

## Déployer sur Vercel

### 1. Pousser sur GitHub
```bash
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/TON_USERNAME/stillhere-app.git
git push -u origin main
```

### 2. Connecter Vercel
1. vercel.com → New Project → importe le repo
2. Framework : Vite (auto-détecté)
3. Build : `npm run build` / Output : `dist`
4. Deploy → en ligne en ~2 min

### 3. Domaine personnalisé
Vercel → Settings → Domains → Add → `stillhere.world`
Puis chez ton registrar :
```
A     @    76.76.21.21
CNAME www  cname.vercel-dns.com
```

## Variables d'environnement (étape 2)
Créer `.env.local` (jamais commité) :
```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```
M�me chose dans Vercel → Settings → Environment Variables.

## Sécurité
- Headers CSP dans vercel.json
- Pas de données personnelles collectées
- Messages anonymes, aucun compte requis
- Rate limiting Supabase (étape 2)
