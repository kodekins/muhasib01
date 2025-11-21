# 🧠 Intelligent Conversational AI for Invoice Creation

## Overview

The AI accountant now has **memory** and can have **multi-turn conversations**. It collects information step by step, shows a preview before creating records, and requires confirmation before executing any actions.

## Features

✅ **Conversational Memory** - Remembers what you said across multiple messages  
✅ **Progressive Data Collection** - Asks for missing information one step at a time  
✅ **Preview Before Create** - Shows a formatted preview with all details  
✅ **Editable Previews** - You can edit any field before confirming  
✅ **Safe Execution** - Nothing is created without your confirmation  

---

## How It Works

### Flow Diagram

```
User: "Create an invoice for John"
   ↓
AI: [COLLECTING MODE]
   "I'll create an invoice for John. What's the amount or what items?"
   ↓
User: "$500 for consulting"
   ↓
AI: [COLLECTING MODE]
   "Perfect! $500 for consulting. When should it be dated and when is it due?"
   ↓
User: "Today and due in 30 days"
   ↓
AI: [PREVIEW MODE]
   Shows formatted invoice preview with Edit/Confirm buttons
   ↓
User: Clicks "Confirm & Create Invoice"
   ↓
AI: [EXECUTE MODE]
   ✅ Invoice created successfully!
```

---

## Example Conversations

### Example 1: Step-by-Step Invoice Creation

**User:** Create an invoice for John Doe

**AI:** I'll help you create an invoice for John Doe. What is the amount or what items should I include?

**User:** $500 for consulting services

**AI:** Got it! $500 for consulting services. When should the invoice be dated and when is it due?

**User:** Date it today and make it due in 30 days

**AI:** *[Shows Preview Card]*
```
📄 Invoice Preview

Customer: John Doe
Invoice Date: January 22, 2025
Due Date: February 21, 2025

Line Items:
• Consulting Services - $500.00

Total: $500.00

[Edit] [Confirm & Create Invoice] [Cancel]
```

**User:** *Clicks "Confirm & Create Invoice"*

**AI:** ✅ Invoice INV-001 created successfully! Total: $500.00. The invoice is in draft status.

---

### Example 2: Quick Invoice (All Info at Once)

**User:** Create invoice for ABC Corp, $2,500 for web development, dated 2025-01-20, due 2025-02-20

**AI:** *[Shows Preview Immediately]*
```
📄 Invoice Preview

Customer: ABC Corp
Invoice Date: January 20, 2025
Due Date: February 20, 2025

Line Items:
• Web Development - $2,500.00

Total: $2,500.00

[Edit] [Confirm & Create Invoice] [Cancel]
```

---

### Example 3: Editing Before Confirmation

**User:** Create invoice for Sarah's Bakery, $800 for marketing services

**AI:** Perfect! I'll create an invoice for Sarah's Bakery for $800. When should it be dated and when is payment due?

**User:** Today, due in 15 days

**AI:** *[Shows Preview]*

**User:** *Clicks "Edit", changes amount to $850, adds note "January campaign"*

**AI:** *[Preview updates in real-time]*

**User:** *Clicks "Confirm & Create Invoice"*

**AI:** ✅ Invoice INV-002 created successfully! Total: $850.00. The invoice is in draft status.

---

### Example 4: Cancellation

**User:** Create invoice for Tech Corp, $1000

**AI:** I'll create an invoice for Tech Corp for $1,000. When should it be dated and when is it due?

**User:** cancel

**AI:** Okay, I've cancelled that. What would you like to do instead?

---

## Using the Preview Interface

### Preview Card Features

The preview card shows:
- Customer name
- Invoice date and due date
- All line items with quantities and prices
- Subtotal, tax, discount (if any)
- Total amount
- Notes (if any)

### Edit Mode

Click the **Edit** button to:
- Change dates
- Modify line item descriptions
- Adjust quantities and prices
- Add or remove line items
- Add notes

All calculations update automatically!

### Buttons

- **✓ Confirm & Create Invoice** - Creates the invoice in your system
- **Edit** - Switch between view and edit modes
- **✗ Cancel** - Abandon the invoice creation

---

## Technical Implementation

### 1. Database Changes

New table: `conversation_context`
- Stores partial data during conversations
- Tracks what's collected and what's missing
- Maintains state (collecting, preview, confirmed)

Updated: `messages` table
- Added `message_type` field (text, preview, success)
- Added `metadata` field for preview data

### 2. Edge Function Updates

The Edge Function now:
- Loads conversation history for context
- Maintains state across messages
- Returns structured responses with types
- Handles confirmation flow

### 3. Frontend Components

**New Components:**
- `InvoicePreview` - Interactive preview card
- Updated `ChatInterface` - Handles preview messages
- Updated `useChat` - Manages different message types

---

## Migration Steps

### 1. Deploy Database Migration

```bash
# Apply the migration
supabase db push
```

Or manually run the migration file:
```sql
-- See: supabase/migrations/20250122000000_add_conversation_context.sql
```

### 2. Deploy Edge Function

```bash
# Deploy the updated AI function
supabase functions deploy ai-accountant
```

### 3. Test the System

1. Start a new conversation
2. Type: "Create an invoice for [customer name]"
3. Follow the AI's prompts
4. Review the preview
5. Confirm creation

---

## AI System Prompt Details

### Three Modes

#### 1. **COLLECTING Mode**
- Activated when user provides incomplete information
- AI asks for missing required fields
- Remembers previously provided data
- Conversational and friendly

**Response Format:**
```json
{
  "mode": "collecting",
  "action": "CREATE_INVOICE",
  "collected": { "customer_id": "...", "amount": 500 },
  "missing": ["invoice_date", "due_date"],
  "response": "Great! When should the invoice be dated?"
}
```

#### 2. **PREVIEW Mode**
- Activated when all required fields are collected
- Shows formatted preview
- Waits for user confirmation
- Allows editing

**Response Format:**
```json
{
  "mode": "preview",
  "action": "CREATE_INVOICE",
  "preview_data": {
    "customer_id": "...",
    "customer_name": "John Doe",
    "invoice_date": "2025-01-22",
    "due_date": "2025-02-21",
    "lines": [...],
    "total_amount": 500
  },
  "response": "Here's your invoice preview..."
}
```

#### 3. **EXECUTE Mode**
- Activated on confirmation
- Creates the actual record
- Returns success message

---

## Required Fields for Invoices

- ✅ `customer_id` - Must exist in database
- ✅ `invoice_date` - Format: YYYY-MM-DD
- ✅ `due_date` - Format: YYYY-MM-DD
- ✅ `lines` - Array of line items with:
  - `description`
  - `quantity`
  - `unit_price`
  - `amount`

### Optional Fields
- `tax_amount`
- `discount_amount`
- `notes`
- `terms`

---

## Troubleshooting

### AI Doesn't Remember Previous Messages
- Check that conversation_context table exists
- Verify conversationId is being passed to Edge Function
- Check Edge Function logs in Supabase dashboard

### Preview Not Showing
- Verify message_type and metadata are being saved
- Check ChatInterface is importing InvoicePreview
- Look for errors in browser console

### Confirmation Not Working
- Ensure "confirm" is being sent as a message
- Check Edge Function is detecting confirmation
- Verify conversation context state is "preview"

### Customer Not Found
- AI will only use customers that exist in your database
- Add customers first through the Customers page
- Or ask AI: "Create a customer named John Doe"

---

## Future Enhancements

Coming soon:
- ✨ Bill preview (same flow for bills)
- ✨ Product preview
- ✨ Multi-item invoice wizard
- ✨ Invoice templates
- ✨ Batch invoice creation
- ✨ Smart date suggestions (e.g., "next Friday")
- ✨ Product autocomplete from catalog
- ✨ Customer credit limit checks

---

## API Reference

### Edge Function Endpoint

```
POST /functions/v1/ai-accountant
```

**Request:**
```json
{
  "message": "Create an invoice for John",
  "conversationId": "uuid",
  "userId": "uuid"
}
```

**Response Types:**

**Type 1: Message (Collecting)**
```json
{
  "type": "message",
  "response": "I'll create an invoice..."
}
```

**Type 2: Preview**
```json
{
  "type": "preview",
  "action": "CREATE_INVOICE",
  "data": { /* invoice data */ },
  "response": "Here's your preview..."
}
```

**Type 3: Success**
```json
{
  "type": "success",
  "response": "✅ Invoice created!",
  "data": { /* created invoice */ }
}
```

---

## Best Practices

### For Users

1. **Be conversational** - The AI understands natural language
2. **Provide info incrementally** - You don't need to give everything at once
3. **Review previews carefully** - Check all details before confirming
4. **Use the edit button** - Make changes directly in the preview
5. **Be specific about dates** - Use formats like "today", "tomorrow", or "2025-01-20"

### For Developers

1. **Always pass conversationId** - Required for memory to work
2. **Handle all response types** - text, preview, success, error
3. **Store metadata properly** - Preview data needs to be in metadata field
4. **Clear context after completion** - Prevents stale data
5. **Test edge cases** - Missing customers, invalid dates, etc.

---

## Support

For issues or questions:
1. Check Edge Function logs in Supabase dashboard
2. Review browser console for frontend errors
3. Verify database migrations are applied
4. Test with simple queries first

---

## License

Part of the Muhasib AI Accounting System


