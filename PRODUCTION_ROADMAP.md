# Production Roadmap

This project is a stable MVP moving toward a production-level hotel reservation system. Use this file to track what is done, what is in progress, and what still needs work.

Legend:

- `[x]` Done
- `[~]` In progress / partially done
- `[ ]` Not started

## Current Status

- Stable MVP exists.
- GitHub is connected.
- Build, lint, and tests currently pass.
- Production hardening is in progress.
- Email sending works only for the Resend account email unless a real sending domain is verified.

## Phase 1: Stability Foundation

- [x] Add initial backend tests.
- [x] Add test script.
- [x] Add GitHub Actions CI.
- [x] Confirm local build passes.
- [x] Harden public booking creation against concurrent overbooking.
- [x] Add audit log foundation.
- [x] Add admin audit page.
- [x] Improve audit page wording so it is admin-friendly, not developer-only.
- [x] Expand audit coverage for rooms, room types, staff, reservations, payments, and inquiries.

## Phase 2: Production Auth And Security

- [x] Add password reset token model.
- [x] Add forgot password flow.
- [x] Add reset password flow.
- [x] Send password reset email through Resend.
- [x] Stop showing reset links on the page.
- [x] Add email verification token model.
- [x] Add guest email verification flow.
- [x] Block unverified guest login.
- [x] Prevent duplicate reset emails while an active reset token exists.
- [x] Prevent duplicate verification emails while an active verification token exists.
- [x] Invalidate auth tokens when email sending fails, so users are not trapped.
- [x] Add auth audit events:
  - `GUEST_REGISTERED`
  - `EMAIL_VERIFICATION_SENT`
  - `EMAIL_VERIFIED`
  - `PASSWORD_RESET_REQUESTED`
  - `PASSWORD_CHANGED`
  - `ACCOUNT_LOCKED`
- [x] Scope normal login rate limiting by account/email instead of blocking every login from the same IP.
- [~] Email provider is integrated, but testing is limited by Resend domain rules.
- [ ] Replace in-memory rate limiting with Redis/Upstash.
- [x] Add session versioning and invalidate existing sessions after password reset.
- [x] Add safer guest account unlock workflow for hotel admins, including clear lock expiration date and time.
- [ ] Add auth/security event filters in the audit UI.
- [ ] Add stronger password policy UI.

## Phase 3: Real Notifications

- [~] Resend integration exists for auth emails only.
- [x] Password reset email.
- [x] Email verification email.
- [ ] Booking confirmation email.
- [ ] Payment confirmation email.
- [ ] Cancellation email.
- [ ] Contact inquiry received email.
- [ ] Admin inquiry alert email.
- [ ] Notification log table.
- [ ] Admin resend notification action.
- [ ] Production sending domain verification.

## Phase 4: Real Payments

- [ ] Choose payment provider. Stripe is the likely default.
- [ ] Add payment sessions or payment intents.
- [ ] Add verified webhook handling.
- [ ] Store provider references.
- [ ] Store payment lifecycle events.
- [ ] Replace mock/card-on-arrival behavior for online payments.
- [ ] Add admin refund/payment correction tools.

## Phase 5: Full CMS

- [ ] Add CMS models for hotel overview content.
- [ ] Add CMS models for SEO metadata.
- [ ] Add CMS models for hotel policies.
- [ ] Add CMS models for contact page content.
- [ ] Add structured content sections.
- [ ] Add media library with uploads.
- [ ] Add image alt text, categories, ordering, and primary image support.
- [ ] Add admin CMS screens for:
  - Hotel overview
  - Rooms content
  - Gallery
  - Dining
  - Amenities
  - Location/contact content
- [ ] Make public hotel pages read from CMS data instead of hardcoded content.
- [ ] Keep CMS structured before considering drag-and-drop editing.

## Phase 6: Admin Dashboard Upgrade

- [ ] Add admin overview stats:
  - Today's check-ins
  - Today's check-outs
  - Occupancy
  - Revenue
  - Pending payments
  - New inquiries
  - Recent bookings
- [ ] Improve reservation filters.
- [ ] Add reservation calendar/table view.
- [ ] Add room assignment workflow.
- [ ] Add quick reservation status updates.
- [ ] Add richer guest profiles with booking history, total spend, and notes.
- [ ] Improve payments dashboard.
- [ ] Improve inquiries dashboard.
- [ ] Improve staff dashboard.
- [ ] Improve audit/security dashboard.

## Phase 7: Analytics

- [ ] Booking analytics by date range.
- [ ] Booking analytics by room type.
- [ ] Cancellation rate analytics.
- [ ] Average stay length.
- [ ] Booking lead time.
- [ ] Revenue by month.
- [ ] Revenue by room type.
- [ ] Revenue by payment status.
- [ ] Average booking value.
- [ ] Occupancy by date range.
- [ ] Room type utilization.
- [ ] Returning guest analytics.
- [ ] Guest lifetime value.
- [ ] Inquiry analytics by status and type.

## Phase 8: Operations And Deployment

- [~] Production README exists; screenshots still need to be added.
- [ ] Add deployment instructions.
- [ ] Add environment variable documentation.
- [ ] Document Prisma migration workflow.
- [ ] Document admin bootstrap workflow.
- [ ] Deploy to Vercel or another host.
- [ ] Use production PostgreSQL.
- [ ] Set up staging environment.
- [ ] Set up production environment.
- [ ] Add structured logging.
- [ ] Add error tracking.
- [ ] Add database backup and restore plan.
- [ ] Run security review before real launch.

## Phase 9: Portfolio And Hiring Readiness

- [~] GitHub repository exists.
- [x] Rewrite README from default Next.js text.
- [ ] Add screenshots or demo GIFs.
- [x] Add feature list.
- [x] Add architecture notes.
- [x] Add setup instructions.
- [x] Add known limitations section.
- [ ] Add live demo link after deployment.
- [ ] Update CV project section with this project.

## Next Recommended Work

1. Add auth/security event filters to the audit page.
2. Add Redis/Upstash-backed rate limiting.
3. Add stronger password policy UI.
4. Add screenshots to the README.
5. Continue toward CMS and admin dashboard stats.

## Testing Checklist After Auth Changes

- Register with the allowed Resend test email.
- Verify email.
- Login after verification.
- Request password reset.
- Reset password.
- Login with the new password.
- Try 5 wrong passwords for one account and confirm only that account is locked.
- Login with admin account after guest lockout and confirm it is not blocked.
- Check `/admin/audit` for auth events.
