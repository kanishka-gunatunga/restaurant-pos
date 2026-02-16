# Guide: Pull Main Branch Into Your Branch (Without Losing Your Work)

Your teammate pushed a **Branch table** and other changes to `main`. You need those changes in your `dev-nethmi` branch while keeping your user management work.

---

## The Strategy

```
main:     [A] --- [B] --- [C]  (Branch table, Category, etc.)
                   \
dev-nethmi:         [D] --- [E]  (Your user management work)
```

We will **merge main into dev-nethmi** so your branch gets:
- Branch model
- Category, Modification, Variation models
- All other main changes

...while keeping your:
- User, UserDetail, Customer models
- Auth middleware, customer routes
- Your updated UserController

---

## Step-by-Step Process

### Step 1: Save Your Current Work (Commit Everything)

**Never merge with uncommitted changes** - you could lose work or get into a messy state.

```bash
# See what's changed
git status

# Add all your files
git add .

# Commit with a clear message
git commit -m "feat: user management module - User, UserDetail, Customer, auth, passcode"
```

Now your work is safely saved in a commit.

---

### Step 2: Fetch the Latest from Remote

Get the latest `main` (and other branches) from GitHub/GitLab:

```bash
git fetch origin
```

This downloads updates but doesn't change your files yet.

---

### Step 3: Merge Main Into Your Branch

You're on `dev-nethmi`. Pull main's changes into it:

```bash
git merge origin/main
```

**What happens:**
- Git combines main's commits with yours
- If no conflicts → merge completes, you're done
- If conflicts → Git will tell you which files have conflicts

---

### Step 4: Resolve Conflicts (If Any)

If you see something like:
```
CONFLICT (content): Merge conflict in src/models/User.js
Automatic merge failed; fix conflicts and then commit the result.
```

**Don't panic.** Git is asking you to choose what to keep.

#### How to resolve:

1. Open the conflicted file. You'll see markers:
   ```
   <<<<<<< HEAD
   (your version - dev-nethmi)
   =======
   (their version - main)
   >>>>>>> origin/main
   ```

2. **Edit the file** to keep what you want:
   - For `User.js`: Keep YOUR version (admin, manager, cashier, passcode) - main has the old admin/staff
   - Remove the `<<<<<<<`, `=======`, `>>>>>>>` lines

3. Save the file.

4. Mark as resolved and continue:
   ```bash
   git add src/models/User.js
   git status   # Check if more conflicts
   git commit -m "merge: integrate main (Branch table) with user management"
   ```

#### Files that might conflict:
| File | What to do |
|------|------------|
| `src/models/User.js` | Keep YOUR version (your User has roles, passcode, status) |
| `src/app.js` | **Merge both** - keep main's associations (Branch, Category, etc.) AND add your routes (customerRoutes) and associations (User-UserDetail) |
| `src/routes/authRoutes.js` | Keep YOUR version (you have verify-passcode) |

---

### Step 5: Connect UserDetail to Branch Table

After the merge, you need to update `UserDetail` so `branchId` references the Branch table.

**In `src/models/UserDetail.js`** - add proper foreign key:

```javascript
branchId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    references: {
        model: 'branches',  // Branch table
        key: 'id',
    },
}
```

**In `src/models/associations.js`** (or wherever associations are defined) - add:

```javascript
const Branch = require('./Branch');

UserDetail.belongsTo(Branch, { foreignKey: 'branchId' });
Branch.hasMany(UserDetail, { foreignKey: 'branchId' });
```

**Note:** Main has associations in `app.js`. You have `associations.js`. After merge, you may need to consolidate - either add User/UserDetail/Branch associations to app.js, or ensure associations.js is loaded and add Branch there.

---

## Quick Reference Commands

```bash
# 1. Save your work
git add .
git commit -m "feat: user management module"

# 2. Get latest main
git fetch origin

# 3. Merge main into your branch
git merge origin/main

# 4. If conflicts - fix them, then:
git add .
git commit -m "merge: integrate main with user management"

# 5. Push your updated branch (when ready)
git push origin dev-nethmi
```

---

## If Something Goes Wrong

**"I want to undo the merge"** (before committing):
```bash
git merge --abort
```

**"I committed but want to undo"**:
```bash
git reset --hard HEAD~1
```
⚠️ This removes your last commit - only use if you haven't pushed.

**"I have too many conflicts, I'm stuck"**:
- Ask your senior for help
- Or: `git merge --abort`, then try again later with a fresh mind

---

## Summary

1. **Commit first** - always
2. **Fetch** - get latest from remote
3. **Merge** - `git merge origin/main`
4. **Resolve conflicts** - keep your user management, add their Branch/Category/etc.
5. **Update UserDetail** - link branchId to Branch table
6. **Test** - run the app, make sure everything works
