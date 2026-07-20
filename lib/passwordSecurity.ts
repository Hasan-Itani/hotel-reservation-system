import bcrypt from "bcryptjs";

export function isCurrentPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}