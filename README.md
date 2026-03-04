# Chrono Narrative Engine

[![CI Smoke](https://github.com/Olexan-art/chrono-narrative-engine/actions/workflows/ci-smoke.yml/badge.svg)](https://github.com/Olexan-art/chrono-narrative-engine/actions/workflows/ci-smoke.yml)
[![Auto Release](https://github.com/Olexan-art/chrono-narrative-engine/actions/workflows/auto-release-prod.yml/badge.svg)](https://github.com/Olexan-art/chrono-narrative-engine/actions/workflows/auto-release-prod.yml)
[![Netlify Deploy](https://github.com/Olexan-art/chrono-narrative-engine/actions/workflows/netlify-deploy.yml/badge.svg)](https://github.com/Olexan-art/chrono-narrative-engine/actions/workflows/netlify-deploy.yml)
[![Supabase Deploy](https://github.com/Olexan-art/chrono-narrative-engine/actions/workflows/supabase-deploy.yml/badge.svg)](https://github.com/Olexan-art/chrono-narrative-engine/actions/workflows/supabase-deploy.yml)
[![Fallback Retell](https://github.com/Olexan-art/chrono-narrative-engine/actions/workflows/fallback-bulk-retell-us.yml/badge.svg)](https://github.com/Olexan-art/chrono-narrative-engine/actions/workflows/fallback-bulk-retell-us.yml)

## Project info

**Prod URL**: https://bravennow.com

## 🤖 Queue-Based Retell System

This project features an advanced **queue-based news retelling system** with the following capabilities:

### 🚀 Key Features
- **20 news items** processed every 10 minutes
- **Parallel processing** between Z.AI and DeepSeek providers (10 items each)
- **Real-time statistics** with 15min/1h/6h/24h time ranges  
- **Dark theme admin interface** for professional operation
- **Automatic queue management** with smart cleanup

### 📊 Admin Interface
Access the admin dashboard at: `http://localhost:8081`

**Features:**
- Live queue status monitoring
- Manual queue controls (init/process/clear)
- Detailed statistics across multiple time ranges
- Dark theme optimized for extended use
- One-click refresh functionality

### ⚡ Performance
- **~2,880 news items/day** (120 items/hour × 24 hours)
- **Parallel LLM processing** for 2× speed improvement
- **Zero downtime** with queue persistence
- **Smart load balancing** between AI providers

For detailed documentation see: [RETELL_TRANSLATE_AUTOMATION.md](RETELL_TRANSLATE_AUTOMATION.md)

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
