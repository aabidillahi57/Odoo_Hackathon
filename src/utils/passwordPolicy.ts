export interface PasswordRule {
  id: string;
  label: string;
  met: boolean;
}

export function evaluatePasswordPolicy(password: string): {
  isValid: boolean;
  rules: PasswordRule[];
  errorMessage?: string;
} {
  const rules: PasswordRule[] = [
    {
      id: 'length',
      label: 'Longer than 8 characters (at least 9)',
      met: Boolean(password && password.length > 8),
    },
    {
      id: 'uppercase',
      label: 'At least one uppercase letter (A-Z)',
      met: Boolean(password && /[A-Z]/.test(password)),
    },
    {
      id: 'lowercase',
      label: 'At least one lowercase letter (a-z)',
      met: Boolean(password && /[a-z]/.test(password)),
    },
    {
      id: 'special',
      label: 'At least one special character (!@#$%^&* etc.)',
      met: Boolean(password && /[!@#$%^&*(),.?":{}|<>\-_+=\/\\~`[\]]/.test(password)),
    },
  ];

  const isValid = rules.every((r) => r.met);
  let errorMessage: string | undefined;

  if (!isValid) {
    const unmet = rules.filter((r) => !r.met).map((r) => r.label);
    errorMessage = `Password must satisfy: ${unmet.join(', ')}`;
  }

  return { isValid, rules, errorMessage };
}
