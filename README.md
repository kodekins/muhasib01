# MUHASIB - AI Accounting Assistant

**The Complete AI-Powered Bookkeeping & Accounting System**

MUHASIB is a full-featured accounting application with an intelligent AI assistant that understands natural language commands and can perform all accounting operations.

## Project info

**URL**: https://lovable.dev/projects/b3f5b86f-5e0f-4df5-a66d-c1559ddc372c

## 🎯 Features

- **AI Accounting Assistant** - Natural language interface for all operations
- **Invoice Management** - Create, send, and track invoices
- **Bill Management** - Enter and pay vendor bills
- **Inventory Tracking** - Manage products and stock levels
- **Customer & Vendor Management** - Complete CRM functionality
- **Financial Reports** - P&L, Balance Sheet, Cash Flow, Aging Reports
- **Budget Tracking** - Set and monitor budgets
- **Double-Entry Bookkeeping** - Full journal entry support
- **Multi-Currency** - Support for multiple currencies (coming soon)

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/b3f5b86f-5e0f-4df5-a66d-c1559ddc372c) and start prompting.

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

- **Frontend**: React + TypeScript + Vite
- **UI**: shadcn-ui + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **AI**: OpenRouter API (Google Gemma 2)
- **Authentication**: Supabase Auth

## ⚙️ Setup & Configuration

### 1. Install Dependencies

```sh
npm install
```

### 2. Configure Supabase

This project requires a Supabase backend. You need to:

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Run all migrations from the `supabase/migrations` folder
3. Deploy the edge function: `supabase/functions/ai-accountant`

### 3. Configure AI Assistant (REQUIRED)

The AI assistant requires an OpenRouter API key:

1. **Get OpenRouter API Key**:
   - Go to [https://openrouter.ai](https://openrouter.ai)
   - Sign up or login
   - Navigate to "Keys" section
   - Create a new API key

2. **Set Environment Variable in Supabase**:
   - Go to: Supabase Dashboard → Settings → Edge Functions → Secrets
   - Add secret: `OPENROUTER_API_KEY` = `your-api-key-here`
   - Click "Add Secret"

3. **Deploy Edge Function**:
   - Option A (Dashboard): Copy code from `supabase/functions/ai-accountant/index.ts` and paste in Supabase Dashboard
   - Option B (CLI): `supabase functions deploy ai-accountant`

**⚠️ Without the OpenRouter API key, the AI assistant will not work!**

See `AI_ASSISTANT_FIX_GUIDE.md` for detailed setup instructions and troubleshooting.

### 4. Update Supabase Configuration

Create a `src/integrations/supabase/client.ts` file or update with your Supabase credentials:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'YOUR_SUPABASE_URL'
const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### 5. Run Development Server

```sh
npm run dev
```

## 🤖 Using the AI Assistant

The AI assistant can understand natural language commands like:

- "Create an invoice for John Smith for $500"
- "Show me my profit and loss for last month"
- "Add a new customer named ABC Corp"
- "What bills are due this week?"
- "Record a $150 expense for office supplies"
- "Update inventory for Product X to 50 units"

See `AI_ASSISTANT_FIX_GUIDE.md` for complete command reference.

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/b3f5b86f-5e0f-4df5-a66d-c1559ddc372c) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
