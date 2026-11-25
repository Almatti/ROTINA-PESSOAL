import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Política de Privacidade" };

export default function Privacy() {
  return (
    <LegalPage title="Política de Privacidade" updated="25/11/2026">
      <p>Esta política explica como o aplicativo <strong>Vilma — Minha Vida</strong> trata seus dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD). <em>Antes de publicar, o responsável pelo app deve completar os dados do controlador e do encarregado (DPO) indicados abaixo.</em></p>
      <h2>1. Controlador e contato</h2>
      <p>Controlador: [nome/razão social e CNPJ/CPF do responsável]. Encarregado (DPO): [nome e e-mail de contato]. Solicitações sobre dados podem ser feitas pelo e-mail do encarregado ou diretamente no app, em Configurações › Privacidade.</p>
      <h2>2. Dados que tratamos</h2>
      <ul>
        <li><strong>Cadastro:</strong> nome, apelido, e-mail, foto de perfil (opcional).</li>
        <li><strong>Conteúdo que você registra:</strong> tarefas, compromissos, hábitos, anotações, metas, estudos, treinos, casa e finanças.</li>
        <li><strong>Dados sensíveis de saúde (art. 11):</strong> sono, humor/diário e, somente se você ativar o módulo, ciclo menstrual e sintomas.</li>
        <li><strong>Integrações:</strong> se você conectar o Google Agenda, tokens de acesso (armazenados criptografados) e os eventos sincronizados.</li>
        <li><strong>Técnicos:</strong> registros de acesso necessários à segurança (art. 15 do Marco Civil da Internet).</li>
      </ul>
      <h2>3. Finalidades e bases legais</h2>
      <ul>
        <li>Prestar o serviço de organização pessoal — execução de contrato (art. 7º, V).</li>
        <li>Dados de saúde e do ciclo menstrual — consentimento específico e destacado (art. 11, I), que pode ser revogado a qualquer momento.</li>
        <li>Assistente de IA — consentimento: enviamos ao provedor de IA apenas o necessário para responder ao seu pedido.</li>
        <li>Segurança e prevenção a fraudes — legítimo interesse e obrigação legal.</li>
      </ul>
      <h2>4. Inteligência artificial</h2>
      <p>A assistente Vilma usa a API da Anthropic (Claude). Quando você conversa com ela, enviamos sua mensagem e um resumo mínimo do contexto necessário (por exemplo, compromissos do período consultado). <strong>Dados do ciclo menstrual e textos do diário não são enviados à IA.</strong> Conforme os termos comerciais da Anthropic, dados enviados pela API não são usados para treinar modelos. Não usamos seus dados para treinar modelos próprios.</p>
      <h2>5. Compartilhamento</h2>
      <p>Seus dados não são vendidos. Utilizamos operadores para hospedagem e banco de dados (Supabase), hospedagem web (Vercel), IA (Anthropic) e, se você autorizar, o Google Agenda. Esses serviços podem processar dados fora do Brasil, com salvaguardas contratuais (art. 33).</p>
      <h2>6. Segurança</h2>
      <p>Conexões criptografadas (HTTPS), isolamento por usuária no banco de dados (Row Level Security), tokens de integração criptografados, limitação de requisições e chaves privadas mantidas apenas no servidor.</p>
      <h2>7. Seus direitos (art. 18)</h2>
      <ul>
        <li>Confirmar e acessar seus dados — exporte tudo em JSON em Configurações › Privacidade.</li>
        <li>Corrigir dados — edite qualquer registro no app.</li>
        <li>Revogar consentimentos — desative a IA, o módulo de ciclo ou a integração com o Google a qualquer momento.</li>
        <li>Eliminar seus dados — exclua sua conta em Configurações › Privacidade; todos os registros são apagados.</li>
      </ul>
      <h2>8. Retenção</h2>
      <p>Mantemos seus dados enquanto sua conta estiver ativa. Ao excluir a conta, os dados são removidos do banco de dados de produção imediatamente; cópias de segurança expiram conforme o ciclo do provedor.</p>
      <h2>9. Crianças e adolescentes</h2>
      <p>O app não é destinado a menores de 13 anos.</p>
      <h2>10. Alterações</h2>
      <p>Avisaremos no app sobre mudanças relevantes nesta política.</p>
    </LegalPage>
  );
}
