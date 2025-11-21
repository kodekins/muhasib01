# 🚀 Quick Start Guide - Intelligent AI Invoice System

## Get Started in 5 Minutes

Follow these steps to deploy and test the new intelligent conversational AI for invoice creation.

---

## Step 1: Apply Database Migration ⚡

```bash
# Navigate to your project directory
cd accu-chat

# Apply the migration
supabase db push
```

**What this does:**
- Creates `conversation_context` table
- Adds `message_type` and `metadata` columns to `messages` table
- Sets up security policies

**Verify it worked:**
```bash
# Check if table exists
supabase db remote show conversation_context
```

---

## Step 2: Deploy Edge Function 🚀

```bash
# Deploy the updated AI function
supabase functions deploy ai-accountant

# Wait for deployment to complete...
# You should see: "Deployed ai-accountant"
```

**Verify it works:**
```bash
# Check function logs
supabase functions logs ai-accountant --tail
```

Keep this terminal open to monitor logs during testing.

---

## Step 3: Restart Dev Server 💻

```bash
# Stop your current dev server (Ctrl+C)

# Start it again
npm run dev
```

This ensures frontend has the latest components.

---

## Step 4: Create a Test Customer 👤

Before testing invoice creation, you need at least one customer:

1. Open your app: `http://localhost:5173`
2. Sign in with Google
3. Navigate to **Customers** tab
4. Click **Add Customer**
5. Fill in:
   - Name: `John Doe`
   - Company: `Test Company`
   - Email: `john@test.com`
6. Click **Save**

---

## Step 5: Test the AI! 🧪

### Test 1: Basic Conversation

1. Go to **AI Assistant** tab
2. Type: **"Create an invoice for John Doe"**
3. AI should ask: *"What is the amount or what items should I include?"*
4. Type: **"$500 for consulting services"**
5. AI should ask: *"When should it be dated and when is it due?"*
6. Type: **"Today and due in 30 days"**
7. You should see a **preview card** appear! 📄
8. Review the preview
9. Click **"Confirm & Create Invoice"**
10. Success message: *"✅ Invoice INV-001 created successfully!"*

### Test 2: Quick Creation

1. Start new conversation
2. Type: **"Create invoice for John Doe, $1000, today, due Feb 20"**
3. Preview should appear immediately (all info provided)
4. Click confirm
5. Done! ✅

### Test 3: Edit Preview

1. Create an invoice (use Test 1 or 2)
2. When preview appears, click **"Edit"** button
3. Change the amount to $600
4. Click **"Done Editing"**
5. Verify preview shows $600
6. Click confirm
7. Check invoice amount is $600

### Test 4: Cancellation

1. Type: **"Create an invoice for John Doe"**
2. AI asks for amount
3. Type: **"cancel"**
4. AI should say: *"Okay, I've cancelled that..."*
5. No invoice created ✅

### Test 5: Memory Test

1. Type: **"I want to bill a client"**
2. AI asks which client
3. Type: **"John Doe"**
4. AI asks for amount
5. Type: **"How much was the last invoice I created?"**
6. Type: **"Make it $500"**
7. Verify AI remembers you're creating invoice for John Doe
8. Continue to completion

---

## Expected Results ✅

After testing, you should verify:

- [ ] Conversations work across multiple messages
- [ ] AI remembers context from previous messages
- [ ] Preview appears before invoice creation
- [ ] Preview shows correct data
- [ ] Edit button works
- [ ] Confirm creates invoice
- [ ] Cancel prevents creation
- [ ] Invoice appears in Invoices tab

---

## Viewing Created Invoices

1. Navigate to **Sales** dropdown → **Invoices**
2. You should see all created invoices:
   - INV-001, INV-002, etc.
   - Status: Draft
   - Customer names
   - Amounts

---

## Debugging Tips 🔍

### If preview doesn't appear:

**Check browser console:**
```
Right-click → Inspect → Console tab
Look for errors
```

**Check message type:**
```javascript
// Should see message_type: "preview" in database
```

### If AI doesn't remember:

**Check Edge Function logs:**
```bash
supabase functions logs ai-accountant --tail
```

Look for:
```
Loading conversation context...
Context loaded: { ... }
```

### If confirmation doesn't work:

**Type exactly:** `confirm` (lowercase)

Alternative keywords that work:
- `yes`
- `create`
- `ok`
- `proceed`
- `approve`

### If Edge Function fails:

**Redeploy:**
```bash
supabase functions deploy ai-accountant --no-verify-jwt
```

**Check environment variables:**
```bash
# Verify OPENROUTER_API_KEY is set
supabase secrets list
```

---

## Common Issues & Solutions

### Issue: "Not authenticated" error
**Solution:** Sign out and sign in again

### Issue: Customer not found
**Solution:** 
- Make sure customer exists in Customers page
- Use exact customer name
- AI only uses existing customers

### Issue: Dates not working
**Solution:** Use these formats:
- "today"
- "tomorrow"  
- "2025-01-25"
- "Jan 25, 2025"

### Issue: Preview shows wrong amount
**Solution:**
- Click Edit
- Verify line items
- Check quantity × unit_price = amount
- Amounts auto-calculate

---

## Advanced Testing

### Test Multi-Line Invoice

Type:
```
Create invoice for John Doe, dated today, due in 30 days:
- 10 hours of consulting at $100/hour
- Website hosting: $50
```

AI should create invoice with two line items!

### Test Natural Language Dates

Try these:
- "next Friday"
- "end of month"
- "2 weeks from now"
- "January 31st"

### Test Editing

In preview:
1. Click Edit
2. Click "+ Add Line Item"
3. Fill in new line
4. Remove a line (click X)
5. Change quantities
6. Watch totals update automatically

---

## Performance Check

Good performance indicators:
- AI responds in < 3 seconds
- Preview renders instantly
- Edit mode is smooth
- Confirm creates invoice in < 1 second

If slower:
- Check internet connection
- Check Edge Function region (should be near you)
- Review Edge Function logs for errors

---

## What To Do Next

### Extend to Bills

Want the same for bills? It's easy:

1. Copy `InvoicePreview.tsx` → `BillPreview.tsx`
2. Update Edge Function to handle `CREATE_BILL`
3. Add bill case in ChatInterface
4. Test with vendors!

### Add More Features

Ideas:
- Product search in line items
- Auto-fill from templates
- Recurring invoices
- Send invoice via email
- PDF generation preview

---

## Production Readiness Checklist

Before going to production:

- [ ] Test with real customer data
- [ ] Test with various date formats
- [ ] Test with multiple users
- [ ] Add error boundaries
- [ ] Set up monitoring/logging
- [ ] Document for other team members
- [ ] Add user feedback mechanism
- [ ] Test on mobile devices
- [ ] Add loading states
- [ ] Handle offline scenarios

---

## Getting Help

### Resources

📖 **User Guide:** `INTELLIGENT_AI_INVOICE_GUIDE.md`  
📝 **Implementation Details:** `IMPLEMENTATION_SUMMARY.md`  
💾 **Database Schema:** `supabase/migrations/20250122000000_add_conversation_context.sql`

### Debug Commands

```bash
# View Edge Function logs
supabase functions logs ai-accountant --tail

# Check database
supabase db remote show conversation_context

# Verify migration
supabase db remote list

# Test Edge Function directly
curl -X POST 'https://your-project.supabase.co/functions/v1/ai-accountant' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"message":"test","userId":"...","conversationId":"..."}'
```

---

## Success! 🎉

If all tests pass, you now have:
- ✅ Intelligent conversational AI
- ✅ Memory across messages
- ✅ Safe preview-before-create workflow
- ✅ Editable previews
- ✅ Professional invoice creation

**Next:** Try creating bills, products, or other entities using the same pattern!

---

## Feedback

Found a bug? Have a suggestion?
- Create an issue in your project
- Update the documentation
- Improve the AI prompts

Happy coding! 🚀
