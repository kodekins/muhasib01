/**
 * MUHASIB AI Accountant - Enhanced Edge Function with Conversation Memory
 * 
 * Features:
 * - Multi-turn conversations with memory
 * - Collects missing information step by step
 * - Shows preview before creating records
 * - Requires confirmation before execution
 */

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openRouterApiKey = Deno.env.get('OPENROUTER_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!openRouterApiKey) {
      throw new Error('AI service not configured');
    }

    const { message, conversationId, userId, model } = await req.json();
    
    if (!message || !userId || !conversationId) {
      throw new Error('Missing required fields: message, userId, and conversationId');
    }
    
    // Use provided model or default
    const selectedModel = model || 'meta-llama/llama-3.2-3b-instruct:free';
    
    console.log('AI Request:', { 
      message: message.substring(0, 100), 
      conversationId, 
      userId,
      model: selectedModel 
    });

    // Check if user is confirming a preview
    const isConfirmation = message.toLowerCase().match(/^(confirm|yes|create|proceed|ok|approve)$/i);
    const isCancel = message.toLowerCase().match(/^(cancel|no|stop|abort)$/i);
    
    // Load conversation context
    const context = await loadConversationContext(conversationId, userId);
    
    // Handle confirmation
    if (isConfirmation && context && context.state === 'preview') {
      console.log('Executing confirmed action:', context.pending_action);
      const result = await executeAction(context.pending_action, context.collected_data, userId);
      await clearConversationContext(conversationId);
      
      return new Response(JSON.stringify({ 
        type: 'success',
        response: result.response,
        data: result.data
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle cancellation
    if (isCancel && context) {
      await clearConversationContext(conversationId);
      return new Response(JSON.stringify({
        type: 'message',
        response: "Okay, I've cancelled that. What would you like to do instead?"
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // OPTIMIZATION: Try to parse simple commands directly (no AI needed)
    const directCommand = parseDirectCommand(message);
    if (directCommand) {
      console.log('Direct command detected:', directCommand.action);
      try {
        // Handle EDIT_INVOICE specially - needs preview mode
        if (directCommand.action === 'EDIT_INVOICE') {
          // Load invoice data for preview
          let query = supabase
            .from('invoices')
            .select('*, customer:customers(name), lines:invoice_lines(*)')
            .eq('user_id', userId);

          if (directCommand.data.invoice_number) {
            query = query.eq('invoice_number', directCommand.data.invoice_number);
          }

          const { data: invoice } = await query.single();

          if (invoice) {
            const previewData = {
              invoice_id: invoice.id,
              invoice_number: invoice.invoice_number,
              customer_id: invoice.customer_id,
              customer_name: invoice.customer?.name,
              invoice_date: invoice.invoice_date,
              due_date: invoice.due_date,
              lines: invoice.lines.sort((a: any, b: any) => a.line_order - b.line_order),
              subtotal: invoice.subtotal,
              tax_amount: invoice.tax_amount || 0,
              discount_amount: invoice.discount_amount || 0,
              total_amount: invoice.total_amount,
              notes: invoice.notes || ''
            };

            // Save to context
            await updateConversationContext(conversationId, userId, {
              pending_action: 'EDIT_INVOICE',
              collected_data: previewData,
              missing_fields: [],
              state: 'preview'
            });

      return new Response(JSON.stringify({ 
              type: 'preview',
              action: 'EDIT_INVOICE',
              data: previewData,
              response: `Here's invoice ${invoice.invoice_number} ready to edit. Make your changes and confirm.`
            }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
          }
        }

        // Execute other direct commands
        const result = await executeAction(directCommand.action, directCommand.data, userId);
        
        // Determine response type
        let responseType = 'success';
        if (directCommand.action === 'LIST_INVOICES' && result.data && Array.isArray(result.data)) {
          responseType = 'success'; // Will trigger InvoiceListActions component
        }

        return new Response(JSON.stringify({
          type: responseType,
          response: result.response,
          data: result.data
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error: any) {
        console.error('Direct command error:', error);
        return new Response(JSON.stringify({
          type: 'error',
          response: `Error: ${error.message}`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Load user data for context
    const userData = await loadUserData(userId);
    
    // Load recent messages for conversation history
    const messageHistory = await loadRecentMessages(conversationId);
    
    // Build system prompt
    const systemPrompt = buildSystemPrompt(userData, context, messageHistory);
    
    // Call AI with selected model
    const aiResponse = await callOpenRouter(systemPrompt, message, selectedModel);
    
    // Parse AI response
    const parsed = parseAIResponse(aiResponse);
    console.log('Parsed AI Response:', JSON.stringify(parsed, null, 2));
    
    // Handle based on mode
    if (parsed.mode === 'collecting') {
      // Save partial data
      await updateConversationContext(conversationId, userId, {
        pending_action: parsed.action,
        collected_data: parsed.collected,
        missing_fields: parsed.missing,
        state: 'collecting'
      });
      
      return new Response(JSON.stringify({ 
        type: 'message',
        response: parsed.response
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (parsed.mode === 'preview') {
      // For EDIT_INVOICE, if only invoice_number/id provided, load full invoice data
      if (parsed.action === 'EDIT_INVOICE' && parsed.preview_data && 
          (parsed.preview_data.invoice_number || parsed.preview_data.invoice_id) &&
          !parsed.preview_data.lines) {
        
        // Load full invoice data
        let query = supabase
      .from('invoices')
          .select('*, customer:customers(name), lines:invoice_lines(*)')
          .eq('user_id', userId);

        if (parsed.preview_data.invoice_id) {
          query = query.eq('id', parsed.preview_data.invoice_id);
        } else if (parsed.preview_data.invoice_number) {
          query = query.eq('invoice_number', parsed.preview_data.invoice_number);
        }

        const { data: invoice } = await query.single();

        if (invoice) {
          // Build full preview data
          parsed.preview_data = {
            invoice_id: invoice.id,
            invoice_number: invoice.invoice_number,
            customer_id: invoice.customer_id,
            customer_name: invoice.customer?.name,
            invoice_date: invoice.invoice_date,
            due_date: invoice.due_date,
            lines: invoice.lines.sort((a: any, b: any) => a.line_order - b.line_order),
            subtotal: invoice.subtotal,
            tax_amount: invoice.tax_amount || 0,
            discount_amount: invoice.discount_amount || 0,
            total_amount: invoice.total_amount,
            notes: invoice.notes || ''
          };
        }
      }

      // Save preview data
      await updateConversationContext(conversationId, userId, {
        pending_action: parsed.action,
        collected_data: parsed.preview_data,
        missing_fields: [],
        state: 'preview'
      });
      
      return new Response(JSON.stringify({
        type: 'preview',
        action: parsed.action,
        data: parsed.preview_data,
        response: parsed.response
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (parsed.mode === 'execute') {
      // Direct execution (user provided all info)
      const result = await executeAction(parsed.action, parsed.data, userId);
      await clearConversationContext(conversationId);
      
      return new Response(JSON.stringify({
        type: 'success',
        response: result.response,
        data: result.data
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Default: just a conversational response
    return new Response(JSON.stringify({
      type: 'message',
      response: aiResponse
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-accountant:', error);
    return new Response(JSON.stringify({ 
      type: 'error',
      error: error.message,
      response: "I apologize, but I encountered an error. Please try again."
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Helper Functions

async function loadConversationContext(conversationId: string, userId: string) {
  const { data, error } = await supabase
    .from('conversation_context')
      .select('*')
    .eq('conversation_id', conversationId)
      .eq('user_id', userId)
    .single();
    
  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    console.error('Error loading context:', error);
  }
  
  return data;
}

async function updateConversationContext(conversationId: string, userId: string, updates: any) {
  const { error } = await supabase
    .from('conversation_context')
    .upsert({
      conversation_id: conversationId,
      user_id: userId,
      ...updates,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'conversation_id'
    });
    
  if (error) {
    console.error('Error updating context:', error);
  }
}

async function clearConversationContext(conversationId: string) {
  const { error } = await supabase
    .from('conversation_context')
    .delete()
    .eq('conversation_id', conversationId);
    
  if (error) {
    console.error('Error clearing context:', error);
  }
}

async function loadRecentMessages(conversationId: string) {
  const { data } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(6);
    
  return (data || []).reverse();
}

async function loadUserData(userId: string) {
  const [accounts, customers, products] = await Promise.all([
    supabase.from('accounts').select('id, name, account_type, code').eq('user_id', userId).limit(10),
    supabase.from('customers').select('id, name, company_name, email').eq('user_id', userId).eq('is_active', true).limit(10),
    supabase.from('products').select('id, name, type, unit_price').eq('user_id', userId).eq('is_active', true).limit(10),
  ]);
  
  return {
    accounts: accounts.data || [],
    customers: customers.data || [],
    products: products.data || []
  };
}

function buildSystemPrompt(userData: any, context: any, messageHistory: any[]) {
  const historyText = messageHistory.map(m => `${m.role}: ${m.content}`).join('\n');
  
  const contextInfo = context ? `
# ACTIVE CONVERSATION CONTEXT
You are currently ${context.state === 'collecting' ? 'collecting information for' : 'showing preview for'}: ${context.pending_action}
Collected data so far: ${JSON.stringify(context.collected_data)}
Missing fields: ${context.missing_fields?.join(', ') || 'none'}
` : '';

  return `You are MUHASIB AI - An intelligent conversational accountant with MEMORY.

# CORE BEHAVIOR - MULTI-TURN CONVERSATIONS
You can have CONVERSATIONS with users. When creating invoices:

1. **COLLECTING MODE**: If user gives INCOMPLETE information
   - Acknowledge what you received
   - Ask for ONE or TWO missing fields (don't overwhelm)
   - Be conversational and friendly
   - REMEMBER previous messages
   
   Response format (JSON):
   {
     "mode": "collecting",
     "action": "CREATE_INVOICE",
     "collected": { "customer_id": "uuid", "amount": 500 },
     "missing": ["invoice_date", "due_date"],
     "response": "Great! I'll create an invoice for $500. When should it be dated and when is it due?"
   }

2. **PREVIEW MODE**: When you have ALL required fields
   - Show formatted preview
   - Ask for confirmation
   - User can edit or confirm
   
   Response format (JSON):
   {
     "mode": "preview",
     "action": "CREATE_INVOICE",
     "preview_data": {
  "customer_id": "uuid",
       "customer_name": "John Doe",
       "invoice_date": "2025-01-22",
       "due_date": "2025-02-21",
       "lines": [{"description": "Consulting", "quantity": 1, "unit_price": 500, "amount": 500}],
       "subtotal": 500,
       "tax_amount": 0,
       "total_amount": 500
     },
     "response": "Here's your invoice preview:\\n\\nCustomer: John Doe\\nDate: Jan 22, 2025\\nDue: Feb 21, 2025\\nAmount: $500.00 for Consulting\\nTotal: $500.00\\n\\nType 'confirm' to create this invoice."
   }

3. **EXECUTE MODE**: Only if user provides EVERYTHING upfront
   Same as preview but mode is "execute"

# INVOICE REQUIREMENTS

## Creating Invoices (CREATE_INVOICE)
Required fields:
- customer_id (must exist in customers list)
- invoice_date (format: YYYY-MM-DD)
- due_date (format: YYYY-MM-DD)
- lines: [{ description, quantity, unit_price, amount }]

Optional: tax_amount, discount_amount, notes

## Sending Invoices (SEND_INVOICE)
When user says "send invoice INV-001" or "mark invoice as sent":
{
  "mode": "execute",
  "action": "SEND_INVOICE",
  "data": {
    "invoice_number": "INV-001"
  }
}

## Listing Invoices (LIST_INVOICES)
When user asks "show my invoices" or "list draft invoices":
{
  "mode": "execute",
  "action": "LIST_INVOICES",
  "data": {
    "status": "draft", // optional: draft, sent, paid, overdue, void, or omit for all
    "customer_id": "uuid", // optional: filter by customer
    "customer_name": "ABC Corp" // optional: filter by customer name
  }
}

## Getting Invoice Details (GET_INVOICE)
When user asks "show invoice INV-001" or "get invoice details":
{
  "mode": "execute",
  "action": "GET_INVOICE",
  "data": {
    "invoice_number": "INV-001" // or "invoice_id": "uuid"
  }
}

## Editing Invoices (EDIT_INVOICE)
When user wants to edit an invoice, use preview mode similar to creation:
{
  "mode": "preview",
  "action": "EDIT_INVOICE",
  "preview_data": {
  "invoice_id": "uuid",
    "invoice_number": "INV-001",
    "customer_id": "uuid",
    "customer_name": "John Doe",
    "invoice_date": "2025-01-22",
    "due_date": "2025-02-21",
    "lines": [...],
    "subtotal": 500,
    "tax_amount": 0,
    "total_amount": 500,
    "notes": "..."
  },
  "response": "Here's the invoice to edit. Make your changes and confirm."
}

# EXAMPLE CONVERSATIONS

User: "Send invoice INV-001"
You: {"mode":"execute","action":"SEND_INVOICE","data":{"invoice_number":"INV-001"}}

User: "Show my draft invoices"
You: {"mode":"execute","action":"LIST_INVOICES","data":{"status":"draft"}}

User: "Show invoices for ABC Corp"
You: {"mode":"execute","action":"LIST_INVOICES","data":{"customer_name":"ABC Corp"}}

User: "Edit invoice INV-002"
You: {"mode":"preview","action":"EDIT_INVOICE","preview_data":{...full invoice data...}}

User: "What are the details of invoice INV-002?"
You: {"mode":"execute","action":"GET_INVOICE","data":{"invoice_number":"INV-002"}}

${contextInfo}

# USER'S DATA
Customers: ${JSON.stringify(userData.customers)}
Products: ${JSON.stringify(userData.products)}
Accounts: ${JSON.stringify(userData.accounts.map((a: any) => ({ id: a.id, name: a.name })))}

# RECENT CONVERSATION
${historyText}

# IMPORTANT RULES
- ALWAYS return valid JSON for invoice operations
- NEVER make up customer IDs - only use IDs from the list above
- If customer doesn't exist, ask user to create them first
- For dates: accept "today", "tomorrow", or specific dates
- Default due date: 30 days from invoice date if not specified
- Be conversational but return structured JSON
- REMEMBER what user told you in previous messages

# EXAMPLE CONVERSATIONS

User: "Create invoice for John"
You: {"mode":"collecting","action":"CREATE_INVOICE","collected":{"customer_id":"uuid-john"},"missing":["amount","invoice_date","due_date"],"response":"I'll create an invoice for John. What's the amount or what items should I include?"}

User: "$500 for consulting"
You: {"mode":"collecting","action":"CREATE_INVOICE","collected":{"customer_id":"uuid-john","lines":[{...}],"subtotal":500},"missing":["invoice_date","due_date"],"response":"Perfect! $500 for consulting. When should the invoice be dated and when is payment due?"}

User: "Today and due in 30 days"
You: {"mode":"preview","action":"CREATE_INVOICE","preview_data":{...},"response":"Here's your invoice preview..."}`;
}

async function callOpenRouter(systemPrompt: string, userMessage: string, model: string = 'meta-llama/llama-3.2-3b-instruct:free') {
  console.log('Using AI model:', model);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openRouterApiKey}`,
        'Content-Type': 'application/json',
      'HTTP-Referer': supabaseUrl,
        'X-Title': 'MUHASIB AI Accountant',
      },
      body: JSON.stringify({
      model: model,
        messages: [
          { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
      max_tokens: 1000,  // Reduced to conserve credits
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenRouter error:', errorData);
      
      // Handle credits exhausted error
      if (errorData.error?.code === 402 || errorData.error?.message?.includes('credits')) {
        throw new Error('AI credits exhausted. Please add your own OpenRouter API key or try a different model.');
      }
      
      throw new Error(`AI service error: ${errorData.error?.message || response.statusText}`);
    }

  const data = await response.json();
  return data.choices[0].message.content;
}

function parseAIResponse(aiResponse: string) {
  try {
    // Clean markdown code blocks if present
      let cleanResponse = aiResponse.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/\n?```$/g, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/```\n?/g, '').replace(/\n?```$/g, '');
      }
      
    const parsed = JSON.parse(cleanResponse);
    
    // Validate structure
    if (parsed.mode && parsed.action) {
      return parsed;
    }
    
    // If not structured, return as conversational
    return { mode: 'conversation', response: aiResponse };
    } catch (error) {
    console.log('Not JSON, treating as conversation:', error.message);
    return { mode: 'conversation', response: aiResponse };
  }
}

// ============================================================================
// DIRECT COMMAND PARSER
// Parses simple commands without needing AI (faster, no credits used)
// ============================================================================

/**
 * Parse direct commands that don't require AI
 * Returns null if AI is needed
 */
function parseDirectCommand(message: string): { action: string; data: any } | null {
  const msg = message.toLowerCase().trim();
  
  // SEND INVOICE commands
  const sendMatch = msg.match(/^(?:send|mark as sent)\s+invoice\s+(inv-\d+)$/i);
  if (sendMatch) {
    return {
      action: 'SEND_INVOICE',
      data: { invoice_number: sendMatch[1].toUpperCase() }
    };
  }
  
  // EDIT INVOICE commands
  const editMatch = msg.match(/^(?:edit|modify|update)\s+invoice\s+(inv-\d+)$/i);
  if (editMatch) {
    return {
      action: 'EDIT_INVOICE',
      data: { invoice_number: editMatch[1].toUpperCase() }
    };
  }
  
  // VIEW/SHOW INVOICE commands
  const viewMatch = msg.match(/^(?:show|view|get|display)\s+invoice\s+(inv-\d+)$/i);
  if (viewMatch) {
    return {
      action: 'GET_INVOICE',
      data: { invoice_number: viewMatch[1].toUpperCase() }
    };
  }
  
  // PAY INVOICE commands
  const payMatch = msg.match(/^(?:pay|mark as paid)\s+invoice\s+(inv-\d+)$/i);
  if (payMatch) {
    return {
      action: 'PAY_INVOICE',
      data: { invoice_number: payMatch[1].toUpperCase() }
    };
  }
  
  // LIST INVOICES commands
  if (msg.match(/^(?:show|list|display)\s+(?:my\s+)?(?:draft\s+)?invoices?$/)) {
    const isDraft = msg.includes('draft');
    return {
      action: 'LIST_INVOICES',
      data: isDraft ? { status: 'draft' } : {}
    };
  }
  
  if (msg.match(/^(?:show|list|display)\s+sent\s+invoices?$/)) {
    return {
      action: 'LIST_INVOICES',
      data: { status: 'sent' }
    };
  }
  
  if (msg.match(/^(?:show|list|display)\s+paid\s+invoices?$/)) {
    return {
      action: 'LIST_INVOICES',
      data: { status: 'paid' }
    };
  }
  
  // LIST INVOICES BY CUSTOMER
  const customerMatch = msg.match(/^(?:show|list|display)\s+invoices?\s+for\s+(.+)$/);
  if (customerMatch) {
    return {
      action: 'LIST_INVOICES',
      data: { customer_name: customerMatch[1].trim() }
    };
  }
  
  // Not a direct command, needs AI
  return null;
}

// ============================================================================
// BUSINESS LOGIC HELPERS - EXACT COPY FROM SERVICES
// These functions replicate the EXACT logic from the manual UI services
// to ensure 100% identical behavior and database records
// ============================================================================

/**
 * Create journal entry for invoice (Revenue Recognition)
 * Debit: Accounts Receivable (Asset +)
 * Credit: Revenue (Income +)
 * Credit: Sales Tax Payable (if tax)
 */
async function createJournalEntryForInvoice(userId: string, invoice: any) {
  try {
    // Get required accounts
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id, code, name, account_type')
      .eq('user_id', userId)
      .in('code', ['1200', '2100', '4000']);

    const arAccount = accounts?.find((a: any) => a.code === '1200'); // Accounts Receivable
    const taxPayableAccount = accounts?.find((a: any) => a.code === '2100'); // Sales Tax Payable
    const revenueAccount = accounts?.find((a: any) => a.code === '4000'); // Revenue

    if (!arAccount || !revenueAccount) {
      console.warn('Required accounts not found for journal entry');
      return null;
    }

    // Get invoice lines for detailed revenue entries
    const { data: invoiceLines } = await supabase
      .from('invoice_lines')
      .select('*, account:accounts(id, name)')
      .eq('invoice_id', invoice.id)
      .order('line_order');

    // Create journal entry
    const { data: journalEntry, error: jeError } = await supabase
      .from('journal_entries')
          .insert([{
            user_id: userId,
        entry_date: invoice.invoice_date,
        description: `Revenue recognition - ${invoice.invoice_number}`,
        status: 'posted',
        source_type: 'invoice',
        source_id: invoice.id,
        reference: invoice.invoice_number,
        notes: `Invoice to ${invoice.customer?.name || 'customer'}`
          }])
          .select()
          .single();

    if (jeError) {
      console.error('Journal entry creation failed:', jeError);
      return null;
    }

    // Build journal entry lines
    const journalLines: any[] = [];

    // DEBIT: Accounts Receivable (full invoice amount)
    journalLines.push({
      journal_entry_id: journalEntry.id,
      account_id: arAccount.id,
      debit: invoice.total_amount,
      credit: 0,
      description: `AR - ${invoice.invoice_number}`,
      entity_type: 'customer',
      entity_id: invoice.customer_id
    });

    // CREDIT: Revenue for each line item
    if (invoiceLines && invoiceLines.length > 0) {
      for (const line of invoiceLines) {
        const lineRevenueAccount = line.account || revenueAccount;
        journalLines.push({
          journal_entry_id: journalEntry.id,
          account_id: lineRevenueAccount.id,
          debit: 0,
          credit: line.amount,
          description: `Revenue - ${line.description}`,
          entity_type: 'customer',
          entity_id: invoice.customer_id
        });
      }
    } else {
      // No line items, use subtotal as revenue
      journalLines.push({
        journal_entry_id: journalEntry.id,
        account_id: revenueAccount.id,
        debit: 0,
        credit: invoice.subtotal,
        description: `Revenue - ${invoice.invoice_number}`,
        entity_type: 'customer',
        entity_id: invoice.customer_id
      });
    }

    // CREDIT: Sales Tax Payable (if applicable)
    if (invoice.tax_amount && invoice.tax_amount > 0 && taxPayableAccount) {
      journalLines.push({
        journal_entry_id: journalEntry.id,
        account_id: taxPayableAccount.id,
        debit: 0,
        credit: invoice.tax_amount,
        description: 'Sales tax collected',
        entity_type: 'customer',
        entity_id: invoice.customer_id
      });
    }

    // Insert journal entry lines
    const { error: linesError } = await supabase
      .from('journal_entry_lines')
      .insert(journalLines);

    if (linesError) {
      console.error('Journal entry lines creation failed:', linesError);
      // Delete the journal entry if lines failed
      await supabase.from('journal_entries').delete().eq('id', journalEntry.id);
      return null;
    }

    console.log('Journal entry created:', journalEntry.id);
    return journalEntry.id;
  } catch (error: any) {
    console.error('Error creating journal entry:', error);
    return null;
  }
}

/**
 * Update customer balance (Accounts Receivable)
 * EXACT COPY from CustomerService.calculateCustomerBalance
 */
async function updateCustomerBalance(customerId: string, userId: string) {
  try {
    // Get customer to ensure it exists
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('user_id')
      .eq('id', customerId)
      .single();

    if (customerError) {
      console.error('Customer not found:', customerError);
      return;
    }

    // Sum all outstanding invoice balances for this customer
    // IMPORTANT: Only include sent, partial, overdue, viewed - exclude draft and paid
    const { data: invoices, error: invError } = await supabase
      .from('invoices')
      .select('balance_due')
      .eq('customer_id', customerId)
      .eq('user_id', userId)
      .in('status', ['sent', 'partial', 'overdue', 'viewed']); // EXACT same as service

    if (invError) {
      console.error('Error fetching invoices for balance:', invError);
      return;
    }

    // Calculate balance from invoices
    const balance = invoices?.reduce((sum, inv) => sum + parseFloat(inv.balance_due.toString()), 0) || 0;

    // Update customer balance
    const { error: updateError } = await supabase
      .from('customers')
      .update({ 
        balance: balance,
        updated_at: new Date().toISOString()
      })
      .eq('id', customerId);

    if (updateError) {
      console.error('Error updating customer balance:', updateError);
      return;
    }

    console.log('Customer balance updated:', customerId, balance);
  } catch (error: any) {
    console.error('Error in updateCustomerBalance:', error);
  }
}

/**
 * Record stock movement for inventory tracking
 * EXACT COPY from StockMovementService.recordStockMovement
 */
async function recordStockMovement(data: {
  userId: string;
  productId: string;
  movementType: 'sale' | 'purchase' | 'adjustment' | 'return';
  quantity: number; // Positive for increases, negative for decreases
  unitCost: number;
  referenceType?: string;
  referenceId?: string;
  referenceNumber?: string;
  description?: string;
  movementDate: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const totalValue = Math.abs(data.quantity) * data.unitCost;
    const movementDate = data.movementDate || new Date().toISOString();

    // Insert stock movement record
    const { data: movement, error: movementError } = await supabase
      .from('stock_movements')
      .insert([{
        product_id: data.productId,
        movement_type: data.movementType,
        quantity: data.quantity,
        unit_cost: data.unitCost,
        total_value: totalValue,
        reference_type: data.referenceType,
        reference_id: data.referenceId,
        reference_number: data.referenceNumber,
        description: data.description,
        movement_date: movementDate,
        user_id: data.userId
      }])
      .select()
      .single();

    if (movementError) {
      console.error('Stock movement insert error:', movementError);
      return { success: false, error: movementError.message };
    }

    // Update product quantity
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('quantity_on_hand, name')
      .eq('id', data.productId)
      .single();

    if (productError) {
      console.error('Product fetch error:', productError);
      return { success: false, error: productError.message };
    }

    const newQuantity = (product.quantity_on_hand || 0) + data.quantity;

    const { error: updateError } = await supabase
      .from('products')
      .update({ quantity_on_hand: newQuantity })
      .eq('id', data.productId);

    if (updateError) {
      console.error('Product quantity update error:', updateError);
      return { success: false, error: updateError.message };
    }

    console.log(`Stock movement recorded successfully: Product ${product.name}, Movement: ${data.quantity}, New quantity: ${newQuantity}`);
    return { success: true };
  } catch (error: any) {
    console.error('Error recording stock movement:', error);
    return { success: false, error: error.message || 'Failed to record stock movement' };
  }
}

/**
 * Record Cost of Goods Sold (COGS) for a product item
 * EXACT COPY from InventoryService.recordCostOfGoodsSold
 */
async function recordCostOfGoodsSold(
  userId: string,
  data: {
    product_id: string;
    quantity: number;
    unit_cost: number;
    total_cost: number;
    sale_date: string;
    invoice_id?: string;
    reference?: string;
  }
) {
  try {
    // Get required accounts
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id, code, name')
      .eq('user_id', userId)
      .in('code', ['1300', '5000']); // Inventory, COGS

    const inventoryAccount = accounts?.find((a: any) => a.code === '1300');
    const cogsAccount = accounts?.find((a: any) => a.code === '5000');

    if (!inventoryAccount || !cogsAccount) {
      console.error('Required accounts not found. Please ensure Inventory (1300) and COGS (5000) exist.');
      return;
    }

    // Check if sufficient inventory (don't update here - StockMovementService will update)
    const { data: product } = await supabase
      .from('products')
      .select('quantity_on_hand, name')
      .eq('id', data.product_id)
      .single();

    if (product) {
      const newQuantity = (product.quantity_on_hand || 0) - data.quantity;
      if (newQuantity < 0) {
        console.warn(`Insufficient inventory for product ${data.product_id}. Available: ${product.quantity_on_hand}, Requested: ${data.quantity}`);
        // Continue anyway - negative inventory allowed in some businesses
      }
    }

    // Get customer name for stock movement description
    let customerName = 'Customer';
    if (data.invoice_id) {
      const { data: invoiceData } = await supabase
        .from('invoices')
        .select(`
          invoice_number,
          customer:customers(name)
        `)
        .eq('id', data.invoice_id)
        .single();

      if (invoiceData && invoiceData.customer) {
        customerName = invoiceData.customer.name;
      }
    }

    // Record stock movement (sale) - EXACT same as service
    await recordStockMovement({
      userId: userId,
      productId: data.product_id,
      movementType: 'sale',
      quantity: -data.quantity, // Negative for sale
      unitCost: data.unit_cost,
      referenceType: 'invoice',
      referenceId: data.invoice_id,
      referenceNumber: data.reference,
      description: `Sold to ${customerName}`,
      movementDate: data.sale_date
    });

    // Create journal entry for COGS - EXACT same as service
    // Generate entry number
    const { count } = await supabase
      .from('journal_entries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    
    const entryNumber = `JE-${String((count || 0) + 1).padStart(5, '0')}`;

    const { data: journalEntry, error: jeError } = await supabase
      .from('journal_entries')
      .insert([{
        user_id: userId,
        entry_number: entryNumber,
        entry_date: data.sale_date,
        reference: data.reference || `COGS-${data.product_id}`,
        description: `Cost of goods sold - ${product?.name || 'Product'}`,
        status: 'posted',
        source_type: data.invoice_id ? 'invoice' : undefined,
        source_id: data.invoice_id,
        notes: `Product ID: ${data.product_id}\nQuantity: ${data.quantity}\nUnit Cost: $${data.unit_cost}`,
        total_debits: data.total_cost,
        total_credits: data.total_cost
      }])
      .select()
      .single();

    if (jeError) {
      console.error('COGS journal entry creation failed:', jeError);
      return;
    }

    // Create journal entry lines
    const { error: linesError } = await supabase
      .from('journal_entry_lines')
      .insert([
        {
          journal_entry_id: journalEntry.id,
          account_id: cogsAccount.id,
          debit: data.total_cost,
          credit: 0,
          description: 'Cost of goods sold',
          entity_type: 'product',
          entity_id: data.product_id
        },
        {
          journal_entry_id: journalEntry.id,
          account_id: inventoryAccount.id,
          debit: 0,
          credit: data.total_cost,
          description: 'Inventory reduced',
          entity_type: 'product',
          entity_id: data.product_id
        }
      ]);

    if (linesError) {
      console.error('COGS journal entry lines creation failed:', linesError);
      // Delete the journal entry if lines failed
      await supabase.from('journal_entries').delete().eq('id', journalEntry.id);
      return;
    }

    console.log(`COGS recorded: ${data.quantity} units removed from inventory, total cost: $${data.total_cost}`);
  } catch (error: any) {
    console.error('Error recording COGS:', error);
  }
}

/**
 * Create transaction record for audit trail
 */
async function createTransactionRecord(userId: string, invoice: any) {
  try {
    // Get Accounts Receivable account
    const { data: arAccount } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', userId)
      .eq('code', '1200')
          .single();

    if (!arAccount) {
      console.warn('Accounts Receivable account not found for transaction');
      return;
    }

    // Create transaction record
    await supabase.from('transactions').insert([{
      user_id: userId,
      account_id: arAccount.id,
      customer_id: invoice.customer_id,
      description: `Invoice ${invoice.invoice_number} - ${invoice.customer?.name || 'Customer'}`,
      amount: invoice.total_amount,
      transaction_date: invoice.invoice_date,
      transaction_type: 'invoice',
      reference_id: invoice.id,
      reference_number: invoice.invoice_number,
      status: 'posted',
      notes: invoice.notes
    }]);

    console.log('Transaction record created');
  } catch (error: any) {
    console.error('Error creating transaction record:', error);
  }
}

// ============================================================================
// ACTION EXECUTION
// ============================================================================

async function executeAction(action: string, data: any, userId: string) {
  console.log('Executing action:', action, data);
  
  if (action === 'CREATE_INVOICE') {
        // Generate invoice number
    const { data: lastInvoice } = await supabase
      .from('invoices')
      .select('invoice_number')
          .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
          .single();

    let invoiceNumber = 'INV-001';
    if (lastInvoice?.invoice_number) {
      const lastNum = parseInt(lastInvoice.invoice_number.split('-')[1] || '0');
      invoiceNumber = `INV-${String(lastNum + 1).padStart(3, '0')}`;
    }
        
        // Calculate totals (SAME AS SALES ORDER - line-level tax and discount)
    const subtotal = data.lines.reduce((sum: number, line: any) => {
      const qty = line.quantity || 1;
      const price = line.unit_price;
      const discount = line.discount_percent || 0;
      
      const lineSubtotal = qty * price;
      const discountAmount = lineSubtotal * (discount / 100);
      const taxableAmount = lineSubtotal - discountAmount;
      
      return sum + taxableAmount;
    }, 0);
    
    const tax_amount = data.lines.reduce((sum: number, line: any) => {
      const qty = line.quantity || 1;
      const price = line.unit_price;
      const discount = line.discount_percent || 0;
      const tax = line.tax_rate || 0;
      
      const lineSubtotal = qty * price;
      const discountAmount = lineSubtotal * (discount / 100);
      const taxableAmount = lineSubtotal - discountAmount;
      const lineTax = taxableAmount * (tax / 100);
      
      return sum + lineTax;
    }, 0);
    
    const discount_amount = 0; // No invoice-level discount (line-level only)
    const total_amount = subtotal + tax_amount;
        
        // Create invoice
    const { data: invoice, error: invoiceError } = await supabase
          .from('invoices')
          .insert([{
            user_id: userId,
            customer_id: data.customer_id,
        invoice_number: invoiceNumber,
        invoice_date: data.invoice_date,
            due_date: data.due_date,
            status: 'draft',
        subtotal: subtotal,
        tax_amount: tax_amount,
        discount_amount: discount_amount,
        total_amount: total_amount,
        balance_due: total_amount,
            notes: data.notes || ''
          }])
          .select()
          .single();

    if (invoiceError) {
      console.error('Invoice creation error:', invoiceError);
      throw new Error(`Failed to create invoice: ${invoiceError.message}`);
    }

        // Create invoice lines (calculate amount with tax included)
    const lines = data.lines.map((line: any, index: number) => {
      const qty = line.quantity || 1;
      const price = line.unit_price;
      const discount = line.discount_percent || 0;
      const tax = line.tax_rate || 0;
      
      const lineSubtotal = qty * price;
      const discountAmount = lineSubtotal * (discount / 100);
      const taxableAmount = lineSubtotal - discountAmount;
      const lineTax = taxableAmount * (tax / 100);
      const amount = taxableAmount + lineTax;
      
      return {
        invoice_id: invoice.id,
        description: line.description,
        quantity: qty,
        unit_price: price,
        discount_percent: discount,
        tax_rate: tax,
        amount: amount,
        account_id: line.account_id,
        line_order: index
      };
    });

        const { error: linesError } = await supabase
          .from('invoice_lines')
      .insert(lines);

    if (linesError) {
      console.error('Invoice lines error:', linesError);
      throw new Error(`Failed to create invoice lines: ${linesError.message}`);
    }

    console.log('Invoice created:', invoiceNumber);

        return {
      response: `✅ Invoice ${invoiceNumber} created successfully! Total: $${total_amount.toFixed(2)}. The invoice is in draft status. Send it to record in your books.`,
      data: invoice
    };
  }

  if (action === 'EDIT_INVOICE') {
    // Find invoice
    let invoice;
    if (data.invoice_id) {
      const { data: inv } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', data.invoice_id)
        .eq('user_id', userId)
        .single();
      invoice = inv;
    } else if (data.invoice_number) {
      const { data: inv } = await supabase
        .from('invoices')
        .select('*')
        .eq('invoice_number', data.invoice_number)
        .eq('user_id', userId)
        .single();
      invoice = inv;
    }

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    // Calculate new totals (SAME AS SALES ORDER - line-level tax and discount)
    const subtotal = data.lines.reduce((sum: number, line: any) => {
      const qty = line.quantity || 1;
      const price = line.unit_price;
      const discount = line.discount_percent || 0;
      
      const lineSubtotal = qty * price;
      const discountAmount = lineSubtotal * (discount / 100);
      const taxableAmount = lineSubtotal - discountAmount;
      
      return sum + taxableAmount;
    }, 0);
    
    const tax_amount = data.lines.reduce((sum: number, line: any) => {
      const qty = line.quantity || 1;
      const price = line.unit_price;
      const discount = line.discount_percent || 0;
      const tax = line.tax_rate || 0;
      
      const lineSubtotal = qty * price;
      const discountAmount = lineSubtotal * (discount / 100);
      const taxableAmount = lineSubtotal - discountAmount;
      const lineTax = taxableAmount * (tax / 100);
      
      return sum + lineTax;
    }, 0);
    
    const discount_amount = 0; // No invoice-level discount (line-level only)
    const total_amount = subtotal + tax_amount;

    // Update invoice
    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        customer_id: data.customer_id || invoice.customer_id,
        invoice_date: data.invoice_date || invoice.invoice_date,
        due_date: data.due_date || invoice.due_date,
        subtotal: subtotal,
        tax_amount: tax_amount,
        discount_amount: discount_amount,
        total_amount: total_amount,
        balance_due: total_amount - (invoice.amount_paid || 0),
        notes: data.notes !== undefined ? data.notes : invoice.notes
      })
      .eq('id', invoice.id);

    if (updateError) {
      throw new Error(`Failed to update invoice: ${updateError.message}`);
    }

    // Update invoice lines if provided
    if (data.lines && data.lines.length > 0) {
      // Delete old lines
      await supabase
        .from('invoice_lines')
        .delete()
        .eq('invoice_id', invoice.id);

      // Create new lines (calculate amount with tax included)
      const lines = data.lines.map((line: any, index: number) => {
        const qty = line.quantity || 1;
        const price = line.unit_price;
        const discount = line.discount_percent || 0;
        const tax = line.tax_rate || 0;
        
        const lineSubtotal = qty * price;
        const discountAmount = lineSubtotal * (discount / 100);
        const taxableAmount = lineSubtotal - discountAmount;
        const lineTax = taxableAmount * (tax / 100);
        const amount = taxableAmount + lineTax;
        
        return {
          invoice_id: invoice.id,
          description: line.description,
          quantity: qty,
          unit_price: price,
          discount_percent: discount,
          tax_rate: tax,
          amount: amount,
          account_id: line.account_id,
          line_order: index
        };
      });

      const { error: linesError } = await supabase
        .from('invoice_lines')
        .insert(lines);

      if (linesError) {
        throw new Error(`Failed to update invoice lines: ${linesError.message}`);
      }
    }

    // BUSINESS LOGIC: Update customer balance if invoice was already sent/paid
    if (invoice.status === 'sent' || invoice.status === 'paid' || invoice.status === 'partial') {
      await updateCustomerBalance(invoice.customer_id, userId);
    }

    console.log('Invoice updated:', invoice.invoice_number);

        return {
      response: `✅ Invoice ${invoice.invoice_number} updated successfully! New total: $${total_amount.toFixed(2)}.${invoice.status !== 'draft' ? ' Customer balance updated.' : ''}`,
      data: { ...invoice, total_amount }
    };
  }
  
  if (action === 'SEND_INVOICE') {
    // EXACT COPY from InvoiceService.sendInvoice - fetch with lines
    let invoice;
    if (data.invoice_id) {
      const { data: inv, error: fetchError } = await supabase
        .from('invoices')
        .select('*, customer:customers(name), lines:invoice_lines(*)')
        .eq('id', data.invoice_id)
        .eq('user_id', userId)
        .single();
      
      if (fetchError) throw fetchError;
      invoice = inv;
    } else if (data.invoice_number) {
      const { data: inv, error: fetchError } = await supabase
        .from('invoices')
        .select('*, customer:customers(name), lines:invoice_lines(*)')
        .eq('invoice_number', data.invoice_number)
        .eq('user_id', userId)
        .single();
      
      if (fetchError) throw fetchError;
      invoice = inv;
    }

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (invoice.status === 'sent' || invoice.status === 'paid') {
        return {
        response: `Invoice ${invoice.invoice_number} has already been ${invoice.status === 'paid' ? 'paid' : `sent on ${new Date(invoice.sent_at).toLocaleDateString()}`}.`
      };
    }

    // Skip quotations
    const isQuotation = invoice.document_type === 'quotation';

    // BUSINESS LOGIC: Create journal entry when sending invoice (not for quotations)
    let journalEntryId = invoice.journal_entry_id;
    if (!journalEntryId && !isQuotation) {
      console.log('Creating journal entry for invoice:', invoice.invoice_number);
      journalEntryId = await createJournalEntryForInvoice(userId, invoice);
      
      if (journalEntryId) {
        // Link journal entry to invoice
        await supabase
          .from('invoices')
          .update({ journal_entry_id: journalEntryId })
          .eq('id', invoice.id);
      }
    }

    // Update status and ensure balance_due is correct (EXACT COPY from service)
    const updateData: any = {
      status: 'sent',
      sent_at: new Date().toISOString()
    };

    // For invoices (not quotations), ensure balance_due is set correctly
    if (!isQuotation) {
      // balance_due should be total_amount - amount_paid
      updateData.balance_due = invoice.total_amount - (invoice.amount_paid || 0);
    }

    const { error: updateError } = await supabase
      .from('invoices')
      .update(updateData)
      .eq('id', invoice.id);

    if (updateError) {
      throw new Error(`Failed to send invoice: ${updateError.message}`);
    }

    // BUSINESS LOGIC: Record COGS for product items (EXACT COPY from service)
    // Process each line individually like InvoiceService.sendInvoice does
    if (!isQuotation && invoice.lines && invoice.lines.length > 0) {
      for (const line of invoice.lines) {
        if (line.product_id) {
          // Get product details to check if it's a tracked inventory item
          const { data: product } = await supabase
            .from('products')
            .select('type, track_inventory, cost')
            .eq('id', line.product_id)
            .single();

          if (product && product.type === 'product' && product.track_inventory) {
            // Record COGS and reduce inventory - EXACT same parameters as service
            const cost = product.cost || 0;
            const totalCost = line.quantity * cost;

            await recordCostOfGoodsSold(
              userId,
              {
                product_id: line.product_id,
                quantity: line.quantity,
                unit_cost: cost,
                total_cost: totalCost,
                sale_date: invoice.invoice_date,
                invoice_id: invoice.id,
                reference: `${invoice.invoice_number}-${line.product_id}`
              }
            );
          }
        }
      }
    }

    // BUSINESS LOGIC: Update customer balance
    await updateCustomerBalance(invoice.customer_id, userId);

    // BUSINESS LOGIC: Create transaction record
    if (!isQuotation) {
      await createTransactionRecord(userId, invoice);
    }

    console.log('Invoice sent with full accounting:', invoice.invoice_number);

        return {
      response: `✅ Invoice ${invoice.invoice_number} has been sent and properly recorded in your books! Journal entry created, customer balance updated.`,
      data: { 
        invoice_number: invoice.invoice_number, 
        sent_at: new Date().toISOString(),
        journal_entry_created: !!journalEntryId 
      }
    };
  }

  if (action === 'PAY_INVOICE') {
    // Find invoice by number or ID
    let invoice;
    if (data.invoice_id) {
      const { data: inv } = await supabase
        .from('invoices')
        .select('*, customer:customers(name)')
        .eq('id', data.invoice_id)
        .eq('user_id', userId)
        .single();
      invoice = inv;
    } else if (data.invoice_number) {
      const { data: inv } = await supabase
        .from('invoices')
        .select('*, customer:customers(name)')
        .eq('invoice_number', data.invoice_number)
        .eq('user_id', userId)
        .single();
      invoice = inv;
    }

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (invoice.status === 'paid') {
      return {
        response: `Invoice ${invoice.invoice_number} is already paid.`
      };
    }

    if (invoice.status === 'draft') {
      return {
        response: `Invoice ${invoice.invoice_number} is still a draft. Please send it first before recording payment.`
      };
    }

    // Use specified payment amount or full balance_due
    const paymentAmount = data.amount || invoice.balance_due;

    if (paymentAmount > invoice.balance_due) {
      throw new Error(`Payment amount ($${paymentAmount}) exceeds balance due ($${invoice.balance_due})`);
    }

    if (paymentAmount <= 0) {
      throw new Error('Payment amount must be positive');
    }

    // Get payment date
    const paymentDate = data.payment_date || new Date().toISOString().split('T')[0];

    // Calculate new balances
    const newBalanceDue = invoice.balance_due - paymentAmount;
    const newStatus = newBalanceDue === 0 ? 'paid' : 'partial';

    // Update invoice
    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        balance_due: newBalanceDue,
        status: newStatus,
        paid_at: newStatus === 'paid' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', invoice.id);

    if (updateError) {
      throw new Error(`Failed to update invoice: ${updateError.message}`);
    }

    // BUSINESS LOGIC: Create payment journal entry
    // Get required accounts
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id, code, name')
      .eq('user_id', userId)
      .in('code', ['1010', '1200']); // Bank Account, Accounts Receivable

    const bankAccount = accounts?.find((a: any) => a.code === '1010');
    const arAccount = accounts?.find((a: any) => a.code === '1200');

    if (bankAccount && arAccount) {
      // Create payment journal entry
      const { data: paymentJE } = await supabase
        .from('journal_entries')
        .insert([{
          user_id: userId,
          entry_date: paymentDate,
          description: `Payment received - ${invoice.invoice_number}`,
          status: 'posted',
          source_type: 'payment',
          source_id: invoice.id,
          reference: invoice.invoice_number
        }])
        .select()
        .single();

      if (paymentJE) {
        // DEBIT: Bank Account (Asset +)
        // CREDIT: Accounts Receivable (Asset -)
        await supabase.from('journal_entry_lines').insert([
          {
            journal_entry_id: paymentJE.id,
            account_id: bankAccount.id,
            debit: paymentAmount,
            credit: 0,
            description: `Payment from ${invoice.customer?.name || 'Customer'}`,
            entity_type: 'customer',
            entity_id: invoice.customer_id
          },
          {
            journal_entry_id: paymentJE.id,
            account_id: arAccount.id,
            debit: 0,
            credit: paymentAmount,
            description: `Payment for ${invoice.invoice_number}`,
            entity_type: 'customer',
            entity_id: invoice.customer_id
          }
        ]);

        console.log('Payment journal entry created:', paymentJE.id);
      }
    }

    // BUSINESS LOGIC: Update customer balance
    await updateCustomerBalance(invoice.customer_id, userId);

    // Create payment record (optional - for better tracking)
    const { data: payment } = await supabase
      .from('payments')
      .insert([{
        user_id: userId,
        customer_id: invoice.customer_id,
        payment_type: 'invoice_payment',
        payment_date: paymentDate,
        amount: paymentAmount,
        payment_method: data.payment_method || 'bank_transfer',
        reference_number: data.reference_number || invoice.invoice_number,
        notes: data.notes || `Payment for ${invoice.invoice_number}`,
        status: 'completed'
      }])
      .select()
      .single();

    // Link payment to invoice
    if (payment) {
      await supabase
        .from('payment_applications')
        .insert([{
          payment_id: payment.id,
          invoice_id: invoice.id,
          amount_applied: paymentAmount
        }]);
    }

    console.log('Payment recorded with full accounting:', invoice.invoice_number, paymentAmount);

    return {
      response: `✅ Payment of $${paymentAmount.toFixed(2)} recorded for invoice ${invoice.invoice_number}! ${newStatus === 'paid' ? 'Invoice is now fully paid.' : `Remaining balance: $${newBalanceDue.toFixed(2)}`} Journal entry created, customer balance updated.`,
      data: { 
        invoice_number: invoice.invoice_number,
        payment_amount: paymentAmount,
        balance_due: newBalanceDue,
        status: newStatus,
        payment_date: paymentDate
      }
    };
  }

  if (action === 'LIST_INVOICES') {
    let query = supabase
          .from('invoices')
          .select('*, customer:customers(name)')
          .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    // Filter by status if provided
    if (data.status) {
      query = query.eq('status', data.status);
    }

    // Filter by customer if provided
    if (data.customer_id) {
      query = query.eq('customer_id', data.customer_id);
    } else if (data.customer_name) {
      // Find customer by name first
      const { data: customer } = await supabase
        .from('customers')
        .select('id')
          .eq('user_id', userId)
        .ilike('name', `%${data.customer_name}%`)
        .limit(1)
        .single();
      
      if (customer) {
        query = query.eq('customer_id', customer.id);
      }
    }

    const { data: invoices, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch invoices: ${error.message}`);
    }

    if (!invoices || invoices.length === 0) {
      const filterDesc = data.customer_name 
        ? ` for ${data.customer_name}`
        : data.status 
          ? ` with status ${data.status}`
          : '';
        return {
        response: `No invoices found${filterDesc}. ${!data.customer_name && !data.status ? 'Create your first invoice to get started!' : ''}`
      };
    }

    const invoiceList = invoices.map(inv => 
      `📄 ${inv.invoice_number} - ${inv.customer?.name || 'Unknown'} - $${inv.total_amount.toFixed(2)} - ${inv.status}`
    ).join('\n');

    const filterTitle = data.customer_name 
      ? `Invoices for ${data.customer_name}`
      : data.status 
        ? `${data.status.charAt(0).toUpperCase() + data.status.slice(1)} Invoices`
        : 'All Invoices';

        return {
      response: `${filterTitle}:\n\n${invoiceList}\n\n💡 You can send, edit, or view details of any invoice.`,
      data: invoices
    };
  }

  if (action === 'GET_INVOICE') {
    let invoice;
    if (data.invoice_id) {
      const { data: inv } = await supabase
          .from('invoices')
        .select('*, customer:customers(name, email), lines:invoice_lines(*)')
          .eq('id', data.invoice_id)
          .eq('user_id', userId)
        .single();
      invoice = inv;
    } else if (data.invoice_number) {
      const { data: inv } = await supabase
        .from('invoices')
        .select('*, customer:customers(name, email), lines:invoice_lines(*)')
        .eq('invoice_number', data.invoice_number)
          .eq('user_id', userId)
        .single();
      invoice = inv;
    }

    if (!invoice) {
        return {
        response: `Invoice ${data.invoice_number || data.invoice_id} not found.`
      };
    }

    const lineItems = invoice.lines.map((line: any) => 
      `• ${line.description}: ${line.quantity} × $${line.unit_price} = $${line.amount.toFixed(2)}`
    ).join('\n');

        return {
      response: `📄 Invoice ${invoice.invoice_number}\n\n` +
        `Customer: ${invoice.customer?.name || 'Unknown'}\n` +
        `Date: ${new Date(invoice.invoice_date).toLocaleDateString()}\n` +
        `Due: ${new Date(invoice.due_date).toLocaleDateString()}\n` +
        `Status: ${invoice.status}\n\n` +
        `Items:\n${lineItems}\n\n` +
        `Subtotal: $${invoice.subtotal.toFixed(2)}\n` +
        (invoice.tax_amount ? `Tax: $${invoice.tax_amount.toFixed(2)}\n` : '') +
        `Total: $${invoice.total_amount.toFixed(2)}\n` +
        `Balance Due: $${invoice.balance_due.toFixed(2)}`,
      data: invoice
    };
  }
  
  throw new Error(`Unknown action: ${action}`);
}
