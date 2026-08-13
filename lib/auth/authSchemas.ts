import { z } from 'zod'
import { PASSWORD_MAX, PASSWORD_MIN, USERNAME_MAX, USERNAME_MIN } from './credentials'

export const LoginInputSchema = z.object({
  /** Username or email address. Resolution happens server-side. */
  identifier: z.string().trim().min(1, 'Enter your username or email.').max(255),
  password: z.string().min(1, 'Enter your password.').max(PASSWORD_MAX),
})
export type LoginInput = z.infer<typeof LoginInputSchema>

export const RegisterInputSchema = z.object({
  username: z
    .string()
    .trim()
    .min(USERNAME_MIN, `Usernames are ${USERNAME_MIN}-${USERNAME_MAX} characters.`)
    .max(USERNAME_MAX, `Usernames are ${USERNAME_MIN}-${USERNAME_MAX} characters.`)
    .regex(/^[a-z0-9][a-z0-9_-]*$/i, 'Use only letters, numbers, dashes, and underscores.'),
  email: z.string().trim().email('Enter a valid email address.').max(255),
  password: z
    .string()
    .min(PASSWORD_MIN, `Passwords must be at least ${PASSWORD_MIN} characters.`)
    .max(PASSWORD_MAX, `Passwords are limited to ${PASSWORD_MAX} characters.`),
})
export type RegisterInput = z.infer<typeof RegisterInputSchema>
