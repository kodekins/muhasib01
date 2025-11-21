# 🎯 AI Model Selector - Quick Guide

## ✅ What Was Added

You can now **select which AI model to use** directly in the chat interface! This solves the rate-limiting issue by giving you multiple AI models to choose from.

---

## 🎨 New Features

### 1. Model Selector Dropdown
Located at the top-right of the AI chat interface:
- **6 different AI models** to choose from
- **5 free models** (no API key needed)
- **2 premium models** (requires your OpenRouter API key)
- **Auto-saves** your preference to localStorage

### 2. Model Information
Each model shows:
- **Speed indicator** (Fast/Medium/Slow)
- **Quality level** (Good/Better/Best)
- **Provider** (Meta, Google, Mistral, etc.)
- **Tier** (Free or Paid)
- **Description** with use cases

### 3. Smart Tooltips
- Hover over model selector for details
- Info icon explains free vs premium models
- Helps you choose the right model for your needs

---

## 📋 Available Models

### Free Models (No API Key Needed)

1. **Llama 3.2 3B** ⚡ (Default)
   - Provider: Meta
   - Speed: Fast
   - Best for: Quick responses, basic tasks
   - Rate Limit: Low (most reliable)

2. **Gemini 2.0 Flash** ⚡
   - Provider: Google
   - Speed: Fast
   - Best for: Balanced speed and quality
   - Rate Limit: Medium (can get limited at peak times)

3. **Gemma 2 9B** 🟡
   - Provider: Google
   - Speed: Medium
   - Best for: Complex accounting scenarios
   - Rate Limit: Medium

4. **Mistral 7B** 🟡
   - Provider: Mistral AI
   - Speed: Medium
   - Best for: Reliable alternative
   - Rate Limit: Low (good backup)

5. **Hermes 3 (405B)** 🔴
   - Provider: Nous Research
   - Speed: Slow (but powerful)
   - Best for: Complex financial analysis
   - Rate Limit: High (use sparingly)

### Premium Models (Requires API Key + Credits)

6. **Claude 3.5 Sonnet** 👑
   - Provider: Anthropic
   - Speed: Medium
   - Best for: Best overall quality
   - Cost: ~$3 per million tokens

7. **GPT-4o** 👑
   - Provider: OpenAI
   - Speed: Medium  
   - Best for: Complex reasoning
   - Cost: ~$2.50 per million tokens

---

## 🚀 How to Use

### Step 1: Deploy Updates

```bash
# Deploy the updated Edge Function
npx supabase functions deploy ai-accountant
```

(Press `y` when prompted)

### Step 2: Refresh Your Browser

```bash
# If dev server is running, just refresh
# Otherwise start it:
npm run dev
```

### Step 3: Select Your Model

1. Open AI Assistant tab
2. Look at top-right corner
3. Click the dropdown (shows current model)
4. Pick a different model
5. Start chatting!

---

## 💡 When to Switch Models

### If You Get Rate Limit Error:
1. Click model selector dropdown
2. Try: **Mistral 7B** (usually available)
3. Or try: **Llama 3.2 3B** (fastest, most reliable)

### For Quick Questions:
Use: **Llama 3.2 3B** (fast responses)

### For Complex Invoices:
Use: **Gemini 2.0 Flash** or **Gemma 2 9B**

### For Financial Analysis:
Use: **Hermes 3** (if not rate-limited) or premium models

### For Production/Important Work:
Get your own API key → Use **Claude 3.5 Sonnet**

---

## 🔑 Getting Your Own API Key (Optional)

### Why Get Your Own Key?
- ✅ No rate limits
- ✅ Faster responses
- ✅ Access to premium models (Claude, GPT-4)
- ✅ Better reliability
- ✅ Only ~$5-10 lasts for hundreds of conversations

### How to Get API Key:

1. **Sign up at OpenRouter**
   - Go to: https://openrouter.ai/
   - Sign up (free)

2. **Add Credits**
   - Go to: Settings → Credits
   - Add $5-$10 (lasts a long time)

3. **Create API Key**
   - Go to: Settings → Keys
   - Click "Create Key"
   - Copy the key

4. **Add to Supabase**
   ```bash
   npx supabase secrets set OPENROUTER_API_KEY=sk-or-v1-xxxxx
   ```

5. **Redeploy Function**
   ```bash
   npx supabase functions deploy ai-accountant
   ```

6. **Select Premium Model**
   - In chat, select "Claude 3.5 Sonnet" or "GPT-4o"
   - Enjoy unlimited access!

---

## 🎯 Model Selection Strategy

### Recommended Flow:

**Start with:** Llama 3.2 3B (most reliable free)
   ↓
**If rate-limited:** Switch to Mistral 7B
   ↓
**If still limited:** Try Gemma 2 9B
   ↓
**Need premium:** Get API key → Claude 3.5 Sonnet

### For Different Tasks:

| Task | Recommended Model |
|------|------------------|
| Quick invoice creation | Llama 3.2 3B |
| Complex invoice with items | Gemini 2.0 Flash |
| Financial reports | Gemma 2 9B |
| Budget analysis | Hermes 3 or Claude |
| Multiple operations | Claude 3.5 Sonnet |
| Production use | Claude 3.5 Sonnet (paid) |

---

## 🔍 Troubleshooting

### Model selector not showing?
1. Clear browser cache
2. Hard refresh (Ctrl+Shift+R)
3. Check browser console for errors

### Rate limit on all free models?
- **Solution:** Get your own API key (see above)
- **Or:** Wait 5-10 minutes and try again
- **Or:** Try at off-peak times (early morning, late night)

### Premium models not working?
1. Check you have API key set: `npx supabase secrets list`
2. Verify you have credits in OpenRouter dashboard
3. Check Edge Function logs for errors

### Model not responding?
1. Check Edge Function logs: `npx supabase functions logs ai-accountant --tail`
2. Try different model
3. Check OpenRouter status page

---

## 📊 Files Created/Modified

### New Files:
- ✅ `src/components/chat/ModelSelector.tsx` - Model selector component
- ✅ `MODEL_SELECTOR_GUIDE.md` - This guide

### Modified Files:
- ✅ `src/components/chat/ChatInterface.tsx` - Added model selector to header
- ✅ `src/hooks/useChat.ts` - Passes selected model to Edge Function
- ✅ `supabase/functions/ai-accountant/index.ts` - Uses dynamic model

---

## 🎉 Benefits

### Before:
- ❌ Stuck with one model
- ❌ No alternative when rate-limited
- ❌ Had to wait or give up

### After:
- ✅ 6 different models to choose from
- ✅ Switch instantly when one is rate-limited
- ✅ Choose based on speed vs quality needs
- ✅ Option to use premium models
- ✅ Better reliability overall

---

## 🚀 Next Steps

1. **Deploy**: Run `npx supabase functions deploy ai-accountant`
2. **Test**: Refresh browser and check model selector
3. **Switch**: Try different models to see which works best
4. **Optional**: Get your own API key for unlimited access

---

## 💰 Cost Comparison

### Free Models:
- Cost: $0
- Rate Limits: Yes (can be restrictive)
- Quality: Good to Better
- Best for: Testing, personal use, light usage

### With Your Own API Key ($5-10):
- Cost: ~$0.01 - $0.05 per conversation
- Rate Limits: None
- Quality: Best
- Best for: Production, business use, heavy usage

**Example:** $10 credit = ~200-1000 conversations (depending on model)

---

## 📞 Support

If you have issues:
1. Check Edge Function logs
2. Try different models
3. Verify model name is correct
4. Check OpenRouter dashboard for status

---

**Status:** ✅ Ready to deploy and use!  
**Next:** Run `npx supabase functions deploy ai-accountant`


