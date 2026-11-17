# Mewepak CMS

Headless content management system for the Mewepak packaging showcase website.

## Goals

- Preserve the existing WordPress site's visual design, URLs, media, booking flow, and 3D pouch preview.
- Manage the site through a standalone authenticated admin.
- Keep the current WordPress frontend outside this repository until its static/headless migration is ready.

## Planned modules

- Product categories with menu group, image, summary, visibility, and ordering.
- Products and their packaging specifications.
- Page content and SEO metadata.
- Consultation bookings.
- 3D model assets and preview settings.
- Media library and site-wide settings.

## Planned stack

- Static admin application deployed on Cloudflare Pages.
- Supabase Auth, Postgres, and Storage.
- Supabase Row Level Security for protected records.
- Public booking submissions routed through a Cloudflare Function.

The current WordPress theme and uploaded backup are the visual and content reference. The admin is developed separately so its implementation does not alter that frontend.
