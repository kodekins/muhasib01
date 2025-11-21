# 🔧 Fix Credits Issue - Quick Guide

## Issues Fixed

1. ✅ Reduced `max_tokens` from 2000 → 1000 (saves credits)
2. ✅ Added better error message for credit exhaustion
3. ✅ Verified model selector is working correctly

---

## 🚀 Deploy Fix Now

```bash
npx supabase functions deploy ai-accountant
```

This will immediately reduce token usage by 50%!

---

## ⚡ Temporary Solution (Until You Get Your Own Key)

### Option 1: Use Different Free Models

Try these models that might have better availability:

1. **mistralai/mistral-7b-instruct:free**
   - Usually less congested
   - Good quality

2. **google/gemma-2-9b-it:free**
   - Google model
   - Reliable

3. **nousresearch/hermes-3-llama-3.1-405b:free**
   - Most powerful free model
   - May be slower

**How to switch:** Use the model dropdown in the chat interface!

---

## 💳 Permanent Solution: Get Your Own API Key (Recommended)

### Why Get Your Own Key?
- ✅ No rate limits
- ✅ No credit exhaustion
- ✅ Faster responses
- ✅ Access to premium models
- ✅ **Cost: ~$0.01 per conversation** ($5 = 500+ conversations!)

### Steps to Get API Key:

#### 1. Sign Up
```
https://openrouter.ai/
```
- Click "Sign Up"
- Use Google/Email

#### 2. Add Credits
```
https://openrouter.ai/settings/credits
```
- Click "Add Credits"
- Add $5 (or more)
- This lasts a LONG time!

#### 3. Create API Key
```
https://openrouter.ai/settings/keys
```
- Click "Create Key"
- Give it a name: "Muhasib AI"
- Copy the key (starts with `sk-or-v1-...`)

#### 4. Update Supabase
```bash
npx supabase secrets set OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

#### 5. Redeploy
```bash
npx supabase functions deploy ai-accountant
```

#### 6. Done!
Now you have unlimited access to all models! ✨

---

## 📊 Cost Breakdown

### Free Shared Key:
- ❌ Runs out quickly
- ❌ Shared with many users
- ❌ Frequent rate limits
- ❌ Can't use premium models

### Your Own Key ($5):
- ✅ ~500-1000 conversations
- ✅ No rate limits
- ✅ Access to all models
- ✅ Can use Claude, GPT-4, etc.

### Example Costs:
| Model | Cost per 1M tokens | Conversations per $5 |
|-------|-------------------|---------------------|
| Llama 3.2 3B | Free tier limits | 50-100 |
| Gemini Flash | $0.075 | 200-500 |
| Claude 3.5 | $3.00 | 30-50 |
| GPT-4o | $2.50 | 40-60 |

**Average conversation:** 2,000-5,000 tokens total

---

## 🔍 Why Model Selector Might Seem Not Working

The model selector **IS working**, but:

1. **Free models share the same credit pool** - If one is exhausted, all are
2. **You need your own API key** - Then each model has separate limits
3. **With your own key:** Model selector works perfectly!

### Test It:
```bash
# After getting your own API key:
1. Deploy: npx supabase functions deploy ai-accountant
2. Open chat
3. Change model in dropdown
4. Send message
5. Check logs: Should show "Using AI model: [your selection]"
```

---

## 🐛 Troubleshooting

### Error: "AI credits exhausted"
**Solution:** Get your own API key (see above)

### Error: "Rate limit"
**Solution:** 
- Try different free model
- Wait 5-10 minutes
- Or get your own API key

### Model selector not changing model
**Check:**
```bash
# View Edge Function logs
npx supabase functions logs ai-accountant --tail

# Look for this line:
"Using AI model: [model-name]"
```

If you see the model name changing, it's working!

### Still getting errors with own key
**Verify:**
```bash
# Check secret is set
npx supabase secrets list

# Should show:
# OPENROUTER_API_KEY = sk-or-v1-...
```

---

## ✅ Quick Checklist

Immediate (free):
- [x] Reduced max_tokens to 1000
- [ ] Deploy Edge Function
- [ ] Try different free models

Permanent (paid, recommended):
- [ ] Sign up at OpenRouter
- [ ] Add $5 credits
- [ ] Create API key
- [ ] Update Supabase secret
- [ ] Redeploy function
- [ ] Test all models

---

## 🎉 Benefits After Getting Your Own Key

Before:
- ❌ Frequent credit errors
- ❌ Can't change models
- ❌ Limited to free tier
- ❌ Shared rate limits

After:
- ✅ No more credit errors
- ✅ Model selector works perfectly
- ✅ Access to premium models
- ✅ Personal rate limits
- ✅ **Professional setup!**

---

## 💡 Pro Tips

1. **Start with $5** - It lasts a long time
2. **Monitor usage** - Check OpenRouter dashboard
3. **Use free models** - For testing
4. **Use premium models** - For production
5. **Set up billing alerts** - Get notified at $1, $3, $5

---

## 📞 Support

If you still have issues after:
1. Deploying the fix
2. Getting your own API key

Check:
```bash
# View logs
npx supabase functions logs ai-accountant --tail

# Test with different models
# Check OpenRouter dashboard
https://openrouter.ai/activity
```

---

## 🚀 Deploy Now

```bash
# Apply the max_tokens fix
npx supabase functions deploy ai-accountant

# Then test with different models
# Or get your own API key for unlimited access!
```

---

**Status:** ✅ Fix Ready  
**Deploy Time:** < 1 minute  
**Cost to Fix:** Free (or $5 for permanent solution)

