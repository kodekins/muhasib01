# 🔧 Database Schema Errors - Quick Fix Guide

## 🚨 Problem

Your services are trying to access tables that don't exist in your database yet because the migrations haven't been applied.

## ✅ Solution

You need to apply the migrations to your Supabase database.

## 📋 Steps to Fix

### Step 1: Check Current Database State

```bash
# See which migrations have been applied
supabase migration list
```

### Step 2: Apply Missing Migrations

```bash
# Option A: Apply all pending migrations
supabase db push

# Option B: Apply specific migrations
supabase migration up
```

### Step 3: Verify Tables Were Created

```bash
# Connect to database and check
supabase db diff

# Or check in Supabase Dashboard:
# Go to: Database → Tables
# You should see:
# - invoices
# - invoice_lines
# - bills
# - bill_lines
# - products
# - journal_entries
# - journal_entry_lines
# - payments
# etc.
```

## 🎯 Required Migrations

You need to apply these two migrations:

### 1. Base Schema
**File**: `supabase/migrations/20250118000000_clean_schema_with_user_setup.sql`

Creates:
- profiles
- conversations
- messages
- accounts
- categories
- transactions
- attachments
- budgets
- customers
- vendors

### 2. Full Bookkeeping System
**File**: `supabase/migrations/20250118100000_full_bookkeeping_system.sql`

Creates:
- invoices
- invoice_lines
- bills
- bill_lines
- products
- journal_entries
- journal_entry_lines
- payments
- bank_accounts
- estimates
- tax_rates
- reconciliations
- attachments (extended)

## 🔍 Errors You're Seeing & Why

### Error 1: "Could not find the table 'public.transactions'"
**Cause**: Base migration not applied  
**Fix**: Apply `20250118000000_clean_schema_with_user_setup.sql`

### Error 2: "Could not find relationship between 'invoices' and 'invoice_lines'"
**Cause**: Full bookkeeping migration not applied  
**Fix**: Apply `20250118100000_full_bookkeeping_system.sql`

### Error 3: "Could not find the function public.get_next_invoice_number"
**Cause**: Services use application logic, not database functions  
**Fix**: This is actually correct! Services generate numbers in JS, not SQL

### Error 4: "Could not find the 'amount_paid' column"
**Cause**: Migration not applied (column exists in migration)  
**Fix**: Apply migrations

### Error 5: Product foreign key errors
**Cause**: Products table doesn't exist yet  
**Fix**: Apply full bookkeeping migration

## 🚀 Quick Fix Command

Run this in your terminal (in project root):

```bash
# Make sure you're logged in to Supabase
supabase login

# Link to your project (if not already)
supabase link --project-ref your-project-ref

# Apply all migrations
supabase db push

# Verify
supabase db diff
```

## 🔐 Alternative: Use Supabase Dashboard

If CLI doesn't work:

1. Go to Supabase Dashboard
2. Navigate to: **SQL Editor**
3. Create a new query
4. Copy the entire contents of `20250118000000_clean_schema_with_user_setup.sql`
5. Run it
6. Then copy and run `20250118100000_full_bookkeeping_system.sql`

## ⚠️ Important Notes

### Migration Order Matters!
Run them in this order:
1. ✅ First: `20250118000000_clean_schema_with_user_setup.sql`
2. ✅ Then: `20250118100000_full_bookkeeping_system.sql`

### Don't Worry About Old Migrations
The old migrations in your `migrations/` folder are superseded by the new clean ones:
- `20250915*.sql` - OLD (ignore)
- `20250916*.sql` - OLD (ignore)
- `20250917*.sql` - OLD (ignore)
- `20250118*.sql` - NEW (apply these)

## 🧪 After Migration - Test

Once migrations are applied, refresh your app and you should see:

✅ Dashboard loads without errors  
✅ Invoices tab works  
✅ Bills tab works  
✅ Products tab works  
✅ Journal tab works  
✅ Reports tab works  
✅ No more 404 or relationship errors  

## 🎯 Check Your Tables

After migration, you should have these tables in Supabase:

### Base Tables (Migration 1)
- [x] profiles
- [x] conversations
- [x] messages
- [x] accounts
- [x] categories
- [x] transactions
- [x] attachments
- [x] budgets
- [x] customers
- [x] vendors

### Bookkeeping Tables (Migration 2)
- [x] invoices
- [x] invoice_lines
- [x] bills
- [x] bill_lines
- [x] products
- [x] journal_entries
- [x] journal_entry_lines
- [x] payments
- [x] bank_accounts
- [x] estimates
- [x] tax_rates
- [x] reconciliations

**Total: 22 tables** for full bookkeeping

## 💡 Why This Happened

The migrations exist in your code but haven't been applied to your Supabase database yet. It's like having a blueprint (migration files) but the house (database tables) hasn't been built yet.

## 🆘 If Migrations Fail

If you get errors when running migrations:

### Error: "relation already exists"
```bash
# Some tables exist from old migrations
# Solution: Drop old tables first (CAREFUL!)
# OR: Skip conflicting parts manually
```

### Error: "permission denied"
```bash
# Make sure you're authenticated
supabase login

# Make sure you're linked to the right project
supabase link
```

### Error: "connection refused"
```bash
# Start local Supabase (if using local dev)
supabase start

# OR: Make sure you're targeting remote
supabase link --project-ref YOUR_REF
```

## 📞 Need Help?

Run these commands and share output:

```bash
# Check current state
supabase migration list
supabase status
supabase projects list

# Try to apply
supabase db push --dry-run
```

---

## ✅ Success Checklist

After running migrations:

- [ ] Run `supabase db push`
- [ ] Check Supabase Dashboard → Database → Tables
- [ ] See 22+ tables listed
- [ ] Refresh your app
- [ ] No more 404 errors
- [ ] All tabs load correctly
- [ ] Can create invoices
- [ ] Can create bills
- [ ] Can add products

**Once complete, your app will work perfectly!** 🎉

