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
      max_tokens: 2000,
    }),
  });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
    console.error('OpenRouter error:', errorData);
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
        
        // Calculate totals
    const subtotal = data.subtotal || data.lines.reduce((sum: number, line: any) => sum + line.amount, 0);
    const tax_amount = data.tax_amount || 0;
    const discount_amount = data.discount_amount || 0;
    const total_amount = subtotal + tax_amount - discount_amount;
        
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

        // Create invoice lines
    const lines = data.lines.map((line: any, index: number) => ({
      invoice_id: invoice.id,
          description: line.description,
          quantity: line.quantity || 1,
          unit_price: line.unit_price,
          amount: line.amount,
          line_order: index
        }));

        const { error: linesError } = await supabase
          .from('invoice_lines')
      .insert(lines);

    if (linesError) {
      console.error('Invoice lines error:', linesError);
      throw new Error(`Failed to create invoice lines: ${linesError.message}`);
    }

    return {
      response: `✅ Invoice ${invoiceNumber} created successfully! Total: $${total_amount.toFixed(2)}. The invoice is in draft status.`,
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

    // Calculate new totals
    const subtotal = data.subtotal || data.lines.reduce((sum: number, line: any) => sum + line.amount, 0);
    const tax_amount = data.tax_amount !== undefined ? data.tax_amount : invoice.tax_amount;
    const discount_amount = data.discount_amount !== undefined ? data.discount_amount : invoice.discount_amount;
    const total_amount = subtotal + tax_amount - discount_amount;

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

      // Create new lines
      const lines = data.lines.map((line: any, index: number) => ({
        invoice_id: invoice.id,
        description: line.description,
        quantity: line.quantity || 1,
        unit_price: line.unit_price,
        amount: line.amount,
        line_order: index
      }));

      const { error: linesError } = await supabase
        .from('invoice_lines')
        .insert(lines);

      if (linesError) {
        throw new Error(`Failed to update invoice lines: ${linesError.message}`);
      }
    }

    return {
      response: `✅ Invoice ${invoice.invoice_number} updated successfully! New total: $${total_amount.toFixed(2)}.`,
      data: { ...invoice, total_amount }
    };
  }
  
  if (action === 'SEND_INVOICE') {
    // Find invoice by number or ID
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

    if (invoice.status === 'sent') {
      return {
        response: `Invoice ${invoice.invoice_number} has already been sent on ${new Date(invoice.sent_at).toLocaleDateString()}.`
      };
    }

    // Update invoice status to sent
    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString()
      })
      .eq('id', invoice.id);

    if (updateError) {
      throw new Error(`Failed to send invoice: ${updateError.message}`);
    }

    return {
      response: `✅ Invoice ${invoice.invoice_number} has been marked as sent! The customer should receive it shortly.`,
      data: { invoice_number: invoice.invoice_number, sent_at: new Date().toISOString() }
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
