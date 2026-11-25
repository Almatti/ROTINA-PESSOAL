import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Termos de Uso" };

export default function Terms() {
  return (
    <LegalPage title="Termos de Uso" updated="25/11/2026">
      <p>Ao usar a Vilma você concorda com estes termos. <em>O responsável pelo app deve revisá-los com assessoria jurídica antes da publicação.</em></p>
      <h2>1. O serviço</h2>
      <p>A Vilma é uma ferramenta de organização pessoal. Indicadores de sono, humor, ciclo e finanças são informativos e <strong>não constituem aconselhamento médico, psicológico ou financeiro</strong>.</p>
      <h2>2. Sua conta</h2>
      <p>Você é responsável por manter sua senha em sigilo e pelas informações que registra.</p>
      <h2>3. Assistente Vilma</h2>
      <p>A assistente pode cometer erros. Ações que excluem registros ou alteram vários itens exigem sua confirmação. Revise informações importantes.</p>
      <h2>4. Previsões do ciclo</h2>
      <p>São estimativas e não devem ser usadas como método contraceptivo.</p>
      <h2>5. Encerramento</h2>
      <p>Você pode excluir sua conta a qualquer momento nas configurações.</p>
    </LegalPage>
  );
}
