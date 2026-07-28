# ProjectPath

ProjectPath is a construction operations product designed to improve the flow of information from the jobsite to the office.

It is not intended to replace estimating, scheduling, or full construction-management platforms. Its focus is the execution loop that often breaks between daily activity, reporting, issues, ownership, action, and measurable follow-through.

## The problem

Construction companies frequently rely on group texts, spreadsheets, disconnected forms, and informal conversations to understand what is happening across active jobs. Important information may be recorded without becoming visible, assigned, resolved, or learned from.

ProjectPath is designed to help teams turn daily field information into structured action.

## Product focus

- Daily reporting discipline
- Field-to-office visibility
- Issue escalation
- Ownership and follow-through
- Lookahead coordination
- Safety workflows
- Job-performance awareness
- Mobile-first use for field teams

## Jon Morrison's role

Jon leads product strategy, customer discovery, workflow definition, positioning, feature prioritization, UX direction, testing, and AI-assisted implementation. He works with construction operators and technical collaborators to translate real field and leadership problems into a focused software product.

This repository reflects a product-led, AI-assisted development workflow. It should not be interpreted as a claim that one person manually authored every line of code.

## Current status

Active product development and early customer validation.

## Technology

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- Supabase
- Playwright for selected end-to-end testing

## Local development

```bash
npm install
npm run dev
```

## Testing

```bash
npx playwright install chromium
npm run test:e2e
```

## Product leadership context

ProjectPath demonstrates Jon's core product approach: begin with the work people are trying to complete, identify where the operating loop breaks, simplify the workflow, and guide the product from discovery through usable software.
