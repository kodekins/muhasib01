# 🚀 Opening Balance - Quick Start Guide

## What You Need to Know

You can now set **opening balances** when creating accounts! This is perfect for:
- Migrating from another system
- Setting up accounts with existing balances
- Starting with proper beginning balances

---

## How to Use (3 Easy Steps)

### 1️⃣ Apply the Database Migration

Run this command in your terminal:

```bash
npx supabase db push
```

Or if using Supabase CLI:

```bash
supabase db push
```

This adds the opening balance columns to your accounts table.

---

### 2️⃣ Create an Account with Opening Balance

1. Go to **Accounting → Accounts**
2. Click **"New Account"**
3. Fill in the account details:
   - Account Type (Asset, Liability, etc.)
   - Account Code (e.g., 1010)
   - Account Name (e.g., "Chase Checking")

4. **In the "Opening Balance" section:**
   - **Amount**: Enter the current balance (e.g., `10000` for $10,000)
   - **Date**: Select the date of this balance
   
5. Click **"Create Account"**

---

### 3️⃣ Done! ✨

The system automatically:
- ✅ Creates your account
- ✅ Creates a journal entry for the opening balance
- ✅ Uses "Opening Balance Equity" account (3900) for offsetting
- ✅ Shows the correct balance immediately

---

## Examples

### Example 1: Bank Account
```
Account: 1010 - Checking Account
Opening Balance: $10,000
Date: 2024-01-01

→ Creates journal entry:
   DEBIT:  1010 - Checking Account         $10,000
   CREDIT: 3900 - Opening Balance Equity   $10,000
```

### Example 2: Credit Card
```
Account: 2100 - Business Credit Card
Opening Balance: $2,500 (debt)
Date: 2024-01-01

→ Creates journal entry:
   DEBIT:  3900 - Opening Balance Equity   $2,500
   CREDIT: 2100 - Business Credit Card     $2,500
```

### Example 3: Equipment
```
Account: 1500 - Office Equipment
Opening Balance: $50,000
Date: 2024-01-01

→ Creates journal entry:
   DEBIT:  1500 - Office Equipment         $50,000
   CREDIT: 3900 - Opening Balance Equity   $50,000
```

---

## Important Notes

1. **All amounts are positive numbers**
   - For assets: enter positive (e.g., `10000`)
   - For liabilities: enter positive (e.g., `5000`)
   - System handles debit/credit automatically

2. **Opening Balance Equity (3900)**
   - Created automatically if doesn't exist
   - Used for offsetting all opening balances
   - Should net to zero when all accounts are set up

3. **Can't change after creation**
   - Once created, opening balance is in the journal
   - To correct: create an adjusting entry
   - Or void and recreate

4. **Optional field**
   - Leave blank if account has no opening balance
   - Can create accounts without opening balance
   - Works exactly as before

---

## Verify It's Working

### Check the Account Balance
1. Go to **Accounting → Accounts**
2. Find your account
3. Balance should show the opening balance

### View the Journal Entry
1. Click **"View Entries"** on the account
2. You'll see an entry with:
   - Reference: "Opening Balance"
   - Description: "Opening Balance - [Account Name]"
   - Correct debit/credit amounts

### Check Opening Balance Equity
1. Find account **3900 - Opening Balance Equity**
2. View its entries
3. Should show all opening balance journal entries
4. Total should equal zero when all accounts are set up

---

## When Opening Balance Equity Doesn't Equal Zero

This is normal! It happens when:
- You haven't entered all opening balances yet
- You're in the middle of setting up accounts

**It should net to zero when:**
```
Total Asset Opening Balances
- Total Liability Opening Balances
- Total Equity Opening Balances
= 0
```

If it doesn't equal zero after all setup:
- You're missing some account opening balances
- Or there's an accounting error in your starting numbers

---

## Common Questions

**Q: What date should I use?**
A: Usually your business start date or the date you're starting to use this system.

**Q: Do I need to enter opening balance for all accounts?**
A: Only accounts that have existing balances. New accounts can be created with zero balance.

**Q: What if I make a mistake?**
A: Create an adjusting journal entry, or delete the opening balance entry and recreate.

**Q: Can I skip this feature?**
A: Yes! It's completely optional. Leave the opening balance field blank.

---

## Need More Help?

See the complete documentation: `OPENING_BALANCE_FEATURE.md`

---

**Status:** ✅ Ready to use - No conflicts with existing features!

