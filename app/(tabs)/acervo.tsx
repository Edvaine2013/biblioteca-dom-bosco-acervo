import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { getInitials, useLibrary, type Book } from "@/lib/library-store";

const green = "#163A2B";

export default function AcervoScreen() {
  const router = useRouter();
  const { books, borrowBook } = useLibrary();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"todos" | "disponiveis">("todos");
  const filtered = useMemo(() => books.filter((book) => `${book.title} ${book.author} ${book.category}`.toLowerCase().includes(query.toLowerCase()) && (filter === "todos" || book.available)), [books, filter, query]);

  function loan(book: Book) {
    Alert.alert("Registrar empréstimo", `Confirmar empréstimo de “${book.title}”?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Confirmar", onPress: () => borrowBook(book.id, "Leitor atual") },
    ]);
  }

  return (
    <ScreenContainer containerClassName="bg-[#F4F2EA]">
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 36 }}
        ListHeaderComponent={
          <View>
            <View className="flex-row items-start justify-between mb-5">
              <View><Text className="text-3xl font-bold text-[#163A2B]">Acervo</Text><Text className="text-[#6B7C70] mt-1">{books.length} livros catalogados</Text></View>
              <Pressable onPress={() => router.push("/novo-livro" as any)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]} className="w-11 h-11 rounded-2xl bg-[#163A2B] items-center justify-center"><MaterialIcons name="add" size={24} color="white" /></Pressable>
            </View>
            <View className="flex-row items-center bg-white rounded-2xl px-4 mb-4 border border-[#E0E5DF]"><MaterialIcons name="search" size={21} color="#7D8C82" /><TextInput value={query} onChangeText={setQuery} placeholder="Buscar por título ou autor" placeholderTextColor="#9AA69D" className="flex-1 py-3.5 px-3 text-[#163A2B]" /></View>
            <View className="flex-row gap-2 mb-5"><Chip label="Todos" active={filter === "todos"} onPress={() => setFilter("todos")} /><Chip label="Disponíveis" active={filter === "disponiveis"} onPress={() => setFilter("disponiveis")} /></View>
          </View>
        }
        renderItem={({ item }) => <BookCard book={item} onLoan={() => loan(item)} />}
        ListEmptyComponent={<View className="items-center py-16"><MaterialIcons name="menu-book" size={42} color="#A9B9AD" /><Text className="text-[#6B7C70] mt-3">Nenhum livro encontrado.</Text></View>}
      />
    </ScreenContainer>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]} className={`rounded-full px-4 py-2 ${active ? "bg-[#163A2B]" : "bg-[#E4EBE5]"}`}><Text className={`text-xs font-bold ${active ? "text-white" : "text-[#597061]"}`}>{label}</Text></Pressable>;
}

function BookCard({ book, onLoan }: { book: Book; onLoan: () => void }) {
  return <View className="bg-white rounded-3xl p-4 mb-3 border border-[#E2E7E1]"><View className="flex-row"><View className="w-16 h-20 rounded-2xl bg-[#D9E9DD] items-center justify-center mr-3"><Text className="text-[#163A2B] text-xl font-bold">{getInitials(book.title)}</Text></View><View className="flex-1"><Text className="text-[#163A2B] font-bold text-base" numberOfLines={2}>{book.title}</Text><Text className="text-[#6B7C70] text-sm mt-1" numberOfLines={1}>{book.author}</Text><Text className="text-[#91A197] text-xs mt-2">{book.category} · {book.shelf}</Text></View><View className={`h-2.5 w-2.5 rounded-full mt-1 ${book.available ? "bg-[#67A67B]" : "bg-[#D59B4C]"}`} /></View><View className="flex-row justify-between items-center mt-4 pt-3 border-t border-[#EEF1ED]"><Text className={`text-xs font-bold ${book.available ? "text-[#4A8B61]" : "text-[#B5792C]"}`}>{book.available ? "Disponível" : "Emprestado"}</Text>{book.available && <Pressable onPress={onLoan} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}><Text className="text-[#163A2B] text-xs font-bold">Registrar empréstimo →</Text></Pressable>}</View></View>;
}
