# Opeladeiro nativo (Android e iOS) com Capacitor

O app nativo é o mesmo site (`index.html`) dentro de um aplicativo. O ID é `app.opeladeiro`.

## Primeira vez (precisa de computador com Node 20+)
1. `npm install`
2. `npx cap add android` e, num Mac, `npx cap add ios`
3. `npm run cap:sync`
4. Android: `npm run cap:android` abre o Android Studio. Build > Generate Signed Bundle (.aab).
5. iOS: `npm run cap:ios` abre o Xcode. Product > Archive > enviar para a App Store Connect.

## Guardar para sempre (não subir no GitHub)
- Keystore de assinatura do Android e sua senha. Perdeu, perdeu a conta do app: use também o Play App Signing.
- Chaves do Firebase (`google-services.json`) e da Apple (APNs).

## Notificações nativas (depois das contas)
- Android: projeto no Firebase com o app `app.opeladeiro`, `google-services.json` em `android/app/`.
- iOS: capability Push Notifications no Xcode + chave APNs (.p8) enviada ao Firebase.
- No site e no app instalado pelo navegador as notificações já funcionam por Web Push (função `send-push`).
- Falta: no app nativo, registrar o token com `@capacitor/push-notifications` e enviar por FCM. Fica para a versão 1.1.

## Links obrigatórios nas lojas
- Política de privacidade: /privacidade/ · Termos: /termos/ · Exclusão de conta: Perfil > Excluir minha conta (dentro do app)
