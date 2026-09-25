import { Camera } from "expo-camera";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/screen-container";
import { useLibrary } from "@/lib/library-store";
import { notify } from "@/lib/dialogs";
import { BarcodeScanner } from "@/lib/barcode-scanner";
import { acquireCameraStream, getCameraPermissionState, releaseCameraStream, type CameraStream } from "@/lib/camera-stream";
import { decodeBarcodePhoto, pickBarcodePhoto } from "@/lib/barcode-photo";
import type { CameraErrorInfo } from "@/lib/camera-errors";
import { CATALOG_SOURCES, explainIsbnIssue, isValidIsbn, lookupBookByIsbn, readIsbn, toIsbn13, type CatalogBook } from "@/lib/catalog-lookup";

const green = "#163A2B";

export default function NewBookScreen() {
  const router = useRouter();
  const { addBook, hydrated } = useLibrary();
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [author, setAuthor] = useState("");
  const [publisher, setPublisher] = useState("");
  const [edition, setEdition] = useState("");
  const [pages, setPages] = useState("");
  const [language, setLanguage] = useState("");
  const [description, setDescription] = useState("");
  const [catalogSource, setCatalogSource] = useState("");
  const [category, setCategory] = useState("Literatura");
  const [year, setYear] = useState("");
  const [shelf, setShelf] = useState("");
  const [isbn, setIsbn] = useState("");
  const [coverUri, setCoverUri] = useState<string>();
  const [catalogMessage, setCatalogMessage] = useState("Leia o código de barras ou informe o ISBN manualmente.");
  const [isReading, setIsReading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerLocked, setScannerLocked] = useState(false);
  const [cameraStream, setCameraStream] = useState<CameraStream>(null);
  const [cameraIssue, setCameraIssue] = useState<CameraErrorInfo | null>(null);
  const [isDecodingPhoto, setIsDecodingPhoto] = useState(false);
  const streamRef = useRef<CameraStream>(null);

  // Se a permissão já estiver bloqueada, avisa antes de o usuário tentar:
  // o navegador não volta a perguntar e a falha pareceria um defeito.
  useEffect(() => {
    let active = true;
    void getCameraPermissionState().then((state) => {
      if (!active) return;
      if (state === "denied") {
        setCameraIssue({
          name: "NotAllowedError",
          title: "A câmera está bloqueada para este site",
          message:
            "O navegador registrou uma recusa e não volta a perguntar sozinho. Libere em Permissões › Câmera › Permitir e depois recarregue a página. Enquanto isso, use “Ler de uma foto” ou digite o ISBN.",
          permissionDenied: true,
          needsReload: true,
          canRetry: false,
        });
      }
    });
    return () => {
      active = false;
    };
  }, [showScanner]);

  /** Recarrega a página: é o único jeito de o Chrome reler a autorização. */
  const reloadForPermission = useCallback(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") window.location.reload();
  }, []);

  const closeScanner = useCallback(() => {
    setShowScanner(false);
    setCameraStream(null);
    // Libera a câmera (o `stop()` do ZXing cuida do caso web).
    releaseCameraStream(streamRef.current);
    streamRef.current = null;
  }, []);

  useEffect(() => () => releaseCameraStream(streamRef.current), []);

  async function openScanner() {
    if (Platform.OS !== "web") {
      const permission = await Camera.requestCameraPermissionsAsync();
      if (!permission.granted) {
        notify("Permissão necessária", "Autorize o acesso à câmera para ler o código de barras ISBN.");
        return;
      }
      setScannerLocked(false);
      setShowScanner(true);
      return;
    }

    // Na web o pedido da câmera precisa acontecer dentro deste clique: fora do
    // gesto do usuário o Safari nega a permissão sem nem exibir o aviso (era a
    // causa do erro "Permissão de câmera negada").
    const result = await acquireCameraStream();
    if (!result.ok) {
      setCameraIssue(result.issue);
      setCatalogMessage(result.issue.message);
      return;
    }
    streamRef.current = result.stream;
    setCameraIssue(null);
    setScannerLocked(false);
    setCameraStream(result.stream);
    setShowScanner(true);
  }

  /**
   * Lê o código de uma foto da etiqueta.
   *
   * Caminho alternativo para quando o navegador bloqueia a câmera ao vivo: aqui
   * quem tira a foto é o aplicativo de câmera do próprio celular, que já tem a
   * autorização de sistema, e o site apenas decodifica a imagem.
   */
  async function readFromPhoto() {
    if (isDecodingPhoto) return;
    setIsDecodingPhoto(true);
    setCatalogMessage("Abrindo a câmera do celular para a foto da etiqueta...");
    try {
      const file = await pickBarcodePhoto();
      if (!file) {
        setCatalogMessage("Nenhuma foto escolhida.");
        return;
      }
      setCatalogMessage("Lendo o código de barras da foto...");
      const reading = await decodeBarcodePhoto(file);
      if (!reading.ok) {
        setCatalogMessage(reading.message);
        return;
      }
      handleBarcodeScanned(reading.code);
    } catch {
      setCatalogMessage("Não foi possível processar a foto. Tente novamente.");
    } finally {
      setIsDecodingPhoto(false);
    }
  }

  function handleBarcodeScanned(data: string) {
    if (scannerLocked) return;
    // O scanner lê qualquer código de barras: é aqui que separamos o ISBN de
    // um código de loja, para não consultar os catálogos com o número errado.
    const reading = readIsbn(data);
    if (!reading.ok) {
      setCatalogMessage(reading.message);
      return;
    }
    setScannerLocked(true);
    closeScanner();
    setIsbn(reading.isbn);
    void fillFromCatalog(reading.isbn);
  }

  async function fillFromCatalog(value = isbn) {
    if (!isValidIsbn(value)) {
      setCatalogMessage("Digite um ISBN válido com 10 ou 13 dígitos.");
      return;
    }
    setIsReading(true);
    setCatalogMessage(
      `Consultando ${CATALOG_SOURCES.map((source) => source.label).join(", ")}...`,
    );
    try {
      const book = await lookupBookByIsbn(value);
      if (!book) {
        setCatalogMessage("ISBN não encontrado. Revise o número ou preencha os campos manualmente.");
        return;
      }
      applyCatalog(book);
      setCatalogMessage("Dados encontrados. Revise as informações antes de salvar.");
    } catch {
      setCatalogMessage("Os catálogos estão indisponíveis. Os campos continuam editáveis para cadastro manual.");
    } finally {
      setIsReading(false);
    }
  }

  function applyCatalog(book: CatalogBook) {
    if (book.isbn) setIsbn(book.isbn);
    if (book.title) setTitle(book.title);
    setSubtitle(book.subtitle ?? "");
    if (book.author) setAuthor(book.author);
    setPublisher(book.publisher ?? "");
    setEdition(book.edition ?? "");
    setPages(book.pages ? String(book.pages) : "");
    setLanguage(book.language ?? "");
    setDescription(book.description ?? "");
    setCatalogSource(book.catalogSource ?? "");
    if (book.category) setCategory(book.category);
    if (book.year) setYear(book.year);
    if (book.coverUri) setCoverUri(book.coverUri);
  }

  async function save() {
    if (!hydrated) {
      notify("Aguarde um instante", "O acervo ainda está carregando os registros salvos.");
      return;
    }
    if (!isValidIsbn(isbn)) {
      const explanation = explainIsbnIssue(isbn);
      notify(
        "ISBN inválido",
        explanation ||
          "Leia o código de barras ou informe um ISBN-10/ISBN-13 válido antes de salvar.",
      );
      return;
    }
    if (!title.trim() || !author.trim()) {
      notify("Complete o registro", "Informe pelo menos o título e o autor para salvar o livro.");
      return;
    }
    setIsSaving(true);
    try {
      await addBook({
        // Guardamos sempre o ISBN-13: é o formato atual e o que os catálogos
        // usam. Se o livro antigo trouxer ISBN-10, ele é convertido.
        isbn: toIsbn13(isbn) ?? isbn.trim(),
        title: title.trim(),
        subtitle: subtitle.trim() || undefined,
        author: author.trim(),
        publisher: publisher.trim() || undefined,
        edition: edition.trim() || undefined,
        pages: pages.trim() ? Number(pages.trim()) : undefined,
        language: language.trim() || undefined,
        description: description.trim() || undefined,
        catalogSource,
        category: category.trim() || "Sem categoria",
        year: year.trim() || "—",
        shelf: shelf.trim() || "A definir",
        coverUri,
      });
      setIsSaving(false);
      setIsSaved(true);
      setCatalogMessage("Livro salvo com sucesso no acervo.");
      setTimeout(() => router.replace("/(tabs)/acervo" as any), 1200);
    } catch {
      notify("Não foi possível salvar", "Verifique o armazenamento do dispositivo e tente novamente.");
      setIsSaving(false);
    }
  }

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} containerClassName="bg-[#F4F2EA]">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <View className="flex-row items-center justify-between mb-6">
            <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}><MaterialIcons name="arrow-back" size={24} color={green} /></Pressable>
            <Text className="text-lg font-bold text-[#163A2B]">Novo registro</Text>
            <View className="w-6" />
          </View>

          <View className="bg-[#163A2B] rounded-[28px] p-5 mb-6">
            <Text className="text-[#CFE6D7] text-xs font-bold tracking-widest">CATALOGAÇÃO POR ISBN</Text>
            <Text className="text-white text-2xl font-bold mt-2 leading-8">Registre usando o ISBN</Text>
            <Text className="text-[#CFE6D7] mt-2 leading-5">Leia o código de barras ou informe o número manualmente para buscar os dados do livro.</Text>
          </View>

          <View className="bg-[#E7EEE8] border-2 border-dashed border-[#A9B9AD] rounded-3xl p-5 mb-4 items-center">
            <View className="w-14 h-14 rounded-full bg-[#CFE6D7] items-center justify-center"><MaterialIcons name="qr-code-scanner" size={28} color={green} /></View>
            <Text className="text-[#163A2B] font-bold mt-3">Leitor de código de barras ISBN</Text>
            <Text className="text-[#6B7C70] text-xs mt-1 text-center">Use a câmera apenas para ler o código ISBN, sem incluir foto do livro.</Text>
            <Pressable onPress={openScanner} style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]} className="mt-4 w-full bg-[#D99A24] rounded-2xl py-3.5 flex-row items-center justify-center"><MaterialIcons name="qr-code-scanner" size={20} color={green} /><Text className="text-[#163A2B] font-bold ml-2">Ler código de barras</Text></Pressable>
            <Pressable disabled={isDecodingPhoto} onPress={readFromPhoto} style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]} className="mt-2 w-full bg-white border border-[#A9B9AD] rounded-2xl py-3.5 flex-row items-center justify-center"><MaterialIcons name={isDecodingPhoto ? "hourglass-top" : "photo-camera"} size={20} color={green} /><Text className="text-[#163A2B] font-bold ml-2">{isDecodingPhoto ? "Lendo a foto..." : "Ler de uma foto da etiqueta"}</Text></Pressable>
            {cameraIssue ? <View className="mt-3 bg-[#FFF4E5] border border-[#D99A24] rounded-2xl p-4"><Text className="text-[#8A5A00] text-xs font-bold mb-1">{cameraIssue.title}</Text><Text className="text-[#6B4A12] text-xs leading-5">{cameraIssue.message}</Text>{cameraIssue.needsReload ? <><Text className="text-[#6B4A12] text-xs leading-5 mt-2">Para liberar no Chrome (Android): toque no <Text className="font-bold">cadeado</Text> na barra de endereços › <Text className="font-bold">Permissões</Text> › <Text className="font-bold">Câmera</Text> › <Text className="font-bold">Permitir</Text> › <Text className="font-bold">Recarregar</Text>.</Text><Text className="text-[#6B4A12] text-xs leading-5 mt-2">Se o cadeado não resolver, o próprio sistema pode estar bloqueando: <Text className="font-bold">Ajustes</Text> › <Text className="font-bold">Apps</Text> › <Text className="font-bold">Gerenciar apps</Text> › <Text className="font-bold">Chrome</Text> › <Text className="font-bold">Permissões</Text> › <Text className="font-bold">Câmera</Text> › Permitir. No Xiaomi (MIUI), confira também <Text className="font-bold">Segurança</Text> › Permissões.</Text><Pressable onPress={reloadForPermission} className="mt-3 bg-[#D99A24] rounded-xl py-3 items-center"><Text className="text-[#163A2B] font-bold text-xs">Recarregar e abrir a câmera</Text></Pressable></> : null}{cameraIssue.canRetry ? <Pressable onPress={openScanner} className="mt-3 bg-[#D99A24] rounded-xl py-3 items-center"><Text className="text-[#163A2B] font-bold text-xs">Tentar novamente</Text></Pressable> : null}<Text className="text-[#6B4A12] text-xs leading-5 mt-3">Enquanto isso, toque em <Text className="font-bold">Ler de uma foto da etiqueta</Text> — funciona em qualquer navegador — ou digite o ISBN abaixo e toque em “Consultar”.</Text></View> : null}
          </View>

          <View className="bg-[#E4EDE4] rounded-2xl p-3 mb-5 flex-row items-center"><MaterialIcons name={isReading ? "hourglass-top" : "auto-awesome"} size={18} color="#315843" /><Text className="flex-1 text-[#315843] text-xs leading-5 ml-2">{catalogMessage}</Text></View>

          <View className="mb-4"><Text className="text-[#294B39] text-xs font-bold mb-2">ISBN</Text><View className="flex-row gap-2"><TextInput value={isbn} onChangeText={setIsbn} placeholder="Digite 10 ou 13 dígitos" placeholderTextColor="#91A197" keyboardType="number-pad" className="flex-1 bg-white border border-[#D7E0D8] rounded-2xl px-4 py-3.5 text-[#163A2B]" /><Pressable disabled={isReading} onPress={() => fillFromCatalog()} className="bg-[#D8EBD9] rounded-2xl px-4 items-center justify-center"><Text className="text-[#163A2B] font-bold text-xs">Consultar</Text></Pressable></View><Text className="text-[#6B7C70] text-xs mt-2">Cadastro manual: digite o ISBN e consulte para preencher os dados automaticamente.</Text><Text className="text-[#8A968D] text-[11px] mt-1 leading-4">Repositórios: {CATALOG_SOURCES.map((source) => `${source.label} (${source.origin})`).join(" · ")}</Text></View>

          <Field label="Título do livro" value={title} onChangeText={setTitle} placeholder="Ex.: O Pequeno Príncipe" />
          <Field label="Subtítulo (opcional)" value={subtitle} onChangeText={setSubtitle} placeholder="Ex.: edição comentada" />
          <Field label="Autor(a)" value={author} onChangeText={setAuthor} placeholder="Ex.: Antoine de Saint-Exupéry" />
          <Field label="Editora (opcional)" value={publisher} onChangeText={setPublisher} placeholder="Ex.: Companhia das Letras" />
          <View className="flex-row gap-3"><View className="flex-1"><Field label="Edição (opcional)" value={edition} onChangeText={setEdition} placeholder="Ex.: 2ª" /></View><View className="flex-1"><Field label="Páginas (opcional)" value={pages} onChangeText={setPages} placeholder="Ex.: 96" keyboardType="number-pad" /></View><View className="flex-1"><Field label="Idioma (opcional)" value={language} onChangeText={setLanguage} placeholder="Ex.: por" /></View></View>
          <View className="flex-row gap-3"><View className="flex-1"><Field label="Categoria" value={category} onChangeText={setCategory} placeholder="Literatura" /></View><View className="w-24"><Field label="Ano" value={year} onChangeText={setYear} placeholder="2026" keyboardType="number-pad" /></View></View>
          <Field label="Localização" value={shelf} onChangeText={setShelf} placeholder="Ex.: Estante A-01" />
          {description ? <View className="bg-white border border-[#D7E0D8] rounded-2xl p-4 mb-4"><Text className="text-[#294B39] text-xs font-bold mb-2">Sinopse {catalogSource ? `· ${catalogSource}` : ""}</Text><Text className="text-[#4E6357] text-sm leading-5">{description}</Text></View> : null}

          <View className="flex-row items-center gap-3 mt-4"><Pressable disabled={isSaving || isReading || !hydrated || isSaved} onPress={save} accessibilityLabel="Salvar livro no acervo" style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.97 : 1 }] }]} className={`flex-1 rounded-2xl py-4 border items-center flex-row justify-center shadow-lg ${isSaved ? "bg-[#2F7A4B] border-[#25643D]" : isSaving || isReading || !hydrated ? "bg-[#B8A77D] border-[#9C8A62]" : "bg-[#D99A24] border-[#B9780C]"}`}><MaterialIcons name={isSaved ? "check-circle" : "library-add"} size={20} color={isSaved ? "white" : green} /><Text className={`font-bold text-base ml-2 ${isSaved ? "text-white" : "text-[#163A2B]"}`}>{isSaved ? "Livro salvo" : isSaving ? "Salvando..." : "Salvar no acervo"}</Text>{isSaving && <ActivityIndicator color={green} size="small" className="ml-2" />}</Pressable>{isSaved && <View accessibilityLabel="Livro salvo com sucesso" className="w-14 h-14 rounded-2xl bg-[#2F7A4B] items-center justify-center border border-[#25643D]"><Text className="text-white text-3xl font-bold">✓</Text></View>}</View>
          <Text className="text-center text-[#6B7C70] text-xs mt-4 leading-5">O cadastro utiliza exclusivamente o ISBN e os dados retornados pelos catálogos selecionados.</Text>
        </ScrollView>
        <Modal visible={showScanner} animationType="slide" onRequestClose={closeScanner}>
          <View className="flex-1 bg-black">
            <BarcodeScanner stream={cameraStream} formats={["ean13", "ean8", "code128"]} active={!scannerLocked} onScanned={handleBarcodeScanned} onError={(reason) => setCatalogMessage(reason)} />
            <View className="absolute inset-0 items-center justify-between p-6" pointerEvents="box-none">
              <View className="w-full flex-row justify-between items-center">
                <Text className="text-white text-lg font-bold">Ler ISBN</Text>
                <Pressable onPress={closeScanner} className="bg-black/50 rounded-full px-4 py-2"><Text className="text-white font-bold">Fechar</Text></Pressable>
              </View>
              <View className="w-72 h-36 border-2 border-[#D99A24] rounded-2xl" pointerEvents="none" />
              <Text className="text-white text-center bg-black/60 rounded-xl px-4 py-3">Aponte para o código de barras ISBN na contracapa.</Text>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; keyboardType?: "number-pad" }) {
  return <View className="mb-4"><Text className="text-[#294B39] text-xs font-bold mb-2">{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#91A197" keyboardType={keyboardType} className="bg-white border border-[#D7E0D8] rounded-2xl px-4 py-3.5 text-[#163A2B]" /></View>;
}
