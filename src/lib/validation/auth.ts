import { z } from "zod";

export const emailSchema = z.string().trim().min(1, "Informe seu e-mail.").email("E-mail inválido.");
export const passwordSchema = z
  .string()
  .min(8, "A senha precisa ter pelo menos 8 caracteres.")
  .regex(/[A-Za-z]/, "Inclua ao menos uma letra.")
  .regex(/\d/, "Inclua ao menos um número.");

export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, "Informe sua senha.") });

export const signupSchema = z
  .object({
    name: z.string().trim().min(2, "Como podemos te chamar?").max(120),
    email: emailSchema,
    password: passwordSchema,
    confirm: z.string(),
    privacy: z.literal(true, { message: "É preciso aceitar a Política de Privacidade." }),
  })
  .refine((d) => d.password === d.confirm, { message: "As senhas não coincidem.", path: ["confirm"] });

export const resetSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((d) => d.password === d.confirm, { message: "As senhas não coincidem.", path: ["confirm"] });

export function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const k = String(issue.path[0] ?? "form");
    if (!out[k]) out[k] = issue.message;
  }
  return out;
}

export function authErrorMessage(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return "E-mail ou senha incorretos.";
  if (/email not confirmed/i.test(msg)) return "Confirme seu e-mail pelo link que enviamos antes de entrar.";
  if (/already registered|already been registered/i.test(msg)) return "Já existe uma conta com este e-mail.";
  if (/rate limit|too many/i.test(msg)) return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
  if (/password/i.test(msg) && /weak|short/i.test(msg)) return "Senha muito fraca. Use ao menos 8 caracteres com letras e números.";
  if (/fetch|network/i.test(msg)) return "Sem conexão com o servidor. Verifique sua internet.";
  return "Não foi possível concluir. Tente novamente.";
}
