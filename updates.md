# Vercel migration notes

This repository contains the NADI dashboard source that currently runs on the Cloudflare/Vinext runtime.

## Important before deploying to Vercel

The app currently uses Cloudflare D1 and Sites authentication. The source includes imports from `cloudflare:workers`, D1 bindings, and repository bridge endpoints. Copying the files into a Git repository is complete, but a Vercel deployment needs a backend migration first.

That migration must choose replacements for:

- Cloudflare D1 (for example, Vercel Postgres, Neon, or Supabase)
- Sites/ChatGPT authentication (for example, the company SSO or another supported auth provider)
- Any scheduled bridge process that reads Plastic repositories locally

Do not put repository access keys or other secrets in Git. Configure them as Vercel environment variables after the backend migration.

The `.openai/hosting.json` file from the ChatGPT Site was intentionally not copied because it points to the old Sites deployment. The existing live Site and its stored repository connections are unchanged.
