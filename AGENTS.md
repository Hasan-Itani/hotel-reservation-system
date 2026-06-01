# Hotel Reservation System Agent Rules

## Project overview

This is a Next.js App Router hotel reservation system.

Tech stack:

- Next.js App Router
- PostgreSQL
- Prisma
- Tailwind CSS
- No `src` directory
- Backend-first system
- Public guest flow + admin panel

Repository:

- https://github.com/Hasan-Itani/hotel-reservation-system

## Current state

Stable MVP is done.

Completed:

- Option A cleanup/security polish
- Guest accounts
- Booking requires logged-in guest
- Guest bookings dashboard
- Booking details/payment URLs work without `guestEmail` for logged-in guests
- Public fallback lookup still works with reservation number + email
- Admin panel
- Admin Guests page
- Public luxury design pass
- Homepage with separate local video hero section
- Public hotel pages:
  - `/hotels/[slug]`
  - `/hotels/[slug]/rooms`
  - `/hotels/[slug]/gallery`
  - `/hotels/[slug]/dining`
  - `/hotels/[slug]/amenities`
  - `/hotels/[slug]/location`
  - `/hotels/[slug]/contact`
- Hotel subnav:
  - Overview
  - Rooms
  - Gallery
  - Dining
  - Amenities
  - Location
  - Contact
  - Book now
- Hotel subnav mobile active item auto-scroll is fixed
- Gallery sliders with autoplay and transitions
- Dining page with centered active carousel
- Public contact form connected to backend
- `HotelInquiry` model added
- `/admin/inquiries` page added
- Admin can view inquiries, add admin notes, and mark:
  - NEW
  - READ
  - REPLIED
  - ARCHIVED
- Metadata added for public hotel pages
- Build is passing

## Deferred items

Do not work on these unless explicitly asked:

- Real email notifications
- Exact latitude/longitude map pins
- Replacing remote placeholder images with local `/public/images/...`
- React Doctor cleanup
- Large admin redesign
- Full CMS/admin editing for gallery/dining/amenities content

## Main commands

Use this command after code changes:

```bash
npm run build
```

Use Prisma commands only when schema changes:

```bash
npx prisma migrate dev --name <migration_name>
npx prisma generate
```

## Critical rules

- Do not touch `.env`.
- Do not commit `.env`.
- Do not rewrite large unrelated files.
- Do not refactor randomly.
- Do not change package versions unless explicitly asked.
- Do not delete files because they look unused unless confirmed by imports/routes/build.
- Do not generate a zip unless explicitly asked.
- Work step by step.
- Before editing, inspect the relevant files first.
- Explain the plan before coding.
- Change only the files required for the current task.
- After every change, run `npm run build`.
- If build fails, fix the build before continuing.
- Keep commits small and named clearly.

## Public UI style

Public pages should use the luxury design system:

- `bg-luxury-cream`
- `text-luxury-ink`
- `border-luxury-stone`
- `bg-luxury-navy`
- `text-luxury-gold`
- `rounded-[2rem]`
- `luxury-container`

Public pages should usually use this shell:

```tsx
<div className="flex min-h-screen flex-col bg-luxury-cream text-luxury-ink">
  <PublicHeader />
  <main className="flex-1">...</main>
  <PublicFooter />
</div>
```

Avoid old public MVP styles like:

- `bg-background`
- `bg-primary`
- `text-primary`
- old blue buttons
- footer gaps on short pages

## Admin UI style

Admin pages should stay clean and functional.

Use existing components unless the task says otherwise:

- `Card`
- `CardHeader`
- `CardContent`
- `Badge`
- `Button`

Admin does not need the full luxury public style.

## Routing notes

Important public routes:

- `/`
- `/hotels`
- `/hotels/[slug]`
- `/hotels/[slug]/rooms`
- `/hotels/[slug]/gallery`
- `/hotels/[slug]/dining`
- `/hotels/[slug]/amenities`
- `/hotels/[slug]/location`
- `/hotels/[slug]/contact`
- `/guest/login`
- `/guest/register`
- `/guest/account`
- `/guest/bookings`
- `/bookings/lookup`
- `/bookings/[reservationNumber]`
- `/bookings/[reservationNumber]/pay`

Important admin routes:

- `/admin`
- `/admin/guests`
- `/admin/inquiries`

## Contact inquiry rules

Public contact form:

- Does not require login
- Saves messages to `HotelInquiry`
- Does not send real email yet

Admin inquiries:

- Require staff/admin access
- Show messages in `/admin/inquiries`
- Allow internal admin note
- Allow statuses:
  - NEW
  - READ
  - REPLIED
  - ARCHIVED

Status meanings:

- NEW: message needs attention
- READ: staff saw it but has not replied
- REPLIED: staff replied manually by email/phone/WhatsApp
- ARCHIVED: finished, duplicate, spam, or no longer active

## Location rules

Current location page uses saved hotel address and Google Maps search/embed.

Do not add latitude/longitude unless explicitly asked.

## Image rules

Some static placeholder images may still use remote URLs.

Do not use random Google Images because of copyright issues.

Later replacement should use:

```txt
public/images/dining/
public/images/amenities/
public/images/gallery/
public/images/hotels/
public/images/rooms/
```

or real upload storage.

## Workflow for every task

1. Run `git status`.
2. Inspect relevant files.
3. Do not edit yet.
4. Give a short plan.
5. Wait for approval if the task is broad or risky.
6. Edit only required files.
7. Run `npm run build`.
8. If build fails, fix it before doing anything else.
9. Summarize changed files.
10. Commit only after build passes.

## Expected Codex response format

For each task, respond with:

- Files inspected
- Plan
- Files changed
- Build result
- Any follow-up needed

## User preference

The user wants direct, step-by-step work.

Do not over-explain.
Do not make the user feel a wrong step was correct.
If something is wrong, say it clearly.
