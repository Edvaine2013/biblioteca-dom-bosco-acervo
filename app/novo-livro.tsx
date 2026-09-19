import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/screen-container";
import { useLibrary } from "@/lib/library-store";

const green = "#163A2B";
const mint = "#CFE6D7";

export default function NewBookScreen() {
  const router = useRouter();
  const { addBook } = useLibrary();
  const [coverUri, setCoverUri] = useState<string>();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [category, setCategory] = useState("Literatura");
  const [year, setYear] = useState("");
  const [shelf, setShelf] = useState("");

  async function pickFromLibrary() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [3, 4], quality: 0.85 });
    if (!result.canceled) setCoverUri(result.assets[0].uri);
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permissão necessária", "Autorize o acesso à câmera para fotografar a capa do livro.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [3, 4], quality: 0.85 });
    if (!result.canceled) setCoverUri(result.assets[0].uri);
  }

  function chooseCover() {
    Alert.alert("Adicionar foto da capa", "Escolha como deseja registrar a imagem.", [
      { text: "Tirar foto", onPress: takePhoto },
      { text: "Escolher da galeria", onPress: pickFromLibrary },
      { text: "Cancelar", style: "cancel" },
    ]);
  }

  function save() {
    if (!title.trim() || !author.trim()) {
      Alert.alert("Complete o registro", "Informe pelo menos o título e o autor para salvar o livro.");
      return;
    }
    addBook({ title: title.trim(), author: author.trim(), category: category.trim() || "Sem categoria", year: year.trim() || "—", shelf: shelf.trim() || "A definir", coverUri });
    Alert.alert("Livro adicionado", "O registro já está disponível no acervo.", [{ text: "Ver acervo", onPress: () => router.replace("/(tabs)/acervo" as any) }]);
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
            <Text className="text-[#CFE6D7] mt-2 leading-5">Fotografe a capa e revise as informações antes de salvar.</Text>
          </View>

          <Pressable onPress={chooseCover} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]} className="mb-5">
            {coverUri ? <Image source={{ uri: coverUri }} className="w-full h-52 rounded-3xl" resizeMode="cover" /> : <View className="h-52 rounded-3xl border-2 border-dashed border-[#A9B9AD] bg-[#E7EEE8] items-center justify-center"><View className="w-14 h-14 rounded-full bg-[#CFE6D7] items-center justify-center"><MaterialIcons name="photo-camera" size={28} color={green} /></View><Text className="text-[#163A2B] font-bold mt-3">Adicionar foto da capa</Text><Text className="text-[#6B7C70] text-xs mt-1">Câmera ou galeria</Text></View>}
          </Pressable>
          {coverUri && <Text className="text-[#53705D] text-xs mb-4">Foto adicionada. Revise os dados abaixo antes de salvar.</Text>}

          <Field label="Título do livro" value={title} onChangeText={setTitle} placeholder="Ex.: O Pequeno Príncipe" />
          <Field label="Autor(a)" value={author} onChangeText={setAuthor} placeholder="Ex.: Antoine de Saint-Exupéry" />
          <View className="flex-row gap-3"><View className="flex-1"><Field label="Categoria" value={category} onChangeText={setCategory} placeholder="Literatura" /></View><View className="w-24"><Field label="Ano" value={year} onChangeText={setYear} placeholder="2026" keyboardType="number-pad" /></View></View>
          <Field label="Localização" value={shelf} onChangeText={setShelf} placeholder="Ex.: Estante A-01" />

          <Pressable onPress={save} style={({ pressed }) => [{ backgroundColor: green, transform: [{ scale: pressed ? 0.98 : 1 }] }]} className="rounded-2xl py-4 items-center mt-4"><Text className="text-white font-bold text-base">Salvar no acervo</Text></Pressable>
          <Text className="text-center text-[#6B7C70] text-xs mt-4 leading-5">A foto fica vinculada ao registro para facilitar a conferência física.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; keyboardType?: "number-pad" }) {
  return <View className="mb-4"><Text className="text-[#294B39] text-xs font-bold mb-2">{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#91A197" keyboardType={keyboardType} className="bg-white border border-[#D7E0D8] rounded-2xl px-4 py-3.5 text-[#163A2B]" /></View>;
}
