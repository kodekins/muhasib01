# 🚀 AI Assistant Deployment Checklist

Use this checklist to ensure your AI assistant is properly deployed and configured.

## ✅ Pre-Deployment Checklist

### 1. Get OpenRouter API Key
- [ ] Go to [https://openrouter.ai](https://openrouter.ai)
- [ ] Sign up or login
- [ ] Navigate to "Keys" section
- [ ] Create a new API key
- [ ] Copy the API key (you'll need it next)
- [ ] Add credits to your account if needed

### 2. Verify Code Changes
- [ ] Check that `supabase/functions/ai-accountant/index.ts` has been updated
- [ ] Verify the syntax error on line 41-43 is fixed (should have proper braces)
- [ ] Confirm new operations are added (inventory, customer list, etc.)

---

## 🔧 Deployment Steps

### Step 1: Configure Supabase Secrets

1. **Open Supabase Dashboard**
   - [ ] Go to: https://supabase.com/dashboard
   - [ ] Select your project

2. **Navigate to Edge Functions Secrets**
   - [ ] Click: Settings (gear icon in sidebar)
   - [ ] Click: Edge Functions
   - [ ] Scroll to "Secrets" section

3. **Add OpenRouter API Key**
   - [ ] Click "Add Secret"
   - [ ] Name: `OPENROUTER_API_KEY`
   - [ ] Value: [paste your API key]
   - [ ] Click "Save"

4. **Verify Existing Secrets**
   - [ ] `SUPABASE_URL` should already exist (auto-configured)
   - [ ] `SUPABASE_SERVICE_ROLE_KEY` should already exist (auto-configured)

### Step 2: Deploy Edge Function

**Option A: Deploy via Supabase Dashboard**

1. [ ] Open Supabase Dashboard
2. [ ] Click "Edge Functions" in sidebar
3. [ ] Find or create "ai-accountant" function
4. [ ] Click "Edit Function" or "Create Function"
5. [ ] Copy entire contents of `supabase/functions/ai-accountant/index.ts`
6. [ ] Paste into editor
7. [ ] Click "Deploy"
8. [ ] Wait for deployment to complete
9. [ ] Check for any errors in deployment logs

**Option B: Deploy via CLI** (if Supabase CLI is installed)

```bash
# Make sure you're in the project root
cd accu-chat

# Login to Supabase
supabase login

# Link your project (if not already linked)
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the function
supabase functions deploy ai-accountant

# Check deployment status
supabase functions list
```

---

## 🧪 Testing & Verification

### Step 3: Test Edge Function

1. **Check Function Status**
   - [ ] Go to: Supabase Dashboard → Edge Functions
   - [ ] Verify "ai-accountant" shows as "Active"
   - [ ] Check deployment timestamp is recent

2. **Test in Application**
   - [ ] Open your application
   - [ ] Navigate to Chat/AI Assistant
   - [ ] Send test message: "Hello! What can you help me with?"
   - [ ] Verify you get a response (not an error)

3. **Test Basic Commands**
   - [ ] "Show me my customers"
   - [ ] "List all products"
   - [ ] "Show me my financial summary"
   - [ ] Each should return appropriate response

4. **Test Create Operations**
   - [ ] "Add a customer named Test User"
   - [ ] "Create a product called Test Product for $50"
   - [ ] Verify operations complete successfully

### Step 4: Check Logs

1. **View Function Logs**
   - [ ] Go to: Supabase Dashboard → Edge Functions → ai-accountant
   - [ ] Click "Logs" tab
   - [ ] Send a test message
   - [ ] Verify logs show request processing
   - [ ] Check for any error messages

2. **Check for Common Issues**
   - [ ] No "OPENROUTER_API_KEY is not set" errors
   - [ ] No "Invalid response from AI service" errors
   - [ ] No 500 errors
   - [ ] No CORS errors

### Step 5: Browser Testing

1. **Open Browser DevTools**
   - [ ] Press F12 in your browser
   - [ ] Go to Network tab
   - [ ] Send a message in chat

2. **Check Network Request**
   - [ ] Find "ai-accountant" request
   - [ ] Verify status is 200 (not 500)
   - [ ] Check response contains "response" field
   - [ ] Verify response is not an error message

---

## 🔍 Troubleshooting

### If you see "500 Internal Server Error":

- [ ] Verify OPENROUTER_API_KEY is set in Supabase secrets
- [ ] Check edge function logs for detailed error
- [ ] Verify OpenRouter API key is valid
- [ ] Check OpenRouter account has credits
- [ ] Confirm edge function is deployed (check timestamp)

### If AI doesn't understand commands:

- [ ] Try simpler commands first ("Hello")
- [ ] Verify function is responding (check logs)
- [ ] Check that database has necessary data
- [ ] Try commands from AI_COMMANDS_REFERENCE.md

### If operations don't work:

- [ ] Verify entities exist (customers, vendors, products)
- [ ] Check RLS policies allow operations
- [ ] Verify user is authenticated
- [ ] Check database connection

---

## 📊 Post-Deployment Validation

### Functional Testing

Test each category of operations:

**Customer Management**
- [ ] List customers works
- [ ] Create customer works
- [ ] Customer data is accurate

**Invoice Management**
- [ ] Create invoice works
- [ ] List invoices works
- [ ] Record payment works

**Product Management**
- [ ] List products works
- [ ] Create product works
- [ ] Update inventory works

**Financial Reports**
- [ ] Profit & Loss generates
- [ ] Financial summary works
- [ ] Budget status shows

**Bill Management**
- [ ] Create bill works
- [ ] List bills works
- [ ] Bills due shows correctly

### Performance Testing

- [ ] Response time is acceptable (< 5 seconds)
- [ ] Multiple rapid requests don't cause errors
- [ ] Function doesn't timeout
- [ ] Logs show reasonable processing time

---

## 📝 Configuration Checklist

Double-check all configurations:

### Supabase Configuration
- [ ] OPENROUTER_API_KEY is set
- [ ] Edge function is deployed
- [ ] Function status is "Active"
- [ ] No deployment errors

### OpenRouter Configuration
- [ ] API key is valid
- [ ] Account has credits
- [ ] Model `google/gemma-2-9b-it:free` is accessible
- [ ] No rate limiting issues

### Application Configuration
- [ ] Supabase client is configured
- [ ] Authentication is working
- [ ] Database connection is active
- [ ] RLS policies are correct

---

## 🎯 Success Criteria

Your deployment is successful when:

- ✅ No 500 errors in chat
- ✅ AI responds to basic queries
- ✅ Operations execute successfully
- ✅ Function logs show no errors
- ✅ All test commands work
- ✅ Response time is acceptable

---

## 🚀 Go Live!

Once all checkboxes are completed:

1. [ ] Test with real user scenarios
2. [ ] Monitor logs for first 24 hours
3. [ ] Check OpenRouter usage/costs
4. [ ] Gather user feedback
5. [ ] Document any issues

---

## 📞 Support Resources

- **Detailed Setup Guide**: `AI_ASSISTANT_FIX_GUIDE.md`
- **Command Reference**: `AI_COMMANDS_REFERENCE.md`
- **Supabase Docs**: https://supabase.com/docs
- **OpenRouter Docs**: https://openrouter.ai/docs

---

## 🎉 Congratulations!

If all checks are complete, your AI accounting assistant is now live and ready to help users manage their finances! 🚀

**Next Steps:**
1. Train users with `AI_COMMANDS_REFERENCE.md`
2. Monitor usage and costs
3. Collect feedback for improvements
4. Enjoy your intelligent accounting system! 🎊

