# MPC Decision Trainer

Browser-based leader-development tactical decision trainer for the Multi-Purpose Company (MPC).

## Production

- Vercel production deployment: https://mpc-decision-trainer.vercel.app/
- Production branch: `main`

The production URL should represent the last tested and approved version. New work should be developed on a feature branch and reviewed through a Vercel Preview Deployment before merging to `main`.

## Current Application

The trainer is currently a self-contained static web application in `index.html`. It includes:

- Formation-specific Tactical Decision Games for HQ, Scout, Mortar, Assault, and UAS leaders
- Easy, Medium, and Hard decision modes
- Persistent COP behavior and decision consequences
- AAR and scoring
- Local browser progress storage
- Progress import/export
- Reports & Requests training
- Call for Fire Trainer
- Built-in tester/system checks

## Development Workflow

1. Create a feature branch from `main`.
2. Make the proposed change without modifying unrelated training content.
3. Open a pull request.
4. Allow the GitHub quality workflow and Vercel Preview Deployment to complete.
5. Test the preview on desktop and mobile.
6. Resolve defects and tester feedback on the feature branch.
7. Merge only after the preview is accepted.
8. Verify the production Vercel deployment after merge.

Do not use production as the experimentation environment.

## Automated Quality Checks

Pull requests and pushes to `main` run the **TDM Quality** GitHub Actions workflow.

The workflow performs:

- Structural validation of required trainer screens, controls, core functions, progress persistence, and difficulty modes
- Playwright browser smoke tests in desktop Chromium
- Playwright browser smoke tests using a mobile Chromium profile
- A complete smoke path from dashboard through the first TDM decision and consequence
- Progress export verification

These tests are intentionally focused on application integrity. They do not judge the tactical correctness of scenario content.

## Run Tests Locally

Requires a current Node.js installation.

```bash
npm install
npx playwright install chromium
npm test
```

To run only structural validation:

```bash
npm run validate
```

To run only browser tests:

```bash
npm run test:e2e
```

Playwright starts the included local static server automatically.

## Repository Guardrails

This is a public repository. Keep the application limited to releasable leader-development and training content.

Do not commit credentials, access tokens, passwords, private server information, CUI, nonpublic operational information, or other sensitive material.

## Release Philosophy

Changes should be small, reviewable, and reversible. Infrastructure, UI, scenario content, analytics, PWA support, and larger architectural changes should normally be handled as separate pull requests so each change can be tested independently.
