export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 100;

export const passwordRequirements = [
  {
    id: "length",
    label: `At least ${PASSWORD_MIN_LENGTH} characters`,
    test: (password: string) => password.length >= PASSWORD_MIN_LENGTH,
  },
  {
    id: "lowercase",
    label: "One lowercase letter",
    test: (password: string) => /[a-z]/.test(password),
  },
  {
    id: "uppercase",
    label: "One uppercase letter",
    test: (password: string) => /[A-Z]/.test(password),
  },
  {
    id: "number",
    label: "One number",
    test: (password: string) => /\d/.test(password),
  },
  {
    id: "symbol",
    label: "One symbol",
    test: (password: string) => /[^A-Za-z0-9\s]/.test(password),
  },
] as const;

export function getUnmetPasswordRequirements(password: string) {
  return passwordRequirements.filter((requirement) => !requirement.test(password));
}

export function meetsPasswordPolicy(password: string) {
  return (
    password.length <= PASSWORD_MAX_LENGTH &&
    getUnmetPasswordRequirements(password).length === 0
  );
}