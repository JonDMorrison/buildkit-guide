

# Revised Setup Wizard -- Streamlined for Action

## The Problem Today

There are three overlapping onboarding surfaces:

1. **WelcomeWizard** (5 steps): Welcome, Role, Org creation, 3-phase OrgOnboardingWizard (financial config, operational diagnostics, AI calibration), Feature tour
2. **SetupWizardHub** (15 steps, 6 phases): Granular checklist covering everything from timezone to invoice permissions
3. **OrgOnboardingWizard** (3 phases): Structural config, operational diagnostics, AI calibration

This creates friction:
- Users answer 20+ questions before they ever see the app
- Many questions (tax model, rate source, invoice approver) aren't relevant until projects exist
- The AI Brain now handles much of what the diagnostic questions were designed to configure -- it can learn from usage instead of upfront interrogation
- The 15-step checklist overwhelms new users with items like "Review PPE" and "Set Up Hazard Library" before they even have a project

## The Core Insight

To get a project up and running, you only need **5 things**:

1. **Organization name** (already collected)
2. **Timezone** (affects all scheduling and time tracking)
3. **First project** (name, location, job type)
4. **First team member** (optional but high-value -- who's working with you?)
5. **AI preferences** (just the risk mode toggle -- strict/balanced/advisory)

Everything else (tax model, labor cost model, trades, safety config, drawings, invoice permissions) can be discovered progressively as users encounter those features, or prompted contextually by the AI Brain when it detects missing configuration.

## Proposed Architecture

### Merge into a single 2-stage flow

**Stage 1: Quick Start Wizard** (replaces WelcomeWizard + OrgOnboardingWizard)
- 4 screens, under 3 minutes total
- Runs once on first login

**Stage 2: Smart Checklist** (replaces SetupWizardHub)
- Contextual, not exhaustive
- Only shows relevant next steps based on what features the user is actually using
- AI Brain can prompt missing config inline (e.g., "You're tracking time but haven't set labor rates -- want to do that now?")

### Stage 1: Quick Start Wizard Screens

**Screen 1 -- Welcome + Role**
- Combine current steps 1 and 2
- Show logo, greeting, role selection in one screen
- Role determines which checklist items appear later

**Screen 2 -- Organization Setup**
- Company name (existing)
- Timezone (currently buried in the 15-step checklist as a separate modal)
- Province/Region (drives safety jurisdiction -- currently a separate setting)
- Remove: sample project toggle (confusing for real users, useful only for demos)

**Screen 3 -- First Project**
- Embed a simplified version of CreateProjectModal inline
- Only: Project name, Job site address, Job type
- Skip: billing address, client, job number, dates, playbook (all deferrable)
- Auto-create a job site from the address

**Screen 4 -- Your AI Assistant**
- Brief intro to the AI Brain
- Single choice: How should AI handle risky situations? (Strict / Balanced / Advisory)
- Remove: the 8 diagnostic questions (AI learns these from actual usage)
- Remove: individual AI feature toggles (default to sensible values)

### Stage 2: Smart Checklist (post-wizard)

Replace the current 15-step, 6-phase checklist with a **context-aware shortlist** that shows 3-5 items at a time based on what the user has done and what they're trying to do.

**Always-shown items** (until complete):
- Invite a team member
- Assign someone to your project

**Shown when user visits Time Tracking:**
- Enable time tracking
- Set labor rates

**Shown when user visits Safety:**
- Review PPE requirements
- Configure hazard library

**Shown when user visits Invoicing:**
- Set up invoice permissions
- Configure tax model

**Shown when user visits Financial pages:**
- Set labor cost rates
- Configure currency and tax model

This means the checklist is never more than 5 items long, and every item shown is relevant to what the user is currently doing.

### What Happens to Removed Config?

The operational profile questions (Phase 2 of OrgOnboardingWizard) don't disappear -- they move to a **Settings > Organization Profile** page where admins can fill them in anytime. The AI Brain reads from this profile but doesn't require it upfront. Missing values get sensible defaults.

## Technical Changes

### Files to modify:

| File | Change |
|------|--------|
| `src/components/onboarding/WelcomeWizard.tsx` | Rewrite to 4-screen Quick Start (Welcome+Role, Org+Timezone, First Project, AI Mode) |
| `src/components/onboarding/OrgOnboardingWizard.tsx` | Remove -- absorbed into WelcomeWizard screen 4 and Settings page |
| `src/components/setup/SetupWizardHub.tsx` | Rewrite to context-aware shortlist (3-5 items max) |
| `src/hooks/useSetupProgress.tsx` | Simplify step tracking -- fewer steps, add `context` field to know which page triggered display |
| `src/hooks/useOperationalProfile.ts` | Keep as-is -- still the backend store, just not populated upfront |
| `src/pages/Setup.tsx` | Update to render new streamlined wizard |

### New files:

| File | Purpose |
|------|---------|
| `src/components/setup/SmartChecklist.tsx` | Context-aware checklist that accepts a `context` prop (e.g., "time-tracking", "safety") and shows only relevant items |
| `src/components/setup/useSmartChecklist.ts` | Hook that computes which items to show based on current route + completion state |

### Database:

No schema changes needed. The existing `setup_checklist_progress` and `organization_operational_profile` tables continue to work. We just write fewer fields during the wizard and populate the rest progressively.

### What gets removed:

- The 3-phase OrgOnboardingWizard (8 diagnostic questions, 6 structural config options, 3 AI toggles) -- reduced to 1 question (AI risk mode)
- Feature tour screen (low value, users learn by doing)
- Sample project creation (remove edge function invocation from wizard)
- 10 of 15 checklist steps from the always-visible list

### What stays:

- Organization + membership creation logic
- Role selection (drives UI customization)
- Operational profile storage (populated later, not upfront)
- All the modal components (CreateProjectModal, InviteUserModal, etc.) -- reused in the smart checklist

## Summary

**Before:** 3 overlapping wizards, 20+ questions before seeing the app, 15-step checklist
**After:** 1 focused wizard (4 screens, ~3 min), smart checklist that shows 3-5 contextual items

The AI Brain handles the rest through progressive discovery.

