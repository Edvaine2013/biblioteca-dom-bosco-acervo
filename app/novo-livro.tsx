import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Camera, CameraView, type BarcodeScanningResult } from "expo-camera";
import { MaterialIcons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/screen-container";
import { useLibrary } from "@/lib/library-store";
import { CATALOG_SOURCES, extractIsbn, isValidIsbn, lookupBookByIsbn, readIsbnFromImage, type CatalogBook } from "@/lib/catalog-lookup";
import { prepareBookImage, readBarcodeFromImage } from "@/lib/book-image";
import type { ImagePickerAsset } from "expo-image-picker";

const green = "#163A2B";
const mint = "#CFE6D7";

export default function NewBookScreen() {
  const router = useRouter();
  const { addBook, hydrated } = useLibrary();
  const [coverUri, setCoverUri] = useState<string>();
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [category, setCategory] = useState("Literatura");
  const [year, setYear] = useState("");
  const [shelf, setShelf] = useState("");
  const [isbn, setIsbn] = useState("");
  const [catalogMessage, setCatalogMessage] = useState("Fotografe a capa ou contracapa para tentar identificar o ISBN automaticamente.");
  const [isReading, setIsReading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerLocked, setScannerLocked] = useState(false);

  async function processImage(asset: ImagePickerAsset) {
    setShowPhotoOptions(false);
    setIsReading(true);
    setCatalogMessage("Preparando a foto para o acervo...");
    let persistentUri: string;
    try {
      persistentUri = await prepareBookImage(asset);
      setCoverUri(persistentUri);
    } catch {
      setCatalogMessage("Não foi possível preparar a foto. Tente novamente com outra imagem.");
      setIsReading(false);
      return;
    }
    if (Platform.OS !== "web") {
      setCatalogMessage("Foto adicionada. Informe o ISBN abaixo para preencher os dados automaticamente.");
      setIsReading(false);
      return;
    }
    setCatalogMessage("Procurando o código de barras ISBN...");
    try {
      const barcodeIsbn = await readBarcodeFromImage(asset.uri);
      const detectedIsbn = barcodeIsbn ?? await readIsbnFromImage(asset.uri, (progress) => {
        setCatalogMessage(`Lendo os números do ISBN... ${Math.round(progress * 100)}%`);
      });
      if (!detectedIsbn) {
        setCatalogMessage("Não encontrei um ISBN legível. Fotografe a contracapa inteira, sem reflexos, ou informe o número manualmente.");
        return;
      }
      setIsbn(detectedIsbn);
      await fillFromCatalog(detectedIsbn);
    } catch {
      setCatalogMessage("Não foi possível ler a imagem agora. Você ainda pode informar o ISBN manualmente.");
    } finally {
      setIsReading(false);
    }
  }

  async function pickFromLibrary() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: false, quality: 0.8, base64: Platform.OS !== "web" });
    if (!result.canceled) await processImage(result.assets[0]);
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permissão necessária", "Autorize o acesso à câmera para fotografar a capa ou contracapa do livro.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.8, base64: Platform.OS !== "web" });
    if (!result.canceled) await processImage(result.assets[0]);
  }

  function chooseCover() {
    setShowPhotoOptions((current) => !current);
  }

  async function openScanner() {
    if (Platform.OS !== "web") {
      const permission = await Camera.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permissão necessária", "Autorize o acesso à câmera para ler o código de barras ISBN.");
        return;
      }
    }
    setShowPhotoOptions(false);
    setScannerLocked(false);
    setShowScanner(true);
  }

  function handleBarcodeScanned({ data }: BarcodeScanningResult) {
    if (scannerLocked) return;
    const detectedIsbn = extractIsbn(data);
    if (!detectedIsbn) return;
    setScannerLocked(true);
    setShowScanner(false);
    setIsbn(detectedIsbn);
    void fillFromCatalog(detectedIsbn);
  }

  async function fillFromCatalog(value = isbn) {
    if (!isValidIsbn(value)) {
      setCatalogMessage("Digite um ISBN válido com 10 ou 13 dígitos.");
      return;
    }
    setCatalogMessage("Consultando o catálogo bibliográfico...");
    try {
      const book = await lookupBookByIsbn(value);
      if (!book) {
        setCatalogMessage("ISBN não encontrado nas fontes bibliográficas. Revise o número ou preencha os campos manualmente.");
        return;
      }
      applyCatalog(book);
      setCatalogMessage("Dados encontrados. Revise as informações antes de salvar no acervo.");
    } catch {
      setCatalogMessage("O catálogo está indisponível no momento. Os campos continuam editáveis para preenchimento manual.");
    }
  }

  function applyCatalog(book: CatalogBook) {
    if (book.isbn) setIsbn(book.isbn);
    if (book.title) setTitle(book.title);
    if (book.author) setAuthor(book.author);
    if (book.category) setCategory(book.category);
    if (book.year) setYear(book.year);
    if (!coverUri && book.coverUri) setCoverUri(book.coverUri);
  }

  async function save() {
    if (!hydrated) {
      Alert.alert("Aguarde um instante", "O acervo ainda está carregando os registros salvos.");
      return;
    }
    if (!title.trim() || !author.trim()) {
      Alert.alert("Complete o registro", "Informe pelo menos o título e o autor para salvar o livro.");
      return;
    }
    setIsSaving(true);
    try {
      await addBook({ title: title.trim(), author: author.trim(), category: category.trim() || "Sem categoria", year: year.trim() || "—", shelf: shelf.trim() || "A definir", coverUri });
      setIsSaving(false);
      setIsSaved(true);
      setCatalogMessage("Livro salvo com sucesso no acervo.");
      setTimeout(() => router.replace("/(tabs)/acervo" as any), 1200);
    } catch {
      Alert.alert("Não foi possível salvar", "Verifique o armazenamento do dispositivo e tente novamente.");
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
            <Text className="text-[#CFE6D7] text-xs font-bold tracking-widest">DIGITALIZAÇÃO DO ACERVO</Text>
            <Text className="text-white text-2xl font-bold mt-2 leading-8">Registre um livro em poucos passos</Text>
            <Text className="text-[#CFE6D7] mt-2 leading-5">Fotografe a capa ou contracapa, confira os dados reconhecidos e salve o registro.</Text>
          </View>

          <Pressable onPress={chooseCover} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]} className="mb-3">
            {coverUri ? <Image source={{ uri: coverUri }} className="w-full h-52 rounded-3xl" resizeMode="cover" /> : <View className="h-52 rounded-3xl border-2 border-dashed border-[#A9B9AD] bg-[#E7EEE8] items-center justify-center"><View className="w-14 h-14 rounded-full bg-[#CFE6D7] items-center justify-center"><MaterialIcons name="photo-camera" size={28} color={green} /></View><Text className="text-[#163A2B] font-bold mt-3">Adicionar foto da capa ou contracapa</Text><Text className="text-[#6B7C70] text-xs mt-1">A imagem será lida para localizar o ISBN</Text></View>}
          </Pressable>
          <Pressable onPress={openScanner} style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]} className="mb-3 bg-[#D99A24] rounded-2xl py-3.5 flex-row items-center justify-center"><MaterialIcons name="qr-code-scanner" size={20} color={green} /><Text className="text-[#163A2B] font-bold ml-2">Ler código de barras ISBN</Text></Pressable>
          {showPhotoOptions && <View className="flex-row gap-3 mb-5"><Pressable onPress={takePhoto} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]} className="flex-1 bg-[#163A2B] rounded-2xl py-3.5 flex-row items-center justify-center"><MaterialIcons name="photo-camera" size={18} color="white" /><Text className="text-white font-bold ml-2">Tirar foto</Text></Pressable><Pressable onPress={pickFromLibrary} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]} className="flex-1 bg-[#DDEBE0] rounded-2xl py-3.5 flex-row items-center justify-center"><MaterialIcons name="photo-library" size={18} color="#163A2B" /><Text className="text-[#163A2B] font-bold ml-2">Galeria</Text></Pressable></View>}
          <View className="bg-[#E4EDE4] rounded-2xl p-3 mb-5 flex-row items-center"><MaterialIcons name={isReading ? "hourglass-top" : "auto-awesome"} size={18} color="#315843" /><Text className="flex-1 text-[#315843] text-xs leading-5 ml-2">{catalogMessage}</Text></View>

          <View className="mb-4"><Text className="text-[#294B39] text-xs font-bold mb-2">ISBN</Text><View className="flex-row gap-2"><TextInput value={isbn} onChangeText={setIsbn} placeholder="Digite 10 ou 13 dígitos" placeholderTextColor="#91A197" keyboardType="number-pad" className="flex-1 bg-white border border-[#D7E0D8] rounded-2xl px-4 py-3.5 text-[#163A2B]" /><Pressable disabled={isReading} onPress={() => fillFromCatalog()} className="bg-[#D8EBD9] rounded-2xl px-4 items-center justify-center"><Text className="text-[#163A2B] font-bold text-xs">Consultar</Text></Pressable></View><Text className="text-[#6B7C70] text-xs mt-2">Use o leitor ou informe o ISBN manualmente para buscar título, autor, ano e capa.</Text><Text className="text-[#8A968D] text-[11px] mt-1">Fontes: {CATALOG_SOURCES.join(" · ")}</Text></View>

          <Field label="Título do livro" value={title} onChangeText={setTitle} placeholder="Ex.: O Pequeno Príncipe" />
          <Field label="Autor(a)" value={author} onChangeText={setAuthor} placeholder="Ex.: Antoine de Saint-Exupéry" />
          <View className="flex-row gap-3"><View className="flex-1"><Field label="Categoria" value={category} onChangeText={setCategory} placeholder="Literatura" /></View><View className="w-24"><Field label="Ano" value={year} onChangeText={setYear} placeholder="2026" keyboardType="number-pad" /></View></View>
          <Field label="Localização" value={shelf} onChangeText={setShelf} placeholder="Ex.: Estante A-01" />

          <View className="flex-row items-center gap-3 mt-4">
            <Pressable
              disabled={isSaving || isReading || !hydrated || isSaved}
              onPress={save}
              accessibilityLabel="Salvar livro no acervo"
              style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.97 : 1 }] }]}
              className={`flex-1 rounded-2xl py-4 border items-center flex-row justify-center shadow-lg ${isSaved ? "bg-[#2F7A4B] border-[#25643D]" : isSaving || isReading || !hydrated ? "bg-[#B8A77D] border-[#9C8A62]" : "bg-[#D99A24] border-[#B9780C]"}`}
            >
              <MaterialIcons name={isSaved ? "check-circle" : "library-add"} size={20} color={isSaved ? "white" : green} />
              <Text className={`font-bold text-base ml-2 ${isSaved ? "text-white" : "text-[#163A2B]"}`}>{isSaved ? "Livro salvo" : isSaving ? "Salvando..." : "Salvar no acervo"}</Text>
              {isSaving && <ActivityIndicator color={green} size="small" className="ml-2" />}
            </Pressable>
            {isSaved && <View accessibilityLabel="Livro salvo com sucesso" className="w-14 h-14 rounded-2xl bg-[#2F7A4B] items-center justify-center border border-[#25643D]"><Text className="text-white text-3xl font-bold">✓</Text></View>}
          </View>
          <Text className="text-center text-[#6B7C70] text-xs mt-4 leading-5">A foto e os dados catalogados ficam vinculados ao registro para facilitar a conferência física.</Text>
        </ScrollView>
        <Modal visible={showScanner} animationType="slide" onRequestClose={() => setShowScanner(false)}>
          <View className="flex-1 bg-black">
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "code128"] }}
              onBarcodeScanned={scannerLocked ? undefined : handleBarcodeScanned}
            >
              <View className="flex-1 items-center justify-between p-6">
                <View className="w-full flex-row justify-between items-center"><Text className="text-white text-lg font-bold">Ler ISBN</Text><Pressable onPress={() => setShowScanner(false)} className="bg-black/50 rounded-full px-4 py-2"><Text className="text-white font-bold">Fechar</Text></Pressable></View>
                <View className="w-72 h-36 border-2 border-[#D99A24] rounded-2xl" />
                <Text className="text-white text-center bg-black/60 rounded-xl px-4 py-3">Aponte para o código de barras ISBN na contracapa.</Text>
              </View>
            </CameraView>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; keyboardType?: "number-pad" }) {
  return <View className="mb-4"><Text className="text-[#294B39] text-xs font-bold mb-2">{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#91A197" keyboardType={keyboardType} className="bg-white border border-[#D7E0D8] rounded-2xl px-4 py-3.5 text-[#163A2B]" /></View>;
}
