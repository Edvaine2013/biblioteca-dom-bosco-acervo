import { Alert, Platform } from "react-native";

/**
 * Diálogos multiplataforma.
 *
 * O `Alert` do react-native-web é um stub vazio (`static alert() {}`), então
 * qualquer `Alert.alert(...)` era silenciosamente ignorado no site publicado:
 * os botões de empréstimo e devolução nunca confirmavam a ação e as mensagens
 * de validação do cadastro não apareciam. Na web usamos os diálogos nativos do
 * navegador; no iOS/Android mantemos o Alert nativo.
 */
function isWeb() {
  return Platform.OS === "web";
}

function join(title: string, message?: string) {
  return [title, message].filter(Boolean).join("\n\n");
}

/** Mostra uma mensagem informativa. */
export function notify(title: string, message?: string) {
  if (isWeb()) {
    if (typeof window !== "undefined") window.alert(join(title, message));
    return;
  }
  Alert.alert(title, message);
}

/** Pede confirmação e executa a ação apenas se o usuário confirmar. */
export function confirm(title: string, message: string, onConfirm: () => void, confirmLabel = "Confirmar") {
  if (isWeb()) {
    if (typeof window !== "undefined" && window.confirm(join(title, message))) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: "Cancelar", style: "cancel" },
    { text: confirmLabel, onPress: onConfirm },
  ]);
}
