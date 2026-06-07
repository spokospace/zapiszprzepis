# Decision: Job Queue Strategy for ZapiszPrzepis

**Status:** CRITICAL BLOCKER  
**Date:** 2026-06-07  
**Current State:** Recipe extraction not working on Cloudflare production

---

## Problem Statement

Current implementation uses **Trigger.dev** for background job processing (recipe extraction via Firecrawl + OpenAI), but:
- **Trigger.dev requires Node.js runtime**
- **Cloudflare Pages/Workers use Wasm/isolates (no Node.js)**
- Result: `extractRecipeTask.trigger()` silently fails — recipes never get extracted

This is an **architectural mismatch** discovered during production testing.

---

## Options Analysis

### **Option 1: Keep Trigger.dev (Deployment Change)**

**What:** Redeploy app to Vercel instead of Cloudflare

#### Pros:
- ✅ No code changes needed
- ✅ Trigger.dev has great DX + monitoring
- ✅ Already implemented, tested locally
- ✅ Better for complex multi-step workflows
- ✅ Good learning investment (reusable for future projects)

#### Cons:
- ❌ **Must abandon Cloudflare** (loses edge benefits, cost savings)
- ❌ Vercel is more expensive than Cloudflare
- ❌ Loses Cloudflare Workers ecosystem integration
- ❌ Migration effort: rebuild CI/CD, DNS, env vars
- ❌ Performance: Cloudflare Edge → Vercel US region (latency increase)
- ⚠️ Commitment to Node.js infrastructure (vs serverless-first)

**Implementation Time:** ~2 hours (reconfig + redeploy)

**Recommended for:** If you plan to keep app on traditional Node.js platform long-term

---

### **Option 2: Refactor to Inngest (Keep Cloudflare)**

**What:** Replace Trigger.dev SDK with Inngest, keep Cloudflare deployment

#### Pros:
- ✅ **Works perfectly on Cloudflare Pages** (native support)
- ✅ Serverless-first design (true FaaS)
- ✅ Fast implementation (45 min refactor)
- ✅ Simpler SDK for simple→medium tasks
- ✅ Better cost (free tier: 100k events/month)
- ✅ Keep all Cloudflare benefits (edge, DNS, bundle size)
- ✅ Recipe extraction is simple → Inngest is sufficient
- ✅ Can migrate to Trigger.dev later if needed

#### Cons:
- ❌ Code refactor needed (src/trigger/extract-recipe.ts → Inngest format)
- ❌ Different API/patterns (learning curve, but small)
- ❌ Less mature than Trigger.dev
- ❌ Fewer advanced workflow features (but you don't need them)
- ⚠️ Monitoring dashboard less polished than Trigger.dev

**Implementation Time:** ~45 minutes

**Recommended for:** Serverless-first approach, Cloudflare commitment, simple→medium jobs

---

### **Option 3: Remove Background Jobs (Quick Hack)**

**What:** Process recipes synchronously in server action instead of background job

#### Pros:
- ✅ Fastest to implement (~10 min)
- ✅ No external service needed
- ✅ Simpler debugging

#### Cons:
- ❌ **User must wait 30-60s for recipe extraction** (blocks form)
- ❌ Timeout risk if Firecrawl/OpenAI slow
- ❌ Bad UX (app freezes during processing)
- ❌ Violates Web Share Target specs (should redirect immediately)
- ❌ Kills PWA experience
- ❌ Not viable for production

**Not Recommended** — UX would be broken

---

## Decision Matrix

| Criteria | Trigger.dev (Vercel) | Inngest (Cloudflare) | Sync (None) |
|----------|---------------------|---------------------|------------|
| Works on Cloudflare | ❌ No | ✅ Yes | ✅ Yes* |
| Code changes needed | ❌ No | ⚠️ Moderate | ⚠️ Major |
| Implementation time | 2 hours | 45 min | 10 min |
| Cost | $$$ (Vercel) | $ (Free tier) | $ (Cloudflare) |
| Production ready | ✅ Yes | ✅ Yes | ❌ Bad UX |
| Scalability | ✅✅ Excellent | ✅ Good | ❌ Limited |
| Feature completeness | ✅✅ Rich | ✅ Sufficient | ❌ Missing |
| Cloud commitment | Node.js | Serverless | Serverless |

---

## Recommendation

### 🎯 **Use Option 2: Inngest + Cloudflare**

**Reasoning:**

1. **You chose Cloudflare** — good decision (fast, cheap, simple)
   - Inngest is designed for exactly this use case
   
2. **Recipe extraction is simple** — Inngest is sufficient
   - Fetch page → Extract with LLM → Save to DB
   - No complex workflows or multi-step dependencies
   - Trigger.dev would be overengineering

3. **Fast + Low Risk**
   - 45 min refactor (minimal changes)
   - Can always migrate to Trigger.dev later
   - Inngest API is straightforward

4. **Cost Efficiency**
   - Free tier: 100k events/month (enough for months of testing)
   - Cloudflare remains cheap
   - No commitment to expensive Vercel

5. **Architecture Clarity**
   - Trigger.dev = traditional job queue (Node.js)
   - Inngest = serverless-first (matches your stack)
   - Better long-term fit for Cloudflare

---

## Implementation Plan (Option 2)

### Phase 1: Setup Inngest (~10 min)
```bash
npm install inngest
# Create src/inngest/client.ts
# Create src/inngest/functions.ts
```

### Phase 2: Migrate extract-recipe (~20 min)
- Replace `extractRecipeTask` with Inngest function
- Update trigger call in `src/app/share/actions.ts`
- Keep Firecrawl + OpenAI logic unchanged

### Phase 3: Deploy + Test (~15 min)
- Commit + push to GitHub
- Cloudflare redeploys automatically
- Test on Pixel 9: share → verify recipe extraction works

### Timeline: ~45 minutes total

---

## Risk Assessment

### Option 1 (Trigger.dev + Vercel):
- **Risk:** High dependency change (platform switch)
- **Mitigation:** Can revert to Cloudflare if needed

### Option 2 (Inngest + Cloudflare):
- **Risk:** Low (isolated SDK change, no platform switch)
- **Mitigation:** Inngest well-documented, can roll back

### Option 3 (Sync):
- **Risk:** Product risk (broken UX)
- **Not viable**

---

## Timeline Comparison

| Option | Setup | Implementation | Testing | Total |
|--------|-------|-----------------|---------|-------|
| Trigger.dev + Vercel | 30 min | 90 min | 30 min | **~2.5 hours** |
| Inngest + Cloudflare | 10 min | 30 min | 15 min | **~45 min** |
| Sync (hack) | 0 min | 10 min | 5 min | **~15 min** (broken) |

---

## My Take (Why I Recommend Inngest)

1. **Principle of Least Change**
   - Keep Cloudflare (you chose it for good reasons)
   - Replace only job queue SDK (45 min)
   - vs redeploy entire app to Vercel (2.5 hours + ongoing costs)

2. **You Don't Need Trigger.dev's Power**
   - Trigger.dev excels at: multi-step workflows, complex dependencies, scheduling
   - Your case: fetch → extract → save (simple linear)
   - Inngest handles this perfectly, with less complexity

3. **Long-term Clarity**
   - Inngest keeps you serverless-first
   - Trigger.dev pulls you toward Node.js infrastructure
   - Future-you will appreciate simpler stack

4. **Speed to Production**
   - 45 min vs 2.5 hours
   - Recipe extraction still broken today; Inngest fix is tomorrow morning

---

## Decision

**→ Proceed with Option 2: Refactor to Inngest, stay on Cloudflare**

**Next Step:** Authorize refactor (~45 min), test on Pixel 9, verify recipes extract correctly.

---

---

## Use Cases in ZapiszPrzepis

### **S-01: Facebook Text Recipe Source** (Current - Broken)
```
Facebook text sharing → Firecrawl fetch + OpenAI extract → Save recipe
Duration: 30-60 seconds (async task)
```
- **Task**: `extract-recipe`
- **Trigger**: `POST /share` → Web Share Target
- **Status**: Broken (Trigger.dev doesn't work on Cloudflare)

### **S-02: Web Blog Recipe Source** (Phase 3 - Testing)
```
Web blog URL → Firecrawl (JS enabled) + OpenAI extract → Save recipe
Duration: 30-60 seconds (async task)
```
- **Task**: `extract-recipe` (same as S-01, reuse logic)
- **Trigger**: `POST /share` → Web Share Target
- **Status**: Not yet working (depends on S-01 fix)

### **S-04: YouTube Recipe Source** (Proposed - Future)
```
YouTube URL → yt-dlp audio extract → Whisper transcribe → OpenAI extract → Save recipe
Duration: 1-3 minutes (async task)
```
- **Task**: `youtube-recipe` (new task)
- **Trigger**: `POST /share` → Web Share Target
- **Status**: Planned for Phase 2

### **S-05: Category Browse** (Implemented - No Job Needed)
```
Filter recipes by category, display grid
Duration: <100ms (no async)
```
- **Task**: None required
- **Query**: Direct Supabase RLS query
- **Status**: Works without background job

---

## Job Queue Summary

**Total tasks needed:**
1. `extract-recipe` — S-01 + S-02 (reuse same logic)
2. `youtube-recipe` — S-04 (future)

**Frequency (per PRD target_scale: small):**
- ~50 recipes/month = 1-2 tasks/day
- Inngest free tier: 100k events/month ✅ (2000× headroom)

**Conclusion:** Inngest is perfectly sized. No overkill, just what's needed for three recipe sources.

---

## Appendix: What I Should Have Done

This blocker was preventable. I should have:

1. **Planning Phase**: Asked "Where are we deploying?" → identified Cloudflare
2. **Architecture Check**: "Does Trigger.dev work on Cloudflare?" → ❌ No
3. **Early Decision**: Chosen Inngest at S-01 planning, not discovered in production

**Lesson learned:** Always verify tech stack compatibility with deployment target **before implementation**, not after production test.
