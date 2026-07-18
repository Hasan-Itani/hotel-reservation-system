# Hotel Reservation System

A full-stack hotel reservation system built with Next.js App Router, PostgreSQL, Prisma, and Tailwind CSS.

This project started as a stable MVP and is being upgraded toward a production-level hotel operations platform with guest booking, admin management, secure authentication, audit logging, notifications, CMS content, analytics, and deployment readiness.

## Status

In progress.

Current state:

- Stable MVP is complete.
- Guest booking flow is functional.
- Admin panel is functional.
- Authentication hardening is in progress.
- Build, lint, and tests pass locally.
- Roadmap is tracked in [PRODUCTION_ROADMAP.md](./PRODUCTION_ROADMAP.md).

## Tech Stack

- Next.js App Router
- React
- TypeScript
- PostgreSQL
- Prisma ORM
- Tailwind CSS
- Resend for transactional auth emails
- Jose for JWT sessions
- bcryptjs for password hashing
- Node test runner with `tsx`
- GitHub Actions CI

## Main Features

### Public Guest Experience

- Hotel listing pages
- Hotel detail pages
- Room listing pages
- Gallery, dining, amenities, location, and contact pages
- Public availability search
- Guest account registration
- Email verification
- Login/logout
- Password reset by email
- Booking creation for logged-in guests
- Guest booking dashboard
- Booking lookup fallback by reservation number and email
- Booking details and payment pages
- Contact inquiry form connected to backend

### Admin Panel

- Admin dashboard shell
- Room type management
- Room management
- Reservation management
- Guest list
- Staff management
- Payment management
- Inquiry management
- Audit log page

### Security And Reliability Work

- Password hashing
- JWT session cookies
- Guest email verification
- Password reset tokens
- Account lockout after failed login attempts
- Login limiting scoped by account/email
- Rate limiting on sensitive endpoints
- Reservation concurrency protection to reduce overbooking risk
- Audit logging for important admin and auth events
- Friendly public-facing error messages
- GitHub Actions CI
- Backend tests for reservation/pricing/concurrency helpers

## Important Routes

### Public

- `/`
- `/hotels`
- `/hotels/[slug]`
- `/hotels/[slug]/rooms`
- `/hotels/[slug]/gallery`
- `/hotels/[slug]/dining`
- `/hotels/[slug]/amenities`
- `/hotels/[slug]/location`
- `/hotels/[slug]/contact`
- `/hotels/[slug]/book`
- `/guest/register`
- `/guest/login`
- `/guest/account`
- `/guest/bookings`
- `/guest/forgot-password`
- `/guest/reset-password`
- `/guest/verify-email`
- `/bookings/lookup`
- `/bookings/[reservationNumber]`
- `/bookings/[reservationNumber]/pay`

### Admin

- `/admin`
- `/admin/room-types`
- `/admin/rooms`
- `/admin/reservations`
- `/admin/guests`
- `/admin/inquiries`
- `/admin/payments`
- `/admin/staff`
- `/admin/audit`

## Environment Variables

Create a local `.env` file. Do not commit it.

Required:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
JWT_SECRET="replace_this_with_a_long_random_secret"
```

Optional but needed for real auth emails:

```env
RESEND_API_KEY="your_resend_api_key"
EMAIL_FROM="Hotel System <onboarding@resend.dev>"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Email note:

- `onboarding@resend.dev` is only useful for limited Resend testing.
- Resend may only send to the Resend account email until a real sending domain is verified.
- For real production, use a verified domain and an address like `bookings@yourdomain.com`.

## Local Setup

Install dependencies:

```bash
npm install
```

Generate Prisma client:

```bash
npx prisma generate
```

Run migrations:

```bash
npx prisma migrate dev
```

Seed sample data when needed:

```bash
npm run seed
```

Run the development server:

```bash
npm run dev
```

Open:

```txt
http://localhost:3000
```

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm test
npm run seed
```

## Validation

Use these before pushing changes:

```bash
npm run build
npm run lint
npm test
```

## Current Limitations

- Payments are not a real online payment integration yet.
- Email is integrated for auth workflows only.
- Resend test sending is limited without a verified domain.
- Rate limiting is still in-memory and should be moved to Redis/Upstash before real production.
- CMS content management is not complete yet.
- Some public content/images are still static or placeholder-based.
- Observability still needs structured logs, error tracking, and operational monitoring.
- Deployment setup is not finished.

## Roadmap

Detailed phase tracking is in:

```txt
PRODUCTION_ROADMAP.md
```

Main upcoming work:

1. Add auth/security filters to the audit page.
2. Replace in-memory rate limiting with Redis/Upstash.
3. Add screenshots and demo media to this README.
4. Continue CMS and admin dashboard upgrades.
5. Prepare deployment and production environment documentation.

## Repository

```txt
https://github.com/Hasan-Itani/hotel-reservation-system
```
