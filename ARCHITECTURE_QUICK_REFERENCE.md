# Architecture Quick Reference

## 🎯 The Big Picture

```
YOU (User) have TWO ways to interact:

┌─────────────────────────────────────────────────────────┐
│                    WAY 1: USE THE UI                     │
│                                                          │
│  Click buttons → Fill forms → Submit                    │
│         ↓                                                │
│  Frontend Services (Browser)                             │
│         ↓                                                │
│  Supabase Client (RLS Security)                          │
│         ↓                                                │
│  Database ✅                                             │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                  WAY 2: USE THE CHAT                     │
│                                                          │
│  Type message → "Create invoice for $500"                │
│         ↓                                                │
│  Edge Function (Server)                                  │
│         ↓                                                │
│  AI processes → Understands intent                       │
│         ↓                                                │
│  Database ✅                                             │
└─────────────────────────────────────────────────────────┘

BOTH end up in the same database!
BOTH trigger realtime updates!
BOTH are secured by user_id filtering!
```

## 📊 Side-by-Side Comparison

| Aspect | Frontend Services | Edge Function |
|--------|------------------|---------------|
| **What is it?** | TypeScript code in browser | Deno code on Supabase server |
| **When?** | User clicks UI button | User types in chat |
| **Where?** | `src/services/*.ts` | `supabase/functions/ai-accountant/` |
| **Security** | RLS (automatic) | Service Role (manual filter) |
| **Example** | Click "Create Invoice" | Type "Create invoice for $500" |
| **AI?** | ❌ No | ✅ Yes (OpenRouter) |
| **Speed** | ⚡ Fast | 🐌 Slower (AI processing) |
| **Cost** | Free | Small compute cost |

## 🔄 Real Example: Creating an Invoice

### Via UI (Frontend Service)
```
1. Open Invoices tab
2. Click "New Invoice"
3. Select customer from dropdown
4. Add line: "Website" - $1500
5. Click "Create Invoice"
   
   ↓ InvoiceService.createInvoice()
   ↓ Supabase.from('invoices').insert()
   ↓ Database writes
   ↓ ✅ Done!
```

### Via Chat (Edge Function)
```
1. Open AI Assistant tab
2. Type: "Create invoice for ABC Corp for $1500"
3. Press Enter
   
   ↓ Edge Function receives message
   ↓ AI understands: CREATE_INVOICE
   ↓ Looks up customer "ABC Corp"
   ↓ Creates invoice in database
   ↓ ✅ Done!
```

### Result: SAME!
Both create the same invoice in the database.  
Both show up in the Invoices tab.  
Both trigger realtime updates.

## 🧠 Why Two Ways?

### Frontend Services (UI)
**For users who want CONTROL**
- See exactly what you're doing
- Fill in all details
- Visual interface
- Point and click

**Perfect for:**
- Accountants
- Bookkeepers
- People who like forms
- Precise data entry

### Edge Function (AI Chat)
**For users who want SPEED**
- Just type naturally
- AI figures it out
- No forms needed
- Conversational

**Perfect for:**
- Quick entries
- Non-accountants
- Voice-like input
- Questions about data

## 🔐 Security Model

### Frontend Services
```typescript
// Automatic security via RLS
const { data } = await supabase
  .from('invoices')
  .select('*');
// ↑ RLS automatically adds: WHERE user_id = auth.uid()
// You ONLY see your own invoices
// Cannot see other users' data
// No code needed - built-in!
```

### Edge Function
```typescript
// Manual security - YOU must filter
const { data } = await supabase
  .from('invoices')
  .select('*')
  .eq('user_id', userId); // ← YOU must add this!
// Without this line, you'd see ALL users' invoices
// Service role bypasses RLS
// Must be careful!
```

## 💡 Mental Model

Think of it like a restaurant:

### Frontend Services = Menu Ordering
- You see the menu (UI)
- You point to what you want (click button)
- Staff takes your order (service)
- Kitchen cooks it (database)
- ✅ You get exactly what you ordered

### Edge Function = Tell the Chef
- You tell the chef: "Surprise me with something Italian for $20"
- Chef understands (AI)
- Chef decides what to make (edge function logic)
- Chef cooks it (database)
- ✅ You get something good (hopefully!)

**Both get you food (data in database)!**

## 🎨 Code Examples

### Frontend Service Usage
```typescript
// In a React component
import { InvoiceService } from '@/services';

const MyComponent = () => {
  const handleCreate = async () => {
    const result = await InvoiceService.createInvoice({
      user_id: userId,
      customer_id: 'abc-123',
      total_amount: 1500
    });
    
    if (result.success) {
      alert('Invoice created!');
    }
  };
  
  return <button onClick={handleCreate}>Create</button>;
};
```

### Edge Function Usage
```typescript
// In chat component
const handleSendMessage = async (message: string) => {
  const response = await fetch('/functions/v1/ai-accountant', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: 'Create invoice for $1500',
      userId: userId,
      conversationId: convId
    })
  });
  
  const data = await response.json();
  // Shows AI response in chat
};
```

## 🔄 How They Stay in Sync

```
Frontend Service creates invoice
        ↓
    Database writes
        ↓
   Realtime triggers
        ↓
   ┌─────┴─────┐
   ↓           ↓
UI updates   Chat updates
```

```
Edge Function creates invoice
        ↓
    Database writes
        ↓
   Realtime triggers
        ↓
   ┌─────┴─────┐
   ↓           ↓
UI updates   Chat updates
```

**Both trigger the SAME realtime events!**  
**So both UIs stay perfectly in sync!**

## 📋 When to Use Which

### Use Frontend Services (UI) When:
- ✅ You want precise control
- ✅ You need to see all options
- ✅ You're entering complex data
- ✅ You're doing bulk operations
- ✅ You want immediate visual feedback

### Use Edge Function (Chat) When:
- ✅ You want to ask questions
- ✅ You want quick entry
- ✅ You're not sure where to find something
- ✅ You want natural language
- ✅ You need reports explained

### Use BOTH When:
- ✅ Creating invoice via UI
- ✅ Asking chat "Did the invoice get created?"
- ✅ Chat creates, UI refines
- ✅ UI creates, chat analyzes

## 🚀 Quick Decision Tree

```
Are you typing a natural language question or command?
    ↓ YES
    Use CHAT (Edge Function)
    
    ↓ NO
Are you filling out a form or clicking buttons?
    ↓ YES
    Use UI (Frontend Services)
```

## 💪 Strengths of Each

### Frontend Services Strengths
1. **Fast**: No server round-trip
2. **Secure**: RLS automatic
3. **Type-safe**: TypeScript checks
4. **Debuggable**: Browser dev tools
5. **Offline-capable**: Can cache
6. **Free**: No compute costs

### Edge Function Strengths
1. **Smart**: AI-powered
2. **Flexible**: Understands variations
3. **Helpful**: Can explain things
4. **Powerful**: Access to all data
5. **Conversational**: Natural language
6. **Multi-step**: Complex workflows

## 🎯 The Truth

**You don't need to choose!**

Both work together:
- Create invoice in UI ✅
- Ask chat "How much did I bill this month?" ✅
- Chat creates customer ✅
- UI creates invoice for that customer ✅
- Ask chat "Show me profit and loss" ✅
- View detailed report in Reports tab ✅

**They're partners, not competitors!**

## 📚 Where to Learn More

- **Edge Function Details**: See `EDGE_FUNCTION_ARCHITECTURE.md`
- **Service API**: See `src/services/README.md`
- **Component Integration**: See `SERVICE_INTEGRATION_REFERENCE.md`
- **Full Implementation**: See `BOOKKEEPING_UI_IMPLEMENTATION.md`

## 🎊 Summary

```
┌─────────────────────────────────────────────┐
│  UI Buttons → Frontend Services → Database  │
│                                             │
│  Chat Messages → Edge Function → Database  │
│                                             │
│        Same Database = Same Result!         │
│       Realtime Sync = Always Updated!       │
└─────────────────────────────────────────────┘
```

**That's it!** 🎉

Your app has two interfaces to the same bookkeeping system. Use whichever feels right at the moment!

