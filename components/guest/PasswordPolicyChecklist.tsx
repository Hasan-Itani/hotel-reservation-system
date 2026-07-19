import {
  PASSWORD_MAX_LENGTH,
  passwordRequirements,
} from "@/lib/passwordPolicy";

type PasswordPolicyChecklistProps = {
  password: string;
  confirmPassword?: string;
};

function RequirementStatus({
  isMet,
  label,
}: {
  isMet: boolean;
  label: string;
}) {
  return (
    <li
      className={`flex items-center gap-2 ${
        isMet ? "font-bold text-emerald-700" : "text-slate-600"
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-2.5 w-2.5 rounded-full border ${
          isMet
            ? "border-emerald-700 bg-emerald-700"
            : "border-slate-400 bg-transparent"
        }`}
      />
      <span className="sr-only">{isMet ? "Met: " : "Not met: "}</span>
      {label}
    </li>
  );
}

export function PasswordPolicyChecklist({
  password,
  confirmPassword,
}: PasswordPolicyChecklistProps) {
  const isTooLong = password.length > PASSWORD_MAX_LENGTH;
  const showConfirmation = confirmPassword !== undefined;
  const passwordsMatch = !!confirmPassword && password === confirmPassword;

  return (
    <div
      className="rounded-2xl border border-luxury-stone bg-luxury-cream px-4 py-3"
      aria-live="polite"
    >
      <p className="text-xs font-black uppercase tracking-[0.16em] text-luxury-ink">
        Password requirements
      </p>
      <ul className="mt-2 grid gap-1.5 text-sm sm:grid-cols-2">
        {passwordRequirements.map((requirement) => (
          <RequirementStatus
            key={requirement.id}
            isMet={requirement.test(password)}
            label={requirement.label}
          />
        ))}
        {showConfirmation ? (
          <RequirementStatus
            isMet={passwordsMatch}
            label="Passwords match"
          />
        ) : null}
        {isTooLong ? (
          <li className="font-bold text-danger sm:col-span-2">
            Password must not exceed {PASSWORD_MAX_LENGTH} characters
          </li>
        ) : null}
      </ul>
    </div>
  );
}