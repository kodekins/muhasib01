# Install Opening Balance Feature

## 📦 Installation Steps

### Step 1: Apply Database Migration

Run the migration to add opening balance columns to your database:

```bash
npx supabase db push
```

Or if you're using Supabase CLI:

```bash
supabase db push
```

Or manually apply the migration:

```bash
psql -h your-host -U your-user -d your-db -f supabase/migrations/20250121000000_add_opening_balance.sql
```

### Step 2: Verify Migration

Check that the columns were added:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'accounts' 
  AND column_name LIKE 'opening_balance%';
```

Expected output:
```
column_name                  | data_type
----------------------------+----------
opening_balance             | numeric
opening_balance_date        | date
opening_balance_recorded    | boolean
opening_balance_entry_id    | uuid
```

### Step 3: Restart Application (if needed)

If your application is already running, restart it to pick up the TypeScript type changes:

```bash
# If using npm
npm run dev

# If using bun
bun run dev
```

### Step 4: Test the Feature

1. Go to **Accounting → Accounts**
2. Click **"New Account"**
3. You should see the new "Opening Balance" section
4. Try creating an account with an opening balance

---

## ✅ Verification Checklist

- [ ] Migration applied successfully
- [ ] No database errors
- [ ] Application restarted
- [ ] Opening Balance section appears in Create Account dialog
- [ ] Can create account with opening balance
- [ ] Journal entry is created automatically
- [ ] Account 3900 - Opening Balance Equity is created
- [ ] Balance shows correctly in Chart of Accounts
- [ ] Can view opening balance journal entry

---

## 🔧 Troubleshooting

### Problem: Migration fails with "column already exists"

**Solution:** The column already exists. Skip the migration or run:
```sql
ALTER TABLE public.accounts 
DROP COLUMN IF EXISTS opening_balance,
DROP COLUMN IF EXISTS opening_balance_date,
DROP COLUMN IF EXISTS opening_balance_recorded,
DROP COLUMN IF EXISTS opening_balance_entry_id;
```
Then rerun the migration.

### Problem: TypeScript errors about opening_balance

**Solution:** The types file wasn't updated. Manually update `src/integrations/supabase/types.ts`:

```typescript
accounts: {
  Row: {
    // ... existing fields ...
    opening_balance: number
    opening_balance_date: string | null
    opening_balance_recorded: boolean
    opening_balance_entry_id: string | null
  }
}
```

### Problem: "Opening Balance Equity" account not created

**Solution:** It's created automatically on first use. If it's missing, manually create it:
```sql
INSERT INTO public.accounts (user_id, name, code, account_type, is_active)
VALUES ('[your-user-id]', 'Opening Balance Equity', '3900', 'equity', true);
```

### Problem: Journal entry not created when account is created

**Solution:** Check browser console for errors. The account is still created, you can manually create the journal entry:

1. Go to **Accounting → Journal Entries**
2. Click **"New Entry"**
3. Create entry with:
   - Description: "Opening Balance - [Account Name]"
   - Reference: "Opening Balance"
   - Lines:
     - DEBIT: Your account (if asset) or 3900 (if liability)
     - CREDIT: 3900 (if asset) or your account (if liability)

---

## 🔄 Rollback (if needed)

If you need to remove the feature:

### Step 1: Remove columns

```sql
ALTER TABLE public.accounts 
DROP COLUMN IF EXISTS opening_balance,
DROP COLUMN IF EXISTS opening_balance_date,
DROP COLUMN IF EXISTS opening_balance_recorded,
DROP COLUMN IF EXISTS opening_balance_entry_id;

DROP INDEX IF EXISTS idx_accounts_opening_balance_recorded;
```

### Step 2: Revert TypeScript types

Remove the opening balance fields from `src/integrations/supabase/types.ts`

### Step 3: Revert AccountsManager component

Use git to revert `src/components/accounting/AccountsManager.tsx` to previous version:

```bash
git checkout HEAD~1 -- src/components/accounting/AccountsManager.tsx
```

---

## 📚 Documentation

After installation, refer to:
- `OPENING_BALANCE_QUICK_START.md` - Quick start guide
- `OPENING_BALANCE_FEATURE.md` - Complete documentation
- `OPENING_BALANCE_SUMMARY.md` - Feature summary

---

## 🎉 You're Done!

The opening balance feature is now installed and ready to use. Start creating accounts with opening balances!

---

**Installation Status:** ✅ Complete
**Version:** 1.0
**Date:** 2024-01-21

