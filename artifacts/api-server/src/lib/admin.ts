export function isAdminEmail(email: string): boolean {
  const configuredAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  return Boolean(
    configuredAdminEmail &&
      email.trim().toLowerCase() === configuredAdminEmail,
  );
}
