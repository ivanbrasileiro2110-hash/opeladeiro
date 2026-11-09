# Respostas para "Segurança dos dados" (Google Play) e "Privacidade do app" (Apple)

O app coleta e vincula ao usuário (não vende nem usa para publicidade; não rastreia entre apps):

| Dado | Finalidade | Opcional |
|---|---|---|
| E-mail | Conta e login | Não |
| Nome, apelido, foto de perfil | Funcionamento (aparecer na pelada) | Foto: sim |
| Dados do jogo (presença, gols, notas, votos) | Funcionamento | Não |
| Identificador do aparelho para notificações (token push) | Notificações | Sim |
| Logs de erros (mensagem de erro, aparelho/navegador, sem dados pessoais) | Diagnóstico | Não |

Respostas Google Play:
- Compartilha dados com terceiros: Não (operadores como Supabase e Vercel não contam como compartilhamento).
- Dados criptografados em trânsito: Sim (HTTPS).
- Usuário pode pedir exclusão: Sim, no app (Perfil > Excluir minha conta) e por e-mail. Informar URL: https://opeladeiro.vercel.app/privacidade/
- Público: 13+ (não é direcionado a crianças).
- Anúncios: Não. Compras no app: Não nesta versão.

Respostas Apple (Nutrition Labels): Dados vinculados à identidade: Informações de contato (e-mail, nome), Conteúdo do usuário (foto), Identificadores (ID de usuário), Diagnósticos. Usados para: Funcionalidade do app. Rastreamento: Não.
