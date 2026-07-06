# Production Roadmap

This project is currently a stable MVP. The target is production-level hotel operations with CMS-managed public content, stronger reliability, analytics, and production security.

## Phase 1: Stability Foundation

- Add automated tests for pricing, availability, reservation status rules, auth/roles, and payment access.
- Add CI checks for install, Prisma generation, lint, tests, and build.
- Clean rough formatting and small code quality issues without broad refactors.
- Harden booking creation against concurrent overbooking.
- Add an audit log foundation for important admin actions.

## Phase 2: Production Auth And Security

- Add password reset.
- Add email verification.
- Add session invalidation or session versioning.
- Replace in-memory rate limiting with Redis-backed rate limiting.
- Apply rate limits to login, booking, lookup, contact, and payment endpoints.
- Add audit logging for admin changes.

## Phase 3: Real Notifications

- Integrate a production email provider.
- Add email templates for booking confirmation, payment confirmation, cancellation, inquiry received, admin inquiry alert, password reset, and email verification.
- Add notification logs and resend support.

## Phase 4: Real Payments

- Integrate a real payment provider, likely Stripe.
- Add payment sessions or payment intents.
- Add verified webhook handling.
- Store provider references and payment lifecycle events.
- Add admin payment and refund tools.

## Phase 5: Full CMS

- Add CMS models for hotel page content, SEO metadata, policies, contact text, and structured page sections.
- Add a media library with uploads, alt text, categories, and ordering.
- Add admin CMS screens for gallery, dining, amenities, hotel overview, room content, and public page sections.
- Make public hotel pages read from CMS data instead of hardcoded content.
- Use controlled structured sections before attempting any drag-and-drop builder.

## Phase 6: Admin Dashboard Upgrade

- Add overview stats for check-ins, check-outs, occupancy, revenue, pending payments, new inquiries, and recent bookings.
- Improve reservation workflows with filters, calendar/table views, room assignment, and quick status updates.
- Add guest profiles with booking history, total spend, and notes.
- Add payments, inquiries, staff, and audit dashboards.

## Phase 7: Analytics

- Add booking analytics by date range, room type, cancellation rate, average stay length, and booking lead time.
- Add revenue analytics by month, room type, payment status, and average booking value.
- Add occupancy analytics by date range and room type utilization.
- Add guest analytics for returning guests and lifetime value.
- Add inquiry analytics by status and type.

## Phase 8: Operations And Deployment

- Add error tracking.
- Add structured logging.
- Add database backup and restore plan.
- Separate local, staging, and production environments.
- Document deployment, migrations, environment variables, and admin bootstrap.
- Perform a security review before production launch.

## Current First Sprint

1. Add test script and first backend tests.
2. Add GitHub Actions CI.
3. Confirm lint, tests, and build pass.
4. Then continue with booking concurrency hardening.
